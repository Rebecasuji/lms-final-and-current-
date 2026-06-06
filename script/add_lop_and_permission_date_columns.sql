-- Migration: Add LOP tracking and permission_date columns
-- Run this in Supabase SQL editor (Database → SQL Editor) or via psql.
-- This enables the Permission Policy Enhancement feature with monthly limits and LOP indicators.

BEGIN;

-- Add permission_date column to permissions table if not exists
ALTER TABLE IF EXISTS permissions
  ADD COLUMN IF NOT EXISTS permission_date date,
  ADD COLUMN IF NOT EXISTS is_lop_applicable boolean DEFAULT false;

-- Create index on permission_date and user_id for faster monthly counting
CREATE INDEX IF NOT EXISTS idx_permissions_user_month 
  ON permissions(user_id, permission_date);

COMMIT;

-- After running, refresh your app and the Permission feature will support:
-- - Monthly permission limit tracking (max 3 per month)
-- - Loss of Pay (LOP) indicators for permissions exceeding limits
-- - Permission duration validation (max 2 hours)
-- - Admin approval interface with LOP status badges
