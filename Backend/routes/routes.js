const express = require('express')
const router = express()
const mongoose = require('mongoose')
const bcrypt = require('bcrypt')
const cookie = require('cookie-parser')
const passport = require('passport')
const jwt = require('jsonwebtoken')
const User = require('../models/userschema')
const nanoid = require('nanoid')

const {register , login, verifyJWT , logout} = require('../controllers/userController')

router.use(express.json())
router.use(express.urlencoded({ extended: true }))
router.use(cookie())

// 🔹 Google OAuth Strategy
const GoogleStrategy = require('passport-google-oauth20').Strategy;

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${process.env.NODE_ENV === 'production' ? process.env.BACKEND_URL || 'https://chatappv2-qa96.onrender.com' : 'http://localhost:3000'}/auth/google/callback`
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const user = { 
            id: profile.id, 
            email: profile.emails[0].value, 
            name: profile.displayName,
            googleId: profile.id // Track Google ID specifically
        };
        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

// Logout before starting Google auth to clear previous sessions
router.get('/auth/google/logout', (req, res) => {
    // Clear the token cookie
    res.clearCookie("token", { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production', 
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });
    
    // Redirect to Google auth
    res.redirect('/auth/google');
});

// ✅ Google Login Route
router.get('/auth/google',
    passport.authenticate('google', { 
        scope: ['profile', 'email'],
        prompt: 'select_account' // Force Google account selection each time
    })
);

// ✅ Google OAuth Callback
router.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: `${process.env.CLIENT_URL || 'http://localhost:5173'}/login`, session: false }),
    async (req, res) => {
        try {
            const user = req.user;
            const email = user.email;
            const name = user.name;
            const googleId = user.googleId || user.id;

            // Check if user already exists
            let existingUser = await User.findOne({ email: email });
            
            // If user doesn't exist, create a new one
            if (!existingUser) {
                const uid = nanoid.nanoid(4);
                let isunique = false;
                while (!isunique) {
                    const isexist = await User.findOne({ uid });
                    if (!isexist) {
                        isunique = true;
                    } else {
                        uid = nanoid.nanoid(4);
                    }
                }
                
                existingUser = new User({
                    email: email,
                    username: name,
                    uid: uid,
                    googleId: googleId
                });
                
                console.log('Creating new user:', existingUser);
                await existingUser.save();
            } 
            // If user exists but doesn't have googleId, update it
            else if (!existingUser.googleId && googleId) {
                existingUser.googleId = googleId;
                await existingUser.save();
            }

            // ✅ Generate JWT token with user's correct info
            const token = jwt.sign({ 
                email: email, 
                uid: existingUser.uid, 
                username: existingUser.username 
            }, process.env.JWT_SECRET, {
                expiresIn: '7d' // Set token expiration 
            });

            // ✅ Store JWT token in HTTP-only cookie
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });
            
            // ✅ Redirect to frontend
            res.redirect(process.env.CLIENT_URL || 'http://localhost:5173');
        } catch (error) {
            console.error('Error in Google callback:', error);
            res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=auth_error`);
        }
    }
);



// Authentication routes


// User routes






router.get('/',verifyJWT)
router.post('/signup', register)
router.post('/login', login)
router.post("/logout", (req, res) => {
    // Clear the cookie with the same options used when setting it
    res.clearCookie("token", { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production', 
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    });
    res.status(200).json({ message: "Logged out successfully" });
});

router.get('/me', verifyJWT, (req, res) => {
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
        console.log('req.body', req.body)
        const { username, profilepicture } = req.body;
        const userId = req.user.uid;

        const user = await User.findOne({ uid: userId });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update fields if provided
        if (username) user.username = username;
        if (profilepicture) user.profilepicture = profilepicture;

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
        res.status(500).json({ message: 'Failed to update profile' });
    }
});

module.exports = router