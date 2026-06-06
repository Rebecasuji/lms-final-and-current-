-- Add Hourly OD support to leaves table
-- This migration adds columns to support hourly OD (On-Duty) requests

-- Add columns for hourly OD time tracking
ALTER TABLE leaves ADD COLUMN IF NOT EXISTS od_from_time time;
ALTER TABLE leaves ADD COLUMN IF NOT EXISTS od_to_time time;

-- Add a comment to document these columns
COMMENT ON COLUMN leaves.od_from_time IS 'Start time for Hourly OD requests (HH:mm format)';
COMMENT ON COLUMN leaves.od_to_time IS 'End time for Hourly OD requests (HH:mm format)';

-- Verify the changes
-- SELECT * FROM leaves WHERE leave_type = 'OD' LIMIT 1;
