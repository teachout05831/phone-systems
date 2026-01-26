-- Migration: Add custom_fields column to contacts table
-- Allows users to store any additional fields they want

-- Add custom_fields JSONB column
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}';

-- Create index for faster JSON queries
CREATE INDEX IF NOT EXISTS idx_contacts_custom_fields ON public.contacts USING GIN (custom_fields);

-- Comment for documentation
COMMENT ON COLUMN public.contacts.custom_fields IS 'Flexible JSON storage for user-defined custom fields like job_title, linkedin, etc.';
