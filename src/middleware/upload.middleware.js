const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const env = require('../config/env');

// MIME type whitelist
const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'video/mp4',
    'video/webm',
    'audio/mpeg',
    'audio/wav',
    'application/zip',
    'application/x-zip-compressed'
];

// Multer configuration - store in memory
const multerUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024
    },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('File type not allowed'), false);
        }
    }
});

// Helper function to upload buffer to Cloudinary
function uploadToCloudinary(buffer, options) {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            options,
            (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            }
        );
        
        const PassThrough = require('stream').PassThrough;
        const readable = new PassThrough();
        readable.end(buffer);
        readable.pipe(uploadStream);
    });
}

// Cloudinary upload middleware
async function cloudinaryUploadMiddleware(req, res, next) {
    // If no file, skip (some routes may not require a file)
    if (!req.file) {
        return next();
    }
    
    try {
        // Determine resource type based on mimetype
        let resourceType = 'raw';
        if (req.file.mimetype.startsWith('image/')) {
            resourceType = 'image';
        } else if (req.file.mimetype.startsWith('video/') || req.file.mimetype.startsWith('audio/')) {
            resourceType = 'video';
        }
        
        // Build upload options
        const options = {
            folder: env.CLOUDINARY_FOLDER + '/' + req.user.org_id,
            resource_type: resourceType,
            type: 'private',
            use_filename: true,
            unique_filename: true,
            overwrite: false,
            tags: [req.user.org_id]
        };
        
        // Upload to Cloudinary
        const result = await uploadToCloudinary(req.file.buffer, options);
        
        // Attach the result to req
        req.cloudinaryResult = result;
        
        next();
    } catch (error) {
        next(error);
    }
}

// Export as combined middleware array
module.exports = {
    single: [multerUpload.single('file'), cloudinaryUploadMiddleware]
};