# ChatApp Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Backend Documentation](#backend-documentation)
4. [Frontend Documentation](#frontend-documentation)
5. [Features](#features)
6. [Setup and Installation](#setup-and-installation)
7. [API Documentation](#api-documentation)
8. [Socket.IO Implementation](#socketio-implementation)
9. [Security](#security)
10. [Troubleshooting](#troubleshooting)

## Project Overview

ChatApp is a real-time chat application built with React.js for the frontend and Node.js/Express for the backend. The application supports features like:
- Real-time messaging
- File sharing (images, videos, audio, documents)
- Voice calls
- User authentication (Email/Password and Google OAuth)
- Online/Offline status
- Message reactions
- Message deletion
- Profile management

## Architecture

### Tech Stack
- **Frontend**: React.js, Socket.IO Client, Vite
- **Backend**: Node.js, Express.js, Socket.IO, MongoDB
- **Authentication**: JWT, Passport.js (Google OAuth)
- **File Storage**: Local storage with Multer
- **Database**: MongoDB with Mongoose ODM

### Project Structure
```
ChatApp/
├── Frontend/
│   └── ChatApp/
│       ├── src/
│       │   ├── components/
│       │   ├── pages/
│       │   └── scripts/
└── Backend/
    ├── controllers/
    ├── models/
    ├── routes/
    └── uploads/
```

## Backend Documentation

### Server Setup (`Backend/index.js`)
The backend server is configured with:
- Express.js for HTTP server
- Socket.IO for real-time communication
- Multer for file uploads
- MongoDB connection
- CORS configuration

Key configurations:
```javascript
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:5173',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true
    }
});
```

### Database Models

#### User Schema (`Backend/models/userschema.js`)
```javascript
const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    password: String,
    role: String,
    gooleId: String,
    socketid: String,
    onlinestatus: {
        status: Boolean,
        lastseen: Date
    },
    profilepicture: String,
    uid: String,
    chats: [{
        typeofchat: String,
        recievername: String,
        chatid: String,
        userid: String,
        lastmessage: String,
        updatedat: Date,
        chatimage: String,
        unread: Boolean
    }]
});
```

#### Message Schema (`Backend/models/messageschema.js`)
```javascript
const Chats = new mongoose.Schema({
    chatid: String,
    senderid: String,
    recieverid: String,
    groupid: String,
    messagetext: String,
    media: {
        type: String,
        url: String,
        filename: String,
        size: Number,
        mimeType: String
    },
    messageType: String,
    sent: {
        issent: Boolean,
        sentat: Date
    },
    delivered: {
        isdelivered: Boolean,
        deliveredat: Date
    },
    read: {
        isread: Boolean,
        readat: Date
    },
    reactions: [{
        userId: String,
        type: String,
        timestamp: Number
    }]
});
```

### Authentication (`Backend/controllers/userController.js`)
The application supports two authentication methods:
1. Email/Password authentication
2. Google OAuth authentication

Key functions:
- `register`: Creates new user accounts
- `login`: Authenticates users
- `verifyJWT`: Validates JWT tokens
- `logout`: Handles user logout

## Frontend Documentation

### Main Components

#### ChatApp (`Frontend/ChatApp/src/ChatApp.jsx`) - Detailed Analysis

The ChatApp component is the main container of the application. Let's break down its functionality section by section:

##### 1. State Management
```javascript
const [user, setUser] = useState(null);
const [selectedChat, setSelectedChat] = useState(null);
const [showSearch, setShowSearch] = useState(false);
const [showVoiceCall, setShowVoiceCall] = useState(false);
const [callType, setCallType] = useState('outgoing');
const [incomingCallOffer, setIncomingCallOffer] = useState(null);
const [socket, setSocket] = useState(null);
const [notifications, setNotifications] = useState(0);
```
- `user`: Stores the current user's information
- `selectedChat`: Tracks the currently selected chat
- `showSearch`: Controls the visibility of the search interface
- `showVoiceCall`: Manages voice call interface visibility
- `callType`: Determines if the call is incoming or outgoing
- `incomingCallOffer`: Stores WebRTC offer for incoming calls
- `socket`: Manages Socket.IO connection
- `notifications`: Tracks unread message notifications

##### 2. Socket.IO Connection Setup
```javascript
useEffect(() => {
    if (user?.email) {
        const newSocket = io('http://localhost:3000', {
            reconnection: true,
            reconnectionAttempts: 5,
            timeout: 20000
        });

        newSocket.on('connect', () => {
            console.log('Socket connected');
            newSocket.emit('registersocket', user.email);
        });

        newSocket.on('disconnect', () => {
            console.log('Socket disconnected');
        });

        setSocket(newSocket);

        return () => {
            newSocket.close();
        };
    }
}, [user?.email]);
```
- Creates Socket.IO connection when user is authenticated
- Configures reconnection settings
- Registers user's socket ID with the server
- Handles connection/disconnection events
- Cleans up socket connection on component unmount

##### 3. Socket Event Handlers
```javascript
useEffect(() => {
    if (!socket) return;

    // Handle incoming messages
    socket.on('private message', (message) => {
        if (selectedChat?.chatid === message.chatid) {
            setMessages(prev => [...prev, message]);
        }
    });

    // Handle incoming calls
    socket.on('incoming-call', ({ from, offer }) => {
        setIncomingCallOffer(offer);
        setShowVoiceCall(true);
        setCallType('incoming');
    });

    // Handle call answer
    socket.on('call-answered', ({ answer }) => {
        // Handle call answer logic
    });

    // Handle ICE candidates
    socket.on('ice-candidate', ({ candidate }) => {
        // Handle ICE candidate logic
    });

    return () => {
        socket.off('private message');
        socket.off('incoming-call');
        socket.off('call-answered');
        socket.off('ice-candidate');
    };
}, [socket, selectedChat]);
```
- Sets up event listeners for various socket events
- Handles incoming messages, calls, and WebRTC signaling
- Cleans up event listeners on component unmount

##### 4. Chat Selection Handler
```javascript
const handlechatclick = (searchuser, chatid, userdata) => {
    if (searchuser) {
        setSelectedChat({
            chatid: searchuser.uid,
            recievername: searchuser.username,
            profilepicture: searchuser.profilepicture
        });
    } else {
        setSelectedChat({
            chatid: chatid,
            recievername: userdata.recievername,
            profilepicture: userdata.chatimage
        });
    }
    setShowSearch(false);
};
```
- Handles chat selection from search results or recent chats
- Updates selected chat state
- Closes search interface when chat is selected

##### 5. Voice Call Handlers
```javascript
const handleVoiceCallClick = () => {
    setShowVoiceCall(true);
    setCallType('outgoing');
    socket.emit('call-user', {
        userToCall: selectedChat.chatid,
        from: user.uid,
        offer: null // Will be set after WebRTC setup
    });
};
```
- Initiates outgoing voice calls
- Sets up WebRTC connection
- Emits call request to server

##### 6. Chat Deletion Handler
```javascript
const handleDeleteChat = (chatId) => {
    socket.emit('delete-chat', {
        userId: user.uid,
        chatId: chatId
    });
};
```
- Emits chat deletion request to server
- Updates UI after successful deletion

##### 7. Render Logic
```javascript
return (
    <div className="app-container">
        {user ? (
            <div className="chat-container">
                <RecentChats 
                    user={user}
                    handlechatclick={handlechatclick}
                    handlesearchbtn={() => setShowSearch(true)}
                    notifications={notifications}
                />
                {selectedChat ? (
                    <ChatWindow 
                        selectedChat={selectedChat}
                        user={user}
                        socket={socket}
                    />
                ) : (
                    <EmptyPage onNewChat={() => setShowSearch(true)} />
                )}
            </div>
        ) : (
            <Navigate to="/login" />
        )}
    </div>
);
```
- Renders different components based on user authentication state
- Shows RecentChats and ChatWindow when chat is selected
- Shows EmptyPage when no chat is selected
- Redirects to login if user is not authenticated

##### 8. Component Dependencies
- `RecentChats`: Displays list of recent conversations
- `ChatWindow`: Handles individual chat interface
- `EmptyPage`: Shows welcome screen when no chat is selected
- `VoiceCall`: Manages voice call interface

##### 9. Key Features
1. **Real-time Communication**
   - Socket.IO for instant messaging
   - WebRTC for voice calls
   - Event-based architecture

2. **State Management**
   - React hooks for local state
   - Socket events for real-time updates
   - Context for global state

3. **User Interface**
   - Responsive design
   - Dynamic component rendering
   - Smooth transitions

4. **Error Handling**
   - Socket connection error handling
   - Call failure handling
   - Authentication checks

#### ChatWindow (`Frontend/ChatApp/src/components/chatwindow/chatwindow.jsx`)
Handles individual chat functionality:
- Message sending/receiving
- File uploads
- Voice messages
- Media preview
- Message reactions

#### RecentChats (`Frontend/ChatApp/src/components/recentchats.jsx`)
Displays and manages chat history:
- Shows recent conversations
- Handles chat selection
- Manages chat deletion
- Shows online/offline status

### Authentication Components

#### Login (`Frontend/ChatApp/src/pages/login.jsx`)
Handles user login with:
- Email/password authentication
- Google OAuth integration
- Form validation
- Error handling

#### Signup (`Frontend/ChatApp/src/pages/signup.jsx`)
Manages new user registration with:
- Form validation
- Password strength checking
- Google OAuth integration
- Success/error handling

## Features

### Real-time Messaging
- Uses Socket.IO for real-time communication
- Supports text messages, media files, and voice messages
- Includes message delivery and read receipts
- Supports message reactions

### File Sharing
- Supports multiple file types:
  - Images (JPEG, PNG, GIF, etc.)
  - Videos (MP4, WebM, OGG)
  - Audio (MP3, WAV, OGG)
  - Documents (PDF, DOC, DOCX)
  - Other file types
- File size limit: 50MB
- Progress tracking for uploads

### Voice Calls
- WebRTC implementation for voice calls
- Supports incoming/outgoing calls
- Mute/unmute functionality
- Call duration tracking

### User Management
- Profile picture support
- Username customization
- Online/offline status
- Last seen tracking

## Setup and Installation

### Prerequisites
- Node.js (v14 or higher)
- MongoDB
- npm or yarn

### Backend Setup
1. Navigate to the Backend directory:
```bash
cd Backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with:
```
MongoURI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

4. Start the server:
```bash
npm start
```

### Frontend Setup
1. Navigate to the Frontend directory:
```bash
cd Frontend/ChatApp
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

## API Documentation

### Authentication Endpoints
- `POST /signup`: Register new user
- `POST /login`: User login
- `GET /me`: Get current user details
- `POST /logout`: User logout

### Profile Endpoints
- `PUT /update-profile`: Update user profile
- `GET /auth/google`: Google OAuth login
- `GET /auth/google/callback`: Google OAuth callback

### File Upload
- `POST /upload`: Upload files (multipart/form-data)
  - Supports multiple files
  - Returns array of file details

## Socket.IO Implementation

### Connection Events
- `connection`: New socket connection
- `disconnect`: Socket disconnection
- `registersocket`: Register user socket ID

### Message Events
- `private message`: Send/receive private messages
- `private message recieve confirmation`: Message delivery confirmation
- `private message update`: Update message status

### Call Events
- `call-user`: Initiate voice call
- `call-answered`: Handle call answer
- `ice-candidate`: WebRTC ICE candidate exchange
- `end-call`: End voice call

## Security

### Authentication
- JWT-based authentication
- HTTP-only cookies
- Secure session management
- Google OAuth integration

### File Upload Security
- File type validation
- File size limits
- Secure file storage
- Unique filename generation

### Data Protection
- Password hashing with bcrypt
- Input validation
- XSS protection
- CORS configuration

## Troubleshooting

### Common Issues
1. Connection Issues
   - Check MongoDB connection
   - Verify Socket.IO connection
   - Check CORS configuration

2. File Upload Problems
   - Verify file size limits
   - Check file type restrictions
   - Ensure upload directory exists

3. Authentication Issues
   - Check JWT token validity
   - Verify cookie settings
   - Check OAuth configuration

### Debugging Tips
1. Enable console logging
2. Check network requests
3. Verify environment variables
4. Monitor Socket.IO events

## Contributing
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License
This project is licensed under the MIT License - see the LICENSE file for details. 