const { Pool } = require('pg');
const env = require('./env');

const pool = new Pool({
    connectionString: env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

pool.on('error', (err) => {
    console.error('Unexpected DB pool error', err);
});

module.exports = pool;