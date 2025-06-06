require('dotenv').config();
const express = require('express');
const router = require('./routes/routes');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const http = require('http');
const User = require('./models/userschema');
const message = require('./models/messageschema');
const syncmessage = require('./models/syncmessageschema');
const { send } = require('process');
const cookie = require('cookie-parser');
const session = require('express-session');
const configureSession = require('./config/session');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const fetch = require('node-fetch');
const logger = require('./utils/logger');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: [
            'https://chatpe.vercel.app',
            process.env.CLIENT_URL || 'http://localhost:5173',
            'http://localhost:3000'
        ],
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true
    }
});

// Add cookie parser middleware BEFORE routes
app.use(cookie());

// Add session support for OAuth state
app.use(configureSession());

// Use Morgan for HTTP request logging in development, but not in production
if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'));
} else {
    // Use combined format and write to access log in production
    app.use(morgan('combined', { stream: logger.stream }));
}

// Only log request details in development environment
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        logger.debug('=== REQUEST DEBUG ===');
        logger.debug(`Request URL: ${req.originalUrl}`);
        logger.debug('Request headers:', {
            cookie: req.headers.cookie,
            origin: req.headers.origin,
            host: req.headers.host,
            referer: req.headers.referer
        });
        logger.debug(`Content-Type: ${req.headers['content-type']}`);
        next();
    });
}

// Enable CORS for all allowed origins
app.use(cors({
    origin: [
        'https://chatpe.vercel.app',
        process.env.CLIENT_URL || 'http://localhost:5173',
        'http://localhost:3000'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    optionsSuccessStatus: 200,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Handle preflight requests globally
app.options('*', cors());

// Additional CORS headers middleware
app.use((req, res, next) => {
    const allowedOrigins = [
        'https://chatpe.vercel.app',
        process.env.CLIENT_URL || 'http://localhost:5173',
        'http://localhost:3000'
    ];
    
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
    }
    
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).send();
    }
    
    next();
});

// Configure Cloudinary storage
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'chat_uploads',
        resource_type: 'auto',
        allowed_formats: [
            // Images
            'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff',
            // Videos
            'mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv',
            // Audio
            'mp3', 'wav', 'ogg', 'midi', 'aac', 'flac',
            // Documents
            'pdf', 'doc', 'docx',
            // Spreadsheets
            'xls', 'xlsx',
            // Presentations
            'ppt', 'pptx',
            // Archives
            'zip', 'rar', '7z', 'tar',
            // Text files
            'txt', 'csv', 'html', 'css', 'js',
            // Code files
            'json', 'xml', 'yaml', 'py'
        ],
        transformation: { quality: 'auto' }
    }
});






// Add endpoint to fetch ICE server credentials
app.get('/api/ice-servers', async (req, res) => {
    try {
        // Get Metered API key from environment variables
        const METERED_API_KEY = process.env.METERED_API_KEY || '0b3cef3685935b3424354cbea99c073db622';
        
        // Fetch fresh ICE servers from Metered.ca
        const response = await fetch(
            `https://shashikant.metered.live/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`
        );
        
        if (!response.ok) {
            throw new Error(`Failed to fetch ICE servers: ${response.status}`);
        }
        
        const iceServers = await response.json();
        console.log('Providing ICE servers to client');
        
        // Return the ICE servers to the client
        res.json({ iceServers });
    } catch (error) {
        console.error('Error fetching ICE servers:', error);
        
        // Provide fallback ICE servers
        const fallbackServers = [
            {
                urls: "stun:stun.relay.metered.ca:80",
            },
            {
                urls: "turn:global.relay.metered.ca:80",
                username: "54802f233bc4f94626bf76e1",
                credential: "ipCZUvoLoYzVeHVz",
            },
            {
                urls: "turn:global.relay.metered.ca:80?transport=tcp",
                username: "54802f233bc4f94626bf76e1",
                credential: "ipCZUvoLoYzVeHVz",
            }
        ];
        
        res.json({ 
            iceServers: fallbackServers,
            fromFallback: true,
            error: error.message
        });
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    },
    fileFilter: function (req, file, cb) {
        // Accept images, videos, audio, documents, spreadsheets, presentations, and archives
        const allowedTypes = [
            // Images
            'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp', 'image/tiff',
            // Videos
            'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
            // Audio
            'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/midi', 'audio/webm', 'audio/aac', 'audio/flac',
            // Documents
            'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            // Spreadsheets
            'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            // Presentations
            'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            // Archives
            'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed', 'application/x-tar',
            // Text files
            'text/plain', 'text/csv', 'text/html', 'text/css', 'text/javascript',
            // Code files
            'application/json', 'application/xml', 'application/x-yaml', 'application/x-python-code',
            // Fonts
            'font/ttf', 'font/otf', 'font/woff', 'font/woff2'
        ];
        
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Allowed types: images (JPEG, PNG, GIF, WebP, SVG, BMP, TIFF), videos (MP4, WebM, OGG, MOV, AVI, MKV), audio (MP3, WAV, OGG, MIDI, AAC, FLAC), documents (PDF, DOC, DOCX), spreadsheets (XLS, XLSX), presentations (PPT, PPTX), archives (ZIP, RAR, 7Z, TAR), text files (TXT, CSV, HTML, CSS, JS), code files (JSON, XML, YAML, PY), and fonts (TTF, OTF, WOFF, WOFF2)'));
        }
    }
});

// File upload endpoint - Define BEFORE the router middleware
// to prevent body-parser from trying to parse multipart/form-data
app.post('/upload', (req, res, next) => {
    // Check Content-Type before proceeding with multer
    const contentType = req.headers['content-type'] || '';
    console.log('Upload request Content-Type:', contentType);
    
    if (!contentType.includes('multipart/form-data')) {
        console.error('Invalid Content-Type for file upload:', contentType);
        return res.status(400).json({
            success: false,
            error: 'Invalid Content-Type. Expected multipart/form-data but received: ' + contentType,
            help: 'Make sure your frontend is using FormData and not sending JSON'
        });
    }
    
    // Proceed with multer middleware
    next();
}, upload.array('file', 10), (req, res) => {
    try {
        console.log("Processing file upload...");
        if (!req.files || req.files.length === 0) {
            throw new Error('No files uploaded');
        }

        console.log(`Received ${req.files.length} files`);

        // Handle multiple files with Cloudinary URLs
        const files = req.files.map((file, index) => {
            // Debug log to see the structure of the file object
            console.log(`File ${index + 1} structure:`, JSON.stringify(file, null, 2));
            
            let publicId;
            
            // Handle various Cloudinary response structures
            if (file.public_id) {
                publicId = file.public_id;
            } else if (file.filename) {
                publicId = file.filename.split('.')[0];
            } else if (file.path) {
                // Try to extract from the Cloudinary URL
                try {
                    const pathParts = new URL(file.path).pathname.split('/');
                    // Cloudinary URLs typically have the public ID in the last segment before file extension
                    const filename = pathParts[pathParts.length - 1];
                    publicId = filename.split('.')[0];
                } catch (err) {
                    console.error('Error parsing URL:', err);
                    // Fallback using parts of the path
                    const parts = file.path.split('/');
                    publicId = parts[parts.length - 1].split('.')[0];
                }
            } else {
                // Generate a fallback ID
                publicId = `file_${Date.now()}_${index}`;
            }
            
            return {
                url: file.path, // Cloudinary returns the full URL in the path property
                filename: file.originalname || `file_${index + 1}`,
                size: file.size,
                mimeType: file.mimetype,
                public_id: publicId
            };
        });

        console.log('Processed files for client:', files);

        res.json({
            success: true,
            files: files
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Add endpoint to delete a file from Cloudinary
app.delete('/delete-file/:publicId', async (req, res) => {
    try {
        const publicId = req.params.publicId;
        if (!publicId) {
            return res.status(400).json({
                success: false,
                error: 'No public ID provided'
            });
        }

        console.log('Attempting to delete file with publicId:', publicId);
        
        // The public_id may need to include the folder path for Cloudinary to recognize it
        const fullPublicId = publicId.includes('chat_uploads/') ? 
            publicId : 
            `chat_uploads/${publicId}`;
            
        console.log('Using fullPublicId for deletion:', fullPublicId);

        // Delete file from Cloudinary
        const result = await cloudinary.uploader.destroy(fullPublicId);
        console.log('Cloudinary delete result:', result);
        
        if (result.result === 'ok') {
            res.json({
                success: true,
                message: 'File deleted successfully'
            });
        } else {
            throw new Error('Failed to delete file from Cloudinary: ' + result.result);
        }
    } catch (error) {
        console.error('Cloudinary delete error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const healthCheck = {
            status: 'OK',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
            version: process.env.npm_package_version || '1.0.0',
            services: {
                database: 'disconnected',
                cloudinary: 'unknown'
            }
        };

        // Check database connection
        try {
            if (mongoose.connection.readyState === 1) {
                healthCheck.services.database = 'connected';
            } else if (mongoose.connection.readyState === 2) {
                healthCheck.services.database = 'connecting';
            } else if (mongoose.connection.readyState === 3) {
                healthCheck.services.database = 'disconnecting';
            } else {
                healthCheck.services.database = 'disconnected';
            }
        } catch (dbError) {
            healthCheck.services.database = 'error';
            logger.warn('Database health check failed:', dbError.message);
        }

        // Check Cloudinary connection by testing configuration
        try {
            if (cloudinary.config().cloud_name && cloudinary.config().api_key && cloudinary.config().api_secret) {
                healthCheck.services.cloudinary = 'configured';
            } else {
                healthCheck.services.cloudinary = 'not_configured';
            }
        } catch (cloudinaryError) {
            healthCheck.services.cloudinary = 'error';
            logger.warn('Cloudinary health check failed:', cloudinaryError.message);
        }

        // Set response status based on critical services
        const isHealthy = healthCheck.services.database === 'connected';
        
        res.status(isHealthy ? 200 : 503).json(healthCheck);
        
    } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({
            status: 'ERROR',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// Lightweight health check endpoint for load balancers
app.get('/health/ready', (req, res) => {
    res.status(200).json({ 
        status: 'ready',
        timestamp: new Date().toISOString()
    });
});

// Liveness probe endpoint
app.get('/health/live', (req, res) => {
    res.status(200).json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Add router middleware AFTER defining the upload endpoints
app.use(router);

// Socket.io connection handling
io.on('connection', (socket) => {
    // console.log('User connected with socket ID:', socket.id);

    // socket.on('registersocket', async (email) => {

    //     // register socket id with user uid
    //     const user = await User.findOne({ email: email });
    //     if (!user) {
    //         return;
    //     }
    //     // console.log('User:', user);
    //     user.socketid = socket.id;
    //     user.onlinestatus.status = true;
    //     if (!user.profilepicture) {
    //         user.profilepicture = `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`
    //     }






    //     await user.save();




    //     io.to(socket.id).emit('YourDetails', user);
    // })



    socket.on('registersocket', async (email) => {
        console.log('Socket registered for user:', email);

        try {
            const user = await User.findOne({ email: email });

            if (!user) {
                console.log('User not found');
                return;
            }

            user.socketid = socket.id;
            user.onlinestatus.status = true;
            await user.save();

            // Emit user details back to the user
            socket.emit('YourDetails', {
                username: user.username,
                profilepicture: user.profilepicture,
                uid: user.uid,
                chats: user.chats,
                friends: user.friends,
                onlinestatus: {
                    status: user.onlinestatus.status,
                    lastseen: user.onlinestatus.lastseen
                },
                email: user.email,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt,
            });

            // Emit user status change to all users who might be chatting with this user
            // Find chats this user is participating in
            const usersToNotify = new Set();
            
            // Get users from this user's chats
            if (user.chats && user.chats.length > 0) {
                user.chats.forEach(chat => {
                    // Extract other user ID from chat ID
                    const chatId = chat.chatid;
                    if (chatId.length >= 8) {
                        const id1 = chatId.slice(0, 4);
                        const id2 = chatId.slice(4, 8);
                        const otherUserId = id1 === user.uid ? id2 : id1;
                        usersToNotify.add(otherUserId);
                    }
                });
            }
            
            // Get connected sockets for these users
            for (const otherUserId of usersToNotify) {
                const otherUser = await User.findOne({ uid: otherUserId });
                if (otherUser && otherUser.socketid) {
                    io.to(otherUser.socketid).emit('user-status-update', {
                        userId: user.uid,
                        status: {
                            online: true,
                            lastSeen: new Date()
                        }
                    });
                }
            }

        } catch (error) {
            console.error('Error registering socket:', error);
        }
    });













    // LISTEN FOR PRIVATE MESSAGES ADD MESSAGE TO DB TO GET MESSAGEID AND SEND BACK TO SENDER
    socket.on('private message', async (data) => {
        try {
            const newmessage = data.newmessage;
            const chats = data.chats;

            // Find the sender
            const sender = await User.findOne({ uid: newmessage.senderid });
            if (!sender) {
                console.error('Sender not found:', newmessage.senderid);
                return;
            }

            // Update sender's chats
            try {
                sender.chats = chats;
                await sender.save();
            } catch (error) {
                console.error('Error updating user chats:', error);
            }

            // Find the receiver
            const receiver = await User.findOne({ uid: newmessage.recieverid });
            if (!receiver) {
                console.error('Receiver not found:', newmessage.recieverid);
                return;
            }

            // Save message to database with sent status true
            const sent = {
                issent: true,
                sentat: new Date()
            };

            const dbmessage = new message({
                ...newmessage,
                sent,
                messageType: newmessage.media ? newmessage.media.type : 'text'
            });

            await dbmessage.save();

            // Send to receiver if online
            if (receiver.onlinestatus && receiver.onlinestatus.status && receiver.socketid) {
                io.to(receiver.socketid).emit('private message', dbmessage);
            } else {
                // SAVE MESSAGE TO SYNC MESSAGE FOLDER IN DB
                const syncchat = new syncmessage({
                    ...dbmessage.toObject(),
                    whomtosend: receiver.uid,
                    syncstatus: false
                });
                await syncchat.save();
            }

            // Always send confirmation to sender
            io.to(socket.id).emit('private message sent confirmation', dbmessage);

        } catch (error) {
            console.error('Error handling private message:', error);
            // Send error notification to sender
            io.to(socket.id).emit('message_error', {
                error: 'Failed to process message',
                originalMessage: data.newmessage
            });
        }
    });




    // listten for RECIEIVE confirmation and update database and send to sender
    socket.on('private message recieve confirmation', async (modifiedmessage) => {
        try {

            if (!modifiedmessage || !modifiedmessage._id) {
                console.error('Invalid message data received');
                return;
            }

            const senderuid = modifiedmessage.senderid;
            const recieveruid = modifiedmessage.recieverid;

            if (!senderuid || !recieveruid) {
                console.error('Missing sender or receiver ID');
                return;
            }

            // Find receiver user
            const receiver = await User.findOne({ uid: recieveruid });
            if (!receiver) {
                console.error(`Receiver with ID ${recieveruid} not found`);
                return;
            }

            // Find sender user
            const sender = await User.findOne({ uid: senderuid });
            if (!sender) {
                console.error(`Sender with ID ${senderuid} not found`);
                return;
            }

            // Update receiver's chats
            const chats = receiver.chats || [];
            let chatUpdated = false;

            // Check if chat already exists and update it
            for (const chat of chats) {
                if (chat.chatid === modifiedmessage.chatid) {
                    chat.lastmessage = modifiedmessage.messagetext;
                    chat.updatedat = new Date();
                    // Preserve the unread flag - only set it if it doesn't exist
                    // This ensures we don't overwrite the unread status from the client
                    if (chat.unread === undefined) {
                        chat.unread = true; // Default to true for new messages
                    }
                    chatUpdated = true;
                    break;
                }
            }

            // If chat doesn't exist, create a new one
            if (!chatUpdated) {
                const newchat = {
                    typeofchat: modifiedmessage.groupid ? 'group' : 'private',
                    recievername: sender.username,
                    chatid: modifiedmessage.chatid,
                    userid: modifiedmessage.senderid,
                    lastmessage: modifiedmessage.messagetext,
                    updatedat: new Date(),
                    chatimage: sender.profilepicture,
                    unread: true // Set unread to true for new chats
                };

                chats.push(newchat);
            }

            receiver.chats = chats;
            await receiver.save();

            // Update the message in the database
            const oldmessage = await message.findOne({ _id: modifiedmessage._id });
            if (!oldmessage) {
                console.error(`Message with ID ${modifiedmessage._id} not found`);
                return;
            }

            // Update delivery status
            oldmessage.delivered = modifiedmessage.delivered;
            
            // Also update read status if message was marked as read
            if (modifiedmessage.read && modifiedmessage.read.isread) {
                console.log(`Marking message ${oldmessage._id} as read`);
                oldmessage.read = modifiedmessage.read;
            }
            
            await oldmessage.save();

            // Notify the sender about delivery and read confirmation
            const sender_socket = sender.socketid;
            if (sender_socket) {
                io.to(sender_socket).emit('private message recieve confirmation from server', oldmessage);
            } else {
                console.log(`Sender ${senderuid} is not currently connected`);
            }
        } catch (error) {
            console.error('Error processing message confirmation:', error);
        }
    });




    socket.on('private message update', async (modifiedmessage) => {
        try {
            const messageid = modifiedmessage._id;

            console.log('🔄 Modified Message:', modifiedmessage);
            console.log('🔄 Checking if this is a delete-for-everyone operation...');

            // Check if this is a deletion for everyone
            const isDeleteForEveryone = modifiedmessage.deletedby && 
                                      modifiedmessage.deletedfor && 
                                      modifiedmessage.deletedfor.length >= 2;

            // Update message in DB
            const updatedMessage = await message.findByIdAndUpdate(
                messageid,
                { $set: modifiedmessage },  // Update all fields
                { new: true, runValidators: true }
            );

            if (!updatedMessage) {
                console.log("❌ Message not found in DB.");
                return;
            }

            console.log("✅ Updated Message in DB:", updatedMessage);

            // Identify sender and receiver
            const messagesender = await User.findOne({ uid: updatedMessage.senderid });
            const messagereceiver = await User.findOne({ uid: updatedMessage.recieverid });

            if (!messagesender) {
                console.log("❌ Message Sender not found in DB.");
                return;
            }

            if (!messagereceiver) {
                console.log("❌ Message Receiver not found in DB.");
                return;
            }

            // Handle differently based on whether it's delete-for-everyone or not
            if (isDeleteForEveryone) {
                console.log("🗑️ This is a delete-for-everyone operation!");
                
                // Update the last message in chats for both users if this was the last message
                const deletedMessageText = "This message was deleted";
                
                // Update sender's chats
                await updateLastMessageIfNeeded(messagesender, updatedMessage.chatid, deletedMessageText);
                
                // Update receiver's chats
                await updateLastMessageIfNeeded(messagereceiver, updatedMessage.chatid, deletedMessageText);
                
                // Send update to sender (even if they initiated it)
                if (messagesender.socketid) {
                    console.log("✉️ Sending deletion update to sender:", messagesender.uid);
                    io.to(messagesender.socketid).emit('private message update', updatedMessage);
                }
                
                // Send update to receiver
                if (messagereceiver.socketid) {
                    console.log("✉️ Sending deletion update to receiver:", messagereceiver.uid);
                    io.to(messagereceiver.socketid).emit('private message update', updatedMessage);
                } else {
                    console.log("⚠️ Receiver is offline. Saving sync message...");
                    const syncchat = new syncmessage({
                        ...updatedMessage.toObject(),  // Ensure correct structure
                        whomtosend: messagereceiver.uid,
                        syncstatus: false
                    });
                    await syncchat.save();
                }
            } else {
                // Regular message update (original logic)
                // Define recipient socket ID
                let recipientSocketId;

                if (socket.id === messagesender.socketid) {
                    // Sender emitted the update, so send it to the receiver
                    recipientSocketId = messagereceiver.socketid;
                } else {
                    // Receiver emitted the update, so send it to the sender
                    recipientSocketId = messagesender.socketid;
                }

                if (!recipientSocketId) {
                    console.log("⚠️ Recipient is offline. Saving sync message...");
                    const syncchat = new syncmessage({
                        ...updatedMessage.toObject(),  // Ensure correct structure
                        whomtosend: messagereceiver.uid,
                        syncstatus: false
                    });
                    await syncchat.save();
                    return;
                }

                // Emit the updated message to the correct recipient
                io.to(recipientSocketId).emit('private message update from server', updatedMessage);
                console.log("✅ Message update sent to client.");
            }

        } catch (error) {
            console.error("❌ Error in private message update:", error);
        }
    });




    socket.on('fetch chats', async (uid) => {
        // find chat with chatid
        const chat = await message.find({ chatid: uid });
        if (!chat) {
            return;
        }
        console.log('Chat:', chat);
        io.to(socket.id).emit('send chats', chat);
    })








    socket.on('disconnect', async () => {
        console.log('User disconnected');
        const user = await User.findOne({ socketid: socket.id });
        if (!user) {
            return;
        }
        user.socketid = '';
        user.onlinestatus.status = false;
        user.onlinestatus.lastseen = new Date();
        await user.save();
        
        // Notify other users who might be chatting with this user
        const usersToNotify = new Set();
        
        // Get users from this user's chats
        if (user.chats && user.chats.length > 0) {
            user.chats.forEach(chat => {
                // Extract other user ID from chat ID
                const chatId = chat.chatid;
                if (chatId.length >= 8) {
                    const id1 = chatId.slice(0, 4);
                    const id2 = chatId.slice(4, 8);
                    const otherUserId = id1 === user.uid ? id2 : id1;
                    usersToNotify.add(otherUserId);
                }
            });
        }
        
        // Get connected sockets for these users
        for (const otherUserId of usersToNotify) {
            const otherUser = await User.findOne({ uid: otherUserId });
            if (otherUser && otherUser.socketid) {
                io.to(otherUser.socketid).emit('user-status-update', {
                    userId: user.uid,
                    status: {
                        online: false,
                        lastSeen: new Date()
                    }
                });
            }
        }
    });

    socket.on('request user', async (uid) => {
        const user = await User.findOne({ uid: uid });
        if (!user) {
            io.to(socket.id).emit('send user', null);
            return;
        }

        // Make sure each chat has an unread property (defaulting to false if not set)
        const chats = user.chats || [];
        const processedChats = chats.map(chat => {
            // Ensure the unread property is preserved
            return {
                ...chat.toObject ? chat.toObject() : chat,
                unread: chat.unread === true // Convert to boolean, default to false
            };
        });

        // console.log('User:', user);
        const userdata = {
            name: user.username,
            profilepicture: user.profilepicture,
            onlinestatus: {
                online: user.socketid ? true : false,
                lastSeen: user.onlinestatus.lastseen
            },
            chats: processedChats,
            settings: user.settings
        }

        io.to(socket.id).emit('send user', userdata
        );
    })


    // Listen for typing start event
    socket.on('typing-start', (data) => {
        // Broadcast to all other users in the same room/channel
        socket.broadcast.emit('typing-start', data);
    });

    // Listen for typing stop event
    socket.on('typing-stop', (data) => {
        // Broadcast to all other users in the same room/channel
        socket.broadcast.emit('typing-stop', data);
    });

    // Handle user settings updates
    socket.on('update-user-settings', async (data) => {
        try {
            const { userId, settings } = data;
            
            if (!userId || !settings) {
                console.error('Invalid settings update data:', data);
                socket.emit('settings-update-result', { 
                    success: false, 
                    error: 'Invalid settings data' 
                });
                return;
            }
            
            console.log('Updating settings for user:', userId, settings);
            
            // Find and update the user
            const user = await User.findOne({ uid: userId });
            if (!user) {
                console.error('User not found for settings update:', userId);
                socket.emit('settings-update-result', { 
                    success: false, 
                    error: 'User not found' 
                });
                return;
            }
            
            // Update settings
            user.settings = {
                ...user.settings, // Keep existing settings
                ...settings       // Override with new settings
            };
            
            await user.save();
            
            // Send success response
            socket.emit('settings-update-result', { 
                success: true,
                settings: user.settings
            });
            
            console.log('Settings updated successfully for user:', userId);
        } catch (error) {
            console.error('Error updating user settings:', error);
            socket.emit('settings-update-result', { 
                success: false, 
                error: 'Server error updating settings' 
            });
        }
    });

    // Handle requests for user online status
    socket.on('get-user-status', async (userId) => {
        try {
            // Find the requested user
            const requestedUser = await User.findOne({ uid: userId });
            
            if (!requestedUser) {
                console.error('User not found for status request:', userId);
                return;
            }
            
            // Send back the user's online status
            socket.emit('user-status-update', {
                userId: userId,
                status: {
                    online: requestedUser.socketid ? true : false,
                    lastSeen: requestedUser.onlinestatus.lastseen
                }
            });
            
        } catch (error) {
            console.error('Error fetching user status:', error);
        }
    });







    // socket.on('openchannel', (data) => {
    //     console.log('Opening channel:', data);

    //     socket.emit('openchannel', data);

    // }
    // );

    // Remove all voice call related socket handlers:
    // - call-user
    // - call-answered
    // - ice-candidate
    // - call-ended
    // - call-rejected

    socket.on('delete-chat', async ({ userId, chatId }) => {
        try {
            // Find the user who wants to delete the chat
            const user = await User.findOne({ uid: userId });
            if (!user) {
                console.error('User not found:', userId);
                socket.emit('chat-deleted', { success: false, error: 'User not found' });
                return;
            }

            // Remove the chat only from this user's chats array
            user.chats = user.chats.filter(chat => chat.chatid !== chatId);
            await user.save();

            // Emit success response to the current user
            socket.emit('chat-deleted', { 
                success: true, 
                chatId: chatId 
            });

            // Find the other user in this chat
            const otherUser = await User.findOne({ 
                'chats.chatid': chatId,
                uid: { $ne: userId }
            });

            // If the other user is online, notify them that the chat was deleted by the other user
            if (otherUser && otherUser.socketid) {
                io.to(otherUser.socketid).emit('chat-deleted-by-other', {
                    chatId: chatId,
                    deletedBy: user.username
                });
            }

        } catch (error) {
            console.error('Error deleting chat:', error);
            socket.emit('chat-deleted', { 
                success: false, 
                error: 'Failed to delete chat' 
            });
        }
    });

    // Handle marking a chat as read
    socket.on('mark-chat-read', async ({ userId, chatId }) => {
        try {
            // Find user
            const user = await User.findOne({ uid: userId });
            if (!user) {
                console.error('User not found:', userId);
                return;
            }

            // Update chat's unread status
            const chatToUpdate = user.chats.find(chat => chat.chatid === chatId);
            if (chatToUpdate) {
                chatToUpdate.unread = false;
                await user.save();
                console.log(`Chat ${chatId} marked as read for user ${userId}`);
                
                // Also update all unread messages in this chat that were sent to this user
                const updatedMessages = await message.updateMany(
                    { 
                        chatid: chatId,
                        recieverid: userId,
                        'read.isread': { $ne: true } // Only update messages that aren't already marked as read
                    },
                    { 
                        $set: { 
                            'read.isread': true,
                            'read.readat': new Date()
                        } 
                    }
                );
                
                console.log(`Updated read status for ${updatedMessages.modifiedCount} messages in chat ${chatId}`);
                
                // Find the other user (sender) to notify them about the read messages
                const otherUser = await User.findOne({
                    'chats.chatid': chatId,
                    uid: { $ne: userId }
                });
                
                // Get all messages that were just marked as read to update them for the sender
                const readMessages = await message.find({
                    chatid: chatId,
                    recieverid: userId,
                    'read.isread': true
                });
                
                // If the other user is online, notify them that their messages were read
                if (otherUser && otherUser.socketid && readMessages.length > 0) {
                    console.log(`Notifying user ${otherUser.uid} that ${readMessages.length} messages were read`);
                    
                    // Send each updated message to the sender
                    readMessages.forEach(msg => {
                        io.to(otherUser.socketid).emit('private message update from server', msg);
                    });
                }
            }
        } catch (error) {
            console.error('Error marking chat as read:', error);
        }
    });

    // Video call socket handlers
    socket.on('call-user', async (data) => {
        try {
            console.log('Call request received:', data);
            
            const { callerId, callerName, calleeId, callerProfilePic, callType = 'video' } = data;
            
            // Find receiver by uid
            const receiver = await User.findOne({ uid: calleeId });
            if (!receiver) {
                // Send back a "user unavailable" message to caller
                socket.emit('call-rejected', { 
                    message: 'User unavailable', 
                    callerId, 
                    calleeId 
                });
                return;
            }
            
            // Find all socket sessions for the receiver
            const activeSessions = await User.find({
                uid: calleeId,
                socketid: { $ne: null, $ne: '' }
            });
            
            if (activeSessions.length === 0) {
                // No active sessions, user is offline
                socket.emit('call-rejected', { 
                    message: 'User unavailable', 
                    callerId, 
                    calleeId 
                });
                return;
            }
            
            // Send incoming call notification to all receiver's active sessions
            for (const session of activeSessions) {
                if (session.socketid) {
                    io.to(session.socketid).emit('incoming-call', {
                        callerId,
                        callerName,
                        callerProfilePic,
                        calleeId,
                        callType
                    });
                }
            }
        } catch (error) {
            console.error('Error in call-user handler:', error);
        }
    });
    
    socket.on('call-accepted', async (data) => {
        try {
            console.log('Call accepted:', data);
            
            const { callerId, calleeId } = data;
            
            // Find all caller's active sessions
            const callerSessions = await User.find({
                uid: callerId,
                socketid: { $ne: null, $ne: '' }
            });
            
            // Notify all caller's active sessions that call was accepted
            for (const session of callerSessions) {
                if (session.socketid) {
                    io.to(session.socketid).emit('call-accepted', {
                        callerId,
                        calleeId
                    });
                }
            }
        } catch (error) {
            console.error('Error in call-accepted handler:', error);
        }
    });
    
    socket.on('call-rejected', async (data) => {
        try {
            console.log('Call rejected:', data);
            
            const { callerId, calleeId } = data;
            
            // Find all caller's active sessions
            const callerSessions = await User.find({
                uid: callerId,
                socketid: { $ne: null, $ne: '' }
            });
            
            // Notify all caller's active sessions that call was rejected
            for (const session of callerSessions) {
                if (session.socketid) {
                    io.to(session.socketid).emit('call-rejected', {
                        callerId,
                        calleeId
                    });
                }
            }
        } catch (error) {
            console.error('Error in call-rejected handler:', error);
        }
    });
    
    socket.on('call-cancelled', async (data) => {
        try {
            console.log('Call cancelled before pickup:', data);
            
            const { callerId, calleeId } = data;
            
            // Find all callee's active sessions
            const calleeSessions = await User.find({
                uid: calleeId,
                socketid: { $ne: null, $ne: '' }
            });
            
            // Notify all callee's active sessions that call was cancelled
            for (const session of calleeSessions) {
                if (session.socketid) {
                    io.to(session.socketid).emit('call-cancelled', {
                        callerId,
                        calleeId
                    });
                }
            }
        } catch (error) {
            console.error('Error in call-cancelled handler:', error);
        }
    });
    
    socket.on('call-offer', async (data) => {
        try {
            console.log('Call offer received:', data);
            
            const { offer, callerId, calleeId, callType } = data;
            
            // Find all callee's active sessions
            const calleeSessions = await User.find({
                uid: calleeId,
                socketid: { $ne: null, $ne: '' }
            });
            
            // Send offer to all callee's active sessions
            for (const session of calleeSessions) {
                if (session.socketid) {
                    io.to(session.socketid).emit('call-offer', {
                        offer,
                        callerId,
                        calleeId,
                        callType
                    });
                }
            }
        } catch (error) {
            console.error('Error in call-offer handler:', error);
        }
    });
    
    socket.on('call-answer', async (data) => {
        try {
            console.log('Call answer received:', data);
            
            const { answer, callerId, calleeId } = data;
            
            // Find all caller's active sessions
            const callerSessions = await User.find({
                uid: callerId,
                socketid: { $ne: null, $ne: '' }
            });
            
            // Send answer to all caller's active sessions
            for (const session of callerSessions) {
                if (session.socketid) {
                    io.to(session.socketid).emit('call-answer', {
                        answer,
                        callerId,
                        calleeId
                    });
                }
            }
        } catch (error) {
            console.error('Error in call-answer handler:', error);
        }
    });
    
    socket.on('ice-candidate', async (data) => {
        try {
            console.log('ICE candidate:', data);
            
            const { candidate, callerId, calleeId } = data;
            
            // Find the recipient (could be either caller or callee)
            let recipientId;
            
            // Determine who should receive this ICE candidate
            // If the sender is the caller, send to callee
            const sender = await User.findOne({ socketid: socket.id });
            if (!sender) return;
            
            if (sender.uid === callerId) {
                recipientId = calleeId;
            } else {
                recipientId = callerId;
            }
            
            // Find all recipient's active sessions
            const recipientSessions = await User.find({
                uid: recipientId,
                socketid: { $ne: null, $ne: '' }
            });
            
            // Send ICE candidate to all recipient's active sessions
            for (const session of recipientSessions) {
                if (session.socketid) {
                    io.to(session.socketid).emit('ice-candidate', {
                        candidate,
                        callerId,
                        calleeId
                    });
                }
            }
        } catch (error) {
            console.error('Error in ice-candidate handler:', error);
        }
    });
    
    socket.on('call-ended', async (data) => {
        try {
            console.log('Call ended:', data);
            
            const { callerId, calleeId } = data;
            
            // Find all caller's and callee's active sessions
            const callerSessions = await User.find({
                uid: callerId,
                socketid: { $ne: null, $ne: '' }
            });
            
            const calleeSessions = await User.find({
                uid: calleeId,
                socketid: { $ne: null, $ne: '' }
            });
            
            // Notify all caller's active sessions except the one who ended the call
            for (const session of callerSessions) {
                if (session.socketid && session.socketid !== socket.id) {
                    io.to(session.socketid).emit('call-ended', {
                        callerId,
                        calleeId
                    });
                }
            }
            
            // Notify all callee's active sessions except the one who ended the call
            for (const session of calleeSessions) {
                if (session.socketid && session.socketid !== socket.id) {
                    io.to(session.socketid).emit('call-ended', {
                        callerId,
                        calleeId
                    });
                }
            }
        } catch (error) {
            console.error('Error in call-ended handler:', error);
        }
    });

    // All other socket handlers should remain intact
});

// Database Connection
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MongoURI, {
            // Added these options for better stability in production
            // particularly on platforms like Render where connections might drop
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000,
        });
        logger.info("✅ MongoDB connected successfully.");
    } catch (error) {
        logger.error("❌ MongoDB connection error:", error);
        // In production, we might want to retry connecting rather than exiting
        if (process.env.NODE_ENV === 'production') {
            logger.warn("Will retry MongoDB connection in 5 seconds...");
            setTimeout(connectDB, 5000);
        } else {
            process.exit(1); // Exit process with failure in development
        }
    }
};

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error(`Unhandled error: ${err.message}`, { error: err.stack });
    
    const statusCode = err.statusCode || 500;
    const message = process.env.NODE_ENV === 'production' 
        ? 'An error occurred. Please try again later.' 
        : err.message;
        
    res.status(statusCode).json({
        status: 'error',
        message: message
    });
});

// Graceful shutdown handling
const gracefulShutdown = () => {
    logger.info('Received shutdown signal, closing connections...');
    
    server.close(() => {
        logger.info('HTTP server closed');
        
        mongoose.connection.close(false, () => {
            logger.info('MongoDB connection closed');
            process.exit(0);
        });
        
        // Force close after timeout
        setTimeout(() => {
            logger.error('Could not close connections in time, forcing shutdown');
            process.exit(1);
        }, 10000);
    });
};

// Listen for shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Promise Rejection:', reason);
    // In production, we don't want to crash the server
    if (process.env.NODE_ENV !== 'production') {
        throw reason;
    }
});

// Start Server
const PORT = process.env.PORT || 3000;

server.listen(PORT, async () => {
    logger.info(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    await connectDB();
    
    if (process.env.NODE_ENV === 'production') {
        logger.info(`Backend URL: ${process.env.BACKEND_URL || `http://localhost:${PORT}`}`);
        logger.info(`Client URL: ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
    }
});

// Helper function to update the last message in a user's chat if needed
async function updateLastMessageIfNeeded(user, chatId, newLastMessage) {
    if (!user || !user.chats) return;
    
    // Find the chat that matches the chatId
    const chatToUpdate = user.chats.find(chat => chat.chatid === chatId);
    
    if (chatToUpdate) {
        logger.debug(`🔄 Updating last message for user ${user.username} in chat ${chatId}`);
        chatToUpdate.lastmessage = newLastMessage;
        chatToUpdate.updatedat = new Date();
        await user.save();
        logger.debug(`✅ Last message updated for user ${user.username}`);
    }
}

// Add a health check endpoint for Render
app.get('/health', (req, res) => {
    const healthCheck = {
        uptime: process.uptime(),
        message: 'OK',
        timestamp: Date.now(),
        environment: process.env.NODE_ENV || 'development'
    };
    
    try {
        // Check MongoDB connection
        if (mongoose.connection.readyState === 1) {
            healthCheck.database = 'Connected';
        } else {
            healthCheck.database = 'Disconnected';
            healthCheck.message = 'Database connection issue';
            
            // In production, still return 200 to prevent unnecessary restarts
            // but log the issue
            if (process.env.NODE_ENV === 'production') {
                logger.warn('Health check: Database disconnected but returning OK');
            } else {
                return res.status(503).json(healthCheck);
            }
        }
        
        res.status(200).json(healthCheck);
    } catch (error) {
        healthCheck.message = error.message;
        healthCheck.error = error.name;
        
        // In production, still return 200 to prevent unnecessary restarts
        if (process.env.NODE_ENV === 'production') {
            logger.error('Health check error but returning OK:', error);
            res.status(200).json(healthCheck);
        } else {
            res.status(503).json(healthCheck);
        }
    }
});
