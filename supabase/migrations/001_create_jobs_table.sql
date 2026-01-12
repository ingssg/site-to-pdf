-- 작업 큐 테이블 생성
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  config JSONB NOT NULL,
  progress JSONB DEFAULT '{"current": 0, "total": 0, "message": "작업 대기 중", "percentage": 0}'::jsonb,
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT status_check CHECK (status IN ('pending', 'crawling', 'crawl_completed', 'page_selected', 'summarizing', 'generating_pdf', 'completed', 'failed'))
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id) WHERE user_id IS NOT NULL;

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) 정책 (선택사항)
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 자신의 작업을 볼 수 있도록 (익명 사용자도 가능)
CREATE POLICY "Users can view their own jobs" ON jobs
  FOR SELECT USING (true);

CREATE POLICY "Users can create jobs" ON jobs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own jobs" ON jobs
  FOR UPDATE USING (true);
