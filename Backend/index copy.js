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

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:5173',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true
    }
});

// Enable CORS for specific choices
app.use(cors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

// Middleware for routes
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
          
          // Handle pending messages if any
          if (user.pendingMessages && user.pendingMessages.length > 0) {
            try {
              const pendingMessageIds = user.pendingMessages;
              
              // Fetch all pending messages
              const pendingMessages = await message.find({
                _id: { $in: pendingMessageIds }
              });
              
              console.log(`Sending ${pendingMessages.length} pending messages to user ${user.email}`);
              
              // Send each message to the now-online user
              pendingMessages.forEach(msg => {
                socket.emit('private message', msg);
              });
              
              // Update the messages as delivered
              for (const msg of pendingMessages) {
                msg.delivered = { isdelivered: true, deliveredat: new Date() };
                await msg.save();
                
                // Notify the sender about delivery
                const senderSocket = await User.findOne({ uid: msg.senderid });
                if (senderSocket && senderSocket.onlinestatus.status) {
                  io.to(senderSocket.socketid).emit('private message update from server', msg);
                }
              }
              
              // Clear pending messages
              user.pendingMessages = [];
            } catch (error) {
              console.error('Error processing pending messages:', error);
            }
          }
          
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
          
          // Remove the temporary marker before saving to DB
          if (newmessage.isTemporary) {
            delete newmessage.isTemporary;
          }
          
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
            sent
          });
          
          await dbmessage.save();
          
          // Send to receiver if online
          if (receiver.onlinestatus && receiver.onlinestatus.status && receiver.socketid) {
            io.to(receiver.socketid).emit('private message', dbmessage);
          } else {
            // Store for offline receiver
            if (!receiver.pendingMessages) {
              receiver.pendingMessages = [];
            }
            receiver.pendingMessages.push(dbmessage._id);
            await receiver.save();
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
      



    // listten for RECIEVE confirmation and update database and send to sender
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
                    unread: false
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

            // Define recipient socket ID
            let recipientSocketId;

            if (socket.id === messagesender.socketid) {
                // Sender emitted the update, so send it to the receiver
                recipientSocketId = messagereceiver.socketid;
            } else {
                // Receiver emitted the update, so send it to the sender
                recipientSocketId = messagesender.socketid;
            }

            // console.log("🛜 Sending message to socket ID:", recipientSocketId);

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

        // console.log('User:', user);
        const userdata = {
            name: user.username,
            profilepicture: user.profilepicture,
            onlinestatus: {
                online: user.socketid ? true : false,
                lastSeen: user.onlinestatus.lastseen
            },
            chats: user.chats
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
