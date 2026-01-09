-- EMERGENCY FIX: Disable RLS for goals too
ALTER TABLE goals DISABLE ROW LEVEL SECURITY;

-- Just to be safe, disable it for everything involved
ALTER TABLE activities DISABLE ROW LEVEL SECURITY;
