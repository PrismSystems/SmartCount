const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const sslConfig = process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: true,
    ca: fs.readFileSync(path.join(__dirname, '../global-bundle.pem')).toString()
} : false;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
//    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
ssl: { rejectUnauthorized: false }
});

// Test connection
pool.on('connect', () => {
    console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    console.error('Database connection error:', err);
});

module.exports = pool;
