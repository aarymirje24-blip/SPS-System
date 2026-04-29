function requireRole(...roles) {
    return function(req, res, next) {
        // Check if req.user exists
        if (!req.user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Authentication required' 
            });
        }
        
        // Check if user's role is in the allowed roles
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                success: false, 
                message: 'Insufficient permissions' 
            });
        }
        
        next();
    };
}

module.exports = requireRole;