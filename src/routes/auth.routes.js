const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Public routes
const rateLimit = require('express-rate-limit');
const resetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,  // 1 hour window
    max: 5,                      // max 5 reset requests per IP per hour
    message: { success: false, message: 'Too many password reset attempts. Try again in an hour.' },
    standardHeaders: true,
    legacyHeaders: false
});

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/accept-invite/:token', authController.acceptInvite);
router.post('/forgot-password', resetLimiter, authController.forgotPassword);
router.post('/reset-password/:token', resetLimiter, authController.resetPassword);

// Protected routes
router.post('/logout', authMiddleware, authController.logout);
router.get('/me', authMiddleware, authController.getMe);

module.exports = router;