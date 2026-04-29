const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    // If already logged in, redirect to dashboard
    const token = req.cookies && req.cookies.auth_token;
    if (token) {
        try {
            require('../utils/jwt').verifyAccessToken(token);
            return res.redirect('/dashboard');
        } catch(e) {}
    }
    res.render('landing', { title: 'SecureShare — Secure File Sharing for Teams' });
});

router.get('/login', (req, res) => {
    res.render('auth/login', { title: 'Sign In' });
});

router.get('/register', (req, res) => {
    res.render('auth/register', { title: 'Create Organisation' });
});

router.get('/forgot-password', (req, res) => {
    res.render('auth/forgot-password', { title: 'Forgot Password' });
});

router.get('/reset-password/:token', (req, res) => {
    res.render('auth/reset-password', { title: 'Reset Password', token: req.params.token });
});

router.get('/accept-invite/:token', (req, res) => {
    res.render('auth/accept-invite', { title: 'Accept Invitation', token: req.params.token });
});

module.exports = router;
