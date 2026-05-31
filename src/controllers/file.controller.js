const fileModel = require('../models/file.model');
const folderModel = require('../models/folder.model');
const cloudinaryService = require('../services/cloudinary.service');
const auditModel = require('../models/audit.model');
const shareModel = require('../models/share.model');
const https = require('https');
const http = require('http');
const { URL } = require('url');

async function upload(req, res, next) {
    try {
        const { id: userId, org_id, role } = req.user;
        
        if (!req.cloudinaryResult) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const quota = await fileModel.checkOrgStorage(org_id);
        if (!quota.has_space) {
            await cloudinaryService.deleteFile(req.cloudinaryResult.public_id, req.cloudinaryResult.resource_type);
            return res.status(413).json({ success: false, message: 'Organisation storage quota exceeded' });
        }

        let { folder_id, description, tags } = req.body;
        
        if (tags && typeof tags === 'string') {
            try {
                tags = JSON.parse(tags);
            } catch (e) {
                tags = [];
            }
        }

        if (folder_id) {
            const folder = await folderModel.findById(folder_id, org_id);
            if (!folder) {
                return res.status(404).json({ success: false, message: 'Folder not found' });
            }
        }

        const newFile = await fileModel.create({
            org_id,
            folder_id: folder_id || null,
            uploaded_by: userId,
            original_name: req.file.originalname,
            cloudinary_public_id: req.cloudinaryResult.public_id,
            cloudinary_url: req.cloudinaryResult.secure_url,
            cloudinary_resource_type: req.cloudinaryResult.resource_type,
            mime_type: req.file.mimetype,
            size_bytes: req.cloudinaryResult.bytes,
            description: description || null,
            tags: tags || []
        });

        auditModel.log({
            org_id,
            actor_id: userId,
            action: 'FILE_UPLOAD',
            resource_type: 'file',
            resource_id: newFile.id,
            meta: { original_name: req.file.originalname, size_bytes: newFile.size_bytes }
        });

        res.status(201).json({ success: true, file: newFile });
    } catch (error) {
        next(error);
    }
}

async function list(req, res, next) {
    try {
        const { org_id, id: userId, role } = req.user;
        const { folder_id, page = 1, limit = 20, search, mime_type, shared } = req.query;

        let result;
        if ((role === 'admin' || role === 'super_admin') && !folder_id && !shared) {
            result = await fileModel.findAllByOrg(org_id, { page, limit, search, mime_type });
        } else if (folder_id && !shared) {
            result = await fileModel.findByFolder(folder_id, org_id, { page, limit });
        } else {
            result = await fileModel.findAccessibleByUser(userId, org_id, { page, limit, search, mime_type });
        }

        res.status(200).json({ success: true, ...result });
    } catch (error) {
        next(error);
    }
}

async function getOne(req, res, next) {
    try {
        const fileExists = await fileModel.findById(req.params.id, req.user.org_id);
        if (!fileExists) {
            return res.status(404).json({ success: false, message: 'File not found' });
        }
        
        const file = await shareModel.checkAccess(req.params.id, req.user.id, req.user.org_id, req.user.role);
        if (!file) {
            return res.status(403).json({ success: false, message: 'Access denied to this file' });
        }
        
        res.status(200).json({ success: true, file });
    } catch (error) {
        next(error);
    }
}

async function download(req, res, next) {
    try {
        const fileExists = await fileModel.findById(req.params.id, req.user.org_id);
        if (!fileExists) {
            return res.status(404).json({ success: false, message: 'File not found' });
        }

        const file = await shareModel.checkAccess(req.params.id, req.user.id, req.user.org_id, req.user.role);
        if (!file) {
            return res.status(403).json({ success: false, message: 'Access denied to this file' });
        }

        // Only allow download if resolved_permission is owner, admin, download, or edit
        const permitted = ['owner', 'admin', 'download', 'edit'];
        if (!permitted.includes(file.resolved_permission)) {
            return res.status(403).json({ success: false, message: 'Forbidden: You do not have permission to download this file' });
        }

        const url = await cloudinaryService.generateSignedUrl(
            file.cloudinary_public_id,
            file.cloudinary_resource_type,
            60,
            file.original_name
        );

        auditModel.log({
            org_id: req.user.org_id,
            actor_id: req.user.id,
            action: 'FILE_DOWNLOAD',
            resource_type: 'file',
            resource_id: file.id
        });

        // Fetch file from Cloudinary and stream it to client, following redirects if needed
        function streamFromCloudinary(targetUrl, redirectCount = 0) {
            if (redirectCount > 5) {
                return res.status(500).json({ success: false, message: 'Too many redirects from storage' });
            }

            const protocol = targetUrl.startsWith('https') ? https : http;
            protocol.get(targetUrl, (cloudinaryRes) => {
                if (cloudinaryRes.statusCode >= 300 && cloudinaryRes.statusCode < 400 && cloudinaryRes.headers.location) {
                    return streamFromCloudinary(cloudinaryRes.headers.location, redirectCount + 1);
                }

                if (cloudinaryRes.statusCode !== 200) {
                    return res.status(500).json({ success: false, message: 'Failed to fetch file from storage' });
                }

                // Set headers ONLY when we have a successful 200 OK stream from Cloudinary!
                const filename = file.original_name.replace(/"/g, '\\"');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');

                cloudinaryRes.pipe(res);
            }).on('error', (err) => {
                console.error('Cloudinary download error:', err);
                res.status(500).json({ success: false, message: 'Error downloading file' });
            });
        }

        streamFromCloudinary(url);
    } catch (error) {
        next(error);
    }
}

async function remove(req, res, next) {
    try {
        const fileExists = await fileModel.findById(req.params.id, req.user.org_id);
        if (!fileExists) {
            return res.status(404).json({ success: false, message: 'File not found' });
        }

        const file = await shareModel.checkAccess(req.params.id, req.user.id, req.user.org_id, req.user.role);
        if (!file) {
            return res.status(403).json({ success: false, message: 'Access denied to this file' });
        }

        // Only allow delete if resolved_permission is owner, admin, or edit
        const permitted = ['owner', 'admin', 'edit'];
        if (!permitted.includes(file.resolved_permission)) {
            return res.status(403).json({ success: false, message: 'Forbidden: You do not have permission to delete this file' });
        }

        const deleted = await fileModel.softDeleteById(req.params.id, req.user.org_id, req.user.id);
        if (deleted) {
            await cloudinaryService.deleteFile(deleted.cloudinary_public_id, deleted.cloudinary_resource_type);
        }

        auditModel.log({
            org_id: req.user.org_id,
            actor_id: req.user.id,
            action: 'FILE_DELETE',
            resource_type: 'file',
            resource_id: req.params.id
        });

        res.status(200).json({ success: true, message: 'File deleted' });
    } catch (error) {
        next(error);
    }
}

async function update(req, res, next) {
    try {
        const fileExists = await fileModel.findById(req.params.id, req.user.org_id);
        if (!fileExists) {
            return res.status(404).json({ success: false, message: 'File not found' });
        }

        const file = await shareModel.checkAccess(req.params.id, req.user.id, req.user.org_id, req.user.role);
        if (!file) {
            return res.status(403).json({ success: false, message: 'Access denied to this file' });
        }

        // Only allow edit if resolved_permission is owner, admin, or edit
        const permitted = ['owner', 'admin', 'edit'];
        if (!permitted.includes(file.resolved_permission)) {
            return res.status(403).json({ success: false, message: 'Forbidden: You do not have permission to edit this file' });
        }

        const updatedFile = await fileModel.updateById(req.params.id, req.user.org_id, req.body);
        
        res.status(200).json({ success: true, file: updatedFile });
    } catch (error) {
        next(error);
    }
}

module.exports = { upload, list, getOne, download, remove, update };
