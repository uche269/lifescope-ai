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

const run = async () => {
    try {
        console.log("⏳ Adding new columns to food_logs table...");
        await pool.query(`
      ALTER TABLE public.food_logs 
      ADD COLUMN IF NOT EXISTS confidence TEXT,
      ADD COLUMN IF NOT EXISTS items_json TEXT,
      ADD COLUMN IF NOT EXISTS notes TEXT;
    `);
        console.log("✅ Columns added successfully!");
    } catch (err) {
        console.error("❌ Migration failed:", err);
    } finally {
        await pool.end();
    }
};

run();
