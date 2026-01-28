-- Atomic functions for incrementing script counters
-- These prevent race conditions when multiple calls are using scripts simultaneously

-- Increment times_shown for a script
CREATE OR REPLACE FUNCTION increment_script_shown(p_script_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE scripts
  SET times_shown = COALESCE(times_shown, 0) + 1,
      updated_at = NOW()
  WHERE id = p_script_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment times_used for a script
CREATE OR REPLACE FUNCTION increment_script_used(p_script_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE scripts
  SET times_used = COALESCE(times_used, 0) + 1,
      updated_at = NOW()
  WHERE id = p_script_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment times_converted for a script (and recalculate conversion rate)
CREATE OR REPLACE FUNCTION increment_script_converted(p_script_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE scripts
  SET times_converted = COALESCE(times_converted, 0) + 1,
      conversion_rate = CASE
        WHEN COALESCE(times_used, 0) > 0
        THEN ((COALESCE(times_converted, 0) + 1)::DECIMAL / times_used) * 100
        ELSE 0
      END,
      updated_at = NOW()
  WHERE id = p_script_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get script analytics with knowledge base info
CREATE OR REPLACE FUNCTION get_script_analytics(p_knowledge_base_id UUID DEFAULT NULL)
RETURNS TABLE (
  script_id UUID,
  script_title TEXT,
  category TEXT,
  knowledge_base_name TEXT,
  times_shown INT,
  times_used INT,
  times_converted INT,
  conversion_rate DECIMAL,
  usage_rate DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id as script_id,
    s.title as script_title,
    s.category,
    kb.name as knowledge_base_name,
    COALESCE(s.times_shown, 0) as times_shown,
    COALESCE(s.times_used, 0) as times_used,
    COALESCE(s.times_converted, 0) as times_converted,
    COALESCE(s.conversion_rate, 0) as conversion_rate,
    CASE
      WHEN COALESCE(s.times_shown, 0) > 0
      THEN (COALESCE(s.times_used, 0)::DECIMAL / s.times_shown) * 100
      ELSE 0
    END as usage_rate
  FROM scripts s
  JOIN knowledge_bases kb ON s.knowledge_base_id = kb.id
  WHERE (p_knowledge_base_id IS NULL OR s.knowledge_base_id = p_knowledge_base_id)
    AND s.times_shown > 0
  ORDER BY s.conversion_rate DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_script_shown(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_script_used(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_script_converted(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_script_analytics(UUID) TO authenticated;

-- Add index for faster analytics queries
CREATE INDEX IF NOT EXISTS idx_scripts_analytics ON scripts(knowledge_base_id, times_shown, conversion_rate)
WHERE times_shown > 0;

-- Add rep_id to call_script_usage for better tracking
ALTER TABLE call_script_usage
ADD COLUMN IF NOT EXISTS rep_user_id UUID REFERENCES auth.users(id);

-- Create index for rep-based script analytics
CREATE INDEX IF NOT EXISTS idx_call_script_usage_rep ON call_script_usage(rep_user_id, was_used, was_helpful);
