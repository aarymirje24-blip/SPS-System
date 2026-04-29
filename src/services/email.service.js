const nodemailer = require('nodemailer');
const env = require('../config/env');

const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,   // true for port 465 (SSL), false for 587 (TLS)
    auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS
    }
});

transporter.verify((error) => {
    if (error) {
        console.warn('Email transporter not ready:', error.message);
    } else {
        console.log('Email transporter ready');
    }
});

async function sendMail({ to, subject, html }) {
    if (!env.SMTP_HOST) {
        console.log('SMTP not configured. Email to', to, 'subject:', subject);
        console.log('HTML content:', html);
        return null;
    }
    return transporter.sendMail({
        from: env.EMAIL_FROM,
        to,
        subject,
        html
    });
}

async function sendInvitationEmail({ to, inviterName, orgName, inviteUrl, role }) {
    const subject = `You've been invited to join ${orgName} on SecureShare`;
    const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <p>Hi there,</p>
            <p><strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong> as a <strong>${role}</strong>.</p>
            <p>
                <a href="${inviteUrl}" style="display: inline-block; padding: 10px 20px; font-size: 16px; color: #fff; background-color: #007bff; text-decoration: none; border-radius: 5px;">
                    Accept Invitation
                </a>
            </p>
            <p style="font-size: 14px; color: #666;">This invitation expires in 7 days.</p>
            <hr style="border: 0; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="font-size: 12px; color: #999;">If you did not expect this email, you can safely ignore it.</p>
        </div>
    `;
    return sendMail({ to, subject, html });
}

async function sendPasswordResetEmail({ to, resetUrl, userName }) {
    const subject = 'Reset your SecureShare password';
    const html = `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <p>Hi ${userName},</p>
            <p>We received a request to reset your password.</p>
            <p>
                <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; font-size: 16px; color: #fff; background-color: #007bff; text-decoration: none; border-radius: 5px;">
                    Reset Password
                </a>
            </p>
            <p style="font-size: 14px; color: #666;">This link expires in 1 hour. If you did not request a password reset, please ignore this email.</p>
        </div>
    `;
    return sendMail({ to, subject, html });
}

module.exports = { sendInvitationEmail, sendPasswordResetEmail };
