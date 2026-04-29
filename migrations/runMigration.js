const fs = require('fs');
const path = require('path');
const pool = require('../src/config/db');

const migrationPath = path.join(__dirname, '001_initial_schema.sql');

async function runMigration() {
    try {
        const sql = fs.readFileSync(migrationPath, 'utf-8');
        
        await pool.query(sql);
        
        console.log('Migration completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigration();