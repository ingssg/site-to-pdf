-- Supabase jobs 테이블의 status_check 제약조건 업데이트
-- crawl_completed와 page_selected 상태 추가

ALTER TABLE jobs 
DROP CONSTRAINT IF EXISTS status_check;

ALTER TABLE jobs 
ADD CONSTRAINT status_check 
CHECK (status IN (
  'pending', 
  'crawling', 
  'crawl_completed', 
  'page_selected', 
  'summarizing', 
  'generating_pdf', 
  'completed', 
  'failed'
));
