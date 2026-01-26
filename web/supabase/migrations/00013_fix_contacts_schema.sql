-- ============================================
-- FIX CONTACTS TABLE
-- Version: 1.0
-- Adds missing columns used by call.html
-- ============================================

-- Add created_by column (references who created the contact)
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add lead_source column (how the lead came in)
ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS lead_source TEXT;

-- ============================================
-- DONE! Contacts table updated.
-- ============================================
