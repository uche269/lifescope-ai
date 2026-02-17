import pg from 'pg';
const { Client } = pg;

// Connection details from your deploy script
const connectionString = 'postgresql://lifescope_user:Nuujj78rfw@76.13.48.189:5432/lifescope';

const client = new Client({
    connectionString,
    ssl: false
});

async function run() {
    try {
        await client.connect();
        console.log("Connected to database...");

        // 1. List All Databases
        console.log("\n--- All Databases ---");
        const resdbs = await client.query('SELECT datname FROM pg_database WHERE datistemplate = false;');
        resdbs.rows.forEach(r => console.log(`- ${r.datname}`));

        // 2. List All Schemas and Tables
        console.log("\n--- Tables in ALL Schemas ---");
        const resTables = await client.query(`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
            ORDER BY table_schema, table_name;
        `);
        resTables.rows.forEach(r => console.log(`- ${r.table_schema}.${r.table_name}`));

        // 3. Inspect Users Count
        console.log("\n--- Users Count ---");
        try {
            const resUsers = await client.query('SELECT COUNT(*) FROM public.users');
            console.log(`public.users: ${resUsers.rows[0].count}`);
        } catch (e) { console.log("public.users: Table not found"); }


    } catch (err) {
        console.error("Error:", err);
    } finally {
        await client.end();
    }
}

run();
