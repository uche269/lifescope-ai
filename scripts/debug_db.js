
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Manually parse .env to avoid dotenv dependency issues
const envPath = path.resolve(__dirname, '../.env');
try {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split(/\r?\n/).forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim();
            process.env[key] = value;
            // console.log(`Loaded key: ${key}`); // Debug
        }
    });
} catch (e) {
    console.error("Could not read .env file:", e);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugSchema() {
    console.log("--- Debugging Activities Table (No Dotenv) ---");

    // 1. Check if we can read activities
    const { data: activities, error: readError } = await supabase
        .from('activities')
        .select('*')
        .limit(1);

    if (readError) {
        console.error("❌ READ Failed:", readError.message);
        if (readError.code === '42703') {
            console.error("   Reason: Column does not exist?");
        }
    } else {
        console.log("✅ READ Successful. Found:", activities?.length, "activities.");
        if (activities && activities.length > 0) {
            const act = activities[0];
            console.log("Sample Activity Keys:", Object.keys(act));
            // Check specific columns
            const hasLastCompleted = 'last_completed_at' in act;
            const hasDeadline = 'deadline' in act;

            console.log("Checking columns:");
            console.log(`- last_completed_at: ${hasLastCompleted ? 'EXISTS' : 'MISSING ❌'}`);
            console.log(`- deadline: ${hasDeadline ? 'EXISTS' : 'MISSING ❌'}`);

            if (hasLastCompleted) {
                console.log(`Current Value: ${act.last_completed_at}`);
            }

            // 2. Try to update this activity
            console.log(`\n--- Testing UPDATE on Activity ID: ${act.id} ---`);
            const { error: updateError } = await supabase
                .from('activities')
                .update({ last_completed_at: new Date().toISOString() })
                .eq('id', act.id)
                .select();

            if (updateError) {
                console.error("❌ UPDATE Failed:", updateError);
                console.error("   Message:", updateError.message);
                console.error("   Details:", updateError.details);
            } else {
                console.log("✅ UPDATE Successful. RLS seems OK.");
            }
        } else {
            console.log("⚠️ No activities found to test columns/updates on.");
        }
    }
}

debugSchema();
