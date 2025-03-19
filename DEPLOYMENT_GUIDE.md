# Deploying ChatApp to Render

This guide provides step-by-step instructions for deploying the ChatApp application to Render, with a focus on setting up the password reset functionality correctly.

## Prerequisites

- A Render account (https://render.com)
- A GitHub account with your ChatApp repository
- A MongoDB Atlas account for your database
- A Gmail account for sending password reset emails

## Step 1: Prepare Your Repository

Ensure your codebase is ready for deployment:

1. Make sure all environment variables are properly configured in `.env.production.sample`
2. Verify your application runs correctly in production mode locally
3. Commit all changes to your GitHub repository

## Step 2: Set Up MongoDB Atlas

1. Create a new MongoDB Atlas cluster or use an existing one
2. Set up network access to allow connections from anywhere (for Render)
3. Create a database user with read/write permissions
4. Get your MongoDB connection string

## Step 3: Configure Gmail for Password Reset Emails

Follow the instructions in `Backend/README_PASSWORD_RESET.md` to:

1. Enable 2-Step Verification on your Gmail account
2. Generate an App Password for the application
3. Save the App Password for use in Render environment variables

## Step 4: Deploy Backend to Render

1. Log in to your Render account
2. Click "New" and select "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - Name: `chatapp-backend` (or your preferred name)
   - Environment: `Node`
   - Build Command: `cd Backend && npm install`
   - Start Command: `cd Backend && npm start`
   - Select the appropriate instance type (at least 512MB RAM recommended)

5. Add the following environment variables:
   ```
   NODE_ENV=production
   PORT=3000
   BACKEND_URL=https://your-backend-url.onrender.com
   CLIENT_URL=https://your-frontend-url.onrender.com
   JWT_SECRET=your_secure_jwt_secret
   MongoURI=your_mongodb_connection_string
   GMAIL_USER=your.email@gmail.com
   GMAIL_APP_PASSWORD=your_16_character_app_password
   SUPPORT_EMAIL=support@yourdomain.com
   APP_NAME=ChatApp
   ```

6. Click "Create Web Service"

## Step 5: Deploy Frontend to Render

1. In Render, click "New" and select "Static Site"
2. Connect your GitHub repository
3. Configure the service:
   - Name: `chatapp-frontend` (or your preferred name)
   - Build Command: `cd Frontend/ChatApp && npm install && npm run build`
   - Publish Directory: `Frontend/ChatApp/build`

4. Add the following environment variables:
   ```
   REACT_APP_BACKEND_URL=https://your-backend-url.onrender.com
   REACT_APP_ENVIRONMENT=production
   ```

5. Click "Create Static Site"

## Step 6: Update Frontend API Configuration

1. Make sure your frontend is configured to use the production backend URL
2. Update any hardcoded URLs to use environment variables

## Step 7: Verify Deployment

1. Access your frontend URL and test the application
2. Verify user registration and login functionality
3. Test the password reset flow:
   - Request a password reset
   - Check that the email is received in the Gmail account
   - Follow the reset link and change the password
   - Verify you can log in with the new password

## Step 8: Set Up Monitoring

1. Use Render's built-in logs to monitor your application
2. Check the stored logs in your application (`logs/error.log` and `logs/combined.log`)
3. Consider setting up a service like Sentry for error tracking

## Troubleshooting

### Email Issues
- Verify your Gmail App Password is correct
- Ensure 2-Step Verification is enabled
- Check the backend logs for SMTP errors

### Database Issues
- Confirm your MongoDB connection string is correct
- Verify network access settings in MongoDB Atlas
- Check for connection errors in the logs

### Render Deployment Issues
- Review the build logs in Render dashboard
- Make sure the environment variables are correctly set
- Verify the build and start commands are correct

## Security Recommendations

1. Regularly rotate your JWT_SECRET
2. Update your Gmail App Password periodically
3. Monitor for suspicious password reset attempts in the logs
4. Consider adding IP-based restrictions in MongoDB Atlas
5. Enable auto-scaling in Render for high-traffic periods

## Support

If you encounter issues, contact:
- Render Support: https://render.com/support
- MongoDB Atlas Support: https://support.mongodb.com
- Check GitHub issues for common problems 