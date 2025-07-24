require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function testConnection() {
    try {
        console.log('Testing database connection...');
        const client = await pool.connect();
        
        const result = await client.query('SELECT NOW() as current_time, version()');
        console.log('✅ Connection successful!');
        console.log('Current time:', result.rows[0].current_time);
        console.log('PostgreSQL version:', result.rows[0].version);
        
        client.release();
        await pool.end();
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
    }
}

testConnection();