const pool = require('../config/db');

class FileController {
    // Upload a new file
    async uploadFile(req, res) {
        const { userId, filename, filepath, filesize, mimetype } = req.body;
        
        try {
            const result = await pool.query(
                'INSERT INTO files (user_id, filename, filepath, filesize, mimetype) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [userId, filename, filepath, filesize, mimetype]
            );
            
            // Log activity
            await pool.query(
                'INSERT INTO activity_logs (user_id, action, description) VALUES ($1, $2, $3)',
                [userId, 'file_upload', `User uploaded file: ${filename}`]
            );
            
            res.json({ success: true, file: result.rows[0] });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Get all files (admin) or user's files
    async getFiles(req, res) {
        const { userId, role } = req.query;
        
        try {
            let result;
            if (role === 'admin') {
                // Admin can see all files
                result = await pool.query(
                    'SELECT f.*, u.username FROM files f JOIN users u ON f.user_id = u.id ORDER BY f.created_at DESC'
                );
            } else {
                // Regular users see only their files
                result = await pool.query(
                    'SELECT * FROM files WHERE user_id = $1 ORDER BY created_at DESC',
                    [userId]
                );
            }
            
            res.json({ success: true, files: result.rows });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Get file by ID
    async getFileById(req, res) {
        const { id } = req.params;
        
        try {
            const result = await pool.query(
                'SELECT f.*, u.username FROM files f JOIN users u ON f.user_id = u.id WHERE f.id = $1',
                [id]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'File not found' });
            }
            
            res.json({ success: true, file: result.rows[0] });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Delete file
    async deleteFile(req, res) {
        const { id } = req.params;
        const { userId } = req.body;
        
        try {
            // Check if user owns the file or is admin
            const checkResult = await pool.query(
                'SELECT * FROM files WHERE id = $1 AND (user_id = $2 OR $3 = (SELECT role FROM users WHERE id = $2))',
                [id, userId, userId]
            );
            
            if (checkResult.rows.length === 0) {
                return res.status(403).json({ success: false, message: 'Not authorized to delete this file' });
            }
            
            const result = await pool.query(
                'DELETE FROM files WHERE id = $1 RETURNING filename',
                [id]
            );
            
            // Log activity
            await pool.query(
                'INSERT INTO activity_logs (user_id, action, description) VALUES ($1, $2, $3)',
                [userId, 'file_delete', `User deleted file: ${result.rows[0].filename}`]
            );
            
            res.json({ success: true, message: 'File deleted successfully' });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Share file with another user
    async shareFile(req, res) {
        const { fileId, sharedWith } = req.body;
        const { userId } = req.query;
        
        try {
            const result = await pool.query(
                'INSERT INTO shared_files (file_id, shared_by, shared_with) VALUES ($1, $2, $3) RETURNING *',
                [fileId, userId, sharedWith]
            );
            
            // Update file as shared
            await pool.query(
                'UPDATE files SET is_shared = true WHERE id = $1',
                [fileId]
            );
            
            // Log activity
            await pool.query(
                'INSERT INTO activity_logs (user_id, action, description) VALUES ($1, $2, $3)',
                [userId, 'file_share', `User shared file ID: ${fileId} with user ID: ${sharedWith}`]
            );
            
            res.json({ success: true, sharedFile: result.rows[0] });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Get shared files for a user
    async getSharedFiles(req, res) {
        const { userId } = req.query;
        
        try {
            const result = await pool.query(
                `SELECT f.*, u.username as owner_username, su.username as shared_by_username
                FROM shared_files sf
                JOIN files f ON sf.file_id = f.id
                JOIN users u ON f.user_id = u.id
                JOIN users su ON sf.shared_by = su.id
                WHERE sf.shared_with = $1
                ORDER BY sf.created_at DESC`,
                [userId]
            );
            
            res.json({ success: true, files: result.rows });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new FileController();