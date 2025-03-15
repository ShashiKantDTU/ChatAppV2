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
    callbackURL: "http://localhost:3000/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
    
    const user = { id: profile.id, email: profile.emails[0].value, name: profile.displayName };
    return done(null, user); // ✅ No need to serialize session
}));

// ✅ Google Login Route
router.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

// ✅ Google OAuth Callback
router.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: 'http://localhost:5173/login',session: false }),
    async (req, res) => {
        const user = req.user;
        const email = user.email;
        const name = user.name;


        // ✅ Generate JWT token
        const token = jwt.sign({ email:user.email, name: user.displayName }, process.env.JWT_SECRET);

        // ✅ Store JWT token in HTTP-only cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: false,  // ✅ Change to `true` in production with HTTPS
            sameSite: 'lax'
        });
        res.user = token;
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


        // ✅ Redirect to frontend
        res.redirect('http://localhost:5173/');
    }
);



// Authentication routes


// User routes






router.get('/',verifyJWT)
router.post('/signup', register)
router.post('/login', login)
router.post("/logout", (req, res) => {
    res.clearCookie("token", { httpOnly: true, sameSite: "Lax" }); // ✅ Clears token
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