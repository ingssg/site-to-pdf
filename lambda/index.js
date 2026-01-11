/**
 * AWS Lambda 워커 함수 (완전 버전)
 * 기존 로컬 환경의 모든 기능을 Lambda 환경에서 동작하도록 포팅
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

// 클라이언트 초기화
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

/**
 * Supabase에서 'pending' 작업 조회
 */
async function getPendingJob() {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[Lambda] Supabase 조회 에러:', error);
    return null;
  }

  return data;
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
  await updateJobStatus(jobId, {
    progress: {
      current: progress.current,
      total: progress.total,
      message: progress.message,
      percentage: progress.percentage,
    },
  });
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

/**
 * PDF 생성 (완전 버전 - 로컬 환경과 동일)
 */
async function generatePDFs(pages, aiSummary, crawlMode) {
  const generator = new HTMLPDFGenerator();
  try {
    const result = await generator.generatePDFs(pages, aiSummary, crawlMode);
    return result;
  } finally {
    await generator.close();
  }
}

/**
 * Lambda 핸들러
 */
exports.handler = async (event) => {
  console.log('[Lambda] 워커 시작', JSON.stringify(event));

  let job = null;

  try {
    // 1. 작업 조회
    // EventBridge에서 호출된 경우 (스케줄)
    if (event.source === 'aws.events') {
      // Supabase에서 'pending' 작업 조회
      job = await getPendingJob();
    }
    // 직접 호출된 경우 (Vercel에서 jobId 전달)
    else if (event.jobId) {
      // 특정 작업 ID로 조회
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', event.jobId)
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

      // 'pending' 상태가 아니면 처리하지 않음
      if (data.status !== 'pending') {
        console.log(`[Lambda] 작업 ${event.jobId}는 이미 처리 중이거나 완료되었습니다. 상태: ${data.status}`);
        return {
          statusCode: 200,
          body: JSON.stringify({
            success: true,
            message: `Job ${event.jobId} is already ${data.status}`,
          }),
        };
      }

      job = data;
    }
    // 기본: 'pending' 작업 조회
    else {
      job = await getPendingJob();
    }

    if (!job) {
      console.log('[Lambda] 처리할 작업이 없습니다.');
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'No pending jobs' }),
      };
    }

    console.log(`[Lambda] 작업 시작: ${job.id}`);

    // 2. 작업 상태를 'crawling'으로 업데이트
    await updateJobStatus(job.id, { status: 'crawling' });

    // 3. 크롤링 실행
    const crawler = new WebCrawler(job.config, async (current, total, url) => {
      await updateProgress(job.id, {
        current,
        total,
        message: `크롤링 중: ${url}`,
        percentage: Math.round((current / total) * 100),
      });
    });

    const crawlResult = await crawler.crawl();

    // 4. AI 요약 생성 (전체)
    await updateJobStatus(job.id, { status: 'summarizing' });
    const aiSummary = await generateAISummary(crawlResult.pages, openai, 'detailed');

    // 5. 개별 페이지 AI 요약 생성
    await updateProgress(job.id, {
      current: 0,
      total: crawlResult.pages.length,
      message: '개별 페이지 AI 요약 생성 중...',
      percentage: 0,
    });

    for (let i = 0; i < crawlResult.pages.length; i++) {
      const page = crawlResult.pages[i];
      try {
        page.pageSummary = await generatePageSummary(page, openai);
      } catch (error) {
        console.error(`[Lambda] 페이지 요약 생성 실패 (${page.url}):`, error);
        page.pageSummary = '비즈니스 인사이트를 추출할 수 없습니다.';
      }

      await updateProgress(job.id, {
        current: i + 1,
        total: crawlResult.pages.length,
        message: `개별 페이지 AI 요약 생성 중... (${i + 1}/${crawlResult.pages.length})`,
        percentage: Math.round(((i + 1) / crawlResult.pages.length) * 100),
      });
    }

    // 6. PDF 생성 (완전 버전 - 로컬 환경과 동일)
    await updateJobStatus(job.id, { status: 'generating_pdf' });
    const domain = new URL(job.config.url).hostname.replace('www.', '');

    const pdfResult = await generatePDFs(crawlResult.pages, aiSummary, job.config.crawlMode || 'full');

    // 7. ZIP 파일 생성 (통합 PDF + 개별 PDF + 스크린샷 PDF)
    const zip = new JSZip();
    
    // 통합 PDF 추가
    zip.file(`${domain}_analysis.pdf`, pdfResult.mergedPdf);

    // 개별 PDF 추가 (1-based numbering)
    pdfResult.individualPdfs.forEach((pdf, index) => {
      let filename;
      if (index === 0) {
        filename = `01_전체_요약.pdf`;
      } else {
        const pageNumber = String(index + 1).padStart(2, '0');
        filename = `${pageNumber}_개별페이지${index}.pdf`;
      }
      zip.file(filename, pdf);
    });

    // 스크린샷 PDF 추가 (있는 경우)
    if (pdfResult.screenshotPdf && pdfResult.screenshotPdf.length > 0) {
      zip.file(`전체_스크린샷.pdf`, pdfResult.screenshotPdf);
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // 8. Supabase Storage에 업로드
    const timestamp = Date.now();
    const zipUrl = await uploadToStorage(
      'job-results',
      `${job.id}/result_${timestamp}.zip`,
      zipBuffer,
      'application/zip'
    );

    const pdfUrl = await uploadToStorage(
      'job-results',
      `${job.id}/merged_${timestamp}.pdf`,
      pdfResult.mergedPdf,
      'application/pdf'
    );

    const screenshotPdfUrl = pdfResult.screenshotPdf && pdfResult.screenshotPdf.length > 0
      ? await uploadToStorage(
          'job-results',
          `${job.id}/screenshots_${timestamp}.pdf`,
          pdfResult.screenshotPdf,
          'application/pdf'
        )
      : null;

    // 9. 작업 완료
    await updateJobStatus(job.id, {
      status: 'completed',
      result: {
        crawlResult: {
          pages: crawlResult.pages.map((p) => ({
            url: p.url,
            title: p.title,
            content: p.content.substring(0, 500),
            pageSummary: p.pageSummary,
          })),
          totalPages: crawlResult.totalPages,
        },
        summary: aiSummary,
        zipUrl, // ZIP 파일 다운로드 URL
        pdfUrl, // 통합 PDF URL
        screenshotPdfUrl, // 스크린샷 PDF URL (있는 경우)
      },
      completed_at: new Date().toISOString(),
    });

    console.log(`[Lambda] 작업 완료: ${job.id}`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        jobId: job.id,
        message: 'Job completed successfully',
      }),
    };
  } catch (error) {
    console.error('[Lambda] 에러:', error);

    // 작업 실패 처리
    if (job) {
      await updateJobStatus(job.id, {
        status: 'failed',
        error: error.message,
      });
    }

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message,
      }),
    };
  }
};
