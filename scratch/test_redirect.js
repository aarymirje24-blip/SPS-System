const https = require('https');

async function test() {
    // Let's use the URL generated in the previous task or any random HTTPS URL that redirects
    // e.g. https://httpbin.org/redirect/1
    const testUrl = 'https://httpbin.org/redirect/1';
    console.log(`Requesting redirect URL: ${testUrl}`);
    
    https.get(testUrl, (res) => {
        console.log('Status code:', res.statusCode);
        console.log('Headers:', res.headers);
        process.exit(0);
    }).on('error', (err) => {
        console.error(err);
        process.exit(1);
    });
}

test();
