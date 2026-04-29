const pool = require('../config/db');

class UserController {
    // Register new user
    async register(req, res) {
        const { username, email, password, role = 'user' } = req.body;
        
        try {
            const result = await pool.query(
                'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role',
                [username, email, password, role]
            );
            
            // Log activity
            await pool.query(
                'INSERT INTO activity_logs (user_id, action, description) VALUES ($1, $2, $3)',
                [result.rows[0].id, 'register', `User ${username} registered`]
            );
            
            res.json({ success: true, user: result.rows[0] });
        } catch (error) {
            if (error.code === '23505') { // Unique violation
                res.status(400).json({ success: false, message: 'Username or email already exists' });
            } else {
                res.status(500).json({ success: false, message: error.message });
            }
        }
    }

    // Login user
    async login(req, res) {
        const { username, password } = req.body;
        
        try {
            const result = await pool.query(
                'SELECT * FROM users WHERE username = $1',
                [username]
            );
            
            if (result.rows.length === 0) {
                return res.status(401).json({ success: false, message: 'Invalid credentials' });
            }
            
            const user = result.rows[0];
            
            if (user.password !== password) {
                return res.status(401).json({ success: false, message: 'Invalid credentials' });
            }
            
            // Log activity
            await pool.query(
                'INSERT INTO activity_logs (user_id, action, description, ip_address) VALUES ($1, $2, $3, $4)',
                [user.id, 'login', `User ${username} logged in`, req.ip]
            );
            
            res.json({ 
                success: true, 
                user: { id: user.id, username: user.username, email: user.email, role: user.role }
            });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Get all users (admin only)
    async getAllUsers(req, res) {
        try {
            const result = await pool.query(
                'SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC'
            );
            res.json({ success: true, users: result.rows });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Get user by ID
    async getUserById(req, res) {
        const { id } = req.params;
        
        try {
            const result = await pool.query(
                'SELECT id, username, email, role, created_at FROM users WHERE id = $1',
                [id]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }
            
            res.json({ success: true, user: result.rows[0] });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Update user
    async updateUser(req, res) {
        const { id } = req.params;
        const { username, email, role } = req.body;
        
        try {
            const result = await pool.query(
                'UPDATE users SET username = $1, email = $2, role = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING id, username, email, role',
                [username, email, role, id]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }
            
            res.json({ success: true, user: result.rows[0] });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }

    // Delete user
    async deleteUser(req, res) {
        const { id } = req.params;
        
        try {
            const result = await pool.query(
                'DELETE FROM users WHERE id = $1 RETURNING id',
                [id]
            );
            
            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }
            
            res.json({ success: true, message: 'User deleted successfully' });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}

module.exports = new UserController();