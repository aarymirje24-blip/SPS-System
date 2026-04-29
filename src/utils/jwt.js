const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signAccessToken(payload) {
    return jwt.sign(payload, env.JWT_SECRET, {
        expiresIn: '8h',
        algorithm: 'HS256'
    });
}

function signRefreshToken(payload) {
    return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
        expiresIn: '30d',
        algorithm: 'HS256'
    });
}

function verifyAccessToken(token) {
    return jwt.verify(token, env.JWT_SECRET);
}

function verifyRefreshToken(token) {
    return jwt.verify(token, env.JWT_REFRESH_SECRET);
}

module.exports = {
    signAccessToken,
    signRefreshToken,
    verifyAccessToken,
    verifyRefreshToken
};