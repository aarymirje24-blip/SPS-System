const pool = require('../config/db');

async function create({ org_id, created_by, parent_id = null, name }) {
    let path = '/' + name;
    
    if (parent_id) {
        const parentResult = await pool.query(`SELECT path FROM folders WHERE id = $1 AND org_id = $2`, [parent_id, org_id]);
        if (parentResult.rows.length > 0) {
            const parentPath = parentResult.rows[0].path;
            path = parentPath === '/' ? '/' + name : parentPath + '/' + name;
        }
    }

    const result = await pool.query(`
        INSERT INTO folders (org_id, created_by, parent_id, name, path)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
    `, [org_id, created_by, parent_id, name, path]);

    return result.rows[0];
}

async function findById(id, org_id) {
    const result = await pool.query(`
        SELECT * FROM folders WHERE id = $1 AND org_id = $2 AND is_deleted = false
    `, [id, org_id]);
    return result.rows[0] || null;
}

async function findRootByOrg(org_id) {
    const result = await pool.query(`
        SELECT * FROM folders WHERE org_id = $1 AND parent_id IS NULL AND is_deleted = false ORDER BY name ASC
    `, [org_id]);
    return result.rows;
}

async function findChildren(parent_id, org_id) {
    const result = await pool.query(`
        SELECT * FROM folders WHERE parent_id ${parent_id ? '= $1' : 'IS NULL'} AND org_id = ${parent_id ? '$2' : '$1'} AND is_deleted = false ORDER BY name ASC
    `, parent_id ? [parent_id, org_id] : [org_id]);
    return result.rows;
}

async function findAll(org_id, parent_id = null) {
    if (parent_id) {
        return findChildren(parent_id, org_id);
    }
    return findRootByOrg(org_id);
}

async function getBreadcrumb(folder_id, org_id) {
    const result = await pool.query(`
        WITH RECURSIVE breadcrumb AS (
            SELECT id, name, parent_id, path, 0 as depth FROM folders WHERE id = $1 AND org_id = $2
            UNION ALL
            SELECT f.id, f.name, f.parent_id, f.path, b.depth + 1
            FROM folders f JOIN breadcrumb b ON f.id = b.parent_id
        )
        SELECT id, name, path FROM breadcrumb ORDER BY depth DESC
    `, [folder_id, org_id]);
    return result.rows;
}

async function renameById(id, org_id, name) {
    const result = await pool.query(`
        UPDATE folders SET name = $1, updated_at = now() WHERE id = $2 AND org_id = $3 AND is_deleted = false RETURNING *
    `, [name, id, org_id]);
    return result.rows[0] || null;
}

async function softDeleteById(id, org_id) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        const folderResult = await client.query('SELECT * FROM folders WHERE id = $1 AND org_id = $2', [id, org_id]);
        
        if (folderResult.rows.length > 0) {
            await client.query(`
                WITH RECURSIVE descendants AS (
                    SELECT id FROM folders WHERE id = $1 AND org_id = $2
                    UNION ALL
                    SELECT f.id FROM folders f JOIN descendants d ON f.parent_id = d.id WHERE f.org_id = $2
                )
                UPDATE files SET is_deleted = true WHERE folder_id IN (SELECT id FROM descendants) AND org_id = $2;
            `, [id, org_id]);

            await client.query(`
                WITH RECURSIVE descendants AS (
                    SELECT id FROM folders WHERE id = $1 AND org_id = $2
                    UNION ALL
                    SELECT f.id FROM folders f JOIN descendants d ON f.parent_id = d.id WHERE f.org_id = $2
                )
                UPDATE folders SET is_deleted = true, updated_at = now() WHERE id IN (SELECT id FROM descendants);
            `, [id, org_id]);
        }
        
        await client.query('COMMIT');
        
        if (folderResult.rows.length > 0) {
            folderResult.rows[0].is_deleted = true;
            return folderResult.rows[0];
        }
        return null;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

module.exports = {
    create,
    findById,
    findRootByOrg,
    findChildren,
    findAll,
    getBreadcrumb,
    renameById,
    softDeleteById
};
