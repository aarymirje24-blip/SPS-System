const folderModel = require('../models/folder.model');
const fileModel = require('../models/file.model');
const auditModel = require('../models/audit.model');

async function create(req, res, next) {
    try {
        const { name, parent_id } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, message: 'Folder name is required' });
        }

        if (!parent_id) {
            if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
                return res.status(403).json({ success: false, message: 'Only admins can create root folders' });
            }
        } else {
            const parent = await folderModel.findById(parent_id, req.user.org_id);
            if (!parent) {
                return res.status(404).json({ success: false, message: 'Parent folder not found' });
            }
        }

        const folder = await folderModel.create({
            org_id: req.user.org_id,
            created_by: req.user.id,
            parent_id: parent_id || null,
            name
        });

        auditModel.log({
            org_id: req.user.org_id,
            actor_id: req.user.id,
            action: 'FOLDER_CREATE',
            resource_type: 'folder',
            resource_id: folder.id,
            meta: { name: folder.name }
        });

        res.status(201).json({ success: true, folder });
    } catch (error) {
        next(error);
    }
}

async function listRoot(req, res, next) {
    try {
        const folders = await folderModel.findRootByOrg(req.user.org_id);
        res.status(200).json({ success: true, folders });
    } catch (error) {
        next(error);
    }
}

async function getContents(req, res, next) {
    try {
        const folder = await folderModel.findById(req.params.id, req.user.org_id);
        if (!folder) {
            return res.status(404).json({ success: false, message: 'Folder not found' });
        }

        const subFolders = await folderModel.findChildren(req.params.id, req.user.org_id);
        const fileResult = await fileModel.findByFolder(req.params.id, req.user.org_id);
        const breadcrumb = await folderModel.getBreadcrumb(req.params.id, req.user.org_id);

        res.status(200).json({
            success: true,
            folder,
            subFolders,
            files: fileResult.files,
            breadcrumb
        });
    } catch (error) {
        next(error);
    }
}

async function rename(req, res, next) {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ success: false, message: 'Folder name is required' });
        }

        const folder = await folderModel.findById(req.params.id, req.user.org_id);
        if (!folder) {
            return res.status(404).json({ success: false, message: 'Folder not found' });
        }

        if (folder.created_by !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
            return res.status(403).json({ success: false, message: 'Forbidden: You cannot rename this folder' });
        }

        const updatedFolder = await folderModel.renameById(req.params.id, req.user.org_id, name);
        res.status(200).json({ success: true, folder: updatedFolder });
    } catch (error) {
        next(error);
    }
}

async function remove(req, res, next) {
    try {
        const folder = await folderModel.findById(req.params.id, req.user.org_id);
        if (!folder) {
            return res.status(404).json({ success: false, message: 'Folder not found' });
        }

        if (folder.created_by !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
            return res.status(403).json({ success: false, message: 'Forbidden: You cannot delete this folder' });
        }

        await folderModel.softDeleteById(req.params.id, req.user.org_id);

        auditModel.log({
            org_id: req.user.org_id,
            actor_id: req.user.id,
            action: 'FOLDER_DELETE',
            resource_type: 'folder',
            resource_id: req.params.id
        });

        res.status(200).json({ success: true, message: 'Folder deleted' });
    } catch (error) {
        next(error);
    }
}

async function getBreadcrumb(req, res, next) {
    try {
        const breadcrumb = await folderModel.getBreadcrumb(req.params.id, req.user.org_id);
        res.status(200).json({ success: true, breadcrumb });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    create,
    listRoot,
    getContents,
    rename,
    remove,
    getBreadcrumb
};
