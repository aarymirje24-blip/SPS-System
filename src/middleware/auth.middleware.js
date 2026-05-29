const { verifyAccessToken } = require('../utils/jwt');
const pool = require('../config/db');

async function authMiddleware(req, res, next) {
    // Try to get token from cookie first
    let token = req.cookies?.auth_token;
    
    // If not in cookie, check Authorization header
    if (!token && req.headers.authorization) {
        const authHeader = req.headers.authorization;
        if (authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
    }
    
    // No token found
    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: 'Authentication required' 
        });
    }
    
    try {
        // Verify the token
        const decoded = verifyAccessToken(token);
        
        // Fetch current user from database to ensure role and active status are fresh
        const result = await pool.query(
            'SELECT id, org_id, email, full_name, role, avatar_url, is_active FROM users WHERE id = $1',
            [decoded.id]
        );

        const user = result.rows[0];
        if (!user || !user.is_active) {
            return res.status(401).json({ 
                success: false, 
                message: 'Authentication required' 
            });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ 
            success: false, 
            message: 'Invalid or expired token' 
        });
    }
}

module.exports = authMiddleware;