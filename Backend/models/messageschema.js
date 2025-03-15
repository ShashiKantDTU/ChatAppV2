const mongoose = require('mongoose');

const ReactionSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    type: { type: String, required: true },
    timestamp: { type: Number, default: Date.now }
}, { _id: false });  // Prevents Mongoose from adding an extra `_id` field

const MediaSchema = new mongoose.Schema({
    type: { type: String, required: true }, // 'image', 'video', 'audio', 'file'
    url: { type: String, required: true },
    filename: { type: String, required: true },
    size: { type: Number, required: true },
    mimeType: { type: String, required: true },
    duration: { type: Number }, // For audio/video
    thumbnail: { type: String }, // For video
    width: { type: Number }, // For images/videos
    height: { type: Number } // For images/videos
}, { _id: false });

const Chats = new mongoose.Schema({
    chatid: { type: String, required: true },
    senderid: { type: String, required: true },
    recieverid: { type: String },
    groupid: { type: String },
    messagetext: { type: String },
    media: MediaSchema,
    messageType: { 
        type: String, 
        enum: ['text', 'image', 'video', 'audio', 'file'],
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
