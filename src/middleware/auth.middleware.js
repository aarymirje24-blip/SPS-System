const { verifyAccessToken } = require('../utils/jwt');

function authMiddleware(req, res, next) {
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
        
        // Attach user to request
        req.user = decoded;
        
        next();
    } catch (error) {
        return res.status(401).json({ 
            success: false, 
            message: 'Invalid or expired token' 
        });
    }
}

module.exports = authMiddleware;