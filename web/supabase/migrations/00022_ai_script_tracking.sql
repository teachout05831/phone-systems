-- AI Script Selection Tracking
-- Adds columns to track whether scripts were matched via AI or keyword matching

-- Add match_method column to track how scripts were selected
ALTER TABLE call_script_usage
ADD COLUMN IF NOT EXISTS match_method TEXT DEFAULT 'keyword';

-- Add ai_latency_ms column to track AI response times
ALTER TABLE call_script_usage
ADD COLUMN IF NOT EXISTS ai_latency_ms INTEGER;

-- Add comment for documentation
COMMENT ON COLUMN call_script_usage.match_method IS 'How the script was matched: ai or keyword';
COMMENT ON COLUMN call_script_usage.ai_latency_ms IS 'AI response time in milliseconds (null for keyword matches)';

-- Create index for analytics queries comparing AI vs keyword performance
CREATE INDEX IF NOT EXISTS idx_call_script_usage_match_method
ON call_script_usage(match_method, was_helpful);

-- Create index for AI latency monitoring
CREATE INDEX IF NOT EXISTS idx_call_script_usage_ai_latency
ON call_script_usage(ai_latency_ms)
WHERE ai_latency_ms IS NOT NULL;
