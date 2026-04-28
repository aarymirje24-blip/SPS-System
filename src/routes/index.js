const express = require('express');
const PageController = require('../controllers/pageController');

const router = express.Router();
const pageController = new PageController();

// Main routes
router.get('/', pageController.renderHome);
router.get('/about', pageController.renderAbout);

// Auth routes
router.get('/login', pageController.renderLogin);

// Dashboard routes
router.get('/admin-dashboard', pageController.renderAdminDashboard);
router.get('/user-dashboard', pageController.renderUserDashboard);

// File management routes
router.get('/upload', pageController.renderUploadFile);
router.get('/all-files', pageController.renderAllFiles);
router.get('/shared-files', pageController.renderSharedFiles);

// Admin routes
router.get('/manage-users', pageController.renderManageUsers);
router.get('/activity-logs', pageController.renderActivityLogs);

// Settings route
router.get('/settings', pageController.renderSettings);

// 404 catch-all (must be last)
router.use('*', pageController.render404);

module.exports = router;