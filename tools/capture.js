const puppeteer = require('puppeteer');
const path = require('path');

async function run() {
    const browser = await puppeteer.launch({ 
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const baseUrl = 'http://localhost:3001';

    console.log('Capturing Landing Page...');
    await page.goto(`${baseUrl}/`);
    await page.screenshot({ path: path.join(__dirname, 'landing.png'), fullPage: true });

    console.log('Capturing Login Page...');
    await page.goto(`${baseUrl}/login`);
    await page.screenshot({ path: path.join(__dirname, 'login.png') });

    console.log('Capturing Register Page...');
    await page.goto(`${baseUrl}/register`);
    await page.screenshot({ path: path.join(__dirname, 'register.png') });

    console.log('Attempting to create user and capture Dashboard...');
    // We will use the API directly to register
    try {
        const testEmail = `test${Date.now()}@example.com`;
        await page.type('#org_name', 'Test Org');
        await page.type('#full_name', 'Test User');
        await page.type('#email', testEmail);
        await page.type('#password', 'password123');
        await page.type('#confirm_password', 'password123');
        
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('button[type="submit"]')
        ]);

        console.log('Navigating to Dashboard...');
        await page.goto(`${baseUrl}/dashboard`);
        await new Promise(r => setTimeout(r, 2000));
        await page.screenshot({ path: path.join(__dirname, 'dashboard.png') });
    } catch (e) {
        console.error('Error creating user:', e);
    }

    await browser.close();
    console.log('Screenshots captured successfully.');
}

run().catch(console.error);
