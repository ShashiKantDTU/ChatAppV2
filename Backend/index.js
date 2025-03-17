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
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true
    }
});

// Add cookie parser middleware BEFORE routes
app.use(cookie());

// Add session support for OAuth state
app.use(configureSession());

// Log all incoming request headers for debugging
app.use((req, res, next) => {
    console.log('=== REQUEST DEBUG ===');
    console.log('Request URL:', req.originalUrl);
    console.log('Request headers:', {
        cookie: req.headers.cookie,
        origin: req.headers.origin,
        host: req.headers.host,
        referer: req.headers.referer
    });
    console.log('Content-Type:', req.headers['content-type']);
    next();
});

// Enable CORS for specific choices
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    optionsSuccessStatus: 200,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Additional CORS headers for preflight requests
app.use((req, res, next) => {
    // Important: This must match the origin for cookie purposes
    res.header('Access-Control-Allow-Origin', process.env.CLIENT_URL || 'http://localhost:5173');
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
        try {
            // Find the user
            const user = await User.findOne({ email });
            if (!user) {
                console.error('User not found for email:', email);
                return;
            }

            // Update online status
            user.socketid = socket.id;
            user.onlinestatus = { status: true, lastSeen: new Date() };

            // Set default profile picture if none exists
            if (!user.profilepicture) {
                user.profilepicture = `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`;
            }

            // // HANDLE ANY PENDING MESSAGE FOR CLIENT
            // const pendingMessages = syncmessage.find({ whomtosend: user.uid });
            // if (pendingMessages) {
            //     for (const message of pendingMessages) {
            //         const messagetosend = {
            //             chatid: message.chatid,
            //             senderid: message.senderid,
            //             recieverid: message.recieverid,
            //             groupid: message.groupid,
            //             messagetext: message.messagetext,
            //             sent: message.sent,
            //             delivered: message.delivered,
            //             read: message.read,
            //             deletedfor: message.deletedfor,
            //             deletedby: message.deletedby,
            //             reactions: message.reactions
            //         }
            //         io.to(socket.id).emit('private sync message', messagetosend);
            //     }
            //     pendingMessages.deleteMany();
            // }

            // // Notify the sender about delivery
            // const senderSocket = await User.findOne({ uid: msg.senderid });
            // if (senderSocket && senderSocket.onlinestatus.status) {
            //     io.to(senderSocket.socketid).emit('private message update from server', msg);
            // }




            // Save user and emit details
            await user.save();
            io.to(socket.id).emit('YourDetails', user);

        } catch (error) {
            console.error('Error in registersocket handler:', error);
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
        user.save();
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
            chats: processedChats
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
            if (!receiver || !receiver.socketid) {
                // Send back a "user unavailable" message to caller
                socket.emit('call-rejected', { 
                    message: 'User unavailable', 
                    callerId, 
                    calleeId 
                });
                return;
            }
            
            // Send incoming call notification to the receiver
            io.to(receiver.socketid).emit('incoming-call', {
                callerId,
                callerName,
                callerProfilePic,
                calleeId,
                callType
            });
        } catch (error) {
            console.error('Error in call-user handler:', error);
        }
    });
    
    socket.on('call-accepted', async (data) => {
        try {
            console.log('Call accepted:', data);
            
            const { callerId, calleeId } = data;
            
            // Find caller by uid
            const caller = await User.findOne({ uid: callerId });
            if (!caller || !caller.socketid) {
                return;
            }
            
            // Notify caller that call was accepted
            io.to(caller.socketid).emit('call-accepted', {
                callerId,
                calleeId
            });
        } catch (error) {
            console.error('Error in call-accepted handler:', error);
        }
    });
    
    socket.on('call-rejected', async (data) => {
        try {
            console.log('Call rejected:', data);
            
            const { callerId, calleeId } = data;
            
            // Find caller by uid
            const caller = await User.findOne({ uid: callerId });
            if (!caller || !caller.socketid) {
                return;
            }
            
            // Notify caller that call was rejected
            io.to(caller.socketid).emit('call-rejected', {
                callerId,
                calleeId
            });
        } catch (error) {
            console.error('Error in call-rejected handler:', error);
        }
    });
    
    socket.on('call-offer', async (data) => {
        try {
            console.log('Call offer received:', data);
            
            const { offer, callerId, calleeId, callType } = data;
            
            // Find callee by uid
            const callee = await User.findOne({ uid: calleeId });
            if (!callee || !callee.socketid) {
                return;
            }
            
            // Send offer to callee
            io.to(callee.socketid).emit('call-offer', {
                offer,
                callerId,
                calleeId,
                callType
            });
        } catch (error) {
            console.error('Error in call-offer handler:', error);
        }
    });
    
    socket.on('call-answer', async (data) => {
        try {
            console.log('Call answer received:', data);
            
            const { answer, callerId, calleeId } = data;
            
            // Find caller by uid
            const caller = await User.findOne({ uid: callerId });
            if (!caller || !caller.socketid) {
                return;
            }
            
            // Send answer to caller
            io.to(caller.socketid).emit('call-answer', {
                answer,
                callerId,
                calleeId
            });
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
            
            // Find recipient
            const recipient = await User.findOne({ uid: recipientId });
            if (!recipient || !recipient.socketid) {
                return;
            }
            
            // Send ICE candidate to recipient
            io.to(recipient.socketid).emit('ice-candidate', {
                candidate,
                callerId,
                calleeId
            });
        } catch (error) {
            console.error('Error in ice-candidate handler:', error);
        }
    });
    
    socket.on('call-ended', async (data) => {
        try {
            console.log('Call ended:', data);
            
            const { callerId, calleeId } = data;
            
            // Find both users
            const caller = await User.findOne({ uid: callerId });
            const callee = await User.findOne({ uid: calleeId });
            
            // Notify caller if not the one who ended the call
            if (caller && caller.socketid && caller.socketid !== socket.id) {
                io.to(caller.socketid).emit('call-ended', {
                    callerId,
                    calleeId
                });
            }
            
            // Notify callee if not the one who ended the call
            if (callee && callee.socketid && callee.socketid !== socket.id) {
                io.to(callee.socketid).emit('call-ended', {
                    callerId,
                    calleeId
                });
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
        await mongoose.connect(process.env.MongoURI);
        console.log("✅ MongoDB connected successfully.");
    } catch (error) {
        console.error("❌ MongoDB connection error:", error);
        process.exit(1); // Exit process with failure
    }
};

// Start Server
const PORT = process.env.PORT || 3000;

server.listen(PORT, async () => {
    console.log(`🚀 Server running on port ${PORT}`);
    await connectDB();
});

// ADD THIS FUNCTION AFTER THE SOCKET EVENT HANDLER
// Helper function to update the last message in a user's chat if needed
async function updateLastMessageIfNeeded(user, chatId, newLastMessage) {
    if (!user || !user.chats) return;
    
    // Find the chat that matches the chatId
    const chatToUpdate = user.chats.find(chat => chat.chatid === chatId);
    
    if (chatToUpdate) {
        console.log(`🔄 Updating last message for user ${user.username} in chat ${chatId}`);
        chatToUpdate.lastmessage = newLastMessage;
        chatToUpdate.updatedat = new Date();
        await user.save();
        console.log(`✅ Last message updated for user ${user.username}`);
    }
}
