-- 1. Add missing column for persistence
ALTER TABLE activities 
ADD COLUMN IF NOT EXISTS last_completed_at TIMESTAMP WITH TIME ZONE;

-- 2. Ensure deadline exists (just in case)
ALTER TABLE activities 
ADD COLUMN IF NOT EXISTS deadline TEXT; 

-- 3. Fix RLS Policies (Update Permissions)
-- Drop existing potential conflict policies
DROP POLICY IF EXISTS "Users can update their own activities" ON activities;
DROP POLICY IF EXISTS "Users can update activities via goals" ON activities;

-- Create correct policy: Allow update if the user owns the parent goal
CREATE POLICY "Users can update activities via goals" ON activities
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM goals
            WHERE goals.id = activities.goal_id
            AND goals.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM goals
            WHERE goals.id = activities.goal_id
            AND goals.user_id = auth.uid()
        )
    );

-- 4. Ensure Insert is also allowed
DROP POLICY IF EXISTS "Users can insert activities via goals" ON activities;
CREATE POLICY "Users can insert activities via goals" ON activities
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM goals
            WHERE goals.id = activities.goal_id
            AND goals.user_id = auth.uid()
        )
    );
