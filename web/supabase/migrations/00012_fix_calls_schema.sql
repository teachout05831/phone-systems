-- ============================================
-- FIX CALLS TABLE FOR NEWSFEED
-- Version: 1.0
-- Adds missing columns and updates constraints
-- ============================================

-- 1. Add notes column to calls table
ALTER TABLE public.calls
ADD COLUMN IF NOT EXISTS notes TEXT;

-- 2. Update status constraint to include 'connected'
-- First drop the existing constraint
ALTER TABLE public.calls
DROP CONSTRAINT IF EXISTS calls_status_check;

-- Add new constraint with 'connected' status
ALTER TABLE public.calls
ADD CONSTRAINT calls_status_check CHECK (status IN (
  'initiated', 'ringing', 'in_progress', 'completed', 'connected',
  'missed', 'no_answer', 'no-answer', 'busy', 'failed', 'voicemail'
));

-- 3. Update outcome constraint to include new values
-- First drop the existing constraint
ALTER TABLE public.calls
DROP CONSTRAINT IF EXISTS calls_outcome_check;

-- Add new constraint with additional outcome types
ALTER TABLE public.calls
ADD CONSTRAINT calls_outcome_check CHECK (outcome IN (
  'booked', 'callback', 'interested', 'not_interested',
  'wrong_number', 'do_not_call', 'voicemail_left', 'no_outcome',
  'estimate', 'question', 'current_customer'
));

-- ============================================
-- DONE! Calls table updated for newsfeed.
-- ============================================
