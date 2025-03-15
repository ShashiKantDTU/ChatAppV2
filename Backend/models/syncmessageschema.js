const mongoose = require('mongoose');

const ReactionSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    type: { type: String, required: true },
    timestamp: { type: Number, default: Date.now }
}, { _id: false });  // Prevents Mongoose from adding an extra `_id` field

const syncChats = new mongoose.Schema({
    whomtosend: { type: String, required: true },
    syncstaus: { type: Boolean, default: false },
    chatid: { type: String, required: true },
    senderid: { type: String, required: true },
    recieverid: { type: String },
    groupid: { type: String },
    messagetext: { type: String, required: true },

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

const syncmessage = mongoose.model('syncmessages', syncChats);
module.exports = syncmessage;
