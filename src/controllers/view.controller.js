const pool = require('../config/db');
const userModel = require('../models/user.model');
const fileModel = require('../models/file.model');
const folderModel = require('../models/folder.model');
const auditModel = require('../models/audit.model');
const shareModel = require('../models/share.model');
const { buildPagination } = require('../utils/pagination');

async function renderDashboard(req, res, next) {
    try {
        const [recentFilesData, storageData, rootFoldersData] = await Promise.all([
            fileModel.findAccessibleByUser(req.user.id, req.user.org_id, { limit: 5 }),
            fileModel.checkOrgStorage(req.user.org_id),
            folderModel.findAll(req.user.org_id, null)
        ]);

        res.render('dashboard', {
            title: 'Dashboard',
            user: req.user,
            currentPath: req.path,
            recentFiles: recentFilesData.files,
            storage: storageData,
            rootFolders: rootFoldersData.slice(0, 4)
        });
    } catch (error) {
        next(error);
    }
}

async function renderFiles(req, res, next) {
    try {
        const { q, folder_id, page = 1 } = req.query;
        let filesData = { files: [], total: 0 };
        let folders = [];
        let breadcrumb = [];
        const storage = await fileModel.checkOrgStorage(req.user.org_id);

        if (folder_id) {
            folders = await folderModel.findChildren(folder_id, req.user.org_id);
            breadcrumb = await folderModel.getBreadcrumb(folder_id, req.user.org_id);
            filesData = await fileModel.findByFolder(folder_id, req.user.org_id, { page: parseInt(page) });
        } else if (q) {
            filesData = await fileModel.findAccessibleByUser(req.user.id, req.user.org_id, { search: q, page: parseInt(page) });
            folders = await folderModel.findAll(req.user.org_id, null);
        } else {
            filesData = await fileModel.findAccessibleByUser(req.user.id, req.user.org_id, { page: parseInt(page) });
            folders = await folderModel.findAll(req.user.org_id, null);
        }

        const pagination = buildPagination({ total: filesData.total, page: parseInt(page), limit: 20, baseUrl: '/files', existingQuery: req.query });

        res.render('files/index', {
            title: 'My Files',
            user: req.user,
            currentPath: req.path,
            files: filesData.files,
            folders,
            breadcrumb,
            storage,
            query: q,
            page: parseInt(page),
            total: filesData.total,
            pagination
        });
    } catch (error) {
        next(error);
    }
}

async function renderShared(req, res, next) {
    try {
        const query = `
            SELECT DISTINCT f.*, u.full_name as uploader_name, sb.full_name as shared_by_name
            FROM files f
            JOIN users u ON f.uploaded_by = u.id
            JOIN file_shares fs ON fs.file_id = f.id
            JOIN users sb ON fs.shared_by = sb.id
            WHERE f.org_id = $1 AND f.is_deleted = false
              AND fs.shared_with_user_id = $2
              AND (fs.expires_at IS NULL OR fs.expires_at > now())
            ORDER BY f.created_at DESC LIMIT 20
        `;
        const result = await pool.query(query, [req.user.org_id, req.user.id]);

        res.render('files/shared', {
            title: 'Shared With Me',
            user: req.user,
            currentPath: req.path,
            files: result.rows
        });
    } catch (error) {
        next(error);
    }
}

async function renderFileDetail(req, res, next) {
    try {
        const file = await fileModel.findById(req.params.id, req.user.org_id);
        if (!file) {
            return res.status(404).render('404', { title: 'File Not Found', user: req.user, currentPath: req.path });
        }
        
        const shares = await shareModel.findByFileId(file.id, req.user.org_id);
        const orgUsers = await userModel.findAllByOrg(req.user.org_id, { limit: 100 });
        
        res.render('files/detail', {
            title: file.original_name,
            user: req.user,
            currentPath: req.path,
            file,
            shares,
            orgUsers: orgUsers.users
        });
    } catch (error) {
        next(error);
    }
}

async function renderFolderContents(req, res, next) {
    try {
        const folder = await folderModel.findById(req.params.id, req.user.org_id);
        if (!folder) {
            return res.redirect('/files');
        }
        
        const subFolders = await folderModel.findChildren(req.params.id, req.user.org_id);
        const breadcrumb = await folderModel.getBreadcrumb(req.params.id, req.user.org_id);
        const filesData = await fileModel.findByFolder(req.params.id, req.user.org_id);
        
        res.render('files/folder', {
            title: folder.name,
            user: req.user,
            currentPath: req.path,
            folder,
            subFolders,
            files: filesData.files,
            breadcrumb
        });
    } catch (error) {
        next(error);
    }
}

async function renderProfile(req, res, next) {
    try {
        const user = await userModel.findById(req.user.id);
        res.render('profile', {
            title: 'My Profile',
            user: req.user,
            profileUser: user,
            currentPath: req.path
        });
    } catch (error) {
        next(error);
    }
}

async function renderAdminDashboard(req, res, next) {
    try {
        const org_id = req.user.org_id;
        const [usersResult, filesResult, bytesResult, quotaResult, invitesResult, logsResult] = await Promise.all([
            pool.query('SELECT COUNT(*) FROM users WHERE org_id = $1 AND is_active = true', [org_id]),
            pool.query('SELECT COUNT(*) FROM files WHERE org_id = $1 AND is_deleted = false', [org_id]),
            pool.query('SELECT COALESCE(SUM(size_bytes), 0) as total_bytes FROM files WHERE org_id = $1 AND is_deleted = false', [org_id]),
            pool.query('SELECT storage_quota_mb FROM organisations WHERE id = $1', [org_id]),
            pool.query("SELECT COUNT(*) FROM invitations WHERE org_id = $1 AND status = 'pending'", [org_id]),
            auditModel.findByOrg(org_id, { limit: 10 })
        ]);
        
        const stats = {
            user_count: parseInt(usersResult.rows[0].count, 10),
            file_count: parseInt(filesResult.rows[0].count, 10),
            used_bytes: BigInt(bytesResult.rows[0].total_bytes).toString(),
            quota_mb: parseInt(quotaResult.rows[0].storage_quota_mb, 10),
            pending_invitations: parseInt(invitesResult.rows[0].count, 10)
        };
        
        res.render('admin/dashboard', {
            title: 'Admin Dashboard',
            user: req.user,
            currentPath: req.path,
            stats,
            recentLogs: logsResult.logs
        });
    } catch (error) {
        next(error);
    }
}

async function renderAdminUsers(req, res, next) {
    try {
        const { page = 1, search, role } = req.query;
        const result = await userModel.findAllByOrg(req.user.org_id, { page: parseInt(page), limit: 20, search, role });
        
        const pagination = buildPagination({ total: result.total, page: parseInt(page), limit: 20, baseUrl: '/admin/users', existingQuery: req.query });

        res.render('admin/users/index', {
            title: 'Manage Users',
            user: req.user,
            currentPath: req.path,
            ...result,
            pagination
        });
    } catch (error) {
        next(error);
    }
}

async function renderAdminUserDetail(req, res, next) {
    try {
        const targetUser = await userModel.findById(req.params.id);
        if (!targetUser || targetUser.org_id !== req.user.org_id) {
            return res.redirect('/admin/users');
        }
        
        res.render('admin/users/detail', {
            title: targetUser.full_name,
            user: req.user,
            currentPath: req.path,
            targetUser
        });
    } catch (error) {
        next(error);
    }
}

async function renderAdminFiles(req, res, next) {
    try {
        const { page = 1, search } = req.query;
        const result = await fileModel.findAllByOrg(req.user.org_id, { page: parseInt(page), limit: 20, search });
        
        const pagination = buildPagination({ total: result.total, page: parseInt(page), limit: 20, baseUrl: '/admin/files', existingQuery: req.query });

        res.render('admin/files/index', {
            title: 'All Files',
            user: req.user,
            currentPath: req.path,
            ...result,
            pagination
        });
    } catch (error) {
        next(error);
    }
}

async function renderAdminAuditLog(req, res, next) {
    try {
        const { page = 1, action, actor_id, from_date, to_date } = req.query;
        const result = await auditModel.findByOrg(req.user.org_id, { page: parseInt(page), limit: 50, action, actor_id, from_date, to_date });
        
        const pagination = buildPagination({ total: result.total, page: parseInt(page), limit: 50, baseUrl: '/admin/audit-log', existingQuery: req.query });

        res.render('admin/audit-log', {
            title: 'Audit Log',
            user: req.user,
            currentPath: req.path,
            ...result,
            pagination
        });
    } catch (error) {
        next(error);
    }
}

async function renderOrgSettings(req, res, next) {
    try {
        const orgResult = await pool.query('SELECT * FROM organisations WHERE id = $1', [req.user.org_id]);
        
        res.render('admin/org-settings', {
            title: 'Organisation Settings',
            user: req.user,
            currentPath: req.path,
            org: orgResult.rows[0]
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    renderDashboard,
    renderFiles,
    renderShared,
    renderFileDetail,
    renderFolderContents,
    renderProfile,
    renderAdminDashboard,
    renderAdminUsers,
    renderAdminUserDetail,
    renderAdminFiles,
    renderAdminAuditLog,
    renderOrgSettings
};
