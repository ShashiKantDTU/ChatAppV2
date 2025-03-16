const session = require('express-session');

// Configure session middleware
module.exports = function configureSession() {
  return session({
    secret: process.env.SESSION_SECRET || process.env.JWT_SECRET || 'keyboard_cat', // Use JWT_SECRET as fallback
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === 'production', // Only use secure in production
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // For cross-domain
      maxAge: 5 * 60 * 1000 // Short-lived sessions - 5 minutes
    }
  });
}; 