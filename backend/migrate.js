import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL || 'postgresql://lifescope_user:Nuujj78rfw@76.13.48.189:5432/lifescope';

const pool = new pg.Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const migrationSQL = `
-- Phase 1: Multi-User Foundation Migration
-- Non-destructive: adds columns only if they don't exist

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS google_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ai_calls_today INT DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ai_calls_reset_at DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

-- Promote the original owner to admin
UPDATE public.users SET is_admin = true WHERE email = 'uchechukwunnorom2004@gmail.com';

-- Set trial for existing non-admin users (if any)
UPDATE public.users 
  SET trial_ends_at = CURRENT_TIMESTAMP + INTERVAL '7 days' 
  WHERE trial_ends_at IS NULL AND is_admin = false;
-- Phase 4: Linked Goals Migration
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS linked_module TEXT;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS linked_target_value NUMERIC;
`;

const run = async () => {
    try {
        console.log("⏳ Running Phase 1 migration: Multi-User Foundation...");
        await pool.query(migrationSQL);

        // Verify
        const { rows } = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position");
        console.log("✅ Migration complete! Users table columns:");
        rows.forEach(r => console.log(`   - ${r.column_name}`));

        const { rows: users } = await pool.query("SELECT email, plan, is_admin FROM public.users");
        console.log(`\n👥 Existing users: ${users.length}`);
        users.forEach(u => console.log(`   ${u.email} | plan: ${u.plan} | admin: ${u.is_admin}`));
    } catch (err) {
        console.error("❌ Migration failed:", err);
    } finally {
        await pool.end();
    }
};

run();
