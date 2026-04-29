const express = require('express');
const router = express.Router();
const viewController = require('../controllers/view.controller');
const requireRole = require('../middleware/role.middleware');

router.get('/dashboard', viewController.renderDashboard);
router.get('/files', viewController.renderFiles);
router.get('/files/shared-with-me', viewController.renderShared);
router.get('/files/:id', viewController.renderFileDetail);
router.get('/folders/:id', viewController.renderFolderContents);
router.get('/profile', viewController.renderProfile);

// Admin routes
router.get('/admin', requireRole('admin', 'super_admin'), viewController.renderAdminDashboard);
router.get('/admin/users', requireRole('admin', 'super_admin'), viewController.renderAdminUsers);
router.get('/admin/users/:id', requireRole('admin', 'super_admin'), viewController.renderAdminUserDetail);
router.get('/admin/files', requireRole('admin', 'super_admin'), viewController.renderAdminFiles);
router.get('/admin/audit-log', requireRole('admin', 'super_admin'), viewController.renderAdminAuditLog);
router.get('/admin/org-settings', requireRole('super_admin'), viewController.renderOrgSettings);

// 404 handler
router.use((req, res) => {
    res.status(404).render('404', { title: 'Not Found', user: req.user || null, currentPath: req.path });
});

module.exports = router;
