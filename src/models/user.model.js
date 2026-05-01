const pool = require('../config/db');

async function findById(id) {
    const result = await pool.query(`
        SELECT id, org_id, email, full_name, role, avatar_url, is_active, last_login_at, created_at
        FROM users
        WHERE id = $1
    `, [id]);
    return result.rows[0] || null;
}

async function findByEmail(email) {
    const result = await pool.query(`
        SELECT id, org_id, email, password_hash, full_name, role, is_active, failed_login_attempts, lockout_until
        FROM users
        WHERE email = $1
    `, [email]);
    return result.rows[0] || null;
}

async function findAllByOrg(org_id, { page = 1, limit = 20, role, is_active, search } = {}) {
    const offset = (page - 1) * limit;
    const values = [org_id];
    let query = `
        SELECT id, org_id, email, full_name, role, avatar_url, is_active, last_login_at, created_at
        FROM users
        WHERE org_id = $1
    `;
    let countQuery = `
        SELECT COUNT(*) as count
        FROM users
        WHERE org_id = $1
    `;
    let paramIndex = 2;

    if (role) {
        query += ` AND role = $${paramIndex}`;
        countQuery += ` AND role = $${paramIndex}`;
        values.push(role);
        paramIndex++;
    }
    
    if (is_active !== undefined) {
        query += ` AND is_active = $${paramIndex}`;
        countQuery += ` AND is_active = $${paramIndex}`;
        values.push(is_active);
        paramIndex++;
    }

    if (search) {
        const searchPattern = '%' + search + '%';
        query += ` AND (full_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
        countQuery += ` AND (full_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
        values.push(searchPattern);
        paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    
    const [rowsResult, countResult] = await Promise.all([
        pool.query(query, [...values, limit, offset]),
        pool.query(countQuery, values)
    ]);

    return {
        users: rowsResult.rows,
        total: parseInt(countResult.rows[0].count, 10),
        page,
        limit
    };
}

async function create({ org_id, email, password_hash, full_name, role = 'user' }) {
    const result = await pool.query(`
        INSERT INTO users (org_id, email, password_hash, full_name, role)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, org_id, email, full_name, role
    `, [org_id, email, password_hash, full_name, role]);
    return result.rows[0];
}

async function updateById(id, fields) {
    const allowedFields = ['full_name', 'avatar_url', 'is_active', 'role', 'reset_token', 'reset_token_expires', 'failed_login_attempts', 'lockout_until', 'last_login_at', 'password_hash'];
    const updates = [];
    const values = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(fields)) {
        if (allowedFields.includes(key)) {
            updates.push(`${key} = $${paramIndex}`);
            values.push(value);
            paramIndex++;
        }
    }

    if (updates.length === 0) return null;

    updates.push(`updated_at = now()`);
    values.push(id);

    const query = `
        UPDATE users
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, org_id, email, full_name, role, is_active
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
}

async function softDeleteById(id, deleted_by_id) {
    const result = await pool.query(`
        UPDATE users
        SET is_active = false, updated_at = now()
        WHERE id = $1
        RETURNING id
    `, [id]);
    return result.rows[0] || null;
}

module.exports = {
    findById,
    findByEmail,
    findAllByOrg,
    create,
    updateById,
    softDeleteById
};
