const pool = require('../src/config/db');
const shareModel = require('../src/models/share.model');

async function test() {
    try {
        const filesRes = await pool.query('SELECT id, org_id, uploaded_by, original_name FROM files LIMIT 5');
        console.log('Files:', filesRes.rows);
        
        for (const file of filesRes.rows) {
            // Get the owner
            const ownerRes = await pool.query('SELECT id, email, role FROM users WHERE id = $1', [file.uploaded_by]);
            const owner = ownerRes.rows[0];
            console.log(`\nTesting file: ${file.original_name} (${file.id}) owned by ${owner.email}`);
            
            // Check access as owner
            const accessOwner = await shareModel.checkAccess(file.id, owner.id, file.org_id, owner.role);
            console.log('Access as owner:', accessOwner ? accessOwner.resolved_permission : 'NULL');
            
            // Get another user in same org
            const otherRes = await pool.query('SELECT id, email, role FROM users WHERE org_id = $1 AND id != $2 LIMIT 1', [file.org_id, owner.id]);
            const other = otherRes.rows[0];
            if (other) {
                console.log(`Testing access for other user: ${other.email} (${other.role})`);
                const accessOther = await shareModel.checkAccess(file.id, other.id, file.org_id, other.role);
                console.log('Access as other user:', accessOther ? accessOther.resolved_permission : 'NULL');
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

test();
