const pool = require('../config/db');

class ActivityLogController {
    // Get activity logs (admin sees all, users see their own)
    async getActivityLogs(req, res) {
        const { userId, role } = req.query;
        
        try {
            let result;
            if (role === 'admin') {
                // Admin can see all activity logs
                result = await pool.query(
                    `SELECT al.*, u.username 
                    FROM activity_logs al 
                    LEFT JOIN users u ON al.user_id = u.id 
                    ORDER BY al.created_at DESC 
                    LIMIT 100`
                );
            } else {
                // Regular users see only their activity
                result = await pool.query(
                    `SELECT al.*, u.username 
                    FROM activity_logs al 
                    LEFT JOIN users u ON al.user_id = u.id 
                    WHERE al.user_id = $1 
                    ORDER BY al.created_at DESC 
                    LIMIT 50`,
                    [userId]
                );
            }
            
            res.json({ success: true, logs: result.rows });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Get activity logs for a specific user
    async getUserActivityLogs(req, res) {
        const { userId } = req.params;
        
        try {
            const result = await pool.query(
                `SELECT al.*, u.username 
                FROM activity_logs al 
                LEFT JOIN users u ON al.user_id = u.id 
                WHERE al.user_id = $1 
                ORDER BY al.created_at DESC 
                LIMIT 50`,
                [userId]
            );
            
            res.json({ success: true, logs: result.rows });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Log an activity
    async logActivity(req, res) {
        const { userId, action, description, ipAddress } = req.body;
        
        try {
            const result = await pool.query(
                'INSERT INTO activity_logs (user_id, action, description, ip_address) VALUES ($1, $2, $3, $4) RETURNING *',
                [userId, action, description, ipAddress]
            );
            
            res.json({ success: true, log: result.rows[0] });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new ActivityLogController();