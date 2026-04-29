const { verifyAccessToken } = require('../utils/jwt');
const pool = require('../config/db');

async function authRedirectMiddleware(req, res, next) {
    try {
        let token;
        
        // Check cookies first
        if (req.cookies && req.cookies.auth_token) {
            token = req.cookies.auth_token;
        } 
        // Then check Authorization header
        else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.redirect('/login');
        }

        const decoded = verifyAccessToken(token);
        if (!decoded) {
            return res.redirect('/login');
        }

        // Fetch user from database to ensure they are still active
        const result = await pool.query(
            'SELECT id, org_id, role, full_name, email, is_active, avatar_url FROM users WHERE id = $1',
            [decoded.id]
        );

        const user = result.rows[0];

        if (!user || !user.is_active) {
            return res.redirect('/login');
        }

        req.user = user;
        next();

    } catch (error) {
        console.error('Auth redirect middleware error:', error);
        return res.redirect('/login');
    }
}

module.exports = authRedirectMiddleware;
