import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const fixDb = async () => {
    try {
        console.log("Connecting to DB...");

        // Ensure UUID extension
        await pool.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

        console.log("Creating goal_categories table...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS public.goal_categories (
                id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
                user_id UUID NOT NULL,
                name TEXT NOT NULL,
                color TEXT DEFAULT '#3b82f6',
                is_default BOOLEAN DEFAULT false,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("✅ goal_categories table ensured.");

        // Check if table exists
        const res = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'goal_categories'
            );
        `);
        console.log("Table exists check:", res.rows[0].exists);

    } catch (err) {
        console.error("❌ DB Fix failed:", err);
    } finally {
        await pool.end();
    }
};

fixDb();
