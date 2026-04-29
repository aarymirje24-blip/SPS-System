const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const requireRole = require('../middleware/role.middleware');

const uploadMiddleware = require('../middleware/upload.middleware');

router.get('/me/profile', userController.getMyProfile);
router.patch('/me/profile', ...uploadMiddleware.single, userController.updateMyProfile);
router.patch('/me/password', userController.changeMyPassword);

router.get('/', requireRole('admin', 'super_admin'), userController.listUsers);
router.post('/invite', requireRole('admin', 'super_admin'), userController.inviteUser);

router.get('/:id', requireRole('admin', 'super_admin'), userController.getUser);
router.patch('/:id', requireRole('admin', 'super_admin'), userController.updateUser);
router.delete('/:id', requireRole('super_admin'), userController.deleteUser);
router.patch('/:id/reset-password', requireRole('admin', 'super_admin'), userController.adminResetPassword);

module.exports = router;
