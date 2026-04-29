require('dotenv').config();

const env = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: parseInt(process.env.PORT, 10) || 3000,
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    CLOUDINARY_FOLDER: process.env.CLOUDINARY_FOLDER || 'secureshare',
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: parseInt(process.env.SMTP_PORT, 10) || 465,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS,
    EMAIL_FROM: process.env.EMAIL_FROM,
    APP_BASE_URL: process.env.APP_BASE_URL || 'http://localhost:3001',
    COOKIE_SECRET: process.env.COOKIE_SECRET,
    MAX_FILE_SIZE_MB: parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 50,
};

// Validate required environment variables
if (!env.DATABASE_URL || env.DATABASE_URL.trim() === '') {
    throw new Error('Missing required env var: DATABASE_URL');
}

if (!env.JWT_SECRET || env.JWT_SECRET.trim() === '') {
    throw new Error('Missing required env var: JWT_SECRET');
}

if (env.JWT_SECRET && env.JWT_SECRET.length < 32) {
    throw new Error('Missing required env var: JWT_SECRET must be at least 32 chars');
}

if (!env.JWT_REFRESH_SECRET || env.JWT_REFRESH_SECRET.trim() === '') {
    throw new Error('Missing required env var: JWT_REFRESH_SECRET');
}

if (!env.CLOUDINARY_CLOUD_NAME || env.CLOUDINARY_CLOUD_NAME.trim() === '') {
    throw new Error('Missing required env var: CLOUDINARY_CLOUD_NAME');
}

if (!env.CLOUDINARY_API_KEY || env.CLOUDINARY_API_KEY.trim() === '') {
    throw new Error('Missing required env var: CLOUDINARY_API_KEY');
}

if (!env.CLOUDINARY_API_SECRET || env.CLOUDINARY_API_SECRET.trim() === '') {
    throw new Error('Missing required env var: CLOUDINARY_API_SECRET');
}

if (!env.COOKIE_SECRET || env.COOKIE_SECRET.trim() === '') {
    throw new Error('Missing required env var: COOKIE_SECRET');
}

module.exports = env;