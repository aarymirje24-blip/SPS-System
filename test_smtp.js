const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT, 10) || 465,
    secure: (process.env.SMTP_PORT || '465') === '465',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

console.log('Testing SMTP connection with:');
console.log('Host:', process.env.SMTP_HOST || 'smtp.gmail.com');
console.log('Port:', process.env.SMTP_PORT || 465);
console.log('User:', process.env.SMTP_USER);
console.log('Password length:', process.env.SMTP_PASS ? process.env.SMTP_PASS.length : 0);

transporter.verify((error) => {
    if (error) {
        console.error('\n❌ SMTP Verification Failed!');
        console.error('Error Message:', error.message);
        console.error('\nPossible reasons:');
        console.error('1. Your Google App Password might be incorrect or revoked.');
        console.error('2. 2-Step Verification might have been turned off on your Google Account.');
        console.error('3. The SMTP_USER email does not match the account that generated the App Password.');
    } else {
        console.log('\n✅ SMTP Transporter is successfully verified and ready to send emails!');
    }
    process.exit(0);
});
