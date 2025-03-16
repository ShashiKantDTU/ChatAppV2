const mongoose = require('mongoose');

const ReactionSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    type: { type: String, required: true },
    timestamp: { type: Number, default: Date.now }
}, { _id: false });  // Prevents Mongoose from adding an extra `_id` field

// Removed MediaSchema as we're no longer supporting audio messages

const Chats = new mongoose.Schema({
    chatid: { type: String, required: true },
    senderid: { type: String, required: true },
    recieverid: { type: String },
    groupid: { type: String },
    messagetext: { type: String, required: true }, // Made required since it's the only content type now
    // Removed media field
    messageType: { 
        type: String, 
        enum: ['text'], // Only text type allowed now
        default: 'text'
    },

    sent: {
        issent: { type: Boolean },
        sentat: { type: Date, default: Date.now }
    },
    delivered: {
        isdelivered: { type: Boolean },
        deliveredat: { type: Date }
    },
    read: {
        isread: { type: Boolean },
        readat: { type: Date }
    },

    deletedfor: [{ type: String }],
    deletedby: { type: String },
    createdat: { type: Date, default: Date.now },

    reactions: [ReactionSchema]
});

const message = mongoose.model('messages', Chats);
module.exports = message;
