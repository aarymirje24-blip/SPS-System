const pool = require('../config/db');

async function log({ org_id, actor_id = null, action, resource_type = null, resource_id = null, meta = {} }) {
    try {
        await pool.query(`
            INSERT INTO audit_logs (org_id, actor_id, action, resource_type, resource_id, meta)
            VALUES ($1, $2, $3, $4, $5, $6)
        `, [org_id, actor_id, action, resource_type, resource_id, meta]);
    } catch (error) {
        console.error('Audit log failed:', error.message);
    }
}

async function findByOrg(org_id, { page = 1, limit = 50, action, actor_id, from_date, to_date } = {}) {
    const offset = (page - 1) * limit;
    const values = [org_id];
    let query = `
        SELECT al.*, u.full_name as actor_name
        FROM audit_logs al
        LEFT JOIN users u ON al.actor_id = u.id
        WHERE al.org_id = $1
    `;
    let countQuery = `
        SELECT COUNT(*) as count
        FROM audit_logs al
        WHERE al.org_id = $1
    `;
    let paramIndex = 2;

    if (action) {
        query += ` AND al.action ILIKE $${paramIndex}`;
        countQuery += ` AND al.action ILIKE $${paramIndex}`;
        values.push(`%${action}%`);
        paramIndex++;
    }

    if (actor_id) {
        query += ` AND al.actor_id = $${paramIndex}`;
        countQuery += ` AND al.actor_id = $${paramIndex}`;
        values.push(actor_id);
        paramIndex++;
    }

    if (from_date) {
        query += ` AND al.created_at >= $${paramIndex}`;
        countQuery += ` AND al.created_at >= $${paramIndex}`;
        values.push(from_date);
        paramIndex++;
    }

    if (to_date) {
        query += ` AND al.created_at <= $${paramIndex}`;
        countQuery += ` AND al.created_at <= $${paramIndex}`;
        values.push(to_date);
        paramIndex++;
    }

    query += ` ORDER BY al.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;

    const [rowsResult, countResult] = await Promise.all([
        pool.query(query, [...values, limit, offset]),
        pool.query(countQuery, values)
    ]);

    return {
        logs: rowsResult.rows,
        total: parseInt(countResult.rows[0].count, 10),
        page,
        limit
    };
}

module.exports = {
    log,
    findByOrg
};
