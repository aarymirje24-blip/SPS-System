const fileModel = require('../models/file.model');
const folderModel = require('../models/folder.model');
const cloudinaryService = require('../services/cloudinary.service');
const auditModel = require('../models/audit.model');

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
        const file = await fileModel.findById(req.params.id, req.user.org_id);
        if (!file) {
            return res.status(404).json({ success: false, message: 'File not found' });
        }
        res.status(200).json({ success: true, file });
    } catch (error) {
        next(error);
    }
}

async function download(req, res, next) {
    try {
        const file = await fileModel.findById(req.params.id, req.user.org_id);
        if (!file) {
            return res.status(404).json({ success: false, message: 'File not found' });
        }

        const url = await cloudinaryService.generateSignedUrl(file.cloudinary_public_id, file.cloudinary_resource_type, 60);

        auditModel.log({
            org_id: req.user.org_id,
            actor_id: req.user.id,
            action: 'FILE_DOWNLOAD',
            resource_type: 'file',
            resource_id: file.id
        });

        res.status(200).json({ success: true, url, expires_in: 60 });
    } catch (error) {
        next(error);
    }
}

async function remove(req, res, next) {
    try {
        const file = await fileModel.findById(req.params.id, req.user.org_id);
        if (!file) {
            return res.status(404).json({ success: false, message: 'File not found' });
        }

        if (file.uploaded_by !== req.user.id && req.user.role === 'user') {
            return res.status(403).json({ success: false, message: 'Forbidden: You do not own this file' });
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
        const file = await fileModel.findById(req.params.id, req.user.org_id);
        if (!file) {
            return res.status(404).json({ success: false, message: 'File not found' });
        }

        if (file.uploaded_by !== req.user.id && req.user.role === 'user') {
            return res.status(403).json({ success: false, message: 'Forbidden: You do not own this file' });
        }

        const updatedFile = await fileModel.updateById(req.params.id, req.user.org_id, req.body);
        
        res.status(200).json({ success: true, file: updatedFile });
    } catch (error) {
        next(error);
    }
}

module.exports = { upload, list, getOne, download, remove, update };
