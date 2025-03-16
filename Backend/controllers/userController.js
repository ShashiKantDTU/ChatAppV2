// Registering users
// loggin in users 
// verify JWT


const express = require('express');
const app = express();
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nanoid = require('nanoid');


const salt = 10;

const User = require('../models/userschema');



const verifyJWT = async (req, res, next) => {
    // Log request headers to debug cookie transmission
    console.log('=== AUTH DEBUG ===');
    console.log('Request URL:', req.originalUrl);
    console.log('Cookie header:', req.headers.cookie);
    console.log('Origin header:', req.headers.origin);
    
    const token = req.cookies.token;
    console.log('Token from cookies:', token ? 'Token exists' : 'Token missing');
    console.log('Cookies received:', req.cookies);
    
    if (!token) {
        return res.status(401).json({ message: 'Not Loggedin' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Token successfully decoded:', decoded.email);
        
        // Find the user in database
        const user = await User.findOne({ email: decoded.email });
        if (!user) {
            console.log('User not found for email:', decoded.email);
            return res.status(404).json({ message: 'User not found' });
        }
        // Attach user details to request
        req.user = user;
        next();
    } catch (error) {
        console.log('JWT verification error:', error.message);
        return res.status(403).json({ message: "Invalid or Expired Token" });
    }
}














const register = async (req, res, next) => {
    const { email, username, password } = req.body;
    const isalreadyexist = await User.findOne({ email: email });
    if (isalreadyexist) {
        return res.status(400).json({ message: 'User already exists' });
    }
    const hashpass = await bcrypt.hash(password, salt)
    const uid = nanoid.nanoid(4)
    let isunique = false;
    while (!isunique) {
        const isexist = await User.findOne({
            uid
        });
        if (!isexist) {
            isunique = true;
        } else {
            uid = nanoid.nanoid(4)
        }
    }
    try {
        const newUser = new User({
            email: email,
            username: username,
            password: hashpass,
            uid: uid
        });
        await newUser.save();
        // Genrate JWT and send cookie to client 
        const token = jwt.sign({ username: username, email: email }, process.env.JWT_SECRET)
        req.user = token;
        res.cookie('token', token, {
            httpOnly: true,
            sameSite: 'None',
            secure: true,
        });
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error registering user', error: error.message });
    }
    next()
}

const login = async (req, res, next) => {
    const { email, password } = req.body;
    const profile = await User.findOne({ email: email })
    console.log(profile)
    if (!profile) {
        return res.json({ message: 'User does not exist ! Please register' })
    } else {
        if(profile.password === undefined){
            return res.json({ message: 'Password Not Set' })
        }
        const correctpass = bcrypt.compare(password, profile.password)
        if (!correctpass) {
            return res.json({ message: 'Incorrect Password' })
        } else {
            
            // Generate JWT and send cookie to client 
            const token = jwt.sign({ username: profile.username, email: email }, process.env.JWT_SECRET)
            req.user = token;
            
            // Set consistent cookie settings across all auth endpoints
            const isProduction = process.env.NODE_ENV === 'production';
            res.cookie('token', token, {
                httpOnly: true,
                sameSite: 'none',
                secure: true,
                path: '/',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
            });

            // Log cookie settings for debugging
            console.log('Login: Setting auth cookie with token. Cookie options:', {
                httpOnly: true,
                sameSite: 'none',
                secure: true,
                path: '/',
                maxAge: '7 days'
            });

            res.status(201).json({ message: 'User Loggedin successfully' });
            console.log('hashpass', correctpass)
            next()
        }

    }

}

const logout = async (req, res, next) => {
    // Use same cookie options for consistent deletion
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', "", {
        httpOnly: true,
        sameSite: 'none',
        secure: true,
        path: '/',
        expires: new Date(0)
    });
    res.user = null;
    res.status(200).json({ message: 'Logged out successfully' })
    console.log('Logged out')
    next()
}




module.exports = { register, login, verifyJWT, logout }
