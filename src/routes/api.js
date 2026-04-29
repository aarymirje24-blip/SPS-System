const express = require('express');
const router = express.Router();
const PageController = require('../controllers/pageController');
const UserController = require('../controllers/userController');
const FileController = require('../controllers/fileController');
const ActivityLogController = require('../controllers/activityLogController');

const pageController = new PageController();

// User routes
router.post('/users/register', UserController.register);
router.post('/users/login', UserController.login);
router.get('/users', UserController.getAllUsers);
router.get('/users/:id', UserController.getUserById);
router.put('/users/:id', UserController.updateUser);
router.delete('/users/:id', UserController.deleteUser);

// File routes
router.post('/files', FileController.uploadFile);
router.get('/files', FileController.getFiles);
router.get('/files/:id', FileController.getFileById);
router.delete('/files/:id', FileController.deleteFile);
router.post('/files/share', FileController.shareFile);
router.get('/files/shared', FileController.getSharedFiles);

// Activity log routes
router.get('/activity-logs', ActivityLogController.getActivityLogs);
router.get('/activity-logs/user/:userId', ActivityLogController.getUserActivityLogs);
router.post('/activity-logs', ActivityLogController.logActivity);

// Page routes
router.get('/home', pageController.renderHome);
router.get('/about', pageController.renderAbout);
router.get('*', pageController.render404);

module.exports = router;