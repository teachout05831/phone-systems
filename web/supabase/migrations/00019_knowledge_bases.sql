-- Knowledge Bases for AI Coaching
-- Each knowledge base represents a sales methodology or industry-specific scripts

-- Knowledge Bases table
CREATE TABLE IF NOT EXISTS knowledge_bases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- "Cleaning Services", "Story-Based Selling"
  description TEXT,                       -- Description of this sales approach
  industry TEXT,                          -- Optional industry tag
  is_default BOOLEAN DEFAULT FALSE,       -- Is this the default KB?
  is_active BOOLEAN DEFAULT TRUE,         -- Can reps use this?
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Scripts table - objections, stories, closes, openers
CREATE TABLE IF NOT EXISTS scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_base_id UUID REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  category TEXT NOT NULL,                 -- 'objection', 'story', 'close', 'opener', 'rebuttall'
  title TEXT NOT NULL,                    -- "Price Objection - Value Focus"
  trigger_phrases TEXT[],                 -- Keywords that trigger this: ["too expensive", "costs too much"]
  script_text TEXT NOT NULL,              -- The actual words to say
  story_text TEXT,                        -- Optional story component
  follow_up TEXT,                         -- What to say/do after
  tips TEXT,                              -- Additional tips for the rep
  sort_order INT DEFAULT 0,               -- For ordering within category
  is_active BOOLEAN DEFAULT TRUE,
  times_shown INT DEFAULT 0,              -- How many times AI showed this
  times_used INT DEFAULT 0,               -- How many times rep clicked "Used"
  times_converted INT DEFAULT 0,          -- How many times it led to conversion
  conversion_rate DECIMAL(5,2),           -- Calculated: times_converted / times_used
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Track which scripts were shown/used during calls
CREATE TABLE IF NOT EXISTS call_script_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid TEXT NOT NULL,
  script_id UUID REFERENCES scripts(id) ON DELETE SET NULL,
  knowledge_base_id UUID REFERENCES knowledge_bases(id) ON DELETE SET NULL,
  shown_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  was_used BOOLEAN DEFAULT FALSE,         -- Did rep click "Used"?
  was_helpful BOOLEAN,                    -- Did rep mark as helpful?
  call_outcome TEXT,                      -- Updated when call ends: 'booked', 'callback', etc.
  rep_id UUID REFERENCES auth.users(id)
);

-- Insert default knowledge bases
INSERT INTO knowledge_bases (name, description, industry, is_default) VALUES
  ('General Sales', 'Universal sales techniques that work across industries', NULL, TRUE),
  ('Cleaning Services', 'Scripts tailored for residential and commercial cleaning sales', 'cleaning', FALSE),
  ('Moving Services', 'Scripts for moving company sales and quotes', 'moving', FALSE),
  ('Solar Sales', 'Scripts for solar panel and energy sales', 'solar', FALSE),
  ('Story-Based Selling', 'Emphasis on stories and emotional connection', NULL, FALSE);

-- Insert sample scripts for General Sales
INSERT INTO scripts (knowledge_base_id, category, title, trigger_phrases, script_text, story_text, tips)
SELECT
  kb.id,
  'objection',
  'Price Objection - Value Focus',
  ARRAY['too expensive', 'costs too much', 'too much money', 'can''t afford', 'out of budget', 'price is high'],
  'I totally understand - price is always an important factor. Let me ask you this: what would it be worth to you to have [benefit they mentioned] without [pain point they mentioned]? Most of our customers find that the value far exceeds the investment.',
  'Actually, I had a customer last month who said the exact same thing. After trying us out, she told me she wished she''d started sooner because she was spending more time and stress doing it herself than the service costs.',
  'Acknowledge their concern, then redirect to value. Never argue about price directly.'
FROM knowledge_bases kb WHERE kb.name = 'General Sales';

INSERT INTO scripts (knowledge_base_id, category, title, trigger_phrases, script_text, tips)
SELECT
  kb.id,
  'objection',
  'Need to Think About It',
  ARRAY['need to think', 'think about it', 'let me think', 'sleep on it', 'discuss with spouse', 'talk to my husband', 'talk to my wife'],
  'Absolutely, I want you to feel 100% confident. Just so I can help you think it through - what specifically would you want to consider? Is it the timing, the investment, or something else?',
  'This isolates the real objection. Often "need to think" masks a specific concern.'
FROM knowledge_bases kb WHERE kb.name = 'General Sales';

INSERT INTO scripts (knowledge_base_id, category, title, trigger_phrases, script_text, tips)
SELECT
  kb.id,
  'objection',
  'Already Have a Provider',
  ARRAY['already have', 'already use', 'have someone', 'happy with current', 'loyal to'],
  'That''s great that you have someone! Out of curiosity, what do you like most about them? And if you could wave a magic wand and change one thing, what would it be?',
  'Don''t bash competition. Find the gap in their current service.'
FROM knowledge_bases kb WHERE kb.name = 'General Sales';

INSERT INTO scripts (knowledge_base_id, category, title, trigger_phrases, script_text, story_text, tips)
SELECT
  kb.id,
  'close',
  'Assumptive Close',
  ARRAY['ready to start', 'sounds good', 'interested', 'let''s do it'],
  'Perfect! Let me get you set up. Would [date option 1] or [date option 2] work better for your schedule?',
  NULL,
  'Give two options, both result in a yes. Don''t ask IF, ask WHEN.'
FROM knowledge_bases kb WHERE kb.name = 'General Sales';

INSERT INTO scripts (knowledge_base_id, category, title, trigger_phrases, script_text, story_text, tips)
SELECT
  kb.id,
  'story',
  'Overwhelmed Customer Story',
  ARRAY['overwhelmed', 'stressed', 'too much', 'busy', 'no time'],
  'I completely understand that feeling. Let me share a quick story with you...',
  'I had a customer just like you - Sarah was juggling work, kids, and felt like she was drowning. She told me after her first month with us, she finally had time to [relevant benefit]. She actually teared up telling me how much stress it took off her plate.',
  'Use this when customer expresses being overwhelmed. Adjust the name and details to feel natural.'
FROM knowledge_bases kb WHERE kb.name = 'General Sales';

-- Insert sample scripts for Cleaning Services
INSERT INTO scripts (knowledge_base_id, category, title, trigger_phrases, script_text, story_text, tips)
SELECT
  kb.id,
  'objection',
  'Price Objection - Cleaning Value',
  ARRAY['too expensive', 'costs too much', 'cheaper cleaners'],
  'I hear you. Here''s what I''ve found: the cheapest cleaners often end up costing more - missed spots, unreliable scheduling, or having to redo things yourself. Our customers tell us the peace of mind is worth every penny. What matters most to you - the lowest price, or knowing it''s done right every time?',
  'We had a customer who switched from a budget cleaner. She said she was spending her weekends re-cleaning what they missed. Now she actually enjoys her weekends.',
  'Position quality and reliability vs. price. Most people want reliability.'
FROM knowledge_bases kb WHERE kb.name = 'Cleaning Services';

INSERT INTO scripts (knowledge_base_id, category, title, trigger_phrases, script_text, tips)
SELECT
  kb.id,
  'objection',
  'I Can Clean Myself',
  ARRAY['clean myself', 'do it myself', 'don''t need help', 'waste of money'],
  'Totally get it - you''re capable! But let me ask: what would you do with those 3-4 extra hours every week? Spend time with family? Focus on work? Relax? Our service isn''t about whether you CAN clean - it''s about giving you back your time for what matters most.',
  'Reframe from capability to time value. Calculate hours saved per month.'
FROM knowledge_bases kb WHERE kb.name = 'Cleaning Services';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_scripts_knowledge_base ON scripts(knowledge_base_id);
CREATE INDEX IF NOT EXISTS idx_scripts_category ON scripts(category);
CREATE INDEX IF NOT EXISTS idx_scripts_trigger_phrases ON scripts USING GIN(trigger_phrases);
CREATE INDEX IF NOT EXISTS idx_call_script_usage_call ON call_script_usage(call_sid);
CREATE INDEX IF NOT EXISTS idx_call_script_usage_script ON call_script_usage(script_id);

-- Function to update conversion rates
CREATE OR REPLACE FUNCTION update_script_conversion_rate()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE scripts
  SET conversion_rate = CASE
    WHEN times_used > 0 THEN (times_converted::DECIMAL / times_used) * 100
    ELSE 0
  END,
  updated_at = NOW()
  WHERE id = NEW.script_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update conversion rate when usage is tracked
CREATE TRIGGER update_conversion_rate_trigger
AFTER INSERT OR UPDATE ON call_script_usage
FOR EACH ROW
EXECUTE FUNCTION update_script_conversion_rate();

-- RLS Policies
ALTER TABLE knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_script_usage ENABLE ROW LEVEL SECURITY;

-- Everyone can read active knowledge bases
CREATE POLICY "Anyone can view active knowledge bases" ON knowledge_bases
  FOR SELECT USING (is_active = TRUE);

-- Everyone can read active scripts
CREATE POLICY "Anyone can view active scripts" ON scripts
  FOR SELECT USING (is_active = TRUE);

-- Authenticated users can insert script usage
CREATE POLICY "Authenticated users can track script usage" ON call_script_usage
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update their own script usage
CREATE POLICY "Users can update their own script usage" ON call_script_usage
  FOR UPDATE USING (rep_id = auth.uid());
