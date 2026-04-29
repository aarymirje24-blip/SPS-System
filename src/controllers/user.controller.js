const userModel = require('../models/user.model');
const auditModel = require('../models/audit.model');
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const env = require('../config/env');
const { sendInvitationEmail, sendPasswordResetEmail } = require('../services/email.service');

async function listUsers(req, res, next) {
    try {
        const { page = 1, limit = 20, role, is_active, search } = req.query;
        const result = await userModel.findAllByOrg(req.user.org_id, {
            page: parseInt(page),
            limit: parseInt(limit),
            role,
            is_active: is_active !== undefined ? is_active === 'true' : undefined,
            search
        });
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
}

async function getUser(req, res, next) {
    try {
        const user = await userModel.findById(req.params.id);
        if (!user || user.org_id !== req.user.org_id) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        return res.status(200).json({ success: true, user });
    } catch (error) {
        next(error);
    }
}

async function updateUser(req, res, next) {
    try {
        const user = await userModel.findById(req.params.id);
        if (!user || user.org_id !== req.user.org_id) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        const { full_name, is_active, role } = req.body;
        const fields = {};
        if (full_name !== undefined) fields.full_name = full_name;
        if (is_active !== undefined) fields.is_active = is_active;
        if (role !== undefined) fields.role = role;
        
        if (fields.role && req.user.role !== 'super_admin') {
            return res.status(403).json({ success: false, message: 'Only super admins can change roles' });
        }
        
        if (user.role === 'super_admin' && req.user.role !== 'super_admin') {
            return res.status(403).json({ success: false, message: 'Only super admins can modify a super admin' });
        }
        
        const updated = await userModel.updateById(req.params.id, fields);
        
        await auditModel.log({
            org_id: req.user.org_id,
            actor_id: req.user.id,
            action: 'USER_UPDATED',
            resource_type: 'user',
            resource_id: req.params.id,
            meta: fields
        });
        
        return res.status(200).json({ success: true, user: updated });
    } catch (error) {
        next(error);
    }
}

async function inviteUser(req, res, next) {
    try {
        const { email, role = 'user' } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }
        if (role === 'super_admin') {
            return res.status(400).json({ success: false, message: 'Cannot invite a user as super_admin' });
        }
        
        const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ success: false, message: 'A user with this email already exists' });
        }
        
        const existingInvite = await pool.query(
            "SELECT id FROM invitations WHERE email = $1 AND org_id = $2 AND status = 'pending'",
            [email, req.user.org_id]
        );
        if (existingInvite.rows.length > 0) {
            return res.status(409).json({ success: false, message: 'An invitation has already been sent to this email' });
        }
        
        const token = crypto.randomBytes(32).toString('hex');
        const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        
        const inviteResult = await pool.query(`
            INSERT INTO invitations (org_id, invited_by, email, role, token, expires_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, email, role, expires_at
        `, [req.user.org_id, req.user.id, email, role, token, expires_at]);
        
        await auditModel.log({
            org_id: req.user.org_id,
            actor_id: req.user.id,
            action: 'USER_INVITED',
            meta: { email, role }
        });
        
        const invite_url = env.APP_BASE_URL + '/accept-invite/' + token;
        
        const inviter = await userModel.findById(req.user.id);
        const orgResult = await pool.query('SELECT name FROM organisations WHERE id = $1', [req.user.org_id]);
        const orgName = orgResult.rows[0]?.name || 'your organisation';

        sendInvitationEmail({
            to: email,
            inviterName: inviter.full_name,
            orgName,
            inviteUrl: invite_url,
            role
        }).catch(err => console.error('Invite email failed:', err.message));

        return res.status(201).json({
            success: true,
            invitation: inviteResult.rows[0],
            invite_url
        });
    } catch (error) {
        next(error);
    }
}

async function adminResetPassword(req, res, next) {
    try {
        const user = await userModel.findById(req.params.id);
        if (!user || user.org_id !== req.user.org_id) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 60 * 60 * 1000);
        
        await userModel.updateById(req.params.id, { reset_token: token, reset_token_expires: expires });
        
        await auditModel.log({
            org_id: req.user.org_id,
            actor_id: req.user.id,
            action: 'PASSWORD_RESET_REQUESTED',
            resource_type: 'user',
            resource_id: req.params.id
        });
        
        const reset_url = env.APP_BASE_URL + '/reset-password/' + token;
        
        const targetUserFull = await userModel.findById(req.params.id);
        sendPasswordResetEmail({
            to: targetUserFull.email,
            resetUrl: reset_url,
            userName: targetUserFull.full_name
        }).catch(err => console.error('Reset email failed:', err.message));

        return res.status(200).json({ success: true, message: 'Password reset initiated', reset_url });
    } catch (error) {
        next(error);
    }
}

async function deleteUser(req, res, next) {
    try {
        if (req.params.id === req.user.id) {
            return res.status(400).json({ success: false, message: 'Cannot deactivate yourself' });
        }
        
        const user = await userModel.findById(req.params.id);
        if (!user || user.org_id !== req.user.org_id) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        if (user.role === 'super_admin') {
            return res.status(403).json({ success: false, message: 'Cannot deactivate a super admin' });
        }
        
        await userModel.softDeleteById(req.params.id, req.user.id);
        
        await auditModel.log({
            org_id: req.user.org_id,
            actor_id: req.user.id,
            action: 'USER_DEACTIVATED',
            resource_type: 'user',
            resource_id: req.params.id
        });
        
        return res.status(200).json({ success: true, message: 'User deactivated' });
    } catch (error) {
        next(error);
    }
}

async function getMyProfile(req, res, next) {
    try {
        const user = await userModel.findById(req.user.id);
        return res.status(200).json({ success: true, user });
    } catch (error) {
        next(error);
    }
}

async function updateMyProfile(req, res, next) {
    try {
        const fields = {};
        if (req.body.full_name) fields.full_name = req.body.full_name;
        
        // If a file was uploaded (avatar), save the Cloudinary URL
        if (req.cloudinaryResult) {
            fields.avatar_url = req.cloudinaryResult.secure_url;
        }
        
        if (Object.keys(fields).length === 0) {
            return res.status(400).json({ success: false, message: 'No fields to update' });
        }
        
        const updated = await userModel.updateById(req.user.id, fields);
        return res.status(200).json({ success: true, user: updated });
    } catch (error) {
        next(error);
    }
}

async function changeMyPassword(req, res, next) {
    try {
        const { current_password, new_password } = req.body;
        if (!current_password || !new_password) {
            return res.status(400).json({ success: false, message: 'Both current and new password are required' });
        }
        if (new_password.length < 8) {
            return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
        }
        // Fetch full user with password_hash
        const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
        const user = result.rows[0];
        const match = await bcrypt.compare(current_password, user.password_hash);
        if (!match) {
            return res.status(401).json({ success: false, message: 'Current password is incorrect' });
        }
        const hash = await bcrypt.hash(new_password, 12);
        await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
        await auditModel.log({ org_id: req.user.org_id, actor_id: req.user.id, action: 'PASSWORD_CHANGED', resource_type: 'user', resource_id: req.user.id });
        return res.status(200).json({ success: true, message: 'Password updated' });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    listUsers,
    getUser,
    updateUser,
    inviteUser,
    adminResetPassword,
    deleteUser,
    getMyProfile,
    updateMyProfile,
    changeMyPassword
};
