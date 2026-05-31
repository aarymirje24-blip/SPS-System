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

async function checkAccess(file_id, user_id, org_id, role) {
    const result = await pool.query(`
        SELECT 
          f.*,
          u.full_name as uploader_name,
          (SELECT permission FROM file_shares 
           WHERE file_id = $1 AND share_type = 'org_wide' AND (expires_at IS NULL OR expires_at > now()) LIMIT 1) as org_wide_permission,
          (SELECT permission FROM file_shares 
           WHERE file_id = $1 AND shared_with_user_id = $2 AND (expires_at IS NULL OR expires_at > now()) LIMIT 1) as user_permission
        FROM files f
        JOIN users u ON f.uploaded_by = u.id
        WHERE f.id = $1 AND f.org_id = $3 AND f.is_deleted = false
    `, [file_id, user_id, org_id]);
    
    const file = result.rows[0];
    if (!file) return null;

    // Resolve permission hierarchy
    let resolved = null;
    if (file.uploaded_by === user_id) {
        resolved = 'owner';
    } else if (role === 'admin' || role === 'super_admin') {
        resolved = 'admin';
    } else {
        const userPerm = file.user_permission;
        const orgPerm = file.org_wide_permission;
        
        if (userPerm || orgPerm) {
            const levels = { 'view': 1, 'download': 2, 'edit': 3 };
            const userLevel = userPerm ? levels[userPerm] : 0;
            const orgLevel = orgPerm ? levels[orgPerm] : 0;
            
            const maxLevel = Math.max(userLevel, orgLevel);
            if (maxLevel === 3) resolved = 'edit';
            else if (maxLevel === 2) resolved = 'download';
            else if (maxLevel === 1) resolved = 'view';
        }
    }

    if (!resolved) return null; // No access

    file.resolved_permission = resolved;
    return file;
}

module.exports = {
    create,
    findByFileId,
    findById,
    deleteById,
    checkAccess
};
