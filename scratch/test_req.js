const pool = require('../src/config/db');
const http = require('http');

async function test() {
    try {
        // Find the owner of the active file
        const fileRes = await pool.query('SELECT * FROM files WHERE is_deleted = false LIMIT 1');
        const file = fileRes.rows[0];
        if (!file) {
            console.log('No active files found');
            return;
        }

        const ownerRes = await pool.query('SELECT * FROM users WHERE id = $1', [file.uploaded_by]);
        const owner = ownerRes.rows[0];
        
        console.log(`Testing file ID: ${file.id} owned by user ID: ${owner.id} (${owner.email})`);

        // We can simulate the download directly by importing app and making a mock request, 
        // or by making an HTTP request to localhost:3001. 
        // Let's log in to the running dev server on localhost:3001 using http.request.
        
        const loginData = JSON.stringify({
            email: owner.email,
            password: 'Password123' // Let's try standard password or what is normally used
        });

        const postOptions = {
            hostname: 'localhost',
            port: 3001,
            path: '/api/v1/auth/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(loginData)
            }
        };

        const req = http.request(postOptions, (res) => {
            console.log('Login response status:', res.statusCode);
            const cookies = res.headers['set-cookie'];
            console.log('Cookies returned:', cookies);

            if (res.statusCode !== 200 || !cookies) {
                console.log('Login failed (incorrect password or server not running on 3001)');
                // If login fails, let's try direct invocation of the download function to see where it breaks!
                testDirectController(file, owner);
                return;
            }

            // Make download request with the returned cookie
            const getOptions = {
                hostname: 'localhost',
                port: 3001,
                path: `/api/v1/files/${file.id}/download`,
                method: 'GET',
                headers: {
                    'Cookie': cookies.join('; ')
                }
            };

            const downloadReq = http.request(getOptions, (downloadRes) => {
                console.log('Download response status:', downloadRes.statusCode);
                console.log('Download response headers:', downloadRes.headers);
                
                let body = '';
                downloadRes.on('data', (chunk) => {
                    body += chunk.toString();
                });
                
                downloadRes.on('end', () => {
                    console.log('Download response body (first 500 chars):', body.substring(0, 500));
                    process.exit(0);
                });
            });
            
            downloadReq.on('error', (err) => {
                console.error('Download request error:', err);
                process.exit(1);
            });
            
            downloadReq.end();
        });

        req.on('error', (err) => {
            console.log('Error making request to localhost:3001:', err.message);
            console.log('Will test direct controller execution instead...');
            testDirectController(file, owner);
        });

        req.write(loginData);
        req.end();

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

async function testDirectController(file, owner) {
    try {
        const fileController = require('../src/controllers/file.controller');
        
        // Mock req and res objects
        const req = {
            params: { id: file.id },
            user: owner
        };
        
        const res = {
            status(code) {
                this.statusCode = code;
                return this;
            },
            json(data) {
                this.jsonData = data;
                console.log(`\nDirect controller call returned JSON (Status ${this.statusCode}):`, data);
                process.exit(0);
            },
            setHeader(name, value) {
                this.headers = this.headers || {};
                this.headers[name] = value;
            }
        };
        
        await fileController.download(req, res, (err) => {
            if (err) {
                console.error('\nDirect controller next called with error:', err);
            }
            process.exit(1);
        });
    } catch (err) {
        console.error('Error in direct controller test:', err);
        process.exit(1);
    }
}

test();
