import fs from 'fs';
import path from 'path';
import pg from 'pg';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const { Client } = pg;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const ask = (query) => new Promise((resolve) => rl.question(query, resolve));

// Check for argument first
const argValues = process.argv.slice(2);
const connectionStringArg = argValues[0];

async function main() {
    console.log("\n=== Supabase Automatic Migration Tool ===");
    console.log("This script will connect to your Supabase database and run the 'supabase_setup.sql' script to create tables.");
    console.log("\nPlease access your Supabase Dashboard to get the Connection String:");
    console.log("1. Go to Project Settings > Database.");
    console.log("2. Under 'Connection string', make sure 'URI' is selected.");
    console.log("3. Copy the string (it looks like: postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres)");
    console.log("   (If using the pooled connection (port 6543), that works too).");

    let connectionString = connectionStringArg;

    if (!connectionString) {
        console.log("No connection string provided as argument.");
        console.log("Usage: node scripts/setup_db.js \"postgresql://...\"");

        const connectionStringInput = await ask("\nPaste your Connection String here: ");
        connectionString = connectionStringInput;
    }

    if (!connectionString || !connectionString.trim()) {
        console.error("❌ Connection string is required.");
        rl.close();
        process.exit(1);
    }

    // Adjust connection string SSL 'rejectUnauthorized' if needed, mostly true is fine for public CA, 
    // but sometimes 'false' is needed for self-signed or specific node configs.
    // Supabase uses Let's Encrypt, so mostly standard SSL works.

    const client = new Client({
        connectionString: connectionString.trim(),
        // ssl: { rejectUnauthorized: false } 
    });

    try {
        console.log("\nConnecting to database...");
        await client.connect();
        console.log("✅ Connected!");

        // Read the SQL file typically located two levels up or one level up?
        // Current file is in scripts/setup_db.js, mapping to local c:\Users\asus\2026 goals\lifescope-ai\scripts\setup_db.js
        // SQL file is in c:\Users\asus\2026 goals\lifescope-ai\supabase_setup.sql
        const sqlPath = path.join(__dirname, '..', 'supabase_setup.sql');

        if (!fs.existsSync(sqlPath)) {
            throw new Error(`SQL file not found at: ${sqlPath}`);
        }

        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log("Running migration script from supabase_setup.sql...");

        // Split by semicolons simple approach or run as one block?
        // pg driver query can run multiple statements usually.
        await client.query(sql);

        console.log("✅ Migration successful! Tables have been created and dummy data logic prepared.");
        console.log("   (Check the 'Table Editor' in your Supabase dashboard to verify).");

    } catch (err) {
        console.error("❌ Error running migration:", err.message);
        fs.writeFileSync(path.join(__dirname, '..', 'migration.log'), err.message);
        if (err.message.includes("password")) {
            console.error("   Hint: Check if the password in the connection string is correct.");
        }
    } finally {
        await client.end();
        rl.close();
        process.exit(0);
    }
}

main();
