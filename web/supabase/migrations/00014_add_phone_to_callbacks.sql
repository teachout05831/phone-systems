-- ============================================
-- ADD PHONE NUMBER TO CALLBACKS TABLE
-- Version: 1.0
-- Stores phone number directly on callback for reliability
-- ============================================

-- Add phone_number column to callbacks table
ALTER TABLE public.callbacks
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Create index for phone lookups
CREATE INDEX IF NOT EXISTS idx_callbacks_phone ON public.callbacks(phone_number);

-- ============================================
-- DONE! Callbacks table now has phone_number column.
-- ============================================
