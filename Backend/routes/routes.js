const express = require('express')
const router = express()
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const cookie = require('cookie-parser')
const passport = require('passport')
const jwt = require('jsonwebtoken')
const User = require('../models/userschema')
const nanoid = require('nanoid')
const multer = require('multer')
const cloudinary = require('cloudinary').v2
const { CloudinaryStorage } = require('multer-storage-cloudinary')
const nodemailer = require('nodemailer')
const emailService = require('../utils/emailService')
const rateLimit = require('express-rate-limit')
const logger = require('../utils/logger')

const {register , login, verifyJWT , logout} = require('../controllers/userController')

// Modify JSON parser middleware to skip multipart form data requests
router.use((req, res, next) => {
    // Skip JSON parsing for multipart requests
    if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
        return next();
    }
    // Apply JSON parsing for all other requests
    express.json()(req, res, next);
});

router.use(express.urlencoded({ extended: true }))
router.use(cookie())

// 🔹 Google OAuth Strategy
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// Get the backend URL from environment
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${BACKEND_URL}/auth/google/callback`
}, async (accessToken, refreshToken, profile, done) => {
    
    const user = { id: profile.id, email: profile.emails[0].value, name: profile.displayName };
    return done(null, user); // ✅ No need to serialize session
}));

// ✅ Google Login Route
router.get('/auth/google', (req, res, next) => {
    // Store return URL in session if provided
    const returnUrl = req.query.return_url;
    if (returnUrl) {
        req.session = req.session || {};
        req.session.returnUrl = returnUrl;
        console.log('Storing return URL for OAuth:', returnUrl);
    }
    
    // Call passport authenticate with dynamic state parameter
    passport.authenticate('google', { 
        scope: ['profile', 'email'],
        // Pass the return URL as state for callback
        state: returnUrl || ''
    })(req, res, next);
});

// ✅ Google OAuth Callback
router.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: `${CLIENT_URL}/login`, session: false }),
    async (req, res) => {
        const user = req.user;
        const email = user.email;
        const name = user.name;
        // Get return URL from state or session
        const returnUrl = req.query.state || (req.session && req.session.returnUrl) || CLIENT_URL;

        console.log('Generating JWT token for user:', user);
        console.log('Return URL after auth:', returnUrl);

        // ✅ Generate JWT token
        const token = jwt.sign({ email:user.email, name: user.displayName }, process.env.JWT_SECRET);

        // ✅ Store JWT token in HTTP-only cookie with consistent settings
        const isProduction = process.env.NODE_ENV === 'production';
        
        // Log the full request/response details for debugging
        console.log('===== GOOGLE AUTH CALLBACK DEBUG =====');
        console.log('Request headers:', req.headers);
        console.log('Response headers before setting cookie:', res.getHeaders());
        
        // Set the cookie with necessary flags for cross-origin
        res.cookie('token', token, {
            httpOnly: true,
            sameSite: 'none',
            secure: true,
            path: '/',
            // Don't set domain to allow the browser to use the current domain
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
        });
        
        // Log what we're doing for debugging
        console.log('Setting auth cookie with token. Cookie options:', {
            httpOnly: true,
            sameSite: 'none',
            secure: true,
            path: '/',
            maxAge: '7 days'
        });
        
        // Better browser debugging - Add a visible cookie for the frontend to detect
        res.cookie('auth_debug', 'true', {
            httpOnly: false, // Visible to JavaScript
            sameSite: 'none',
            secure: true,
            path: '/',
            maxAge: 60000 // 1 minute
        });
        
        res.user = req.user;
        console.log('res.user in routes/googleauthcallback:', res.user);
        
        // check if user already exists
        const existingUser = await User.findOne({email: email});
        if(!existingUser){
            const uid = nanoid.nanoid(4)
            let isunique = false;
            while (!isunique) {
                const isexist = await User.findOne({ uid
                });
                if (!isexist) {
                    isunique = true;
                } else {
                    uid = nanoid.nanoid(4)
                }
            }
            const newUser = new User({
                email: email,
                username: name,
                uid: uid
            });
            console.log('new user:', newUser)
            await newUser.save();
        }

        // Log final response headers after setting cookies
        console.log('Response headers after setting cookie:', res.getHeaders());

        // MODIFIED APPROACH: Send JSON with token instead of HTML
        // Include token directly in the URL as a fragment identifier (#)
        // Fragments (#) are not sent to the server but accessible by client JavaScript
        const tokenFragment = encodeURIComponent(token);
        const redirectUrl = returnUrl.includes('?') 
            ? `${returnUrl}&auth_success=true#token=${tokenFragment}` 
            : `${returnUrl}?auth_success=true#token=${tokenFragment}`;
            
        console.log(`Redirecting to: ${redirectUrl}`);
        return res.redirect(redirectUrl);
    }
);



// Authentication routes


// User routes






router.get('/',verifyJWT)
router.post('/signup', register)
router.post('/login', login)
router.post("/logout", (req, res) => {
    // Clear the HTTP-only cookie with same settings as when it was set
    res.clearCookie("token", { 
        httpOnly: true, 
        sameSite: 'none',
        secure: true,
        path: '/'
    });
    
    // Clear the debug cookie too
    res.clearCookie("auth_debug", {
        httpOnly: false,
        sameSite: 'none',
        secure: true,
        path: '/'
    });
    
    res.status(200).json({ 
        message: "Logged out successfully",
        status: "success"
    });
});

router.get('/me', verifyJWT, (req, res) => {
    console.log('/me endpoint accessed with verified token. User:', req.user.email);
    const user = req.user;
    res.json({ 
        user: {
            email: user.email,
            username: user.username,
            uid: user.uid,
            profilepicture: user.profilepicture,
            onlinestatus: user.onlinestatus
        }
    });
});

// Update user profile
router.put('/update-profile', verifyJWT, async (req, res) => {
    try {
        console.log('Updating profile with data:', req.body);
        const { username } = req.body;
        const userId = req.user.uid;

        // Find the user by UID
        const user = await User.findOne({ uid: userId });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update username if provided
        if (username) user.username = username;

        // Handle file upload separately in a dedicated endpoint
        // This will be handled by a new route

        await user.save();

        res.json({ 
            message: 'Profile updated successfully',
            user: {
                username: user.username,
                profilepicture: user.profilepicture
            }
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ message: 'Failed to update profile', error: error.message });
    }
});

// Add a new route for profile image upload
const profileStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'profile_pictures',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        transformation: [
            { width: 400, height: 400, crop: 'limit' },
            { quality: 'auto' }
        ]
    }
});

const profileUpload = multer({
    storage: profileStorage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit for profile pictures
    },
    fileFilter: function (req, file, cb) {
        // Accept only images
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
    }
});

// Update profile with image upload
router.put('/update-profile-image', verifyJWT, (req, res, next) => {
    // Check Content-Type for multipart/form-data
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
        return res.status(400).json({
            success: false,
            error: 'Invalid Content-Type. Expected multipart/form-data but received: ' + contentType,
            help: 'Make sure your frontend is using FormData for file uploads'
        });
    }
    next();
}, profileUpload.single('profileImage'), async (req, res) => {
    try {
        const userId = req.user.uid;
        const { username } = req.body;

        console.log('Updating profile with image. File:', req.file);
        console.log('Form data:', req.body);

        // Find the user
        const user = await User.findOne({ uid: userId });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update username if provided
        if (username) {
            user.username = username;
        }

        // Update profile picture if a file was uploaded
        if (req.file && req.file.path) {
            // Delete the old profile picture from Cloudinary if it exists
            // Extract public_id from the existing profile picture URL
            if (user.profilepicture && user.profilepicture.includes('cloudinary')) {
                try {
                    const urlParts = user.profilepicture.split('/');
                    const filenameWithExt = urlParts[urlParts.length - 1];
                    const publicId = filenameWithExt.split('.')[0];
                    
                    if (publicId) {
                        console.log('Attempting to delete old profile image:', publicId);
                        await cloudinary.uploader.destroy(`profile_pictures/${publicId}`);
                    }
                } catch (deleteError) {
                    console.error('Error deleting old profile image:', deleteError);
                    // Continue with the update even if deletion fails
                }
            }

            // Set the new profile picture URL
            user.profilepicture = req.file.path;
        }

        await user.save();

        res.json({
            message: 'Profile updated successfully',
            user: {
                username: user.username,
                profilepicture: user.profilepicture
            }
        });
    } catch (error) {
        console.error('Error updating profile with image:', error);
        res.status(500).json({ message: 'Failed to update profile', error: error.message });
    }
});

// Add rate limiter and logger imports
const passwordResetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 3, // 3 requests per IP during windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many password reset requests. Please try again after 15 minutes.' }
});

// Forgot Password Route - Apply rate limiting and improve error handling
router.post('/forgot-password', passwordResetLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: 'Email is required' });
        }

        // Find the user
        const user = await User.findOne({ email });
        if (!user) {
            logger.warn(`Password reset attempted for non-existent email: ${email}`);
            // Don't reveal if a user exists to prevent user enumeration
            return res.status(200).json({ 
                message: 'If your email exists in our system, you will receive a password reset link' 
            });
        }

        // Generate a reset token
        const resetToken = jwt.sign(
            { userId: user._id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Store reset token and expiry in user document
        user.resetPasswordToken = resetToken;
        user.resetPasswordExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
        await user.save();

        // Create reset URL
        const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
        const resetUrl = `${CLIENT_URL}/reset-password?token=${resetToken}`;

        // Send password reset email using the email service
        const emailResult = await emailService.sendPasswordResetEmail(
            user.email,
            user.username,
            resetUrl
        );

        logger.info(`Password reset email sent to: ${email}`);

        // Production-safe response (doesn't leak the resetUrl)
        const isProd = process.env.NODE_ENV === 'production';
        if (isProd) {
            return res.status(200).json({
                message: 'If your email exists in our system, you will receive a password reset link'
            });
        } else {
            // Development response with helpful debugging info
            return res.status(200).json({
                message: 'Password reset link sent to your email',
                resetUrl: resetUrl,
                previewUrl: emailResult.previewUrl
            });
        }
    } catch (error) {
        logger.error('Forgot password error:', error);
        // Generic error message for production
        res.status(500).json({ 
            message: 'An error occurred while processing your request. Please try again later.' 
        });
    }
});

// Reset Password Route - Improve error handling for production
router.post('/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;
        
        if (!token || !password) {
            return res.status(400).json({ message: 'Token and password are required' });
        }

        if (password.length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters long' });
        }

        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            logger.warn('Invalid reset token used');
            return res.status(400).json({ message: 'Invalid or expired token' });
        }

        // Find user by email from token
        const user = await User.findOne({ 
            email: decoded.email,
            resetPasswordToken: token,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            logger.warn(`Reset token used but no matching user found for email: ${decoded.email}`);
            return res.status(400).json({ message: 'Token is invalid or has expired' });
        }

        // Hash new password
        const salt = 10;
        const hashedPassword = await bcrypt.hash(password, salt);

        // Update user's password and clear reset token fields
        user.password = hashedPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        // Send confirmation email
        try {
            const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
            const loginUrl = `${CLIENT_URL}/login`;
            
            await emailService.sendPasswordResetConfirmationEmail(
                user.email,
                user.username,
                loginUrl
            );
            
            logger.info(`Password reset successful for user: ${user.email}`);
        } catch (emailError) {
            // Log the error but don't fail the request if email sending fails
            logger.error('Error sending confirmation email:', emailError);
        }

        res.status(200).json({ message: 'Password has been reset successfully' });
        
    } catch (error) {
        logger.error('Reset password error:', error);
        res.status(500).json({ 
            message: 'An error occurred while resetting your password. Please try again later.' 
        });
    }
});

module.exports = router