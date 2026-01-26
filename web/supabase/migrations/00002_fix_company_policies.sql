-- ============================================
-- FIX: Company creation RLS policies
-- Run this in Supabase SQL Editor
-- ============================================

-- Drop existing policies that may be blocking
DROP POLICY IF EXISTS "Users can create companies" ON public.companies;
DROP POLICY IF EXISTS "Users can add company members" ON public.company_members;

-- Allow any authenticated user to create a company
CREATE POLICY "Users can create companies"
  ON public.companies FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow users to add themselves as first member (owner) of a new company
-- OR allow admins/owners to add other members
CREATE POLICY "Users can add company members"
  ON public.company_members FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User is adding themselves
    user_id = auth.uid()
    OR
    -- User is admin/owner of the company adding someone else
    company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Also need SELECT on company_members for the policies to work
DROP POLICY IF EXISTS "Users can view company members" ON public.company_members;
CREATE POLICY "Users can view company members"
  ON public.company_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );
