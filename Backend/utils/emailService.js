const nodemailer = require('nodemailer');
const logger = require('./logger');

/**
 * Creates and returns a configured nodemailer transporter
 * using Gmail in production or Ethereal Email in development
 */
async function createTransporter() {
    // Check if in production or development
    if (process.env.NODE_ENV === 'production') {
        // PRODUCTION: Use Gmail
        logger.info('Using Gmail transporter for email');
        return nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD // App password, not regular password
            }
        });
    } else {
        // DEVELOPMENT: Use Ethereal for testing
        logger.info('Using Ethereal test account for email');
        // Create a test account with Ethereal Email
        const testAccount = await nodemailer.createTestAccount();

        return nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: testAccount.user,
                pass: testAccount.pass
            }
        });
    }
}

/**
 * Sends a password reset email with a reset link
 * 
 * @param {string} email - Recipient email address
 * @param {string} username - Recipient's username
 * @param {string} resetUrl - URL to reset password
 * @returns {object} - Email info including preview URL in development
 */
async function sendPasswordResetEmail(email, username, resetUrl) {
    try {
        const transporter = await createTransporter();
        const isProd = process.env.NODE_ENV === 'production';
        const appName = 'ChatApp';
        const supportEmail = isProd ? process.env.SUPPORT_EMAIL || 'support@yourdomain.com' : 'support@chatapp.com';

        // HTML Email Template
        const htmlTemplate = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #6366f1;">${appName} Password Reset</h1>
                </div>
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
                    <p style="font-size: 16px; line-height: 1.5; color: #333;">Hello ${username || ''},</p>
                    <p style="font-size: 16px; line-height: 1.5; color: #333;">You requested to reset your password for your ${appName} account. Please click the button below to reset your password:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetUrl}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Password</a>
                    </div>
                    <p style="font-size: 16px; line-height: 1.5; color: #333;">If you didn't request this, you can safely ignore this email. Your password will remain unchanged.</p>
                    <p style="font-size: 16px; line-height: 1.5; color: #333;">This link will expire in 24 hours.</p>
                </div>
                <div style="text-align: center; color: #6c757d; font-size: 14px;">
                    <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
                </div>
            </div>
        `;

        // Send email
        const info = await transporter.sendMail({
            from: `"${appName} Support" <${supportEmail}>`,
            to: email,
            subject: 'Password Reset Request',
            text: `You requested to reset your password. Please go to this link to reset your password: ${resetUrl}`,
            html: htmlTemplate
        });

        logger.info('Password reset email sent!');
        
        // Only return preview URL in development
        const response = {
            messageId: info.messageId
        };
        
        if (!isProd) {
            logger.info('Preview URL: %s', nodemailer.getTestMessageUrl(info));
            response.previewUrl = nodemailer.getTestMessageUrl(info);
        }

        return response;
    } catch (error) {
        logger.error('Error sending password reset email:', error);
        throw error;
    }
}

/**
 * Sends a confirmation email after successful password reset
 * 
 * @param {string} email - Recipient email address
 * @param {string} username - Recipient's username
 * @param {string} loginUrl - URL to login page
 * @returns {object} - Email info including preview URL in development
 */
async function sendPasswordResetConfirmationEmail(email, username, loginUrl) {
    try {
        const transporter = await createTransporter();
        const isProd = process.env.NODE_ENV === 'production';
        const appName = 'ChatApp';
        const supportEmail = isProd ? process.env.SUPPORT_EMAIL || 'support@yourdomain.com' : 'support@chatapp.com';

        // HTML Email Template for password reset confirmation
        const htmlTemplate = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border-radius: 10px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h1 style="color: #6366f1;">Password Reset Successful</h1>
                </div>
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px;">
                    <p style="font-size: 16px; line-height: 1.5; color: #333;">Hello ${username || ''},</p>
                    <p style="font-size: 16px; line-height: 1.5; color: #333;">Your password has been successfully reset.</p>
                    <p style="font-size: 16px; line-height: 1.5; color: #333;">If you did not make this change, please contact our support team immediately.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${loginUrl}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Login to Your Account</a>
                    </div>
                </div>
                <div style="text-align: center; color: #6c757d; font-size: 14px;">
                    <p>&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
                </div>
            </div>
        `;

        // Send email
        const info = await transporter.sendMail({
            from: `"${appName} Support" <${supportEmail}>`,
            to: email,
            subject: 'Password Reset Successful',
            text: `Your password has been successfully reset. If you did not make this change, please contact our support team immediately.`,
            html: htmlTemplate
        });

        logger.info('Password reset confirmation email sent!');
        
        // Only return preview URL in development
        const response = {
            messageId: info.messageId
        };
        
        if (!isProd) {
            logger.info('Preview URL: %s', nodemailer.getTestMessageUrl(info));
            response.previewUrl = nodemailer.getTestMessageUrl(info);
        }

        return response;
    } catch (error) {
        logger.error('Error sending password reset confirmation email:', error);
        throw error;
    }
}

module.exports = {
    sendPasswordResetEmail,
    sendPasswordResetConfirmationEmail
}; 