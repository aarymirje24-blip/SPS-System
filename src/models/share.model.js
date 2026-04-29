const pool = require('../config/db');

async function create({ file_id, shared_by, share_type, shared_with_user_id = null, permission = 'view', expires_at = null }) {
    const result = await pool.query(`
        INSERT INTO file_shares (file_id, shared_by, share_type, shared_with_user_id, permission, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
    `, [file_id, shared_by, share_type, shared_with_user_id, permission, expires_at]);
    return result.rows[0];
}

async function findByFileId(file_id, org_id) {
    const result = await pool.query(`
        SELECT fs.*, 
          sb.full_name as shared_by_name,
          sw.full_name as shared_with_name,
          sw.email as shared_with_email
        FROM file_shares fs
        JOIN users sb ON fs.shared_by = sb.id
        LEFT JOIN users sw ON fs.shared_with_user_id = sw.id
        JOIN files f ON fs.file_id = f.id
        WHERE fs.file_id = $1 AND f.org_id = $2
          AND (fs.expires_at IS NULL OR fs.expires_at > now())
        ORDER BY fs.created_at DESC
    `, [file_id, org_id]);
    return result.rows;
}

async function findById(id) {
    const result = await pool.query('SELECT * FROM file_shares WHERE id = $1', [id]);
    return result.rows[0] || null;
}

async function deleteById(id) {
    const result = await pool.query('DELETE FROM file_shares WHERE id = $1 RETURNING id', [id]);
    return result.rows[0] || null;
}

async function checkAccess(file_id, user_id, org_id) {
    const result = await pool.query(`
        SELECT 
          f.uploaded_by,
          f.org_id,
          (SELECT permission FROM file_shares 
           WHERE file_id = $1 AND share_type = 'org_wide' AND (expires_at IS NULL OR expires_at > now()) LIMIT 1) as org_wide_permission,
          (SELECT permission FROM file_shares 
           WHERE file_id = $1 AND shared_with_user_id = $2 AND (expires_at IS NULL OR expires_at > now()) LIMIT 1) as user_permission
        FROM files f
        WHERE f.id = $1 AND f.org_id = $3 AND f.is_deleted = false
    `, [file_id, user_id, org_id]);
    return result.rows[0] || null;
}

module.exports = {
    create,
    findByFileId,
    findById,
    deleteById,
    checkAccess
};
