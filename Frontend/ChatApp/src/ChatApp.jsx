import { useEffect, useState, useContext, useRef, useCallback, useMemo } from 'react';
import styles from './ChatApp.module.css'; // Correct import for CSS Modules
import { Home, Search, Settings, User, Bell, Moon, Shield, LogOut, Sun } from 'lucide-react'
import EmptyPage from './components/nochatpage';
import ChatWindow from './components/chatwindow/chatwindow';
import { io } from 'socket.io-client';
import { AuthContext } from './components/authcontext/authcontext';
import RecentChats from './components/recentchats';
import { useNavigate } from 'react-router-dom';


// THERE ARE SOME ISSUES IN THE FRONTEND OF THE APP (LAYOUT PROBLEMS ) FIX THEM IN THIS CODE






function ChatApp() {
    const { user, setUser } = useContext(AuthContext);
    const [socket, setSocket] = useState(null);
    const [talkingToUser, setTalkingToUser] = useState(null);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const typingTimer = useRef(null);
    const [notificationcount, setNotificationCount] = useState(0);
    const [ismobile, setIsMobile] = useState(false);
    const [activeSection, setActiveSection] = useState('recentChatsSection');
    const [isDarkMode, setIsDarkMode] = useState(() => {
        const savedTheme = localStorage.getItem('theme');
        return savedTheme ? savedTheme === 'dark' : true;
    });
    const navigate = useNavigate();

    // Function to handle window resize
    const handleResize = useCallback(() => {
      const isMobileView = window.innerWidth < 640;
      setIsMobile(isMobileView);
      
      if (!isMobileView && activeSection === 'chatSection') {
        setActiveSection('recentChatsSection');
      }
    }, [activeSection]);

    useEffect(() => {
      handleResize();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, [handleResize]);

    // Establish socket connection
    useEffect(() => {
        // Only create socket if it doesn't exist
        if (!socket) {
            console.log('Creating new socket connection');
            const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
            const newSocket = io(API_URL, {
                reconnection: true,
                reconnectionAttempts: 10,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                timeout: 20000,
                autoConnect: true,
                transports: ['websocket', 'polling'],
                upgrade: true,
                forceNew: true,
                secure: API_URL.startsWith('https')
            });
            setSocket(newSocket);
            
            // Add connection event handlers
            newSocket.on('connect', () => {
                console.log('Connected to server');
                // Re-register socket if user is logged in
                if (user?.email) {
                    newSocket.emit('registersocket', user.email);
                }
            });

            newSocket.on('disconnect', (reason) => {
                console.log('Disconnected from server:', reason);
                if (reason === 'io server disconnect') {
                    // Server initiated disconnect, try to reconnect
                    newSocket.connect();
                }
            });

            newSocket.on('connect_error', (error) => {
                console.error('Connection error:', error);
            });

            newSocket.on('reconnect', (attemptNumber) => {
                console.log('Reconnected to server after', attemptNumber, 'attempts');
                // Re-register socket if user is logged in
                if (user?.email) {
                    newSocket.emit('registersocket', user.email);
                }
            });

            newSocket.on('reconnect_error', (error) => {
                console.error('Reconnection error:', error);
            });

            newSocket.on('reconnect_failed', () => {
                console.error('Failed to reconnect to server');
                alert('Connection lost. Please refresh the page to reconnect.');
            });

            // Add chat deletion listeners
            newSocket.on('chat-deleted', (data) => {
                if (data.success) {
                    setUser(prev => ({
                        ...prev,
                        chats: prev.chats.filter(chat => chat.chatid !== data.chatId)
                    }));
                    
                    if (talkingToUser?.chatid === data.chatId) {
                        setTalkingToUser(null);
                    }
                }
            });

            newSocket.on('chat-deleted-by-other', (data) => {
                if (talkingToUser?.chatid === data.chatId) {
                    setTalkingToUser(null);
                    alert(`${data.deletedBy} has deleted this chat`);
                }
            });
        }
        
        // Cleanup function
        return () => {
            if (socket) {
                console.log('Cleaning up socket connection');
                socket.off('connect');
                socket.off('disconnect');
                socket.off('connect_error');
                socket.off('reconnect');
                socket.off('reconnect_error');
                socket.off('reconnect_failed');
                socket.off('chat-deleted');
                socket.off('chat-deleted-by-other');
                socket.disconnect();
                setSocket(null);
            }
        };
    }, [user?.email]); // Only depend on user email
    
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
        await new Promise(resolve => setTimeout(resolve, 3000)); // Delay of 3 seconds
        const updatedUser = await fetchUser(user.uid);
        
        // Preserve the unread status of chats when updating user data
        setUser(prev => {
          if (!prev?.chats || !updatedUser?.chats) return { ...prev, ...updatedUser };
          
          // Create a map of previous chats with their unread status
          const unreadStatusMap = {};
          prev.chats.forEach(chat => {
            if (chat.unread) {
              unreadStatusMap[chat.chatid] = true;
            }
          });
          
          // Apply the unread status to the updated chats
          const mergedChats = updatedUser.chats.map(chat => {
            if (unreadStatusMap[chat.chatid]) {
              return { ...chat, unread: true };
            }
            return chat;
          });
          
          return {
            ...prev,
            ...updatedUser,
            chats: mergedChats
          };
        });
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
      console.log('▶️ updateMessageInChat called:', updatedMessage);
      
      if (!socket) {
        console.error('❌ Socket not available in updateMessageInChat');
        return;
      }
      
      setTalkingToUser(prev => {
        console.log('▶️ Previous talkingToUser state:', prev);
        
        if (!prev || !prev.messages) {
          console.error('❌ No previous state or messages in updateMessageInChat');
          return prev;
        }
        
        const updatedState = {
          ...prev,
          messages: prev.messages.map(msg => {
            // Compare IDs safely, handling both string and ObjectId cases
            const isMatching = msg._id === updatedMessage._id || 
                              String(msg._id) === String(updatedMessage._id);
                              
            if (isMatching) {
              console.log('✅ Updating message in chat:', msg._id);
              return updatedMessage;
            }
            return msg;
          })
        };
        
        console.log('✅ New talkingToUser state:', updatedState);
        return updatedState;
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
    
    // Socket event handlers
    useEffect(() => {
      if (!socket || !user?.email) return;
      
      console.log('Setting up socket event handlers');
      
      // Register user socket
      socket.emit('registersocket', user.email);
      
      // Setup event listeners
      const eventHandlers = {
        "YourDetails": (userData) => {
          setUser(prev => ({ ...prev, ...userData }));
        },

        "private sync message": () => {
            setNotificationCount((prev) => prev + 1);
        },
        
        "private message": (message) => {
          console.log('Message received:', message);
          setNotificationCount((prev) => prev + 1);
          
          // Check if the user is currently viewing this chat
          const isCurrentChat = talkingToUser && message.senderid === talkingToUser.uid;
          
          if (isCurrentChat) {
            setNotificationCount(prev => prev - 1);
            setTalkingToUser(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                messages: [...prev.messages, message]
              };
            });
          }
          
          // Send delivery confirmation
          const modifiedMessage = {
            ...message,
            delivered: { isdelivered: true, deliveredat: new Date() }
          };
          
          socket.emit("private message recieve confirmation", modifiedMessage);
          
          // Update the chat list - mark the chat as unread if it's not the current chat
          setUser(prev => {
            if (!prev?.chats) return prev;
            
            return {
              ...prev,
              chats: prev.chats.map(chat => {
                // Find the chat that this message belongs to
                const chatId = generateChatId(message.senderid, message.recieverid);
                
                if (chat.chatid === chatId) {
                  return {
                    ...chat,
                    lastmessage: message.messagetext || `[${message.messageType || 'file'}]`,
                    updatedat: new Date(),
                    unread: !isCurrentChat // Mark as unread only if user is not viewing this chat
                  };
                }
                return chat;
              })
            };
          });
          
          refreshUser();
        },
        
        "private message recieve confirmation from server": (updatedMessage) => {
          setTalkingToUser(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              messages: prev.messages.map(msg =>
                msg._id === updatedMessage._id ? updatedMessage : msg
              )
            };
          });
        },
        
        "private message sent confirmation": (updatedMessage) => {
          setTalkingToUser(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              messages: [...prev.messages, updatedMessage]
            };
          });
        },
        
        "private message update": (message) => {
          console.log('📣 Received private message update:', message);
          
          // Check if this is a deletion message
          if (message.deletedfor && message.deletedfor.length > 0) {
            console.log('🗑️ Message has been deleted for users:', message.deletedfor);
            
            // If deletedby is set, this was a "delete for everyone" action
            if (message.deletedby) {
              console.log('👤 Message deleted by user:', message.deletedby);
              
              // For "delete for everyone", we need to make sure it's visible in the UI immediately
              // regardless of whether the current user is viewing this chat
              
              // First, update the message in the current chat if applicable
              if (talkingToUser && talkingToUser.messages) {
                console.log('🔄 Updating message in current chat view');
                updateMessageInChat(message);
                
                // Check if this was the last message in this chat
                const isLastMessage = talkingToUser.messages.length > 0 && 
                  (talkingToUser.messages[talkingToUser.messages.length - 1]._id === message._id ||
                   String(talkingToUser.messages[talkingToUser.messages.length - 1]._id) === String(message._id));
                
                if (isLastMessage && user.chats) {
                  console.log('🔄 This was the last message in the chat, updating chat list');
                  // Update the chat list to show the message was deleted
                  const chatId = message.chatid;
                  
                  setUser(prev => {
                    if (!prev || !prev.chats) return prev;
                    
                    return {
                      ...prev,
                      chats: prev.chats.map(chat => 
                        chat.chatid === chatId 
                          ? { ...chat, lastmessage: "This message was deleted" }
                          : chat
                      )
                    };
                  });
                }
              } else {
                // If user not viewing this chat, we still need to update the chat list
                // if this was the last message in that chat
                if (user && user.chats) {
                  const chatId = message.chatid;
                  const relevantChat = user.chats.find(chat => chat.chatid === chatId);
                  
                  if (relevantChat) {
                    console.log('🔄 Updating chat list for non-active chat');
                    setUser(prev => {
                      if (!prev || !prev.chats) return prev;
                      
                      return {
                        ...prev,
                        chats: prev.chats.map(chat => 
                          chat.chatid === chatId 
                            ? { ...chat, lastmessage: "This message was deleted" }
                            : chat
                        )
                      };
                    });
                  }
                }
              }
              
              // If the user is not currently viewing this chat, show a notification
              if (!talkingToUser || 
                  (message.senderid !== talkingToUser.uid && message.recieverid !== talkingToUser.uid)) {
                console.log('📢 User not viewing this chat, showing deletion notification');
                // Optionally show a toast notification that a message was deleted
                // toast.info('A message was deleted from one of your chats');
              }
              
              // Update the user data in case we need to refresh cached messages
              refreshUser();
              return;
            }
          }
          
          // For normal updates or "delete for me only", just update the message in the current chat
          console.log('🔄 Updating message in local state');
          updateMessageInChat(message);
        },
        
        "private message update from server": (message) => {
          // This is kept for backward compatibility
          console.log('📣 Received legacy private message update:', message);
          updateMessageInChat(message);
        },
        
        "typing-start": (data) => {
          if(!talkingToUser) return;
          if (data.receiverId === user.uid && data.senderid === talkingToUser.uid) {
            setIsTyping(true);
          }
        },
        
        "typing-stop": (data) => {
          if(!talkingToUser) return;
          if (data.receiverId === user.uid && data.senderid === talkingToUser.uid) {
            setIsTyping(false);
          }
        }
      };
      
      // Register all event listeners
      Object.entries(eventHandlers).forEach(([event, handler]) => {
        socket.off(event); // Remove any duplicate listeners
        socket.on(event, handler);
      });
      
      // Cleanup function
      return () => {
        if (socket) {
          console.log('Cleaning up socket event handlers');
          Object.keys(eventHandlers).forEach(event => {
            socket.off(event);
          });
        }
      };
    }, [socket, user?.email, user?.uid, talkingToUser, refreshUser, updateMessageInChat]);
    
    // Handle reaction add
    const handleReactionAdd = useCallback((messageId, reactionType, userId) => {
      if (!talkingToUser?.messages || !socket) return;
      
      const updatedMessage = talkingToUser.messages
        .map(message => {
          if (message._id === messageId) {
            // Filter out any existing reaction from this user
            const filteredReactions = message.reactions.filter(
              reaction => reaction.userId !== userId
            );
            
            // Only add a new reaction if it's not a removal
            if (reactionType === 'remove_reaction' || reactionType === null) {
              return {
                ...message,
                reactions: filteredReactions
              };
            } else {
              // Add the new reaction
              return {
                ...message,
                reactions: [...filteredReactions, { type: reactionType, userId }]
              };
            }
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
        const generatedChatId = generateChatId(loggedUser.uid, targetUid);
        const messages = await fetchChats(generatedChatId);
        
        setTalkingToUser({
          ...receiver,
          name: userInfo.name,
          onlinestatus: userInfo.onlinestatus,
          profilepicture: userInfo.profilepicture,
          messages: messages,
        });
        
        // Mark this chat as read since user is now viewing it
        setUser(prev => {
          if (!prev?.chats) return prev;
          
          const updatedChats = prev.chats.map(chat => {
            if (chat.chatid === generatedChatId) {
              return {
                ...chat,
                unread: false // Mark as read
              };
            }
            return chat;
          });
          
          // Update the server with the read status change
          if (socket) {
            socket.emit('mark-chat-read', {
              userId: loggedUser.uid,
              chatId: generatedChatId
            });
          }
          
          return {
            ...prev,
            chats: updatedChats
          };
        });
        
        // Close search div if open
        setActiveSection('chatSection');
      } catch (error) {
        // console.error('Error fetching user data:', error);
        alert('Error fetching user data: ' + error);
      }
    }, [socket, fetchUser, fetchChats, generateChatId]);
    
    // Handle user typing
    const handleUserTyping = useCallback((e) => {
      if (!socket || !talkingToUser) return;
      
      if (e.target.value.length > 0) {
        socket.emit('typing-start', { receiverId: talkingToUser.uid , senderid: user.uid});
      }
      
      if (typingTimer.current) {
        clearTimeout(typingTimer.current);
      }
      
      typingTimer.current = setTimeout(() => {
        socket.emit('typing-stop', { receiverId: talkingToUser.uid , senderid: user.uid});
      }, 1500);
    }, [socket, talkingToUser]);
    
    // Handle sending messages
    const handleSend = useCallback((message) => {
      if (!socket || !talkingToUser || !user) return;
      
      const chatId = generateChatId(user.uid, talkingToUser.uid);
      
      // Create message object based on type
      const newMessage = {
        chatid: chatId,
        senderid: user.uid,
        recieverid: talkingToUser.uid,
        groupid: null,
        messagetext: typeof message === 'string' ? message : '',
        messageType: typeof message === 'string' ? 'text' : message.messageType,
        media: typeof message === 'string' ? null : message.media,
        sent: { issent: false, sentat: new Date() },
        delivered: { isdelivered: false, deliveredat: null },
        read: { isread: false, readat: null },
        deletedfor: [],
        deletedby: null,
        createdat: new Date()
      };
      
      // Update user chats with new message
      const userChats = user.chats || [];
      const existingChatIndex = userChats.findIndex(chat => chat.chatid === chatId);
      
      let updatedChats;
      
      if (existingChatIndex !== -1) {
        // Update existing chat
        updatedChats = [...userChats];
        updatedChats[existingChatIndex] = {
          ...updatedChats[existingChatIndex],
          lastmessage: typeof message === 'string' ? message : `[${message.messageType}]`,
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
          lastmessage: typeof message === 'string' ? message : `[${message.messageType}]`,
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

    const handleDeleteMessage = useCallback((messageId, deleteType = 'for_me') => {
      console.log('▶️ handleDeleteMessage called with:', { messageId, deleteType });
      console.log('▶️ Socket available:', !!socket);
      console.log('▶️ TalkingToUser available:', !!talkingToUser);
      console.log('▶️ User available:', !!user);
      
      if (!socket || !talkingToUser || !user) {
        console.error('❌ Missing required data:', { 
          socket: !!socket, 
          talkingToUser: !!talkingToUser, 
          user: !!user 
        });
        return;
      }
      
      // Find the message to update - ensure we're comparing the IDs correctly
      // MongoDB ObjectIds need to be compared as strings
      const messageToUpdate = talkingToUser.messages.find(msg => 
        msg._id === messageId || String(msg._id) === String(messageId)
      );
      
      if (!messageToUpdate) {
        console.error('❌ Message not found:', messageId);
        console.log('▶️ Available messages:', talkingToUser.messages.map(m => m._id));
        return;
      }
      
      console.log('✅ Found message to update:', messageToUpdate);
      
      // Create updated message with the appropriate delete settings
      let updatedMessage;
      
      if (deleteType === 'for_everyone') {
        console.log('▶️ Deleting for everyone');
        // Delete for everyone
        updatedMessage = {
          ...messageToUpdate,
          deletedfor: [...(messageToUpdate.deletedfor || []), user.uid, talkingToUser.uid],
          deletedby: user.uid // Add who deleted it
        };
        
        // If this is a media message, delete it from Cloudinary when deleting for everyone
        if (messageToUpdate.media && messageToUpdate.media.cloudinary_id) {
          console.log('▶️ Deleting media from Cloudinary:', messageToUpdate.media.cloudinary_id);
          
          // Make sure we have a valid ID
          let cloudinaryId = messageToUpdate.media.cloudinary_id;
          
          // Delete the file from Cloudinary
          const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
          fetch(`${API_URL}/delete-file/${encodeURIComponent(cloudinaryId)}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json'
            }
          })
          .then(response => {
            if (!response.ok) {
              throw new Error(`Server responded with ${response.status}`);
            }
            return response.json();
          })
          .then(data => {
            if (data.success) {
              console.log('✅ Successfully deleted file from Cloudinary');
            } else {
              console.error('❌ Failed to delete file from Cloudinary:', data.error);
            }
          })
          .catch(error => {
            console.error('❌ Error deleting file from Cloudinary:', error);
          });
        }
        
        // Check if this was the last message in the chat (based on local data)
        // We'll update it in both the UI and send the update to the server
        const isLastMessage = talkingToUser.messages[talkingToUser.messages.length - 1]._id === messageId;
        if (isLastMessage && user.chats) {
          console.log('▶️ This was the last message in the chat, updating local chat list');
          // Find this chat in the user's chat list
          const chatId = generateChatId(user.uid, talkingToUser.uid);
          const chatToUpdate = user.chats.find(chat => chat.chatid === chatId);
          
          if (chatToUpdate) {
            // Update the last message immediately for better UX
            setUser(prev => {
              if (!prev || !prev.chats) return prev;
              
              return {
                ...prev,
                chats: prev.chats.map(chat => 
                  chat.chatid === chatId 
                    ? { ...chat, lastmessage: "This message was deleted" }
                    : chat
                )
              };
            });
          }
        }
      } else {
        console.log('▶️ Deleting for current user only');
        // Delete for me only
        updatedMessage = {
          ...messageToUpdate,
          deletedfor: [...(messageToUpdate.deletedfor || []), user.uid]
        };
      }
      
      console.log('✅ Updated message:', updatedMessage);
      
      // Emit the update to the server
      console.log('▶️ Emitting message update to socket');
      socket.emit('private message update', updatedMessage);
      
      // Update the message locally
      console.log('▶️ Updating message in chat locally');
      updateMessageInChat(updatedMessage);
    }, [socket, talkingToUser, user, updateMessageInChat, generateChatId]);
    
    // Get sorted chats
    const sortedChats = useMemo(() => {
      return user?.chats ? sortChatsByUpdateTime(user.chats) : [];
    }, [user?.chats, sortChatsByUpdateTime]);
    
    // Navigation handlers
    const handleNavigation = useCallback((section) => {
      if (section === activeSection) {
        // If clicking the same section, go back to recentChatsSection
        setActiveSection('recentChatsSection');
      } else {
        setActiveSection(section);
      }
    }, [activeSection]);

    // Function to toggle theme
    const toggleTheme = useCallback(() => {
        setIsDarkMode(prev => {
            const newTheme = !prev;
            localStorage.setItem('theme', newTheme ? 'dark' : 'light');
            return newTheme;
        });
    }, []);

    const handleLogout = async () => {
        try {
            const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
            const response = await fetch(`${API_URL}/logout`, {
                method: 'POST',
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error("Logout failed");
            }

            // Clear all auth-related data from localStorage
            localStorage.removeItem('auth_token');
            localStorage.removeItem('userEmail');
            
            // Clear any other user-related data
            setUser(null);
            
            // Navigate to login page
            navigate('/login');
            
        } catch (error) {
            console.error("Error during logout:", error);
            // Still try to clear local data even if server request fails
            localStorage.removeItem('auth_token');
            localStorage.removeItem('userEmail');
            setUser(null);
            navigate('/login');
        }
    };

    const handleDeleteChat = (chatId) => {
      if (!socket || !user) return;

      // Emit delete chat event
      socket.emit('delete-chat', {
        userId: user.uid,
        chatId: chatId
      });
    };

    return (
      <div className={`${styles.container} ${isDarkMode ? styles.darkTheme : styles.lightTheme}`}>
        {/* Desktop Navigation Panel - Hidden on Mobile */}
        <nav className={`${styles.navigationPanel} ${ismobile ? styles.hiddenOnMobile : ''}`}>
          <div className={styles.logoSection}>
            <img src= {user?.profilepicture || "/default-avatar.png"} alt="ChatApp" className={styles.logo} />
          </div>
          
          <div className={styles.navButtons}>
            <button 
              className={`${styles.navButton} ${activeSection === 'recentChatsSection' ? styles.active : ''}`}
              onClick={() => handleNavigation('recentChatsSection')}
            >
              <Home size={24} />
              <span className={styles.buttonLabel}>Home</span>
            </button>

            <button 
              className={`${styles.navButton} ${activeSection === 'searchSection' ? styles.active : ''}`}
              onClick={() => handleNavigation('searchSection')}
            >
              <Search size={24} />
              <span className={styles.buttonLabel}>Search</span>
            </button>

            <button 
              className={`${styles.navButton} ${activeSection === 'settingsSection' ? styles.active : ''}`}
              onClick={() => handleNavigation('settingsSection')}
            >
              <Settings size={24} />
              <span className={styles.buttonLabel}>Settings</span>
            </button>
          </div>

          <div className={styles.userProfile}>
            <img 
              src={user?.profilepicture || "/default-avatar.png"} 
              alt="Profile" 
              className={styles.profilePic} 
            />
          </div>
        </nav>

        <main className={styles.mainContent}>
          <div 
            className={styles.searchSection}
            style={{
              width: activeSection === 'searchSection' ? (ismobile ? '100%' : '400px') : '0',
              height: ismobile ? '100%' : 'auto',
              opacity: activeSection === 'searchSection' ? '1' : '0',
              visibility: activeSection === 'searchSection' ? 'visible' : 'hidden',
              position: ismobile ? 'absolute' : 'relative',
              overflow: 'hidden'
            }}
          >
            <div className={styles.searchContainer}>
              <h2 className={styles.sectionTitle}>Find Friends</h2>
              <form onSubmit={handleUserSelect} className={styles.searchForm}>
                <div className={styles.searchInputWrapper}>
                  <Search size={20} className={styles.searchIcon} />
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Search users..."
                    className={styles.searchInput}
                  />
                </div>
                <button type="submit" className={styles.searchButton}>
                  Search
                </button>
              </form>
            </div>
          </div>

          <div 
            className={styles.settingsSection}
            style={{
              width: activeSection === 'settingsSection' ? (ismobile ? '100%' : '400px') : '0',
              height: ismobile ? '100%' : 'auto',
              opacity: activeSection === 'settingsSection' ? '1' : '0',
              visibility: activeSection === 'settingsSection' ? 'visible' : 'hidden',
              position: ismobile ? 'absolute' : 'relative',
              overflow: 'hidden'
            }}
          >
            <div className={styles.settingsContainer}>
              <h2 className={styles.settingsTitle}>Settings</h2>
              
              <div className={styles.settingsGroup}>
                <button className={styles.settingsItem}>
                  <div className={styles.settingsLabel}>
                    <User size={20} className={styles.settingsIcon} />
                    <span>Profile Settings</span>
                  </div>
                  <span className={styles.settingsValue}>Edit</span>
                </button>
                
                <button className={styles.settingsItem}>
                  <div className={styles.settingsLabel}>
                    <Bell size={20} className={styles.settingsIcon} />
                    <span>Notifications</span>
                  </div>
                  <span className={styles.settingsValue}>On</span>
                </button>
                
                <button 
                  className={`${styles.settingsItem} ${styles.themeToggle}`}
                  onClick={toggleTheme}
                >
                  <div className={styles.settingsLabel}>
                    {isDarkMode ? (
                      <Moon size={20} className={styles.settingsIcon} />
                    ) : (
                      <Sun size={20} className={styles.settingsIcon} />
                    )}
                    <span>Dark Mode</span>
                  </div>
                  <span className={styles.settingsValue}>
                    {isDarkMode ? 'On' : 'Off'}
                  </span>
                </button>
              </div>

              <div className={styles.settingsGroup}>
                <button className={styles.settingsItem}>
                  <div className={styles.settingsLabel}>
                    <Shield size={20} className={styles.settingsIcon} />
                    <span>Privacy & Security</span>
                  </div>
                  <span className={styles.settingsValue}>Manage</span>
                </button>
                
                <button 
                  className={`${styles.settingsItem} ${styles.logoutButton}`}
                  onClick={handleLogout}
                >
                  <div className={styles.settingsLabel}>
                    <LogOut size={20} className={styles.settingsIcon} />
                    <span>Logout</span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div 
            className={`${styles.recentChatsSection} ${ismobile ? styles.mobileRecentChats : ''}`}
            style={{
              width: activeSection === 'recentChatsSection' || (!ismobile && activeSection !== 'searchSection' && activeSection !== 'settingsSection') 
                ? (ismobile ? '100%' : '400px') 
                : '0',
              height: ismobile ? '100%' : 'auto',
              opacity: activeSection === 'recentChatsSection' ? '1' : '0',
              visibility: activeSection === 'recentChatsSection' ? 'visible' : 'hidden',
              position: ismobile ? 'absolute' : 'relative',
              overflow: 'hidden'
            }}
          >
            <RecentChats
              handlechatclick={(uid, chatId) => {
                handleUserChatClick(uid, chatId, user);
                if (ismobile) {
                  setActiveSection('chatSection');
                }
              }}
              handlesearchbtn={() => handleNavigation('searchSection')}
              user={{...user, chats: sortedChats}}
              notifications={notificationcount}
              refreshUser= {refreshUser}
              handleDeleteChat={handleDeleteChat}
            />
          </div>

          <div 
            className={styles.chatSection}
            style={{
              width: ismobile ? (activeSection === 'chatSection' ? '100%' : '0') : 'auto',
              flex: !ismobile ? 1 : 'none',
              height: ismobile ? '100%' : 'auto',
              opacity: (ismobile && activeSection !== 'chatSection') ? '0' : '1',
              visibility: (ismobile && activeSection !== 'chatSection') ? 'hidden' : 'visible',
              position: ismobile ? 'absolute' : 'relative',
              overflow: 'hidden'
            }}
          >
            {talkingToUser ? (
              <ChatWindow
                handlesend={handleSend}
                userdata={talkingToUser}
                isTyping={isTyping}
                handletyping={handleUserTyping}
                onReactionAdd={handleReactionAdd}
                onDeleteMessage={handleDeleteMessage}
                onBack={ismobile ? () => handleNavigation('recentChatsSection') : undefined}
                socket={socket}
                localUser={user}
              />
            ) : (
              <EmptyPage onNewChat={() => handleNavigation('searchSection')} />
            )}
          </div>
          
          {/* Mobile Navigation Bar - Show on all sections except chat section */}
          {ismobile && activeSection !== 'chatSection' && (
            <div className={styles.mobileNavBar}>
              <button 
                className={`${styles.mobileNavButton} ${activeSection === 'recentChatsSection' ? styles.active : ''}`}
                onClick={() => handleNavigation('recentChatsSection')}
              >
                <Home size={24} />
              </button>
              <button 
                className={`${styles.mobileNavButton} ${activeSection === 'searchSection' ? styles.active : ''}`}
                onClick={() => handleNavigation('searchSection')}
              >
                <Search size={24} />
              </button>
              <button 
                className={`${styles.mobileNavButton} ${activeSection === 'settingsSection' ? styles.active : ''}`}
                onClick={() => handleNavigation('settingsSection')}
              >
                <Settings size={24} />
              </button>
              <button className={styles.mobileNavButton}>
                <img 
                  src={user?.profilepicture || "/default-avatar.png"} 
                  alt="Profile" 
                  className={styles.mobileProfilePic} 
                />
              </button>
            </div>
          )}
        </main>
      </div>
    );
}

export default ChatApp;