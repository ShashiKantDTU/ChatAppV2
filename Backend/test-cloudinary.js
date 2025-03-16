require('dotenv').config();
const cloudinary = require('cloudinary').v2;

// Function to test Cloudinary configuration
async function testCloudinaryConfig() {
    console.log('Testing Cloudinary configuration...');
    
    // Check if environment variables are set
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    
    if (!cloudName || !apiKey || !apiSecret) {
        console.error('❌ ERROR: Missing Cloudinary credentials in environment variables!');
        console.error('Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET');
        return false;
    }
    
    console.log('✅ Cloudinary environment variables found:');
    console.log(`  - CLOUDINARY_CLOUD_NAME: ${cloudName}`);
    console.log(`  - CLOUDINARY_API_KEY: ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`);
    console.log(`  - CLOUDINARY_API_SECRET: ${apiSecret.substring(0, 4)}...${apiSecret.substring(apiSecret.length - 4)}`);
    
    // Configure Cloudinary
    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret
    });
    
    // Test the configuration by making a simple API call
    try {
        console.log('Testing Cloudinary API connection...');
        const result = await cloudinary.api.ping();
        console.log('✅ Cloudinary API connection successful!');
        console.log('API Response:', result);
        return true;
    } catch (error) {
        console.error('❌ ERROR: Failed to connect to Cloudinary API');
        console.error('Error details:', error);
        return false;
    }
}

// Run the test
testCloudinaryConfig()
    .then(success => {
        if (success) {
            console.log('✅ Cloudinary configuration test passed!');
        } else {
            console.error('❌ Cloudinary configuration test failed!');
            process.exit(1);
        }
    })
    .catch(error => {
        console.error('❌ Unexpected error during Cloudinary test:', error);
        process.exit(1);
    }); 