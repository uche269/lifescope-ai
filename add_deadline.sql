-- Add deadline column to goals table if it doesn't exist
ALTER TABLE goals 
ADD COLUMN IF NOT EXISTS deadline TIMESTAMP WITH TIME ZONE;
