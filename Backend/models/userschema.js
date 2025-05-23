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
    gooleId: {
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
    resetPasswordToken: {
        type: String
    },
    resetPasswordExpires: {
        type: Date
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
    ],
    settings: {
        type: Object,
        default: {
            notifications: true,
            sound: true,
            theme: 'dark',
            darkMode: true
        }
    }

})

const User = mongoose.model('User',userSchema)

module.exports = User;