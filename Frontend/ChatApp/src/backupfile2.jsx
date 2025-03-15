import { useEffect, useState, useContext, useRef, useCallback, useMemo } from 'react';
import styles from './ChatApp.module.css'; // Correct import for CSS Modules
import { Home, Search, SettingsIcon } from 'lucide-react'
import EmptyPage from './components/nochatpage';
import ChatWindow from './components/chatwindow/chatwindow';
import { io } from 'socket.io-client';
import { AuthContext } from './components/authcontext/authcontext';
import RecentChats from './components/recentchats';









function ChatApp() {
    const { user, setUser } = useContext(AuthContext);
    const [socket, setSocket] = useState(null);
    const [talkingToUser, setTalkingToUser] = useState(null);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [searchDivVisible, setSearchDivVisible] = useState(false);
    const typingTimer = useRef(null);

    // Establish socket connection
    useEffect(() => {
        const newSocket = io("http://localhost:3000");
        setSocket(newSocket);

        return () => {
            newSocket.disconnect(); // Cleanup on unmount
        };
    }, []);

    // Function to fetch user data from server
    const fetchUser = useCallback((uid) => {
        return new Promise((resolve, reject) => {
            if (!socket) {
                reject('Socket not connected');
                return;
            }

            socket.emit('request user', uid);

            socket.once('send user', (userData) => {
                if (!userData) {
                    reject('User not found');
                } else {
                    resolve(userData);
                }
            });
        });
    }, [socket]);

    // Function to refresh and update user data
    const refreshUser = useCallback(async () => {
        if (!user?.uid || !socket) return;

        try {
            const updatedUser = await fetchUser(user.uid);
            setUser(prev => ({ ...prev, ...updatedUser }));
        } catch (error) {
            console.error('Error refreshing user data:', error);
        }
    }, [fetchUser, user?.uid, setUser, socket]);

    // Generate chat ID from two user IDs
    const generateChatId = useCallback((uid1, uid2) => {
        const sortedId = [uid1, uid2].sort();
        return sortedId[0] + sortedId[1];
    }, []);

    // Updates message in chat window
    const updateMessageInChat = useCallback((updatedMessage) => {
        if (!socket) return;

        setTalkingToUser(prev => {
            if (!prev || !prev.messages) return prev;

            return {
                ...prev,
                messages: prev.messages.map(msg =>
                    msg._id.toString() === updatedMessage._id.toString() ? updatedMessage : msg
                )
            };
        });
    }, [socket]);

    // Fetch chat messages
    const fetchChats = useCallback((chatId) => {
        return new Promise((resolve) => {
            if (!socket) {
                resolve([]);
                return;
            }

            socket.emit('fetch chats', chatId);

            socket.once('send chats', (chatObject) => {
                resolve(chatObject || []);
            });
        });
    }, [socket]);

    // Setup socket event listeners
    useEffect(() => {
        if (!socket || !user?.email) return;

        // Register user socket
        socket.emit('registersocket', user.email);

        // Setup event listeners
        const eventHandlers = {
            "YourDetails": (userData) => {
                setUser(prev => ({ ...prev, ...userData }));
            },

            // MODIFIED EVENT HANDLER FOR "private message" EVENT
            "private message": (message) => {
                // Add message to current chat if sender matches
                if (talkingToUser && message.senderid === talkingToUser.uid) {
                    setTalkingToUser(prev => {
                        if (!prev) return prev;
                        return {
                            ...prev,
                            messages: [...prev.messages, message]
                        };
                    });
                }
                // ADDED: Update recent chats for any message received
                const chatId = generateChatId(user.uid, message.senderid);
                const userChats = user.chats || [];
                const existingChatIndex = userChats.findIndex(chat => chat.chatid === chatId);

                let updatedChats;
                if (existingChatIndex !== -1) {
                    // Update existing chat
                    updatedChats = [...userChats];
                    updatedChats[existingChatIndex] = {
                        ...updatedChats[existingChatIndex],
                        lastmessage: message.messagetext,
                        updatedat: new Date(),
                        // Set unread to true if we're not currently chatting with this user
                        unread: !talkingToUser || message.senderid !== talkingToUser.uid
                    };
                } else {
                    // Add new chat entry - fetch user info if needed
                    // This is a simplified version - you may want to fetch user details 
                    const newChat = {
                        typeofchat: 'private',
                        recievername: message.sendername || 'Unknown', // You might need to include sender name in message
                        chatid: chatId,
                        userid: message.senderid,
                        lastmessage: message.messagetext,
                        updatedat: new Date(),
                        chatimage: message.senderProfile || '', // You might need to include profile pic
                        unread: true // New chats are always unread initially
                    };
                    updatedChats = [...userChats, newChat];
                }

                // Update user state with modified chats
                setUser(prev => ({ ...prev, chats: updatedChats }));

                // Send delivery confirmation
                const modifiedMessage = {
                    ...message,
                    delivered: { isdelivered: true, deliveredat: new Date() }
                };
                socket.emit("private message recieve confirmation", modifiedMessage);
            },

            "private message recieve confirmation from server": (updatedMessage) => {
                setTalkingToUser(prev => {
                    if (!prev) return prev;

                    // Replace the temporary message with the confirmed one from server
                    const updatedMessages = prev.messages.filter(msg =>
                        // Filter out any temporary message with the same text 
                        // (assuming the message text is a reliable indicator)
                        !(msg._id.toString().includes(Date.now().toString().substring(0, 8)) &&
                            msg.messagetext === updatedMessage.messagetext)
                    );

                    return {
                        ...prev,
                        messages: [...updatedMessages, updatedMessage]
                    };
                });
            },

            "private message sent confirmation": (updatedMessage) => {
                setTalkingToUser(prev => {
                    if (!prev) return prev;

                    // Make sure messages array exists
                    const currentMessages = prev.messages || [];

                    // Find and replace the temporary message
                    const updatedMessages = currentMessages.filter(msg => {
                        // Keep all messages that aren't temporary or don't match the confirmed message
                        return !(msg.isTemporary && msg.messagetext === updatedMessage.messagetext);
                    });

                    return {
                        ...prev,
                        messages: [...updatedMessages, updatedMessage]
                    };
                });
            },




            "private message update from server": (updatedMessage) => {
                updateMessageInChat(updatedMessage);
            },

            "typing-start": (data) => {
                if (data.receiverId === user.uid && talkingToUser && data.senderid === talkingToUser.uid) {
                    setIsTyping(true);
                }
            },

            "typing-stop": (data) => {
                if (data.receiverId === user.uid && talkingToUser && data.senderid === talkingToUser.uid) {
                    setIsTyping(false);
                }
            }
        };

        // Register all event listeners
        Object.entries(eventHandlers).forEach(([event, handler]) => {
            socket.off(event); // Remove any duplicate listeners
            socket.on(event, handler);
        });

        // Add connect/disconnect handlers
        socket.on("connect", () => {
            console.log("Connected to server");
        });
        socket.on("disconnect", () => {
            console.log("Disconnected from server");
        });

        // Cleanup function
        return () => {
            if (socket) {
                Object.keys(eventHandlers).forEach(event => {
                    socket.off(event);
                });
                socket.off("connect");
                socket.off("disconnect");
            }
        };
    }, [socket, user?.email, user?.uid, talkingToUser, refreshUser, updateMessageInChat, generateChatId]); // Added generateChatId to dependencies













    const handleReactionAdd = useCallback((messageId, reactionType, userId) => {
        if (!talkingToUser?.messages || !socket) return;

        const updatedMessage = talkingToUser.messages
            .map(message => {
                if (message._id === messageId) {
                    // Filter out any existing reaction from this user
                    const filteredReactions = message.reactions.filter(
                        reaction => reaction.userId !== userId
                    );

                    // Add the new reaction
                    return {
                        ...message,
                        reactions: [...filteredReactions, { type: reactionType, userId }]
                    };
                }
                return message;
            })
            .find(message => message._id === messageId);

        if (updatedMessage) {
            socket.emit('private message update', updatedMessage);
            updateMessageInChat(updatedMessage);
        }
    }, [socket, talkingToUser, updateMessageInChat]);

    // Handle user selection from search
    const handleUserSelect = useCallback((e) => {
        e.preventDefault();
        if (!inputValue) return;

        handleUserChatClick(inputValue, '', user);
        setInputValue('');
    }, [inputValue, user]);

    // Handle user chat click
    // Updates talkingToUser and marks unread messages as read
    const handleUserChatClick = useCallback(async (uid, chatId, loggedUser) => {
        if (!socket) return;

        // Extract UID from chat ID if needed
        let targetUid = uid;
        if (!targetUid || targetUid === '') {
            const id1 = chatId.slice(0, 4);
            const id2 = chatId.slice(4, 8);
            targetUid = id1 === loggedUser.uid ? id2 : id1;
        }

        // Default receiver data
        const receiver = {
            name: 'Unable to fetch',
            uid: targetUid,
            onlinestatus: { online: false, lastSeen: 'long ago' },
            profilepicture: '',
            messages: []
        };

        try {
            const userInfo = await fetchUser(targetUid);
            const chatId = generateChatId(loggedUser.uid, targetUid);
            const messages = await fetchChats(chatId);

            // Set the talkingToUser
            setTalkingToUser({
                ...receiver,
                name: userInfo.name,
                onlinestatus: userInfo.onlinestatus,
                profilepicture: userInfo.profilepicture,
                messages: messages,
            });

            // Mark unread messages as read
            const unreadMessages = messages.filter((msg) => !msg.read?.isread && msg.recieverid === loggedUser.uid);
            if (unreadMessages.length > 0) {
                // Update messages locally
                const updatedMessages = messages.map((msg) =>
                    unreadMessages.includes(msg)
                        ? {
                            ...msg,
                            read: { isread: true, readat: new Date() },
                        }
                        : msg
                );

                // Emit update to server using 'private message update' socket
                unreadMessages.forEach((msg) => {
                    const updatedMessage = {
                        ...msg,
                        read: { isread: true, readat: new Date() },
                    };
                    socket.emit('private message update', updatedMessage);
                });

                // Update the current chat messages in the state
                setTalkingToUser((prev) => ({
                    ...prev,
                    messages: updatedMessages,
                }));
            }

            // Update user chats to mark the chat as read
            const updatedChats = user.chats.map((chat) =>
                chat.chatid === chatId
                    ? {
                        ...chat,
                        unread: false, // Mark as no longer unread
                    }
                    : chat
            );
            setUser((prev) => ({
                ...prev,
                chats: updatedChats,
            }));

            // Close search div if open
            setSearchDivVisible(false);
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
    }, [socket, fetchUser, fetchChats, generateChatId, setUser, user?.chats]);

    // Handle user typing
    const handleUserTyping = useCallback((e) => {
        if (!socket || !talkingToUser) return;

        if (e.target.value.length > 0) {
            socket.emit('typing-start', { receiverId: talkingToUser.uid, senderid: user.uid });
        }

        if (typingTimer.current) {
            clearTimeout(typingTimer.current);
        }

        typingTimer.current = setTimeout(() => {
            socket.emit('typing-stop', { receiverId: talkingToUser.uid, senderid: user.uid });
        }, 1500);
    }, [socket, talkingToUser]);

    // Handle sending messages
    const handleSend = useCallback((message) => {
        if (!socket || !talkingToUser || !user || !message || message === '') return;
      
        const chatId = generateChatId(user.uid, talkingToUser.uid);
      
        const tempId = `temp-${Date.now()}`;
        
        const newMessage = {
          _id: tempId, // Add temporary ID here
          chatid: chatId,
          senderid: user.uid,
          recieverid: talkingToUser.uid,
          groupid: null,
          messagetext: message,
          sent: { issent: false, sentat: new Date() },
          delivered: { isdelivered: false, deliveredat: null },
          read: { isread: false, readat: null },
          deletedfor: [],
          deletedby: null,
          createdat: new Date(),
          // Adding a marker to identify this as a temporary message
          isTemporary: true
        };
      
        // Add to local messages immediately
        setTalkingToUser(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            messages: [...(prev.messages || []), newMessage]
          };
        });
      
        // Update user chats with new message for recent chats
        const userChats = user.chats || [];
        const existingChatIndex = userChats.findIndex(chat => chat.chatid === chatId);
      
        let updatedChats;
      
        if (existingChatIndex !== -1) {
          // Update existing chat
          updatedChats = [...userChats];
          updatedChats[existingChatIndex] = {
            ...updatedChats[existingChatIndex],
            lastmessage: message,
            updatedat: new Date(),
            unread: false
          };
        } else {
          // Add new chat
          const newChat = {
            typeofchat: 'private',
            recievername: talkingToUser.name,
            chatid: chatId,
            userid: talkingToUser.uid,
            lastmessage: message,
            updatedat: new Date(),
            chatimage: talkingToUser.profilepicture,
            unread: false
          };
          updatedChats = [...userChats, newChat];
        }
      
        // Update user state
        setUser(prev => ({ ...prev, chats: updatedChats }));
      
        // Send message to server
        socket.emit("private message", { newmessage: newMessage, chats: updatedChats });
      }, [socket, talkingToUser, user, generateChatId]);
      


    // Toggle search div visibility
    const toggleSearchDiv = useCallback(() => {
        setSearchDivVisible(prev => !prev);
    }, []);

    // Hide search div
    const hideSearchDiv = useCallback(() => {
        setSearchDivVisible(false);
    }, []);

    // Sort chats by update time
    const sortChatsByUpdateTime = useCallback((chats) => {
        if (!Array.isArray(chats) || chats.length === 0) {
            return [];
        }

        return [...chats].sort((a, b) => {
            const dateA = new Date(a.updatedat);
            const dateB = new Date(b.updatedat);
            return dateB - dateA;
        });
    }, []);

    const handleDeleteMessage = useCallback((messageId) => {
        if (!socket || !talkingToUser || !user) return;
        console.log('Deleting message:', messageId);
        console.log('Talking to user:', talkingToUser);
        // Find the message to update
        const messageToUpdate = talkingToUser.messages.find(msg => msg._id === messageId);

        if (!messageToUpdate) {
            console.error('Message not found:', messageId);
            return;
        }

        // Create updated message with current user added to deletedfor array
        const updatedMessage = {
            ...messageToUpdate,
            deletedfor: [...(messageToUpdate.deletedfor || []), user.uid, talkingToUser.uid]
        };

        // Emit the update to the server
        socket.emit('private message update', updatedMessage);

        // Update the message locally
        updateMessageInChat(updatedMessage);
    }, [socket, talkingToUser, user, updateMessageInChat])

    // Get sorted chats
    const sortedChats = useMemo(() => {
        return user?.chats ? sortChatsByUpdateTime(user.chats) : [];
    }, [user?.chats, sortChatsByUpdateTime]);

    return (
        <div className={styles.main}>
            <div className={styles.panel}>
                <button className={styles.panelbtns} onClick={hideSearchDiv}>
                    <Home size={34} color='white' />
                </button>
                <button className={styles.panelbtns} onClick={toggleSearchDiv}>
                    <Search size={34} color='white' />
                </button>
                <button className={styles.panelbtns}>
                    <SettingsIcon size={34} color='white' />
                </button>
            </div>

            {/* Search div */}
            <div
                className={styles.searchdiv}
                style={{
                    width: searchDivVisible ? '400px' : '0',
                    opacity: searchDivVisible ? '1' : '0'
                }}
            >
                <div className={styles.searchdivcontent}>
                    <h2>Search for a user</h2>
                    <form onSubmit={handleUserSelect}>
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder="Search"
                        />
                        <button type="submit">Search</button>
                    </form>
                </div>
            </div>

            {/* Recent chats */}
            <div
                className={styles.aside}
                style={{
                    width: searchDivVisible ? '0' : '400px',
                    opacity: searchDivVisible ? '0' : '1'
                }}
            >
                <div className={styles.asidecontent}>
                    <div className={styles.recentchatscontainer}>
                        <RecentChats
                            handlechatclick={handleUserChatClick}
                            handlesearchbtn={toggleSearchDiv}
                            user={{ ...user, chats: sortedChats }}
                            notifications={8}
                        />
                    </div>
                </div>
            </div>

            {/* Chat window */}
            <div className={styles.chat}>
                {talkingToUser ? (
                    <ChatWindow
                        handlesend={handleSend}
                        userdata={talkingToUser}
                        isTyping={isTyping}
                        handletyping={handleUserTyping}
                        onReactionAdd={handleReactionAdd}
                        onDeleteMessage={handleDeleteMessage}
                    />
                ) : (
                    <EmptyPage />
                )}
            </div>
        </div>
    );
}

export default ChatApp;