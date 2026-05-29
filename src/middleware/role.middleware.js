function requireRole(...roles) {
    return function(req, res, next) {
        // Check if req.user exists
        if (!req.user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Authentication required' 
            });
        }
        
        const userRole = typeof req.user.role === 'string' ? req.user.role.toLowerCase() : '';
        const allowedRoles = roles.map(r => r.toLowerCase());

        // Check if user's role is in the allowed roles
        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({ 
                success: false, 
                message: 'Insufficient permissions' 
            });
        }
        
        next();
    };
}

module.exports = requireRole;