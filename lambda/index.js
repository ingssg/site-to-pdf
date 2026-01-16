/**
 * AWS Lambda 워커 함수
 * action 파라미터에 따라 크롤링 또는 PDF 생성을 수행
 *
 * 지원하는 action:
 * - 'crawl': 웹사이트 크롤링만 수행 (Step 1)
 * - 'generate-pdf': 선택된 페이지로 PDF 생성 (Step 3)
 */

const { WebCrawler } = require("./crawler");
const { generateAISummary, generatePageSummary } = require("./ai");
const { HTMLPDFGenerator } = require("./pdf");
const { createClient } = require("@supabase/supabase-js");
const { OpenAI } = require("openai");
const JSZip = require("jszip");
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { PDFDocument } = require("pdf-lib");
const { LambdaClient, InvokeCommand } = require("@aws-sdk/client-lambda");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const LOG_LEVEL = process.env.LOG_LEVEL || "info";
const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const CURRENT_LOG_LEVEL = LOG_LEVELS[LOG_LEVEL] ?? LOG_LEVELS.info;
const logDebug = (...args) => {
  if (CURRENT_LOG_LEVEL >= LOG_LEVELS.debug) {
    console.log(...args);
  }
};

const SELF_INVOKE_TIMEOUT_MS = Number(
  process.env.SELF_INVOKE_TIMEOUT_MS || 60000
);
const SELF_INVOKE_MAX_RETRIES = Number(
  process.env.SELF_INVOKE_MAX_RETRIES || 7
);
const SELF_INVOKE_BACKOFF_MS = Number(
  process.env.SELF_INVOKE_BACKOFF_MS || 5000
);
const SELF_INVOKE_RATE_LIMIT_BACKOFF_MS = Number(
  process.env.SELF_INVOKE_RATE_LIMIT_BACKOFF_MS || 15000
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function invokeLambdaSelf(lambdaUrl, payload) {
  const functionName =
    process.env.SELF_INVOKE_FUNCTION_NAME ||
    process.env.AWS_LAMBDA_FUNCTION_NAME;
  const canUseSdk = !!functionName && !!lambdaClient;
  for (let attempt = 1; attempt <= SELF_INVOKE_MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      SELF_INVOKE_TIMEOUT_MS
    );

    try {
      if (canUseSdk) {
        const command = new InvokeCommand({
          FunctionName: functionName,
          InvocationType: "Event",
          Payload: Buffer.from(JSON.stringify(payload)),
        });
        await lambdaClient.send(command);
      } else {
        const response = await fetch(lambdaUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const responseText = await response.text().catch(() => "");
        if (response.status === 400) {
          const isAlreadyFinalized =
            responseText.includes("already crawl_completed") ||
            responseText.includes("already failed") ||
            responseText.includes("requires pending or crawling status");
          if (isAlreadyFinalized) {
            return;
          }
        }
        if (response.status === 429) {
          const retryAfterHeader = response.headers.get("retry-after");
          const retryAfterSeconds = Number(retryAfterHeader);
          const retryAfterMs = Number.isFinite(retryAfterSeconds)
            ? retryAfterSeconds * 1000
            : SELF_INVOKE_RATE_LIMIT_BACKOFF_MS;
          const rateLimitError = new Error(
            `status=429 body=${responseText}`.trim()
          );
          rateLimitError.code = "RATE_LIMITED";
          rateLimitError.retryAfterMs = retryAfterMs;
          throw rateLimitError;
        }
        if (!response.ok) {
          throw new Error(`status=${response.status} body=${responseText}`);
        }
      }
      return;
    } catch (error) {
      if (
        canUseSdk &&
        (error?.name === "TooManyRequestsException" ||
          error?.name === "ThrottlingException")
      ) {
        const rateLimitError = new Error(error.message || "Rate limited");
        rateLimitError.code = "RATE_LIMITED";
        rateLimitError.retryAfterMs = SELF_INVOKE_RATE_LIMIT_BACKOFF_MS;
        error = rateLimitError;
      }
      const isLast = attempt === SELF_INVOKE_MAX_RETRIES;
      console.warn(
        `[Lambda] 다음 배치 재호출 실패 (attempt ${attempt}/${SELF_INVOKE_MAX_RETRIES}):`,
        error
      );
      if (isLast) {
        throw error;
      }
      const retryAfterMs =
        error?.retryAfterMs ?? SELF_INVOKE_BACKOFF_MS * attempt;
      await sleep(retryAfterMs);
    } finally {
      clearTimeout(timeout);
    }
  }
}

// 환경 변수
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME;
const S3_REGION =
  process.env.AWS_REGION || process.env.S3_REGION || "ap-northeast-2";
const S3_PUBLIC_BASE_URL = process.env.S3_PUBLIC_BASE_URL || null;
const S3_PRESIGNED_EXPIRES_SECONDS = Number(
  process.env.S3_PRESIGNED_EXPIRES_SECONDS || 604800
);

// 클라이언트 초기화 (지연 초기화 - handler에서 검증)
let supabase = null;
let openai = null;
let s3 = null;
let lambdaClient = null;

function initClients() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase 환경 변수가 설정되지 않았습니다. SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 확인하세요."
    );
  }

  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }

  if (!openai && OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  } else if (!OPENAI_API_KEY) {
    console.warn(
      "[Lambda] OPENAI_API_KEY가 설정되지 않았습니다. AI 기능이 작동하지 않을 수 있습니다."
    );
  }

  if (!s3) {
    s3 = new S3Client({ region: S3_REGION });
  }
  if (!lambdaClient) {
    lambdaClient = new LambdaClient({ region: S3_REGION });
  }
}

/**
 * 작업 상태 업데이트
 */
async function updateJobStatus(jobId, updates) {
  const { error } = await supabase
    .from("jobs")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    console.error("[Lambda] 작업 상태 업데이트 에러:", error);
    throw error;
  }
}

/**
 * 진행률 업데이트
 */
async function updateProgress(jobId, progress) {
  try {
    await updateJobStatus(jobId, {
      progress: {
        current: progress.current,
        total: progress.total,
        message: progress.message,
        percentage: progress.percentage,
      },
    });
    logDebug(
      `[Lambda][Progress] ${jobId} ${progress.message} (${progress.percentage}%)`
    );
  } catch (error) {
    console.error(`[Lambda] 진행률 업데이트 실패: ${jobId}`, error);
    // 진행률 업데이트 실패해도 계속 진행
  }
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function downloadFromStorage(filePath) {
  if (!S3_BUCKET_NAME) {
    throw new Error("S3_BUCKET_NAME이 설정되지 않았습니다.");
  }
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: filePath,
  });
  const response = await s3.send(command);
  if (!response.Body) {
    throw new Error(`S3 다운로드 실패: ${filePath}`);
  }
  return streamToBuffer(response.Body);
}

function getRemainingTimeMs(context) {
  if (!context || typeof context.getRemainingTimeInMillis !== "function") {
    return Number.POSITIVE_INFINITY;
  }
  return context.getRemainingTimeInMillis();
}

function shouldStopForTimeout(context, bufferMs) {
  return getRemainingTimeMs(context) < bufferMs;
}

/**
 * S3에 파일 업로드
 */
async function uploadToStorage(
  filePath,
  fileBuffer,
  contentType,
  downloadFilename = null
) {
  if (!S3_BUCKET_NAME) {
    throw new Error("S3_BUCKET_NAME이 설정되지 않았습니다.");
  }

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: filePath,
    Body: fileBuffer,
    ContentType: contentType,
  });

  try {
    await s3.send(command);
  } catch (error) {
    console.error("[Lambda] S3 업로드 에러:", error);
    throw error;
  }

  if (S3_PUBLIC_BASE_URL) {
    return `${S3_PUBLIC_BASE_URL.replace(/\/$/, "")}/${filePath}`;
  }

  const safeDownloadName =
    downloadFilename || filePath.split("/").pop() || "file";
  const signedCommand = new GetObjectCommand({
    Bucket: S3_BUCKET_NAME,
    Key: filePath,
    ResponseContentType: contentType,
    ResponseContentDisposition: `attachment; filename="${safeDownloadName}"`,
  });
  return getSignedUrl(s3, signedCommand, {
    expiresIn: S3_PRESIGNED_EXPIRES_SECONDS,
  });
}

function computeCrawlPlan(totalPages) {
  const baseBatch = 60;
  if (totalPages <= baseBatch) {
    return [totalPages];
  }
  if (totalPages <= baseBatch * 2) {
    const first = Math.ceil(totalPages / 2);
    return [first, totalPages - first];
  }
  if (totalPages <= baseBatch * 3) {
    const first = Math.ceil(totalPages * 0.4);
    const second = Math.ceil(totalPages * 0.4);
    const remaining = totalPages - first - second;
    return [first, second, remaining];
  }
  const plan = [];
  let remaining = totalPages;
  while (remaining > 0) {
    const batch = Math.min(baseBatch, remaining);
    plan.push(batch);
    remaining -= batch;
  }
  return plan;
}

/**
 * Step 1: 크롤링만 수행
 */
async function handleCrawl(job) {
  // 작업 상태를 'crawling'으로 업데이트
  await updateJobStatus(job.id, { status: "crawling" });

  const totalTargetPages = job.config.maxPages || 50;
  const existingPages = job.result?.crawlResult?.pages || [];
  const baseCount = existingPages.length;
  const crawlPlan = job.result?.crawlPlan || computeCrawlPlan(totalTargetPages);
  const batchIndex = job.result?.crawlBatchIndex || 0;
  const batchLimit = crawlPlan[batchIndex] || totalTargetPages;
  const remainingPages = Math.max(0, totalTargetPages - baseCount);
  const runMaxPages = Math.min(batchLimit, remainingPages);

  const initialUrl = job.config.url;
  try {
    const urlObj = new URL(initialUrl);
    const initialPath = urlObj.pathname || "/";
    await updateProgress(job.id, {
      current: baseCount,
      total: totalTargetPages,
      message: initialPath, // 입력한 URL의 경로만 표시
      percentage:
        totalTargetPages > 0
          ? Math.round((baseCount / totalTargetPages) * 100)
          : 0,
    });
  } catch (error) {
    // URL 파싱 실패 시 전체 URL 사용
    await updateProgress(job.id, {
      current: baseCount,
      total: totalTargetPages,
      message: initialUrl,
      percentage:
        totalTargetPages > 0
          ? Math.round((baseCount / totalTargetPages) * 100)
          : 0,
    });
  }

  // 크롤링 실행
  const crawlerConfig = {
    ...job.config,
    maxPages: runMaxPages,
  };
  const crawler = new WebCrawler(crawlerConfig, async (current, total, url) => {
    const overallCurrent = baseCount + current;
    await updateProgress(job.id, {
      current: overallCurrent,
      total: totalTargetPages,
      message: url, // Lambda 이전 버전과 동일: URL만 전달 (접두사 없음)
      percentage:
        totalTargetPages > 0
          ? Math.round((overallCurrent / totalTargetPages) * 100)
          : 0,
    });
  });

  let crawlResult;
  try {
    crawlResult = await crawler.crawl(job.result?.crawlState || null);
  } catch (error) {
    console.error("[Lambda] 크롤링 실행 실패:", error);
    const fallbackState = job.result?.crawlState || {
      queue: [],
      visitedUrls: [],
      skippedUrls: [],
    };
    crawlResult = {
      pages: [],
      totalPages: 0,
      crawlState: fallbackState,
    };
  }

  // 크롤링 결과 저장 (스크린샷은 Storage에 업로드하고 URL만 저장)
  const newPagesForStorage = await Promise.all(
    crawlResult.pages.map(async (page, index) => {
      let screenshotUrl = null;
      let fullPageScreenshotUrl = null;

      try {
        if (page.screenshot) {
          screenshotUrl = await uploadToStorage(
            `${job.id}/screenshots/viewport_${index + 1}.jpg`,
            page.screenshot,
            "image/jpeg"
          );
        }
      } catch (error) {
        console.warn("[Lambda] 스크린샷 업로드 실패:", error);
      }

      try {
        if (page.fullPageScreenshot) {
          fullPageScreenshotUrl = await uploadToStorage(
            `${job.id}/screenshots/full_${index + 1}.jpg`,
            page.fullPageScreenshot,
            "image/jpeg"
          );
        }
      } catch (error) {
        console.warn("[Lambda] 전체 스크린샷 업로드 실패:", error);
      }

      return {
        url: page.url,
        title: page.title,
        content: page.content || "",
        depth: page.depth,
        pageType: page.pageType,
        screenshotUrl,
        fullPageScreenshotUrl,
        timestamp: page.timestamp,
      };
    })
  );

  const mergedPages = [...existingPages, ...newPagesForStorage].reduce(
    (acc, page) => {
      if (!acc.map.has(page.url)) {
        acc.map.set(page.url, true);
        acc.list.push(page);
      }
      return acc;
    },
    { map: new Map(), list: [] }
  ).list;

  const remainingAfter = Math.max(0, totalTargetPages - mergedPages.length);
  const crawlState = crawlResult.crawlState || {};
  const shouldContinue =
    remainingAfter > 0 && crawlState.queue && crawlState.queue.length > 0;
  const nextBatchIndex = shouldContinue ? batchIndex + 1 : batchIndex;

  if (shouldContinue) {
    await updateJobStatus(job.id, {
      status: "crawling",
      result: {
        ...job.result,
        crawlPlan,
        crawlBatchIndex: nextBatchIndex,
        crawlState,
        crawlResult: {
          pages: mergedPages,
          totalPages: mergedPages.length,
          failedUrls: job.result?.crawlResult?.failedUrls || [],
        },
      },
    });

    const lambdaUrl = job.config?.lambdaUrl || process.env.LAMBDA_FUNCTION_URL;
    if (lambdaUrl) {
      try {
        await invokeLambdaSelf(lambdaUrl, { jobId: job.id, action: "crawl" });
      } catch (error) {
        const errorMessage = String(error?.message || "");
        const isRateLimited =
          error?.code === "RATE_LIMITED" ||
          errorMessage.includes("status=429") ||
          errorMessage.includes("ConcurrentInvocationLimitExceeded");
        const isAborted =
          error?.name === "AbortError" ||
          errorMessage.includes("AbortError") ||
          errorMessage.includes("This operation was aborted");
        const isHeadersTimeout = errorMessage.includes("HeadersTimeoutError");
        const isRetryable = isRateLimited || isAborted || isHeadersTimeout;
        console.error("[Lambda] 다음 배치 재호출 실패:", error);
        if (isRetryable) {
          await updateJobStatus(job.id, {
            status: "crawling",
            error: `Lambda self-invocation retryable: ${error.message}`,
          });
          return {
            statusCode: 202,
            body: JSON.stringify({
              success: true,
              jobId: job.id,
              action: "crawl",
              message: "Self-invocation retryable error. Will retry.",
            }),
          };
        }
        await updateJobStatus(job.id, {
          status: "failed",
          error: `Lambda self-invocation failed: ${error.message}`,
          completed_at: new Date().toISOString(),
        });
        return {
          statusCode: 500,
          body: JSON.stringify({
            success: false,
            jobId: job.id,
            action: "crawl",
            message: `Lambda self-invocation failed: ${error.message}`,
          }),
        };
      }
    } else {
      const errorMessage =
        "Lambda function URL is not configured for self-invocation.";
      console.error(`[Lambda] 다음 배치 재호출 실패: ${errorMessage}`);
      await updateJobStatus(job.id, {
        status: "failed",
        error: errorMessage,
        completed_at: new Date().toISOString(),
      });
      return {
        statusCode: 500,
        body: JSON.stringify({
          success: false,
          jobId: job.id,
          action: "crawl",
          message: errorMessage,
        }),
      };
    }

    return {
      statusCode: 202,
      body: JSON.stringify({
        success: true,
        jobId: job.id,
        action: "crawl",
        message: "Crawling batch completed. Continuing...",
        totalPages: mergedPages.length,
        remaining: remainingAfter,
      }),
    };
  }

  await updateJobStatus(job.id, {
    status: "crawl_completed",
    result: {
      ...job.result,
      crawlPlan,
      crawlBatchIndex: nextBatchIndex,
      crawlState,
      crawlResult: {
        pages: mergedPages,
        totalPages: mergedPages.length,
        failedUrls: job.result?.crawlResult?.failedUrls || [],
      },
    },
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      jobId: job.id,
      action: "crawl",
      message: "Crawling completed. Waiting for page selection.",
      totalPages: mergedPages.length,
    }),
  };
}

/**
 * Step 3: 선택된 페이지로 PDF 생성
 */
async function handleGeneratePDF(job, context) {
  logDebug(`[Lambda] generate-pdf 시작: ${job.id}`);
  logDebug(
    `[Lambda] 메모리 시작: ${Math.round(
      process.memoryUsage().rss / 1024 / 1024
    )}MB`
  );
  try {
    await updateProgress(job.id, {
      current: 0,
      total: 100,
      message: "페이지 데이터 처리 중...",
      percentage: 10,
    });
  } catch (error) {
    console.error(`[Lambda] 초기 진행률 업데이트 실패:`, error);
    // 진행률 업데이트 실패해도 계속 진행
  }

  // 선택된 페이지 정보 가져오기 (result.selectedPages에서 가져옴)
  const selectedPages = job.result?.selectedPages || [];
  const crawlResult = job.result?.crawlResult;

  if (!crawlResult || !crawlResult.pages) {
    throw new Error("크롤링 결과가 없습니다. 먼저 크롤링을 수행하세요.");
  }

  // 선택된 페이지만 필터링 (selectedPages가 비어있으면 모든 페이지 사용)
  let pagesToProcess = crawlResult.pages;
  if (selectedPages.length > 0) {
    pagesToProcess = crawlResult.pages.filter((page) =>
      selectedPages.includes(page.url)
    );
  }

  if (pagesToProcess.length === 0) {
    throw new Error("처리할 페이지가 없습니다.");
  }

  const pagesForPdf = pagesToProcess.map((page) => ({
    ...page,
    timestamp: page.timestamp ? new Date(page.timestamp) : new Date(),
  }));

  const pagesForAi = pagesForPdf.map(
    ({
      screenshot,
      fullPageScreenshot,
      screenshotUrl,
      fullPageScreenshotUrl,
      ...rest
    }) => rest
  );

  const lambdaUrl = job.config?.lambdaUrl || process.env.LAMBDA_FUNCTION_URL;
  const existingAiState = job.result?.aiSummaryState || {};
  const pageSummaries = { ...(job.result?.pageSummaries || {}) };
  const TIMEOUT_BUFFER_MS = 45000;
  const CHECKPOINT_EVERY = 10;

  const checkpointAiState = async (nextIndex, reason) => {
    await updateJobStatus(job.id, {
      status: "summarizing",
      result: {
        ...(job.result || {}),
        aiSummaryState: {
          ...existingAiState,
          aiSummary,
          pageSummaryIndex: nextIndex,
          updatedAt: new Date().toISOString(),
          reason,
        },
        pageSummaries,
      },
    });
  };

  const hasAiSummary = !!existingAiState.aiSummary;
  const hasAllPageSummaries =
    pagesForAi.length > 0 &&
    pagesForAi.every((page) => pageSummaries[page.url]);
  const aiAlreadyDone = hasAiSummary && hasAllPageSummaries;

  if (!aiAlreadyDone) {
    // 작업 상태 업데이트
    await updateJobStatus(job.id, { status: "summarizing" });

    // Lambda 이전 버전과 동일: 전체 사이트 AI 요약 생성 시작 진행률 업데이트
    await updateProgress(job.id, {
      current: 0,
      total: 100,
      message: "전체 사이트 AI 요약 생성 중...",
      percentage: 20,
    });
  }

  // AI 요약 생성 (전체)
  if (!openai) {
    throw new Error("OpenAI API 키가 설정되지 않았습니다.");
  }
  let aiSummary = existingAiState.aiSummary;
  if (!aiSummary) {
    if (shouldStopForTimeout(context, TIMEOUT_BUFFER_MS)) {
      if (lambdaUrl) {
        await checkpointAiState(0, "timeout-before-summary");
        await invokeLambdaSelf(lambdaUrl, {
          jobId: job.id,
          action: "generate-pdf",
        });
        return {
          statusCode: 202,
          body: JSON.stringify({
            success: true,
            jobId: job.id,
            action: "generate-pdf",
            message: "AI summary will continue in next invocation.",
          }),
        };
      }
    }
    aiSummary = await generateAISummary(pagesForAi, openai, "detailed");
    logDebug(`[Lambda] AI 요약 완료: ${job.id} (${pagesForAi.length} pages)`);
    await checkpointAiState(0, "summary-completed");
  }

  // 개별 페이지 AI 요약 생성
  if (!aiAlreadyDone) {
    await updateProgress(job.id, {
      current: 0,
      total: pagesForAi.length,
      message: "개별 페이지 AI 요약 생성 중...",
      percentage: 0,
    });
  }

  let completedCount = 0;
  let startIndex = pagesForAi.length;
  for (let i = 0; i < pagesForAi.length; i += 1) {
    const page = pagesForAi[i];
    const cachedSummary = pageSummaries[page.url];
    if (cachedSummary) {
      pagesForPdf[i].pageSummary = cachedSummary;
      completedCount += 1;
      continue;
    }
    if (startIndex === pagesForAi.length) {
      startIndex = i;
    }
  }

  if (completedCount > 0) {
    await updateProgress(job.id, {
      current: completedCount,
      total: pagesForAi.length,
      message: `개별 페이지 AI 요약 생성 중... (${completedCount}/${pagesForAi.length})`,
      percentage: Math.round((completedCount / pagesForAi.length) * 100),
    });
  }

  for (let i = startIndex; i < pagesForAi.length; i++) {
    const page = pagesForAi[i];
    if (pageSummaries[page.url]) {
      continue;
    }

    if (shouldStopForTimeout(context, TIMEOUT_BUFFER_MS)) {
      if (lambdaUrl) {
        try {
          await checkpointAiState(i, "timeout-before-page-summary");
          await invokeLambdaSelf(lambdaUrl, {
            jobId: job.id,
            action: "generate-pdf",
          });
          return {
            statusCode: 202,
            body: JSON.stringify({
              success: true,
              jobId: job.id,
              action: "generate-pdf",
              message: "AI summary will continue in next invocation.",
            }),
          };
        } catch (error) {
          const errorMessage = String(error?.message || "");
          const isRateLimited =
            error?.code === "RATE_LIMITED" ||
            errorMessage.includes("status=429") ||
            errorMessage.includes("ConcurrentInvocationLimitExceeded");
          const isAborted =
            error?.name === "AbortError" ||
            errorMessage.includes("AbortError") ||
            errorMessage.includes("This operation was aborted");
          const isHeadersTimeout = errorMessage.includes("HeadersTimeoutError");
          const isRetryable = isRateLimited || isAborted || isHeadersTimeout;
          console.error("[Lambda] generate-pdf 재호출 실패:", error);
          if (isRetryable) {
            await updateJobStatus(job.id, {
              status: "summarizing",
              error: `Lambda self-invocation retryable: ${error.message}`,
            });
            return {
              statusCode: 202,
              body: JSON.stringify({
                success: true,
                jobId: job.id,
                action: "generate-pdf",
                message: "Self-invocation retryable error. Will retry.",
              }),
            };
          }
          throw error;
        }
      }
    }

    try {
      const summary = await generatePageSummary(page, openai);
      pageSummaries[page.url] = summary;
      pagesForPdf[i].pageSummary = summary;
    } catch (error) {
      console.error(`[Lambda] 페이지 요약 생성 실패 (${page.url}):`, error);
      const fallback = "비즈니스 인사이트를 추출할 수 없습니다.";
      pageSummaries[page.url] = fallback;
      pagesForPdf[i].pageSummary = fallback;
    }

    completedCount += 1;
    await updateProgress(job.id, {
      current: completedCount,
      total: pagesForAi.length,
      message: `개별 페이지 AI 요약 생성 중... (${completedCount}/${pagesForAi.length})`,
      percentage: Math.round((completedCount / pagesForAi.length) * 100),
    });

    if (completedCount % CHECKPOINT_EVERY === 0) {
      await checkpointAiState(i + 1, "page-summary-checkpoint");
    }
  }

  await checkpointAiState(pagesForAi.length, "page-summary-completed");

  // PDF 생성 (컴파일 배치 재호출)
  await updateJobStatus(job.id, { status: "generating_pdf" });
  await updateProgress(job.id, {
    current: 0,
    total: 100,
    message: "PDF 생성 중...",
    percentage: 30,
  });

  const PDF_COMPILE_CHUNK_SIZE = Number(
    process.env.PDF_COMPILE_CHUNK_SIZE || 8
  );
  const PDF_COMPILE_TIMEOUT_BUFFER_MS = Number(
    process.env.PDF_COMPILE_TIMEOUT_BUFFER_MS || 45000
  );

  const generator = new HTMLPDFGenerator({
    pageChunkSize: PDF_COMPILE_CHUNK_SIZE,
  });
  let pdfResult;
  try {
    const compileState = job.result?.pdfCompileState || {};
    const lambdaUrl = job.config?.lambdaUrl || process.env.LAMBDA_FUNCTION_URL;

    const pdfContext = generator.buildPdfContext(pagesForPdf, aiSummary, {
      generatedDate: compileState.generatedDate,
      reportId: compileState.reportId,
    });
    const totalChunks = Math.ceil(
      pdfContext.pagesWithScreenshots.length / PDF_COMPILE_CHUNK_SIZE
    );
    let nextChunkIndex = Number(compileState.nextChunkIndex || 0);
    const chunkKeys = Array.isArray(compileState.chunkKeys)
      ? [...compileState.chunkKeys]
      : [];
    let frontPdfKey = compileState.frontPdfKey;

    const checkpointPdfState = async (nextIndex, stage, reason) => {
      await updateJobStatus(job.id, {
        status: "generating_pdf",
        result: {
          ...(job.result || {}),
          pdfCompileState: {
            stage,
            chunkSize: PDF_COMPILE_CHUNK_SIZE,
            nextChunkIndex: nextIndex,
            totalChunks,
            frontPdfKey,
            chunkKeys,
            generatedDate: pdfContext.generatedDate,
            reportId: pdfContext.reportId,
            pagesWithScreenshotsCount: pdfContext.pagesWithScreenshots.length,
            updatedAt: new Date().toISOString(),
            reason,
          },
        },
      });
    };

    if (!frontPdfKey) {
      logDebug(`[Lambda] PDF 프론트 생성 시작: ${job.id}`);
      const frontPdf = await generator.generateFrontPdf(pdfContext.vars);
      frontPdfKey = `${job.id}/pdf/chunks/front.pdf`;
      await uploadToStorage(frontPdfKey, frontPdf, "application/pdf");
      await checkpointPdfState(nextChunkIndex, "chunks", "front-created");
    }

    for (
      let chunkIndex = nextChunkIndex;
      chunkIndex < totalChunks;
      chunkIndex += 1
    ) {
      if (shouldStopForTimeout(context, PDF_COMPILE_TIMEOUT_BUFFER_MS)) {
        if (lambdaUrl) {
          await checkpointPdfState(
            chunkIndex,
            "chunks",
            "timeout-before-chunk"
          );
          await invokeLambdaSelf(lambdaUrl, {
            jobId: job.id,
            action: "generate-pdf",
          });
          return {
            statusCode: 202,
            body: JSON.stringify({
              success: true,
              jobId: job.id,
              action: "generate-pdf",
              message: "PDF compile will continue in next invocation.",
            }),
          };
        }
      }

      const start = chunkIndex * PDF_COMPILE_CHUNK_SIZE;
      const chunk = pdfContext.pagesWithScreenshots.slice(
        start,
        start + PDF_COMPILE_CHUNK_SIZE
      );
      const nextPageNumber = 2 + start;
      const chunkPdf = await generator.generatePageChunkPdf(
        pdfContext.vars,
        chunk,
        pdfContext.domain,
        pdfContext.generatedDate,
        nextPageNumber
      );
      const chunkKey = `${job.id}/pdf/chunks/chunk_${chunkIndex + 1}.pdf`;
      await uploadToStorage(chunkKey, chunkPdf, "application/pdf");
      chunkKeys[chunkIndex] = chunkKey;
      nextChunkIndex = chunkIndex + 1;

      const chunkProgress = totalChunks
        ? Math.round((nextChunkIndex / totalChunks) * 30)
        : 0;
      await updateProgress(job.id, {
        current: nextChunkIndex,
        total: totalChunks,
        message: `PDF 컴파일 중... (${nextChunkIndex}/${totalChunks})`,
        percentage: 40 + chunkProgress,
      });

      if (nextChunkIndex % 2 === 0) {
        await checkpointPdfState(nextChunkIndex, "chunks", "chunk-checkpoint");
      }
    }

    await checkpointPdfState(totalChunks, "merge", "chunk-completed");

    if (shouldStopForTimeout(context, PDF_COMPILE_TIMEOUT_BUFFER_MS)) {
      if (lambdaUrl) {
        await invokeLambdaSelf(lambdaUrl, {
          jobId: job.id,
          action: "generate-pdf",
        });
        return {
          statusCode: 202,
          body: JSON.stringify({
            success: true,
            jobId: job.id,
            action: "generate-pdf",
            message: "PDF merge will continue in next invocation.",
          }),
        };
      }
    }

    logDebug(`[Lambda] PDF 병합 시작: ${job.id}`);
    const mergedDoc = await PDFDocument.create();
    const frontPdfBuffer = await downloadFromStorage(frontPdfKey);
    await generator.appendPdfPages(mergedDoc, frontPdfBuffer);
    for (const key of chunkKeys) {
      if (!key) continue;
      const chunkBuffer = await downloadFromStorage(key);
      await generator.appendPdfPages(mergedDoc, chunkBuffer);
    }

    const creationDate = new Date();
    mergedDoc.setCreationDate(creationDate);
    mergedDoc.setModificationDate(creationDate);
    const mergedBytes = await mergedDoc.save();
    const finalPdfBuffer = Buffer.from(mergedBytes);
    const totalSize = finalPdfBuffer.length;
    const totalPages = mergedDoc.getPageCount();

    const coverPages = 1;
    const tocPages = Math.max(
      1,
      totalPages - pdfContext.pagesWithScreenshots.length - 2
    );
    const summaryPages = 1;
    const pageStructure = {
      coverPages,
      tocPages,
      summaryPages,
      summaryPageIndex: coverPages + tocPages,
      individualPagesStartIndex: coverPages + tocPages + summaryPages,
    };

    if (shouldStopForTimeout(context, PDF_COMPILE_TIMEOUT_BUFFER_MS)) {
      if (lambdaUrl) {
        await checkpointPdfState(
          totalChunks,
          "merge",
          "timeout-before-extract"
        );
        await invokeLambdaSelf(lambdaUrl, {
          jobId: job.id,
          action: "generate-pdf",
        });
        return {
          statusCode: 202,
          body: JSON.stringify({
            success: true,
            jobId: job.id,
            action: "generate-pdf",
            message: "PDF finalization will continue in next invocation.",
          }),
        };
      }
    }

    const screenshotPdf = await generator.generateScreenshotPDF(
      pagesForPdf,
      pdfContext.domain,
      pdfContext.generatedDate,
      job.config.crawlMode || "smart"
    );
    const individualPdfs = await generator.extractIndividualPDFsFromDocument(
      mergedDoc,
      pdfContext.pagesWithScreenshots.length,
      pageStructure,
      creationDate
    );

    pdfResult = {
      mergedPdf: finalPdfBuffer,
      individualPdfs,
      tableOfContents: pdfContext.tocItems,
      totalSize,
      totalPages,
      warnings: [],
      screenshotPdf,
    };
    logDebug(`[Lambda] PDF 컴파일 완료: ${job.id}`);
    await checkpointPdfState(totalChunks, "completed", "pdf-completed");
  } finally {
    await generator.close();
  }

  // PDF 컴파일 완료 (중간 진행률 반영)
  await updateProgress(job.id, {
    current: 0,
    total: 100,
    message: "PDF 컴파일 완료",
    percentage: 70,
  });

  // ZIP 파일 생성

  // 개별 PDF 구성 단계
  await updateProgress(job.id, {
    current: 0,
    total: 100,
    message: "개별 PDF 구성 중...",
    percentage: 80,
  });

  await updateProgress(job.id, {
    current: 0,
    total: 100,
    message: "ZIP 파일 생성 중...",
    percentage: 90,
  });

  const zip = new JSZip();

  (pdfResult.individualPdfs || []).forEach((pdfBuffer, index) => {
    const pageNumber = index + 1;

    if (index === 0) {
      // 첫 번째 PDF는 종합 분석 요약
      const filename = `${String(pageNumber).padStart(2, "0")}_전체_요약.pdf`;
      zip.file(filename, pdfBuffer);
      return;
    }

    // 개별 페이지 PDF
    const pageIndex = index - 1;
    const page = pagesForPdf[pageIndex];
    if (!page) {
      return;
    }

    const baseName = `${String(pageNumber).padStart(2, "0")}_${
      page.title || "page"
    }`;
    const filename = `${baseName}.pdf`
      .replace(/[^a-zA-Z0-9가-힣._-]/g, "_")
      .slice(0, 100);

    zip.file(filename, pdfBuffer);
  });

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  logDebug(`[Lambda] ZIP 생성 완료: ${zipBuffer.length} bytes`);

  await updateProgress(job.id, {
    current: 100,
    total: 100,
    message: "파일 업로드 중...",
    percentage: 95,
  });

  // Lambda 이전 버전과 동일한 파일명 형식: ${domain}_individual_pdfs_${date}.zip
  let safeDomain = "site";
  try {
    const domainForFiles = job.config?.url
      ? new URL(job.config.url).hostname.replace("www.", "")
      : "site";
    safeDomain = domainForFiles.replace(/\./g, "_");
  } catch {
    safeDomain = "site";
  }
  const date = new Date().toISOString().split("T")[0];
  const zipFilename = `${safeDomain}_individual_pdfs_${date}.zip`;
  const mergedFilename = `${safeDomain}_business_intelligence_${date}.pdf`;
  const screenshotFilename = `${safeDomain}_screenshots_${date}.pdf`;

  // Supabase Storage에 업로드 (파일명 포함)
  const timestamp = Date.now();
  const zipUrl = await uploadToStorage(
    `${job.id}/${zipFilename}`,
    zipBuffer,
    "application/zip",
    zipFilename
  );
  logDebug(`[Lambda] ZIP 업로드 완료`);

  const pdfUrl = await uploadToStorage(
    `${job.id}/merged_${timestamp}.pdf`,
    pdfResult.mergedPdf,
    "application/pdf",
    mergedFilename
  );
  logDebug(`[Lambda] 통합 PDF 업로드 완료`);

  let screenshotPdfUrl = null;
  if (pdfResult.screenshotPdf && pdfResult.screenshotPdf.length > 0) {
    screenshotPdfUrl = await uploadToStorage(
      `${job.id}/screenshots_${timestamp}.pdf`,
      pdfResult.screenshotPdf,
      "application/pdf",
      screenshotFilename
    );
    logDebug(`[Lambda] 스크린샷 PDF 업로드 완료`);
  }

  // 파일 크기 및 개수 계산 (Lambda 이전 버전과 동일)
  const mergedPdfSize = pdfResult.mergedPdf ? pdfResult.mergedPdf.length : 0;
  const zipSize = zipBuffer.length;
  const individualPdfCount = pdfResult.individualPdfs
    ? pdfResult.individualPdfs.length
    : 0;
  const screenshotPdfSize = pdfResult.screenshotPdf
    ? pdfResult.screenshotPdf.length
    : 0;

  // 통합 PDF 페이지 수 계산 (pdfResult에서 가져오기)
  const mergedPdfPageCount = pdfResult.totalPages || 0;

  // 스크린샷 PDF 개수 (처리된 페이지 수)
  const screenshotPdfCount = pagesForPdf.length;

  // 작업 완료
  await updateJobStatus(job.id, {
    status: "completed",
    result: {
      ...job.result,
      summary: aiSummary,
      zipUrl,
      pdfUrl,
      screenshotPdfUrl,
      processedPages: pagesForPdf.length,
      // Lambda 이전 버전과 동일한 형식으로 파일 크기 및 개수 전달
      totalSize: mergedPdfSize,
      totalSizeMB: (mergedPdfSize / 1024 / 1024).toFixed(2),
      pageCount: mergedPdfPageCount,
      zipSize: zipSize,
      zipSizeMB: (zipSize / 1024 / 1024).toFixed(2),
      individualPdfCount: individualPdfCount,
      screenshotPdfCount: screenshotPdfCount, // 스크린샷 PDF 개수 추가
    },
    completed_at: new Date().toISOString(),
  });

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      jobId: job.id,
      action: "generate-pdf",
      message: "PDF generation completed.",
      zipUrl,
      pdfUrl,
      screenshotPdfUrl,
    }),
  };
}

/**
 * Lambda 핸들러
 */
exports.handler = async (event, context) => {
  // 클라이언트 초기화
  initClients();

  let job = null;

  try {
    // 요청 파싱
    let requestBody = {};
    if (event.body) {
      requestBody =
        typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    } else {
      requestBody = event;
    }

    const { jobId, action } = requestBody;

    if (!jobId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: "jobId is required",
        }),
      };
    }

    if (!action || !["crawl", "generate-pdf"].includes(action)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'action must be "crawl" or "generate-pdf"',
        }),
      };
    }

    // 작업 조회
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", jobId)
      .single();

    if (error) {
      console.error("[Lambda] 작업 조회 에러:", error);
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: "Job not found",
        }),
      };
    }

    job = data;

    // action에 따라 처리
    if (action === "crawl") {
      // 크롤링은 pending 또는 crawling 상태에서 가능 (배치 이어가기)
      if (!["pending", "crawling"].includes(job.status)) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            error: `Job is already ${job.status}. Crawling requires pending or crawling status.`,
          }),
        };
      }
      return await handleCrawl(job);
    } else if (action === "generate-pdf") {
      // PDF 생성은 crawl_completed/page_selected/summarizing/generating_pdf 상태에서 가능 (재호출)
      if (
        ![
          "crawl_completed",
          "page_selected",
          "summarizing",
          "generating_pdf",
        ].includes(job.status)
      ) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            error: `Job status is ${job.status}. PDF generation requires crawl_completed, page_selected, summarizing, or generating_pdf status.`,
          }),
        };
      }
      return await handleGeneratePDF(job, context);
    }
  } catch (error) {
    console.error("[Lambda] 에러:", error);
    console.error("[Lambda] 에러 스택:", error.stack);

    // 작업 실패 처리
    if (job) {
      try {
        await updateJobStatus(job.id, {
          status: "failed",
          error: error.message || "알 수 없는 에러가 발생했습니다",
        });
      } catch (updateError) {
        console.error("[Lambda] 작업 상태 업데이트 실패:", updateError);
      }
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || "알 수 없는 에러가 발생했습니다",
        jobId: job ? job.id : null,
      }),
    };
  }
};
