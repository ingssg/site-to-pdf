-- selected_pages 컬럼 추가 (선택사항 - result JSONB에 저장하는 방식으로 변경했으므로 필요 없음)
-- 하지만 호환성을 위해 컬럼을 추가할 수도 있습니다.
-- 이 마이그레이션은 선택사항입니다.

-- 방법 1: 별도 컬럼 추가 (사용하지 않음)
-- ALTER TABLE jobs ADD COLUMN IF NOT EXISTS selected_pages TEXT[];

-- 방법 2: result JSONB에 저장 (현재 구현 방식)
-- 이미 result 필드가 있으므로 추가 마이그레이션 불필요
