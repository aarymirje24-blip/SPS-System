const pool = require('../src/config/db');
const shareModel = require('../src/models/share.model');
const fileModel = require('../src/models/file.model');
const cloudinaryService = require('../src/services/cloudinary.service');
const https = require('https');

async function test() {
    try {
        // Find a file that is active (not deleted)
        const fileRes = await pool.query('SELECT * FROM files WHERE is_deleted = false LIMIT 1');
        const file = fileRes.rows[0];
        if (!file) {
            console.log('No active files found in DB');
            return;
        }

        // Get owner details
        const ownerRes = await pool.query('SELECT * FROM users WHERE id = $1', [file.uploaded_by]);
        const owner = ownerRes.rows[0];
        console.log(`Testing active file: ${file.original_name} (${file.id}) owned by ${owner.email} (${owner.role})`);

        // Check access
        const access = await shareModel.checkAccess(file.id, owner.id, file.org_id, owner.role);
        console.log('Resolved access permission:', access ? access.resolved_permission : 'NULL');

        if (!access) {
            console.log('No access resolved');
            return;
        }

        // Try generating Cloudinary URL
        const url = await cloudinaryService.generateSignedUrl(
            file.cloudinary_public_id,
            file.cloudinary_resource_type,
            60,
            file.original_name
        );
        console.log('Generated Cloudinary signed URL:', url);

        // Fetch from Cloudinary
        console.log('Fetching from Cloudinary using https.get...');
        https.get(url, (res) => {
            console.log('Cloudinary status code:', res.statusCode);
            console.log('Cloudinary headers:', res.headers);
            
            let count = 0;
            res.on('data', (chunk) => {
                count += chunk.length;
            });
            
            res.on('end', () => {
                console.log(`Finished reading. Read ${count} bytes.`);
                process.exit(0);
            });
        }).on('error', (err) => {
            console.error('Fetch error:', err);
            process.exit(1);
        });

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

test();
