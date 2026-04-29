const fileModel = require('../models/file.model');
const shareModel = require('../models/share.model');
const auditModel = require('../models/audit.model');
const userModel = require('../models/user.model');

async function createShare(req, res, next) {
    try {
        const file = await fileModel.findById(req.params.id, req.user.org_id);
        if (!file) {
            return res.status(404).json({ success: false, message: 'File not found' });
        }
        
        if (file.uploaded_by !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
            return res.status(403).json({ success: false, message: 'Permission denied to share this file' });
        }
        
        const { share_type, shared_with_user_id, permission = 'view', expires_at } = req.body;
        
        if (share_type !== 'user' && share_type !== 'org_wide') {
            return res.status(400).json({ success: false, message: 'Invalid share_type' });
        }
        
        if (share_type === 'org_wide' && req.user.role === 'user') {
            return res.status(403).json({ success: false, message: 'Only admins can share org-wide' });
        }
        
        if (share_type === 'user') {
            if (!shared_with_user_id) {
                return res.status(400).json({ success: false, message: 'shared_with_user_id is required' });
            }
            if (shared_with_user_id === req.user.id) {
                return res.status(400).json({ success: false, message: 'Cannot share with yourself' });
            }
            const targetUser = await userModel.findById(shared_with_user_id);
            if (!targetUser || targetUser.org_id !== req.user.org_id) {
                return res.status(400).json({ success: false, message: 'Target user not found in your organisation' });
            }
        }
        
        const share = await shareModel.create({
            file_id: req.params.id,
            shared_by: req.user.id,
            share_type,
            shared_with_user_id: share_type === 'user' ? shared_with_user_id : null,
            permission,
            expires_at: expires_at || null
        });
        
        await auditModel.log({
            org_id: req.user.org_id,
            actor_id: req.user.id,
            action: 'FILE_SHARE',
            resource_type: 'file',
            resource_id: file.id,
            meta: { share_type, recipient: share_type === 'user' ? shared_with_user_id : 'org_wide' }
        });
        
        return res.status(201).json({ success: true, share });
    } catch (error) {
        next(error);
    }
}

async function listShares(req, res, next) {
    try {
        const file = await fileModel.findById(req.params.id, req.user.org_id);
        if (!file) {
            return res.status(404).json({ success: false, message: 'File not found' });
        }
        
        if (file.uploaded_by !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
            return res.status(403).json({ success: false, message: 'Permission denied to view shares' });
        }
        
        const shares = await shareModel.findByFileId(req.params.id, req.user.org_id);
        return res.status(200).json({ success: true, shares });
    } catch (error) {
        next(error);
    }
}

async function revokeShare(req, res, next) {
    try {
        const file = await fileModel.findById(req.params.id, req.user.org_id);
        if (!file) {
            return res.status(404).json({ success: false, message: 'File not found' });
        }
        
        const share = await shareModel.findById(req.params.shareId);
        if (!share) {
            return res.status(404).json({ success: false, message: 'Share not found' });
        }
        
        if (share.file_id !== file.id) {
            return res.status(400).json({ success: false, message: 'Share does not belong to this file' });
        }
        
        if (share.shared_by !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
            return res.status(403).json({ success: false, message: 'Permission denied to revoke share' });
        }
        
        await shareModel.deleteById(req.params.shareId);
        
        await auditModel.log({
            org_id: req.user.org_id,
            actor_id: req.user.id,
            action: 'FILE_SHARE_REVOKED',
            resource_type: 'share',
            resource_id: share.id,
            meta: { file_id: file.id }
        });
        
        return res.status(200).json({ success: true, message: 'Share revoked' });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    createShare,
    listShares,
    revokeShare
};
