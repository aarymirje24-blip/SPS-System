const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../config/db');
const { signAccessToken } = require('../utils/jwt');
const env = require('../config/env');
const { sendPasswordResetEmail } = require('../services/email.service');

// Cookie helper function
function setCookie(res, token) {
    res.cookie('auth_token', token, {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 8 * 60 * 60 * 1000  // 8 hours in ms
    });
}

// REGISTER handler
async function register(req, res, next) {
    const { org_name, email, password, full_name } = req.body;

    // Validate all fields are present
    if (!org_name || !email || !password || !full_name) {
        return res.status(400).json({
            success: false,
            message: 'All fields are required: org_name, email, password, full_name'
        });
    }

    // Check password length
    if (password.length < 8) {
        return res.status(400).json({
            success: false,
            message: 'Password must be at least 8 characters'
        });
    }

    const client = await pool.connect();

    try {
        // Check if user with that email already exists
        const existingUser = await client.query(
            'SELECT id FROM users WHERE email = $1',
            [email]
        );

        if (existingUser.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // Generate org slug
        const slugBase = org_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        const slug = `${slugBase}-${randomNum}`;

        // Begin transaction
        await client.query('BEGIN');

        // Insert organisation
        const orgResult = await client.query(
            'INSERT INTO organisations (name, slug) VALUES ($1, $2) RETURNING id',
            [org_name, slug]
        );
        const orgId = orgResult.rows[0].id;

        // Hash password
        const hash = await bcrypt.hash(password, 12);

        // Insert user as super_admin
        const userResult = await client.query(
            `INSERT INTO users (org_id, email, password_hash, full_name, role) 
             VALUES ($1, $2, $3, $4, 'super_admin') 
             RETURNING id, email, full_name, role, org_id`,
            [orgId, email, hash, full_name]
        );
        const user = userResult.rows[0];

        // Insert audit log
        await client.query(
            `INSERT INTO audit_logs (org_id, actor_id, action, resource_type, resource_id, meta) 
             VALUES ($1, $2, 'ORG_CREATED', 'org', $1, $3)`,
            [orgId, user.id, { ip: req.ip }]
        );

        // Commit transaction
        await client.query('COMMIT');

        // Create JWT payload
        const payload = {
            id: user.id,
            org_id: user.org_id,
            role: user.role
        };

        // Sign token and set cookie
        const token = signAccessToken(payload);
        setCookie(res, token);

        // Return success
        return res.status(201).json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                role: user.role
            }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Register error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    } finally {
        client.release();
    }
}

// LOGIN handler
async function login(req, res, next) {
    const { email, password } = req.body;

    // Validate email and password
    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Email and password are required'
        });
    }

    try {
        // Query user
        const result = await pool.query(
            `SELECT id, org_id, email, password_hash, full_name, role, is_active, 
                    failed_login_attempts, lockout_until 
             FROM users WHERE email = $1`,
            [email]
        );

        const user = result.rows[0];

        // No user found
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check if account is active
        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: 'Account deactivated'
            });
        }

        // Check lockout
        if (user.lockout_until && new Date(user.lockout_until) > new Date()) {
            return res.status(429).json({
                success: false,
                message: 'Account temporarily locked. Try again later.'
            });
        }

        // Compare password
        const match = await bcrypt.compare(password, user.password_hash);

        if (!match) {
            // Increment failed login attempts
            const newAttempts = (user.failed_login_attempts || 0) + 1;
            let lockoutUntil = null;

            // Lock account after 5 failed attempts
            if (newAttempts >= 5) {
                lockoutUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
            }

            await pool.query(
                `UPDATE users SET failed_login_attempts = $1, lockout_until = $2 WHERE id = $3`,
                [newAttempts, lockoutUntil, user.id]
            );

            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Reset failed attempts and update last login
        await pool.query(
            `UPDATE users SET failed_login_attempts = 0, lockout_until = NULL, last_login_at = NOW() WHERE id = $1`,
            [user.id]
        );

        // Insert audit log
        await pool.query(
            `INSERT INTO audit_logs (org_id, actor_id, action, resource_type, resource_id, meta) 
             VALUES ($1, $2, 'USER_LOGIN', 'user', $2, $3)`,
            [user.org_id, user.id, { ip: req.ip }]
        );

        // Create JWT payload
        const payload = {
            id: user.id,
            org_id: user.org_id,
            role: user.role
        };

        // Sign token and set cookie
        const token = signAccessToken(payload);
        setCookie(res, token);

        // Return success
        return res.status(200).json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                full_name: user.full_name,
                role: user.role
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

// LOGOUT handler
function logout(req, res) {
    res.clearCookie('auth_token');
    return res.status(200).json({
        success: true,
        message: 'Logged out'
    });
}

// GET ME handler
async function getMe(req, res) {
    try {
        const result = await pool.query(
            `SELECT id, org_id, email, full_name, role, avatar_url, last_login_at 
             FROM users WHERE id = $1`,
            [req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        return res.status(200).json({
            success: true,
            user: result.rows[0]
        });

    } catch (error) {
        console.error('GetMe error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
}

// ACCEPT INVITE handler
async function acceptInvite(req, res, next) {
    const { token } = req.params;
    const { full_name, password } = req.body;

    if (!full_name || !password) {
        return res.status(400).json({ success: false, message: 'Full name and password are required' });
    }

    if (password.length < 8) {
        return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    const client = await pool.connect();

    try {
        const inviteResult = await client.query(
            "SELECT * FROM invitations WHERE token = $1 AND status = 'pending'",
            [token]
        );

        if (inviteResult.rows.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid or expired invitation' });
        }

        const invite = inviteResult.rows[0];

        if (new Date(invite.expires_at) < new Date()) {
            await client.query("UPDATE invitations SET status = 'expired' WHERE id = $1", [invite.id]);
            return res.status(400).json({ success: false, message: 'Invitation has expired' });
        }

        const existingUser = await client.query("SELECT id FROM users WHERE email = $1", [invite.email]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ success: false, message: 'Email already registered' });
        }

        await client.query('BEGIN');

        const hash = await bcrypt.hash(password, 12);

        const userResult = await client.query(
            `INSERT INTO users (org_id, email, password_hash, full_name, role)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, email, full_name, role, org_id`,
            [invite.org_id, invite.email, hash, full_name, invite.role]
        );

        const user = userResult.rows[0];

        await client.query("UPDATE invitations SET status = 'accepted' WHERE id = $1", [invite.id]);

        await client.query(
            `INSERT INTO audit_logs (org_id, actor_id, action, resource_type, resource_id, meta)
             VALUES ($1, $2, 'USER_JOINED', 'user', $2, $3)`,
            [user.org_id, user.id, { email: invite.email }]
        );

        await client.query('COMMIT');

        const payload = { id: user.id, org_id: user.org_id, role: user.role };
        const new_token = signAccessToken(payload);
        setCookie(res, new_token);

        return res.status(201).json({
            success: true,
            user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role }
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Accept Invite error:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    } finally {
        client.release();
    }
}

// FORGOT PASSWORD handler
async function forgotPassword(req, res, next) {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }

        const result = await pool.query(
            'SELECT id, full_name, org_id FROM users WHERE email = $1 AND is_active = true',
            [email]
        );

        const user = result.rows[0];

        if (user) {
            const token = crypto.randomBytes(32).toString('hex');
            const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

            await pool.query(
                'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
                [token, expires, user.id]
            );

            const resetUrl = env.APP_BASE_URL + '/reset-password/' + token;
            
            sendPasswordResetEmail({ 
                to: email, 
                resetUrl, 
                userName: user.full_name 
            }).catch(err => console.error('Reset email failed:', err.message));
        }

        return res.status(200).json({ 
            success: true, 
            message: 'If that email is registered, a reset link has been sent.' 
        });

    } catch (error) {
        next(error);
    }
}

// RESET PASSWORD handler
async function resetPassword(req, res, next) {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!password || password.length < 8) {
            return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
        }

        const result = await pool.query(
            'SELECT id, org_id, role, reset_token_expires FROM users WHERE reset_token = $1 AND is_active = true',
            [token]
        );

        const user = result.rows[0];

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired reset link' });
        }

        if (new Date(user.reset_token_expires) < new Date()) {
            return res.status(400).json({ success: false, message: 'Reset link has expired' });
        }

        const hash = await bcrypt.hash(password, 12);

        await pool.query(
            `UPDATE users 
             SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL, failed_login_attempts = 0, lockout_until = NULL 
             WHERE id = $2`,
            [hash, user.id]
        );

        await pool.query(
            `INSERT INTO audit_logs (org_id, actor_id, action, resource_type, resource_id) 
             VALUES ($1, $2, 'PASSWORD_RESET', 'user', $2)`,
            [user.org_id, user.id]
        );

        return res.status(200).json({ success: true, message: 'Password has been reset. You can now log in.' });

    } catch (error) {
        next(error);
    }
}

module.exports = { register, login, logout, getMe, acceptInvite, forgotPassword, resetPassword };