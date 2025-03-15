# ChatApp Deployment Guide

This guide will help you deploy the ChatApp to free tier services.

## Prerequisites

- GitHub account
- MongoDB Atlas account
- Render.com account
- Vercel account

## Step 1: Deploy MongoDB on Atlas

1. Create a MongoDB Atlas account at [https://www.mongodb.com/cloud/atlas/register](https://www.mongodb.com/cloud/atlas/register)
2. Create a new project named "ChatApp"
3. Build a database with the FREE tier option
4. Choose a cloud provider and region
5. Create a database user:
   - Go to Database Access under Security
   - Add a new user with password authentication
   - Give the user Read and Write privileges
6. Set up network access:
   - Go to Network Access under Security
   - Add IP address 0.0.0.0/0 (Allow access from anywhere)
7. Get your connection string:
   - Click "Connect" on your cluster
   - Select "Connect your application"
   - Copy the connection string (replace `<password>` with your database user's password)

## Step 2: Deploy Backend on Render

1. Create a Render account at [https://render.com/](https://render.com/)
2. Connect your GitHub repository
3. Create a new Web Service
4. Select your repository and branch
5. Configure the service:
   - Name: `chatapp-backend`
   - Runtime: `Node`
   - Build Command: `npm install`
   - Start Command: `node index.js`
   - Select "Free" plan
6. Add environment variables:
   - `MongoURI`: Your MongoDB Atlas connection string
   - `PORT`: `10000`
   - `JWT_SECRET`: Generate a secure random string
   - `NODE_ENV`: `production`
   - Leave `CLIENT_URL` blank for now
7. Click "Create Web Service"
8. Wait for deployment to complete and note the URL provided by Render

## Step 3: Deploy Frontend on Vercel

1. Create a Vercel account at [https://vercel.com/signup](https://vercel.com/signup)
2. Import your GitHub repository
3. Configure the project:
   - Framework Preset: Vite
   - Root Directory: `Frontend/ChatApp`
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Add environment variables:
   - `VITE_API_URL`: Your Render backend URL (e.g., `https://chatapp-backend.onrender.com`)
5. Click "Deploy"
6. Wait for deployment to complete and note the URL provided by Vercel

## Step 4: Update Backend with Frontend URL

1. Go to your Render dashboard and open your backend service
2. Update the `CLIENT_URL` environment variable with your Vercel frontend URL
3. Redeploy the service by clicking "Manual Deploy" > "Clear build cache & deploy"

## Step 5: Test Your Deployment

1. Go to your frontend URL
2. Try to register a new account
3. Test login functionality
4. Test messaging features

## Troubleshooting

### CORS Issues
If you encounter CORS errors, check that:
- The `CLIENT_URL` environment variable on the backend matches your frontend URL exactly
- The backend CORS configuration is correct
- Your browser isn't blocking cookies

### Socket Connection Issues
If socket connections fail:
- Check browser console for errors
- Verify environment variables are set correctly
- Make sure your backend is running

### Database Connection Issues
If the app can't connect to MongoDB:
- Verify your MongoDB Atlas connection string
- Check that your database user has correct permissions
- Make sure network access is properly configured 