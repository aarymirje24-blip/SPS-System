const cloudinary = require('../config/cloudinary');
const env = require('../config/env');

async function deleteFile(public_id, resource_type) {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.destroy(public_id, { resource_type, type: 'private', invalidate: true }, (error, result) => {
            if (error) reject(error);
            else resolve(result);
        });
    });
}

async function generateSignedUrl(public_id, resource_type, expiresInSeconds = 60) {
    // Note: For Cloudinary SDK v2, the method signature is: cloudinary.utils.private_download_url(public_id, format, options)
    // Pass format as the file extension or 'auto'
    const url = cloudinary.utils.private_download_url(public_id, 'auto', {
        resource_type: resource_type,
        expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds
    });
    return url;
}

async function uploadBuffer(buffer, options) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
            if (error) {
                reject(error);
            } else {
                resolve(result);
            }
        });
        stream.end(buffer);
    });
}

module.exports = {
    deleteFile,
    generateSignedUrl,
    uploadBuffer
};
