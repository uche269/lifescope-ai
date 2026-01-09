-- EMERGENCY FIX: Disable RLS to rule out permission issues
ALTER TABLE activities DISABLE ROW LEVEL SECURITY;

-- Verify columns again
ALTER TABLE activities ADD COLUMN IF NOT EXISTS last_completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS deadline TEXT;
