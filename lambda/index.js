/**
 * AWS Lambda 워커 함수
 * action 파라미터에 따라 크롤링 또는 PDF 생성을 수행
 *
 * 지원하는 action:
 * - 'crawl': 웹사이트 크롤링만 수행 (Step 1)
 * - 'generate-pdf': 선택된 페이지로 PDF 생성 (Step 3)
 */

const { WebCrawler } = require('./crawler');
const { generateAISummary, generatePageSummary } = require('./ai');
const { HTMLPDFGenerator } = require('./pdf');
const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');
const JSZip = require('jszip');

// 환경 변수
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// 클라이언트 초기화 (지연 초기화 - handler에서 검증)
let supabase = null;
let openai = null;

function initClients() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase 환경 변수가 설정되지 않았습니다. SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 확인하세요.');
  }

  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }

  if (!openai && OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  } else if (!OPENAI_API_KEY) {
    console.warn('[Lambda] OPENAI_API_KEY가 설정되지 않았습니다. AI 기능이 작동하지 않을 수 있습니다.');
  }
}

/**
 * 작업 상태 업데이트
 */
async function updateJobStatus(jobId, updates) {
  const { error } = await supabase
    .from('jobs')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (error) {
    console.error('[Lambda] 작업 상태 업데이트 에러:', error);
    throw error;
  }
}

/**
 * 진행률 업데이트
 */
async function updateProgress(jobId, progress) {
  console.log(`[Lambda] 진행률 업데이트: ${jobId}, ${progress.message}, ${progress.percentage}%`);
  try {
    await updateJobStatus(jobId, {
      progress: {
        current: progress.current,
        total: progress.total,
        message: progress.message,
        percentage: progress.percentage,
      },
    });
    console.log(`[Lambda] 진행률 업데이트 완료: ${jobId}`);
  } catch (error) {
    console.error(`[Lambda] 진행률 업데이트 실패: ${jobId}`, error);
    // 진행률 업데이트 실패해도 계속 진행
  }
}

/**
 * Supabase Storage에 파일 업로드
 */
async function uploadToStorage(bucket, filePath, fileBuffer, contentType) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, fileBuffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    console.error('[Lambda] Storage 업로드 에러:', error);
    throw error;
  }

  // 공개 URL 생성
  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return urlData.publicUrl;
}

function computeCrawlPlan(totalPages) {
  if (totalPages <= 80) {
    return [totalPages];
  }
  if (totalPages <= 160) {
    const first = Math.ceil(totalPages / 2);
    return [first, totalPages - first];
  }
  if (totalPages <= 240) {
    const first = Math.ceil(totalPages * 0.4);
    const second = Math.ceil(totalPages * 0.4);
    const remaining = totalPages - first - second;
    return [first, second, remaining];
  }
  const plan = [];
  let remaining = totalPages;
  while (remaining > 0) {
    const batch = Math.min(100, remaining);
    plan.push(batch);
    remaining -= batch;
  }
  return plan;
}

async function fetchBufferFromUrl(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`파일 다운로드 실패: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Step 1: 크롤링만 수행
 */
async function handleCrawl(job) {
  console.log(`[Lambda] 크롤링 시작: ${job.id}`);

  // 작업 상태를 'crawling'으로 업데이트
  await updateJobStatus(job.id, { status: 'crawling' });

  const totalTargetPages = job.config.maxPages || 50;
  const existingPages = job.result?.crawlResult?.pages || [];
  const baseCount = existingPages.length;
  const crawlPlan = job.result?.crawlPlan || computeCrawlPlan(totalTargetPages);
  const batchIndex = job.result?.crawlBatchIndex || 0;
  const batchLimit = crawlPlan[batchIndex] || totalTargetPages;
  const remainingPages = Math.max(0, totalTargetPages - baseCount);
  const runMaxPages = Math.min(batchLimit, remainingPages);

  // Lambda 이전 버전과 동일: 크롤링 시작 시 즉시 진행률 업데이트
  // 첫 페이지 크롤링 시작 전까지는 입력한 URL의 경로 표시
  const initialUrl = job.config.url;
  try {
    const urlObj = new URL(initialUrl);
    const initialPath = urlObj.pathname || "/";
    await updateProgress(job.id, {
      current: baseCount,
      total: totalTargetPages,
      message: initialPath, // 입력한 URL의 경로만 표시
      percentage: totalTargetPages > 0 ? Math.round((baseCount / totalTargetPages) * 100) : 0,
    });
  } catch (error) {
    // URL 파싱 실패 시 전체 URL 사용
    await updateProgress(job.id, {
      current: baseCount,
      total: totalTargetPages,
      message: initialUrl,
      percentage: totalTargetPages > 0 ? Math.round((baseCount / totalTargetPages) * 100) : 0,
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
      percentage: totalTargetPages > 0
        ? Math.round((overallCurrent / totalTargetPages) * 100)
        : 0,
    });
  });

  const crawlResult = await crawler.crawl(job.result?.crawlState || null);

  // 크롤링 결과 저장 (스크린샷은 Storage에 업로드하고 URL만 저장)
  const newPagesForStorage = await Promise.all(
    crawlResult.pages.map(async (page, index) => {
      let screenshotUrl = null;
      let fullPageScreenshotUrl = null;

      try {
        if (page.screenshot) {
          screenshotUrl = await uploadToStorage(
            'job-results',
            `${job.id}/screenshots/viewport_${index + 1}.jpg`,
            page.screenshot,
            'image/jpeg'
          );
        }
      } catch (error) {
        console.warn('[Lambda] 스크린샷 업로드 실패:', error);
      }

      try {
        if (page.fullPageScreenshot) {
          fullPageScreenshotUrl = await uploadToStorage(
            'job-results',
            `${job.id}/screenshots/full_${index + 1}.jpg`,
            page.fullPageScreenshot,
            'image/jpeg'
          );
        }
      } catch (error) {
        console.warn('[Lambda] 전체 스크린샷 업로드 실패:', error);
      }

      return {
        url: page.url,
        title: page.title,
        content: page.content || '',
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
      status: 'crawling',
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

    const lambdaUrl = process.env.LAMBDA_FUNCTION_URL;
    if (lambdaUrl) {
      fetch(lambdaUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, action: 'crawl' }),
      }).catch((error) => {
        console.error('[Jobs] Lambda 재호출 실패:', error);
      });
    }

    return {
      statusCode: 202,
      body: JSON.stringify({
        success: true,
        jobId: job.id,
        action: 'crawl',
        message: 'Crawling batch completed. Continuing...',
        totalPages: mergedPages.length,
        remaining: remainingAfter,
      }),
    };
  }

  await updateJobStatus(job.id, {
    status: 'crawl_completed',
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

  console.log(`[Lambda] 크롤링 완료: ${job.id}, ${mergedPages.length}페이지`);

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      jobId: job.id,
      action: 'crawl',
      message: 'Crawling completed. Waiting for page selection.',
      totalPages: mergedPages.length,
    }),
  };
}

/**
 * Step 3: 선택된 페이지로 PDF 생성
 */
async function handleGeneratePDF(job) {
  console.log(`[Lambda] PDF 생성 시작: ${job.id}`);

  // Lambda 이전 버전과 동일: 시작 시 즉시 진행률 업데이트
  console.log(`[Lambda] 초기 진행률 업데이트 시작...`);
  try {
    await updateProgress(job.id, {
      current: 0,
      total: 100,
      message: '페이지 데이터 처리 중...',
      percentage: 10,
    });
    console.log(`[Lambda] 초기 진행률 업데이트 완료`);
  } catch (error) {
    console.error(`[Lambda] 초기 진행률 업데이트 실패:`, error);
    // 진행률 업데이트 실패해도 계속 진행
  }

  // 선택된 페이지 정보 가져오기 (result.selectedPages에서 가져옴)
  const selectedPages = job.result?.selectedPages || [];
  const crawlResult = job.result?.crawlResult;

  if (!crawlResult || !crawlResult.pages) {
    throw new Error('크롤링 결과가 없습니다. 먼저 크롤링을 수행하세요.');
  }

  // 선택된 페이지만 필터링 (selectedPages가 비어있으면 모든 페이지 사용)
  let pagesToProcess = crawlResult.pages;
  if (selectedPages.length > 0) {
    pagesToProcess = crawlResult.pages.filter((page) =>
      selectedPages.includes(page.url)
    );
  }

  if (pagesToProcess.length === 0) {
    throw new Error('처리할 페이지가 없습니다.');
  }

  // 스크린샷 복원 (Storage URL 또는 base64)
  const pagesWithBuffers = await Promise.all(
    pagesToProcess.map(async (page) => {
      let screenshotBuffer = null;
      let fullPageScreenshotBuffer = null;

      try {
        if (page.screenshot) {
          screenshotBuffer = Buffer.from(page.screenshot, 'base64');
        } else if (page.screenshotUrl) {
          screenshotBuffer = await fetchBufferFromUrl(page.screenshotUrl);
        }
      } catch (error) {
        console.warn('[Lambda] 스크린샷 다운로드 실패:', error);
      }

      try {
        if (page.fullPageScreenshot) {
          fullPageScreenshotBuffer = Buffer.from(page.fullPageScreenshot, 'base64');
        } else if (page.fullPageScreenshotUrl) {
          fullPageScreenshotBuffer = await fetchBufferFromUrl(page.fullPageScreenshotUrl);
        }
      } catch (error) {
        console.warn('[Lambda] 전체 스크린샷 다운로드 실패:', error);
      }

      return {
        ...page,
        screenshot: screenshotBuffer,
        fullPageScreenshot: fullPageScreenshotBuffer,
        timestamp: page.timestamp ? new Date(page.timestamp) : new Date(),
      };
    })
  );

  // 작업 상태 업데이트
  await updateJobStatus(job.id, { status: 'summarizing' });
  
  // Lambda 이전 버전과 동일: 전체 사이트 AI 요약 생성 시작 진행률 업데이트
  await updateProgress(job.id, {
    current: 0,
    total: 100,
    message: '전체 사이트 AI 요약 생성 중...',
    percentage: 20,
  });

  // AI 요약 생성 (전체)
  if (!openai) {
    throw new Error('OpenAI API 키가 설정되지 않았습니다.');
  }
  const aiSummary = await generateAISummary(pagesWithBuffers, openai, 'detailed');

  // 개별 페이지 AI 요약 생성
  await updateProgress(job.id, {
    current: 0,
    total: pagesWithBuffers.length,
    message: '개별 페이지 AI 요약 생성 중...',
    percentage: 0,
  });

  for (let i = 0; i < pagesWithBuffers.length; i++) {
    const page = pagesWithBuffers[i];
    try {
      page.pageSummary = await generatePageSummary(page, openai);
    } catch (error) {
      console.error(`[Lambda] 페이지 요약 생성 실패 (${page.url}):`, error);
      page.pageSummary = '비즈니스 인사이트를 추출할 수 없습니다.';
    }

    await updateProgress(job.id, {
      current: i + 1,
      total: pagesWithBuffers.length,
      message: `개별 페이지 AI 요약 생성 중... (${i + 1}/${pagesWithBuffers.length})`,
      percentage: Math.round(((i + 1) / pagesWithBuffers.length) * 100),
    });
  }

  // PDF 생성
  await updateJobStatus(job.id, { status: 'generating_pdf' });
  const domain = new URL(job.config.url).hostname.replace('www.', '');

  const generator = new HTMLPDFGenerator();
  let pdfResult;
  try {
    pdfResult = await generator.generatePDFs(pagesWithBuffers, aiSummary, job.config.crawlMode || 'smart');
  } finally {
    await generator.close();
  }

  // ZIP 파일 생성 (Lambda 이전 버전과 동일한 구조)
  // Lambda 이전 버전: src/app/api/generate-pdf/route.ts 참고
  console.log(`[ZIP] ZIP 파일 생성 시작: individualPdfs 개수 = ${(pdfResult.individualPdfs || []).length}`);
  
  // Lambda 이전 버전과 동일: ZIP 파일 생성 시작 진행률 업데이트
  await updateProgress(job.id, {
    current: 0,
    total: 100,
    message: 'ZIP 파일 생성 중...',
    percentage: 90,
  });
  
  const zip = new JSZip();
  
  // Lambda 이전 버전과 동일: individualPdfs만 ZIP에 추가
  // - 통합 PDF 전체는 추가하지 않음
  // - 스크린샷 PDF도 ZIP에 포함하지 않음 (별도 다운로드 URL로 제공)
  (pdfResult.individualPdfs || []).forEach((pdfBuffer, index) => {
    const pageNumber = index + 1;

    if (index === 0) {
      // 첫 번째 PDF는 종합 분석 요약
      const filename = `${String(pageNumber).padStart(2, '0')}_전체_요약.pdf`;
      console.log(`[ZIP] 파일 추가: ${filename} (index=${index}, pageNumber=${pageNumber})`);
      zip.file(filename, pdfBuffer);
      return;
    }

    // 개별 페이지 PDF
    const pageIndex = index - 1;
    const page = pagesWithBuffers[pageIndex];
    if (!page) {
      console.log(`[ZIP] 페이지 없음: index=${index}, pageIndex=${pageIndex}`);
      return;
    }

    const baseName = `${String(pageNumber).padStart(2, '0')}_${page.title || 'page'}`;
    const filename = `${baseName}.pdf`
      .replace(/[^a-zA-Z0-9가-힣._-]/g, '_')
      .slice(0, 100);

    console.log(`[ZIP] 파일 추가: ${filename} (index=${index}, pageNumber=${pageNumber}, title=${page.title})`);
    zip.file(filename, pdfBuffer);
  });

  console.log(`[ZIP] ZIP 파일 생성 중... (총 ${Object.keys(zip.files).length}개 파일)`);
  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  console.log(`[ZIP] ZIP 파일 생성 완료: 크기=${zipBuffer.length} bytes`);
  
  // Lambda 이전 버전과 동일: ZIP 파일 생성 완료 진행률 업데이트
  await updateProgress(job.id, {
    current: 100,
    total: 100,
    message: '파일 업로드 중...',
    percentage: 95,
  });

  // Lambda 이전 버전과 동일한 파일명 형식: ${domain}_individual_pdfs_${date}.zip
  const safeDomain = domain.replace(/\./g, '_');
  const date = new Date().toISOString().split('T')[0];
  const zipFilename = `${safeDomain}_individual_pdfs_${date}.zip`;

  // Supabase Storage에 업로드 (파일명 포함)
  const timestamp = Date.now();
  const zipUrl = await uploadToStorage(
    'job-results',
    `${job.id}/${zipFilename}`,
    zipBuffer,
    'application/zip'
  );

  const pdfUrl = await uploadToStorage(
    'job-results',
    `${job.id}/merged_${timestamp}.pdf`,
    pdfResult.mergedPdf,
    'application/pdf'
  );

  let screenshotPdfUrl = null;
  if (pdfResult.screenshotPdf && pdfResult.screenshotPdf.length > 0) {
    screenshotPdfUrl = await uploadToStorage(
      'job-results',
      `${job.id}/screenshots_${timestamp}.pdf`,
      pdfResult.screenshotPdf,
      'application/pdf'
    );
  }

  // 파일 크기 및 개수 계산 (Lambda 이전 버전과 동일)
  const mergedPdfSize = pdfResult.mergedPdf ? pdfResult.mergedPdf.length : 0;
  const zipSize = zipBuffer.length;
  const individualPdfCount = pdfResult.individualPdfs ? pdfResult.individualPdfs.length : 0;
  const screenshotPdfSize = pdfResult.screenshotPdf ? pdfResult.screenshotPdf.length : 0;
  
  // 통합 PDF 페이지 수 계산 (pdfResult에서 가져오기)
  const mergedPdfPageCount = pdfResult.totalPages || 0;
  
  // 스크린샷 PDF 개수 (처리된 페이지 수)
  const screenshotPdfCount = pagesWithBuffers.length;

  console.log(`[Lambda] 파일 크기 정보: 통합 PDF=${mergedPdfSize} bytes (${(mergedPdfSize / 1024 / 1024).toFixed(2)} MB), ZIP=${zipSize} bytes (${(zipSize / 1024 / 1024).toFixed(2)} MB), 개별 PDF 개수=${individualPdfCount}, 통합 PDF 페이지 수=${mergedPdfPageCount}, 스크린샷 PDF 개수=${screenshotPdfCount}`);

  // 작업 완료
  await updateJobStatus(job.id, {
    status: 'completed',
    result: {
      ...job.result,
      summary: aiSummary,
      zipUrl,
      pdfUrl,
      screenshotPdfUrl,
      processedPages: pagesWithBuffers.length,
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

  console.log(`[Lambda] PDF 생성 완료: ${job.id}`);

  return {
    statusCode: 200,
    body: JSON.stringify({
      success: true,
      jobId: job.id,
      action: 'generate-pdf',
      message: 'PDF generation completed.',
      zipUrl,
      pdfUrl,
      screenshotPdfUrl,
    }),
  };
}

/**
 * Lambda 핸들러
 */
exports.handler = async (event) => {
  console.log('[Lambda] 워커 시작', JSON.stringify(event));

  // 클라이언트 초기화
  initClients();

  let job = null;

  try {
    // 요청 파싱
    let requestBody = {};
    if (event.body) {
      requestBody = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } else {
      requestBody = event;
    }

    const { jobId, action } = requestBody;

    if (!jobId) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'jobId is required',
        }),
      };
    }

    if (!action || !['crawl', 'generate-pdf'].includes(action)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'action must be "crawl" or "generate-pdf"',
        }),
      };
    }

    // 작업 조회
    console.log(`[Lambda] 작업 조회: ${jobId}, action: ${action}`);
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      console.error('[Lambda] 작업 조회 에러:', error);
      return {
        statusCode: 404,
        body: JSON.stringify({
          success: false,
          error: 'Job not found',
        }),
      };
    }

    job = data;

    // action에 따라 처리
    if (action === 'crawl') {
      // 크롤링은 pending 상태에서만 가능
      if (job.status !== 'pending') {
        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            error: `Job is already ${job.status}. Crawling requires pending status.`,
          }),
        };
      }
      return await handleCrawl(job);
    } else if (action === 'generate-pdf') {
      // PDF 생성은 crawl_completed 또는 page_selected 상태에서 가능
      if (!['crawl_completed', 'page_selected'].includes(job.status)) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            error: `Job status is ${job.status}. PDF generation requires crawl_completed or page_selected status.`,
          }),
        };
      }
      return await handleGeneratePDF(job);
    }

  } catch (error) {
    console.error('[Lambda] 에러:', error);
    console.error('[Lambda] 에러 스택:', error.stack);

    // 작업 실패 처리
    if (job) {
      try {
        await updateJobStatus(job.id, {
          status: 'failed',
          error: error.message || '알 수 없는 에러가 발생했습니다',
        });
      } catch (updateError) {
        console.error('[Lambda] 작업 상태 업데이트 실패:', updateError);
      }
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message || '알 수 없는 에러가 발생했습니다',
        jobId: job ? job.id : null,
      }),
    };
  }
};
