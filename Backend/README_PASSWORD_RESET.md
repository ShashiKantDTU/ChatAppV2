# Password Reset Functionality for Production

This document provides information about the password reset feature in ChatApp, which allows users to reset their passwords if they forget them.

## How it works

1. User requests a password reset by providing their email address
2. System verifies the email and sends a reset link with a secure token
3. User clicks the link and is directed to a password reset page
4. User sets a new password, and the system updates their account

## Implementation Details

The password reset functionality uses:

- JWT tokens for secure password reset links
- Nodemailer with Gmail for sending emails in production
- Rate limiting to prevent abuse (3 requests per 15 minutes per IP)
- 24-hour expiration for reset tokens
- Secure password hashing for the new password

## Setting Up Gmail for Password Reset

For production deployment on Render, you'll need to set up a Gmail account to send password reset emails. This requires creating an "App Password" since Gmail's normal login won't work with Nodemailer.

### Step 1: Enable 2-Step Verification
1. Go to your Google Account: https://myaccount.google.com/
2. Select "Security" from the left menu
3. Under "Signing in to Google," select "2-Step Verification"
4. Follow the steps to enable 2-Step Verification

### Step 2: Generate an App Password
1. Go back to the "Security" page
2. Under "Signing in to Google," select "App passwords" (requires 2-Step Verification to be enabled)
3. Enter a name for the app (e.g., "ChatApp Password Reset")
4. Click "Create"
5. Google will display a 16-character app password - **SAVE THIS PASSWORD**
6. Click "Done"

### Step 3: Configure Environment Variables on Render
In your Render dashboard, set these environment variables:

```
NODE_ENV=production
GMAIL_USER=your.email@gmail.com
GMAIL_APP_PASSWORD=your_16_character_app_password
SUPPORT_EMAIL=support@yourdomain.com (or use your Gmail address)
```

## Security Considerations

The production implementation includes several security improvements:

1. **Rate Limiting**: Prevents brute force attacks by limiting password reset requests to 3 per 15 minutes per IP address.

2. **Preventing User Enumeration**: The API returns the same success message whether or not an email exists in the system, preventing attackers from discovering valid email addresses.

3. **Secure Token Generation**: Uses JWT tokens with a 24-hour expiration.

4. **Production-Safe Error Messages**: Generic error messages in production don't reveal sensitive information.

5. **Secure Communication**: All emails are sent using TLS encryption through Gmail.

## Required Environment Variables for Render Deployment

See the `.env.production.sample` file for all required environment variables.

## Monitoring and Logs

The system uses Winston logger to record all password reset activities:

- All password reset attempts are logged
- Successful and failed operations are tracked
- Error logs are stored in `logs/error.log`
- Combined logs are stored in `logs/combined.log`

## Customizing Email Templates

You can customize the email templates in `utils/emailService.js` by modifying the HTML templates.

## Testing the Feature

During development and testing, we use Ethereal Email, which is a fake SMTP service. It captures emails instead of sending them to real email addresses.

### How to Test

1. Go to the Forgot Password page
2. Enter an email address that exists in the system
3. Submit the form
4. In the response, you'll receive a `previewUrl` that looks like: 
   ```
   https://ethereal.email/message/XYZ123...
   ```
5. Click this URL to view the email content in your browser
6. In this preview, click the "Reset Password" button to go to the reset password page
7. Set a new password
8. After successful reset, another email confirmation will be sent (also viewable through a preview URL)

### Notes for Production

In a production environment, you would:

1. Replace Ethereal Email with a real email service like:
   - SendGrid
   - Mailgun
   - Amazon SES
   - A direct SMTP server

2. Remove the `previewUrl` and `resetUrl` from the API response for security reasons

3. Configure proper email templates with your production domain

## Email Template Preview

The password reset emails use a clean, modern design with your application's branding. They include:

- Clear messaging about the password reset
- A prominent call-to-action button
- Security information
- Help text for users who didn't request the reset 