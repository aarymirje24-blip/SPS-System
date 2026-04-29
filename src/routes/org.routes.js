const express = require('express');
const router = express.Router();
const orgController = require('../controllers/org.controller');
const requireRole = require('../middleware/role.middleware');

router.get('/settings', requireRole('admin', 'super_admin'), orgController.getSettings);
router.patch('/settings', requireRole('super_admin'), orgController.updateSettings);
router.get('/stats', requireRole('admin', 'super_admin'), orgController.getStats);
router.get('/audit-log', requireRole('admin', 'super_admin'), orgController.getAuditLog);

module.exports = router;
