/**
 * This is a Render-specific entry point that ensures 
 * the application starts properly on Render's platform.
 * 
 * Render handles process management and environment variables differently,
 * so this file provides additional setup and error handling.
 */

// Load environment variables
require('dotenv').config();

// Set NODE_ENV to production if not already set
if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'production';
}

// Create logs directory if it doesn't exist
const fs = require('fs');
const path = require('path');
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    try {
        fs.mkdirSync(logsDir, { recursive: true });
        console.log(`Created logs directory at ${logsDir}`);
    } catch (error) {
        console.error(`Failed to create logs directory: ${error.message}`);
        // Continue anyway as Render might have its own logging system
    }
}

try {
    // Import the main application
    require('./index.js');
    console.log('Application started successfully via Render entry point');
} catch (error) {
    console.error('Fatal error starting application:', error);
    
    // Log additional diagnostic information
    console.error('Node version:', process.version);
    console.error('Environment:', process.env.NODE_ENV);
    console.error('Current directory:', __dirname);
    console.error('Available files:', fs.readdirSync(__dirname).join(', '));
    
    // Exit with error code
    process.exit(1);
}

// Handle uncaught exceptions at the top level
process.on('uncaughtException', (error) => {
    console.error('UNCAUGHT EXCEPTION - Application will attempt to continue running:', error);
    
    // Don't exit in production - Render will restart the app if needed
    if (process.env.NODE_ENV !== 'production') {
        process.exit(1);
    }
});

console.log('Render entry point initialized successfully'); 