-- Upgrade Schema for Smart Activity Tracking
ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS last_completed_at timestamp with time zone;

-- Comment: This field tracks the exact time an activity was marked done.
-- We will use this to determine if a Daily/Weekly task should be "reset" in the UI.

ALTER TABLE public.activities 
ADD COLUMN IF NOT EXISTS deadline TIMESTAMP WITH TIME ZONE;
