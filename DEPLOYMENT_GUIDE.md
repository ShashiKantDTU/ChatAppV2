# ChatApp Production Deployment Guide

This guide will help you get your ChatApp fully working in production, addressing common issues with WebRTC, Cloudinary and cross-origin communication.

## Checklist for Working Deployment

### 1. Properly Configure Environment Variables

#### In Render (Backend):
- `PORT`: `3000`
- `MongoURI`: Your MongoDB Atlas connection string
- `JWT_SECRET`: A secure random string
- `NODE_ENV`: `production`
- `CLIENT_URL`: Your frontend URL (example: `https://chatpe.vercel.app`)
- `CLOUDINARY_CLOUD_NAME`: Your Cloudinary cloud name
- `CLOUDINARY_API_KEY`: Your Cloudinary API key
- `CLOUDINARY_API_SECRET`: Your Cloudinary API secret
- `BACKEND_URL`: Your backend URL (example: `https://chatappv2-qa96.onrender.com`)

#### In Vercel (Frontend):
- `VITE_API_URL`: Your backend URL (example: `https://chatappv2-qa96.onrender.com`)

### 2. Fix WebRTC Voice Calls

Our recent updates have improved WebRTC connection handling with:
- Multiple STUN/TURN server configuration
- ICE candidate handling improvements
- Better error handling and connection recovery
- Enhanced signaling protocol

#### Testing Voice Calls:
1. Make sure both users have granted microphone permissions
2. Check browser console for any errors during calls
3. Verify that ICE candidates are being exchanged
4. Test from different networks (not just local)

### 3. Fix Cloudinary Media Uploads

We've implemented Cloudinary for secure file storage:
- Free 25GB storage for media files
- Automatic CDN distribution
- Secure URL handling

#### Testing File Uploads:
1. Try uploading a small image (less than 1MB)
2. Check browser console for any errors
3. Verify image appears in chat
4. Check Cloudinary dashboard to confirm the upload

### 4. Troubleshooting Common Issues

#### CORS Errors:
If you see CORS errors in the console:
1. Verify `CLIENT_URL` matches your exact frontend URL (with https://)
2. Check that Render's environment variables are properly set
3. Redeploy the backend after changing environment variables

#### Socket.io Connection Issues:
If real-time features aren't working:
1. Check the browser console for connection errors
2. Verify that both frontend and backend URLs use HTTPS
3. Check that the Socket.io connection isn't being blocked by a firewall

#### Cloudinary Upload Errors:
If media uploads fail with 500 errors:
1. Verify Cloudinary credentials are correct
2. Check Render logs for specific error messages
3. Try uploading a smaller file (Render free tier has memory limitations)
4. Make sure your Cloudinary account is active

#### Voice Call Issues:
If calls connect but have no audio:
1. Check that both users have granted microphone permissions
2. Verify that audio tracks are being added to the peer connection
3. Look for "ICE connection failed" messages in the console

## Recommended Production Optimizations

### Scale Considerations:
- Render free tier has limitations (512MB RAM)
- Cloudinary free tier includes 25GB storage and sufficient bandwidth for small applications
- Consider upgrading to paid tiers as your user base grows

### Security Considerations:
- Set up rate limiting for API endpoints
- Implement proper authentication for file uploads
- Consider adding end-to-end encryption for messages

## Deployment Checklist

- [ ] Backend deployed to Render with correct environment variables
- [ ] Frontend deployed to Vercel with correct environment variables
- [ ] MongoDB Atlas properly configured with network access
- [ ] Cloudinary account set up with correct credentials
- [ ] WebRTC voice calls working in production
- [ ] Media uploads and downloads working correctly
- [ ] Real-time messaging working between users

## Getting Help

If you continue to have issues with your deployment:
1. Check the Render logs for specific error messages
2. Look for errors in the browser console
3. Test with different browsers and networks
4. Consider debugging with network monitoring tools like Chrome DevTools 