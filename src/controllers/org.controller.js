const pool = require('../config/db');
const auditModel = require('../models/audit.model');
const fileModel = require('../models/file.model');
const userModel = require('../models/user.model');

async function getSettings(req, res, next) {
    try {
        const result = await pool.query(
            'SELECT id, name, slug, logo_url, storage_quota_mb, is_active, created_at FROM organisations WHERE id = $1',
            [req.user.org_id]
        );
        return res.status(200).json({ success: true, org: result.rows[0] });
    } catch (error) {
        next(error);
    }
}

async function updateSettings(req, res, next) {
    try {
        const { name, storage_quota_mb } = req.body;
        const updates = [];
        const values = [];
        let paramIndex = 1;
        
        if (name !== undefined) {
            updates.push(`name = $${paramIndex}`);
            values.push(name);
            paramIndex++;
        }
        if (storage_quota_mb !== undefined) {
            updates.push(`storage_quota_mb = $${paramIndex}`);
            values.push(storage_quota_mb);
            paramIndex++;
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ success: false, message: 'No fields to update' });
        }
        
        updates.push(`updated_at = now()`);
        values.push(req.user.org_id);
        
        const query = `
            UPDATE organisations 
            SET ${updates.join(', ')} 
            WHERE id = $${paramIndex} 
            RETURNING id, name, slug, logo_url, storage_quota_mb, is_active, created_at
        `;
        
        const result = await pool.query(query, values);
        
        await auditModel.log({
            org_id: req.user.org_id,
            actor_id: req.user.id,
            action: 'ORG_SETTINGS_UPDATED',
            meta: { name, storage_quota_mb }
        });
        
        return res.status(200).json({ success: true, org: result.rows[0] });
    } catch (error) {
        next(error);
    }
}

async function getStats(req, res, next) {
    try {
        const org_id = req.user.org_id;
        const [usersResult, filesResult, bytesResult, quotaResult, invitesResult] = await Promise.all([
            pool.query('SELECT COUNT(*) FROM users WHERE org_id = $1 AND is_active = true', [org_id]),
            pool.query('SELECT COUNT(*) FROM files WHERE org_id = $1 AND is_deleted = false', [org_id]),
            pool.query('SELECT COALESCE(SUM(size_bytes), 0) as total_bytes FROM files WHERE org_id = $1 AND is_deleted = false', [org_id]),
            pool.query('SELECT storage_quota_mb FROM organisations WHERE id = $1', [org_id]),
            pool.query("SELECT COUNT(*) FROM invitations WHERE org_id = $1 AND status = 'pending'", [org_id])
        ]);
        
        const user_count = parseInt(usersResult.rows[0].count, 10);
        const file_count = parseInt(filesResult.rows[0].count, 10);
        const used_bytes = BigInt(bytesResult.rows[0].total_bytes).toString();
        const quota_mb = parseInt(quotaResult.rows[0].storage_quota_mb, 10);
        const quota_bytes = (BigInt(quota_mb) * BigInt(1024 * 1024)).toString();
        const used_percent = quota_mb > 0 ? ((Number(used_bytes) / Number(quota_bytes)) * 100).toFixed(2) : 0;
        const pending_invitations = parseInt(invitesResult.rows[0].count, 10);
        
        return res.status(200).json({
            success: true,
            stats: {
                user_count,
                file_count,
                used_bytes,
                quota_mb,
                quota_bytes,
                used_percent,
                pending_invitations
            }
        });
    } catch (error) {
        next(error);
    }
}

async function getAuditLog(req, res, next) {
    try {
        const { page = 1, limit = 50, action, actor_id, from_date, to_date } = req.query;
        const result = await auditModel.findByOrg(req.user.org_id, {
            page: parseInt(page),
            limit: parseInt(limit),
            action,
            actor_id,
            from_date,
            to_date
        });
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getSettings,
    updateSettings,
    getStats,
    getAuditLog
};
