const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signAccessToken(payload) {
    return jwt.sign(payload, env.JWT_SECRET, {
        expiresIn: '8h',
        algorithm: 'HS256'
    });
}

// TODO: Phase 2 — refresh token endpoint
// Refresh token functionality requires a new DB table and migration.
// Uncomment these functions once the refresh token storage is implemented.
/*
function signRefreshToken(payload) {
    return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
        expiresIn: '30d',
        algorithm: 'HS256'
    });
}

function verifyRefreshToken(token) {
    return jwt.verify(token, env.JWT_REFRESH_SECRET);
}
*/

function verifyAccessToken(token) {
    return jwt.verify(token, env.JWT_SECRET);
}

module.exports = {
    signAccessToken,
    verifyAccessToken
    // TODO: Add signRefreshToken, verifyRefreshToken back once Phase 2 is implemented
};