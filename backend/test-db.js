import pg from 'pg';
const { Client } = pg;

// Replace 'your_secure_password' with the actual password you set
const connectionString = 'postgresql://lifescope_user:Nuujj78rfw@76.13.48.189:5432/lifescope';

const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function testConnection() {
    try {
        console.log('Attempting to connect to database...');
        await client.connect();
        console.log('Connected successfully!');

        const res = await client.query('SELECT NOW() as current_time');
        console.log('Database time:', res.rows[0].current_time);

        await client.end();
        console.log('Connection closed.');
    } catch (err) {
        console.error('Connection failed!', err);
        process.exit(1);
    }
}

testConnection();
