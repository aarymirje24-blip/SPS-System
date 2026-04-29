const pool = require('../config/db');

async function create({ org_id, folder_id = null, uploaded_by, original_name, cloudinary_public_id, cloudinary_url, cloudinary_resource_type, mime_type, size_bytes, description = null, tags = [] }) {
    const result = await pool.query(`
        INSERT INTO files (org_id, folder_id, uploaded_by, original_name, cloudinary_public_id, cloudinary_url, cloudinary_resource_type, mime_type, size_bytes, description, tags)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
    `, [org_id, folder_id, uploaded_by, original_name, cloudinary_public_id, cloudinary_url, cloudinary_resource_type, mime_type, size_bytes, description, tags]);
    return result.rows[0];
}

async function findById(id, org_id) {
    const result = await pool.query(`
        SELECT f.*, u.full_name as uploader_name
        FROM files f
        JOIN users u ON f.uploaded_by = u.id
        WHERE f.id = $1 AND f.org_id = $2 AND f.is_deleted = false
    `, [id, org_id]);
    return result.rows[0] || null;
}

async function findByFolder(folder_id, org_id, { page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    let query, countQuery, values;

    if (folder_id === null) {
        query = `SELECT * FROM files WHERE folder_id IS NULL AND org_id = $1 AND is_deleted = false ORDER BY created_at DESC LIMIT $2 OFFSET $3`;
        countQuery = `SELECT COUNT(*) as count FROM files WHERE folder_id IS NULL AND org_id = $1 AND is_deleted = false`;
        values = [org_id];
    } else {
        query = `SELECT * FROM files WHERE folder_id = $1 AND org_id = $2 AND is_deleted = false ORDER BY created_at DESC LIMIT $3 OFFSET $4`;
        countQuery = `SELECT COUNT(*) as count FROM files WHERE folder_id = $1 AND org_id = $2 AND is_deleted = false`;
        values = [folder_id, org_id];
    }

    const [rowsResult, countResult] = await Promise.all([
        pool.query(query, [...values, limit, offset]),
        pool.query(countQuery, values)
    ]);

    return {
        files: rowsResult.rows,
        total: parseInt(countResult.rows[0].count, 10),
        page,
        limit
    };
}

async function findAccessibleByUser(user_id, org_id, { page = 1, limit = 20, search, mime_type } = {}) {
    const offset = (page - 1) * limit;
    const values = [org_id, user_id];
    let query = `
        SELECT DISTINCT f.*, u.full_name as uploader_name
        FROM files f
        JOIN users u ON f.uploaded_by = u.id
        LEFT JOIN file_shares fs ON fs.file_id = f.id
        WHERE f.org_id = $1
          AND f.is_deleted = false
          AND (
            f.uploaded_by = $2
            OR fs.shared_with_user_id = $2
            OR fs.share_type = 'org_wide'
          )
    `;
    let countQuery = `
        SELECT COUNT(DISTINCT f.id) as count
        FROM files f
        LEFT JOIN file_shares fs ON fs.file_id = f.id
        WHERE f.org_id = $1
          AND f.is_deleted = false
          AND (
            f.uploaded_by = $2
            OR fs.shared_with_user_id = $2
            OR fs.share_type = 'org_wide'
          )
    `;
    let paramIndex = 3;

    if (search) {
        const searchPattern = '%' + search + '%';
        query += ` AND f.original_name ILIKE $${paramIndex}`;
        countQuery += ` AND f.original_name ILIKE $${paramIndex}`;
        values.push(searchPattern);
        paramIndex++;
    }

    if (mime_type) {
        query += ` AND f.mime_type = $${paramIndex}`;
        countQuery += ` AND f.mime_type = $${paramIndex}`;
        values.push(mime_type);
        paramIndex++;
    }

    query += ` ORDER BY f.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;

    const [rowsResult, countResult] = await Promise.all([
        pool.query(query, [...values, limit, offset]),
        pool.query(countQuery, values)
    ]);

    return {
        files: rowsResult.rows,
        total: parseInt(countResult.rows[0].count, 10),
        page,
        limit
    };
}

async function findAllByOrg(org_id, { page = 1, limit = 20, search, mime_type, uploaded_by } = {}) {
    const offset = (page - 1) * limit;
    const values = [org_id];
    let query = `SELECT * FROM files WHERE org_id = $1 AND is_deleted = false`;
    let countQuery = `SELECT COUNT(*) as count FROM files WHERE org_id = $1 AND is_deleted = false`;
    let paramIndex = 2;

    if (search) {
        const searchPattern = '%' + search + '%';
        query += ` AND original_name ILIKE $${paramIndex}`;
        countQuery += ` AND original_name ILIKE $${paramIndex}`;
        values.push(searchPattern);
        paramIndex++;
    }

    if (mime_type) {
        query += ` AND mime_type = $${paramIndex}`;
        countQuery += ` AND mime_type = $${paramIndex}`;
        values.push(mime_type);
        paramIndex++;
    }

    if (uploaded_by) {
        query += ` AND uploaded_by = $${paramIndex}`;
        countQuery += ` AND uploaded_by = $${paramIndex}`;
        values.push(uploaded_by);
        paramIndex++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;

    const [rowsResult, countResult] = await Promise.all([
        pool.query(query, [...values, limit, offset]),
        pool.query(countQuery, values)
    ]);

    return {
        files: rowsResult.rows,
        total: parseInt(countResult.rows[0].count, 10),
        page,
        limit
    };
}

async function softDeleteById(id, org_id, deleted_by) {
    const result = await pool.query(`
        UPDATE files
        SET is_deleted = true, deleted_by = $2, deleted_at = now()
        WHERE id = $1 AND org_id = $3 AND is_deleted = false
        RETURNING cloudinary_public_id, cloudinary_resource_type
    `, [id, deleted_by, org_id]);
    return result.rows[0] || null;
}

async function updateById(id, org_id, fields) {
    const allowedFields = ['description', 'tags', 'folder_id'];
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
    values.push(id, org_id);

    const query = `
        UPDATE files
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex} AND org_id = $${paramIndex + 1}
        RETURNING *
    `;

    const result = await pool.query(query, values);
    return result.rows[0] || null;
}

async function checkOrgStorage(org_id) {
    const usageResult = await pool.query(`
        SELECT COALESCE(SUM(size_bytes), 0) as used_bytes
        FROM files
        WHERE org_id = $1 AND is_deleted = false
    `, [org_id]);
    
    const quotaResult = await pool.query(`
        SELECT storage_quota_mb
        FROM organisations
        WHERE id = $1
    `, [org_id]);

    if (!quotaResult.rows[0]) {
        throw new Error('Organisation not found');
    }

    const used_bytes = BigInt(usageResult.rows[0].used_bytes);
    const quota_mb = quotaResult.rows[0].storage_quota_mb;
    const quota_bytes = BigInt(quota_mb) * BigInt(1024 * 1024);

    return {
        used_bytes: used_bytes.toString(),
        quota_bytes: quota_bytes.toString(),
        has_space: used_bytes < quota_bytes
    };
}

module.exports = {
    create,
    findById,
    findByFolder,
    findAccessibleByUser,
    findAllByOrg,
    softDeleteById,
    updateById,
    checkOrgStorage
};
