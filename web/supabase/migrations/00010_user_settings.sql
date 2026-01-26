-- ============================================
-- USER SETTINGS TABLE
-- Version: 1.0
-- Stores per-user preferences and settings
-- ============================================

-- Create user_settings table
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Navigation preferences
  hidden_tabs TEXT[] DEFAULT '{}',
  landing_page TEXT DEFAULT 'dashboard',

  -- Notification preferences
  notifications JSONB DEFAULT '{
    "incoming_calls": true,
    "callback_reminders": true,
    "new_leads": true,
    "deal_updates": true,
    "daily_summary": false
  }',

  -- Sound settings
  sounds JSONB DEFAULT '{
    "enabled": true,
    "volume": 75
  }',

  -- Appearance settings
  appearance JSONB DEFAULT '{
    "compact_mode": false
  }',

  -- Timezone setting (IANA timezone name, e.g., 'America/New_York')
  timezone TEXT DEFAULT 'America/New_York',

  -- Pipeline stage visibility settings
  pipeline_stages JSONB DEFAULT '{
    "new_lead": true,
    "contacted": true,
    "qualified": true,
    "proposal": true,
    "negotiation": true,
    "won": true,
    "lost": true
  }',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One settings row per user
  UNIQUE(user_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);

-- Add timezone column if table already exists and column is missing
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';

-- Enable Row Level Security
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can delete own settings" ON public.user_settings;

-- Users can only view their own settings
CREATE POLICY "Users can view own settings"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own settings
CREATE POLICY "Users can insert own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own settings
CREATE POLICY "Users can update own settings"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own settings
CREATE POLICY "Users can delete own settings"
  ON public.user_settings FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updating the updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION update_user_settings_updated_at();

-- ============================================
-- DONE! User settings table created.
-- ============================================
