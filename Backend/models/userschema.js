const mongoose = require('mongoose');


const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        unique: true,
        required: true,
    },
    password: {
        type: String,
        
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user'
    },
    googleId: {
        type: String,
    },
    socketid: {
        type:String,
    },
    onlinestatus: {
        status: {
            type: Boolean,
            default: false
        },
        lastseen: {
            type: Date,
            default: new Date()
        }
    },
    profilepicture: {
        type:String
    },
    uid : {
        type: String,
        unique: true
    },
    chats: [
        {
            typeofchat: {
                type: String
            },
            recievername: {
                type: String
            },
            chatid:{
                type: String
            },
            userid: {
                type: String
            },
            lastmessage :{
                type: String
            },
            updatedat :{
                type: Date,
                default: new Date()
            },
            chatimage :{
                type: String
            },
            unread :{
                type:Boolean,
                
                
            },
        },
    ]

})

const User = mongoose.model('User',userSchema)

module.exports = User;