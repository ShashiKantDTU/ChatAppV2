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
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true
    }
});

// Enable CORS for specific choices
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
    optionsSuccessStatus: 200
}));

// Additional CORS headers for preflight requests
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', process.env.CLIENT_URL || 'http://localhost:5173');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Middleware for routes
app.use(router);

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
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

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// File upload endpoint
app.post('/upload', upload.array('file', 10), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            throw new Error('No files uploaded');
        }

        // Handle multiple files
        const files = req.files.map(file => ({
            url: `http://localhost:3000/uploads/${file.filename}`,
            filename: file.originalname,
            size: file.size,
            mimeType: file.mimetype
        }));

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

            // Update message status
            oldmessage.delivered = modifiedmessage.delivered;
            await oldmessage.save();

            // Notify the sender about delivery confirmation
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

    // Voice Call Signaling
    socket.on('call-user', async ({ userToCall, from, offer }) => {
        try {
            console.log('Call request received:', {
                userToCall,
                from,
                offerDetails: {
                    hasOffer: !!offer,
                    type: offer?.type,
                    hasSdp: !!offer?.sdp
                }
            });
            
            if (!offer) {
                throw new Error('No offer provided');
            }

            if (!offer.sdp) {
                throw new Error('Offer missing SDP');
            }
            
            const calledUser = await User.findOne({ uid: userToCall });
            if (!calledUser) {
                throw new Error('User not found');
            }
            
            if (!calledUser.socketid) {
                throw new Error('User is offline');
            }

            console.log('Sending incoming call to:', calledUser.socketid);
            
            // Ensure the offer has type and SDP fields
            const formattedOffer = {
                type: 'offer',
                sdp: offer.sdp
            };

            // Send the call to the recipient
            io.to(calledUser.socketid).emit('incoming-call', {
                from,
                offer: formattedOffer
            });

            // Send confirmation to caller
            socket.emit('call-initiated', { 
                to: userToCall,
                status: 'ringing'
            });
        } catch (error) {
            console.error('Error in call-user handler:', error);
            socket.emit('call-failed', { 
                error: error.message,
                details: 'Failed to initiate call'
            });
        }
    });

    socket.on('call-answered', async ({ to, answer }) => {
        try {
            console.log('Call answered:', {
                to,
                answerDetails: {
                    hasAnswer: !!answer,
                    type: answer?.type,
                    hasSdp: !!answer?.sdp
                }
            });
            
            if (!answer || !answer.sdp) {
                throw new Error('Invalid answer received');
            }

            const callingUser = await User.findOne({ uid: to });
            if (!callingUser) {
                throw new Error('Calling user not found');
            }
            
            if (!callingUser.socketid) {
                throw new Error('Calling user is offline');
            }

            console.log('Sending answer to caller:', callingUser.socketid);
            
            // Ensure the answer has the correct type
            const formattedAnswer = {
                type: 'answer',
                sdp: answer.sdp
            };

            console.log('Sending formatted answer');
            
            io.to(callingUser.socketid).emit('call-answered', {
                answer: formattedAnswer
            });

            // Send confirmation to the answerer
            socket.emit('answer-sent', {
                to: to,
                status: 'connecting'
            });
        } catch (error) {
            console.error('Error in call-answered handler:', error);
            socket.emit('call-failed', {
                error: error.message,
                details: 'Failed to send answer'
            });
        }
    });

    socket.on('ice-candidate', async ({ to, candidate }) => {
        try {
            if (!candidate) {
                console.log('Empty ICE candidate received, ignoring');
                return;
            }

            console.log('ICE candidate received for', to, {
                type: candidate.type,
                protocol: candidate.protocol || 'unknown'
            });

            const targetUser = await User.findOne({ uid: to });
            if (!targetUser) {
                console.error('Target user not found for ICE candidate');
                return;
            }
            
            if (!targetUser.socketid) {
                console.error('Target user is offline');
                return;
            }

            console.log('Forwarding ICE candidate to:', targetUser.socketid);
            io.to(targetUser.socketid).emit('ice-candidate', {
                candidate
            });
        } catch (error) {
            console.error('Error in ice-candidate handler:', error);
            socket.emit('call-failed', {
                error: 'ICE candidate relay failed',
                details: error.message
            });
        }
    });

    socket.on('end-call', async ({ to }) => {
        try {
            const user = await User.findOne({ uid: to });
            if (user && user.socketid) {
                console.log('Ending call for user:', user.socketid);
                io.to(user.socketid).emit('call-ended');
            } else {
                console.log('Could not end call - user not found or offline');
            }
        } catch (error) {
            console.error('Error in end-call handler:', error);
        }
    });

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
            }
        } catch (error) {
            console.error('Error marking chat as read:', error);
        }
    });
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
