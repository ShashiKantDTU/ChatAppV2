import { useEffect, useState, useContext, useRef, useCallback, useMemo } from 'react';
import styles from './ChatApp.module.css'; // Correct import for CSS Modules
import { Home, Search, Settings, User, Bell, Moon, Shield, LogOut, Sun } from 'lucide-react'
import EmptyPage from './components/nochatpage';
import ChatWindow from './components/chatwindow/chatwindow';
import { io } from 'socket.io-client';
import { AuthContext } from './components/authcontext/authcontext';
import RecentChats from './components/recentchats';
import { useNavigate } from 'react-router-dom';
import VideoCall from './components/VideoCall/VideoCall';
import EditProfileModal from './components/EditProfileModal';

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
        // First check user settings if available, then fall back to localStorage
        if (user?.settings?.darkMode !== undefined) {
            return user.settings.darkMode;
        }
        const savedTheme = localStorage.getItem('theme');
        return savedTheme ? savedTheme === 'dark' : true;
    });
    // Add state to track data loading status
    const [isDataLoading, setIsDataLoading] = useState(true);
    // Add state to track initial data load completion
    const [initialLoadComplete, setInitialLoadComplete] = useState(false);
    // Global call state variables
    const [showGlobalCallUI, setShowGlobalCallUI] = useState(false);
    const [isIncomingCall, setIsIncomingCall] = useState(false);
    const [callInfo, setCallInfo] = useState(null);
    const [callType, setCallType] = useState('video');
    // Add notification state
    const [notifications, setNotifications] = useState([]);
    const [notificationVisible, setNotificationVisible] = useState(false);
    const notificationTimeoutRef = useRef(null);
    // Add notification sound ref
    const notificationSoundRef = useRef(null);
    const navigate = useNavigate();
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    // Add state to track call UI mode
    const [callUiMode, setCallUiMode] = useState('expanded'); // 'expanded', 'compact', or 'collapsed'
    // Add state for edit profile modal
    const [showEditProfile, setShowEditProfile] = useState(false);
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

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
        
        // Only set full loading state if initial load isn't complete
        if (!initialLoadComplete) {
          setIsDataLoading(true);
        }
        
        socket.emit('request user', uid);
        
        socket.once('send user', (userData) => {
          if (!initialLoadComplete) {
            setInitialLoadComplete(true);
          }
          setIsDataLoading(false);
          if (!userData) {
            reject('User not found');
          } else {
            resolve(userData);
          }
        });
      });
    }, [socket, initialLoadComplete]);
    
    // Function to refresh and update user data
    const refreshUser = useCallback(async () => {
      if (!user?.uid || !socket) return;

      try {
        // Don't show loading UI for refreshes after initial load
        if (!initialLoadComplete) {
          setIsDataLoading(true);
        }
        
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
      } finally {
        setIsDataLoading(false);
      }
    }, [fetchUser, user?.uid, setUser, socket, initialLoadComplete]);
    
    // Add initial data loading useEffect
    useEffect(() => {
      if (user?.uid && socket) {
        // Set initial loading state
        setIsDataLoading(true);
        
        // Initial fetch of user data
        fetchUser(user.uid)
          .then(userData => {
            setUser(prev => ({ ...prev, ...userData }));
            setInitialLoadComplete(true);
          })
          .catch(error => {
            console.error('Error fetching initial user data:', error);
          })
          .finally(() => {
            setIsDataLoading(false);
          });
      }
    }, [user?.uid, socket, fetchUser, setUser]);
    
    // Generate chat ID from two user IDs
    const generateChatId = useCallback((uid1, uid2) => {
      const sortedId = [uid1, uid2].sort();
      return sortedId[0] + sortedId[1];
    }, []);
    
    // Updates message in chat window
    const updateMessageInChat = useCallback((updatedMessage) => {
        // Remove sensitive data logs
        if (!socket) {
            console.error('Socket not available in updateMessageInChat');
            return;
        }
        
        setTalkingToUser(prev => {
            if (!prev || !prev.messages) {
                console.error('No previous state or messages in updateMessageInChat');
                return prev;
            }
            
            const updatedState = {
                ...prev,
                messages: prev.messages.map(msg => {
                    // Compare IDs safely, handling both string and ObjectId cases
                    const isMatching = msg._id === updatedMessage._id || 
                                      String(msg._id) === String(updatedMessage._id);
                                      
                    if (isMatching) {
                        return updatedMessage;
                    }
                    return msg;
                })
            };
            
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
          setIsDataLoading(false);
          setInitialLoadComplete(true);
        },

        "settings-update-result": (result) => {
          if (result.success) {
            console.log('Settings updated successfully:', result.settings);
            // Update settings in user object if needed
            setUser(prev => ({
              ...prev,
              settings: result.settings
            }));
            
            // Refresh user data to ensure settings are fully synced
            refreshUser();
          } else {
            console.error('Failed to update settings:', result.error);
          }
        },

        "private sync message": () => {
            setNotificationCount((prev) => prev + 1);
        },
        
        "private message": (message) => {
          setNotificationCount((prev) => prev + 1);
          
          // Get the latest settings from user state instead of using closure value
          const showNotif = () => {
            // Check current state for notifications setting
            const currentSettings = user?.settings;
            if (currentSettings?.notifications && message.senderid !== talkingToUser?.uid) {
              // Find sender info from user's chats
              const chatId = generateChatId(message.senderid, user.uid);
              const senderChat = user.chats?.find(chat => chat.chatid === chatId);
              
              if (senderChat) {
                showNotification(message, senderChat.recievername, senderChat.chatimage);
              } else {
                // If chat not found in existing chats, use a default or placeholder
                // This might happen for the first message from a new contact
                showNotification(message, "New message", null);
                
                // Try to refresh user data to get updated chat list
                refreshUser();
              }
            }
          };
          
          // Execute the function to check current settings
          showNotif();
          
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
          
          // Send delivery confirmation and read confirmation if user is viewing the chat
          const modifiedMessage = {
            ...message,
            delivered: { isdelivered: true, deliveredat: new Date() }
          };
          
          // If the user is viewing this chat, also mark the message as read
          if (isCurrentChat) {
            modifiedMessage.read = { 
              isread: true, 
              readat: new Date() 
            };
          }
          
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
          // Remove verbose logs, keep only essential error logs
          
          // Check if this is a deletion message
          if (message.deletedfor && message.deletedfor.length > 0) {
            
            // If deletedby is set, this was a "delete for everyone" action
            if (message.deletedby) {
              
              // First, update the message in the current chat if applicable
              if (talkingToUser && talkingToUser.messages) {
                updateMessageInChat(message);
                
                // Check if this was the last message in this chat
                const isLastMessage = talkingToUser.messages.length > 0 && 
                  (talkingToUser.messages[talkingToUser.messages.length - 1]._id === message._id ||
                   String(talkingToUser.messages[talkingToUser.messages.length - 1]._id) === String(message._id));
                
                if (isLastMessage && user.chats) {
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
              
              // Update the user data in case we need to refresh cached messages
              refreshUser();
              return;
            }
          }
          
          // For normal updates or "delete for me only", just update the message in the current chat
          updateMessageInChat(message);
        },
        
        "private message update from server": (message) => {
          // This is kept for backward compatibility
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
    }, [socket, user?.email, user?.uid, user?.settings, talkingToUser, refreshUser, updateMessageInChat, generateChatId]);
    
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
        // Remove verbose logs, keep only essential error logs
        
        if (!socket || !talkingToUser || !user) {
            console.error('Missing required data for message deletion');
            return;
        }
        
        // Find the message to update - ensure we're comparing the IDs correctly
        // MongoDB ObjectIds need to be compared as strings
        const messageToUpdate = talkingToUser.messages.find(msg => 
            msg._id === messageId || String(msg._id) === String(messageId)
        );
        
        if (!messageToUpdate) {
            console.error('Message not found for deletion:', messageId);
            return;
        }
        
        // Create updated message with the appropriate delete settings
        let updatedMessage;
        
        if (deleteType === 'for_everyone') {
            // Delete for everyone
            updatedMessage = {
                ...messageToUpdate,
                deletedfor: [...(messageToUpdate.deletedfor || []), user.uid, talkingToUser.uid],
                deletedby: user.uid // Add who deleted it
            };
            
            // If this is a media message, delete it from Cloudinary when deleting for everyone
            if (messageToUpdate.media && messageToUpdate.media.cloudinary_id) {
                // Delete the file from Cloudinary
                const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
                
                fetch(`${API_URL}/delete-file/${messageToUpdate.media.cloudinary_id}`, {
                    method: 'DELETE',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                })
                .then(response => response.json())
                .then(data => {
                    if (!data.success) {
                        console.error('Failed to delete file from Cloudinary:', data.error);
                    }
                })
                .catch(error => {
                    console.error('Error deleting file from Cloudinary:', error);
                });
            }
            
            // Check if this was the last message in the chat (based on local data)
            // We'll update it in both the UI and send the update to the server
            const isLastMessage = talkingToUser.messages[talkingToUser.messages.length - 1]._id === messageId;
            if (isLastMessage && user.chats) {
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
            // Delete for me only
            updatedMessage = {
                ...messageToUpdate,
                deletedfor: [...(messageToUpdate.deletedfor || []), user.uid]
            };
        }
        
        // Emit the update to the server
        socket.emit('private message update', updatedMessage);
        
        // Update the message locally
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

    // Toggle theme function - update to save to server
    const toggleTheme = useCallback(() => {
        if (!socket || !user?.uid) return;

        // Toggle the dark mode status
        const newDarkModeStatus = !isDarkMode;
        
        // Update localStorage for immediate effect and as fallback
        localStorage.setItem('theme', newDarkModeStatus ? 'dark' : 'light');
        
        // Update state optimistically
        setIsDarkMode(newDarkModeStatus);
        
        // Create updated settings object
        const updatedSettings = {
            ...user.settings,
            darkMode: newDarkModeStatus
        };
        
        // Update user state with new settings
        setUser(prev => ({
            ...prev,
            settings: updatedSettings
        }));
        
        // Send update to server
        socket.emit('update-user-settings', {
            userId: user.uid,
            settings: { darkMode: newDarkModeStatus }
        });
    }, [socket, user, isDarkMode]);
    
    // Update the useEffect for theme initialization to watch for user settings changes
    useEffect(() => {
        // Update theme when user settings change
        if (user?.settings?.darkMode !== undefined) {
            setIsDarkMode(user.settings.darkMode);
            localStorage.setItem('theme', user.settings.darkMode ? 'dark' : 'light');
        }
    }, [user?.settings?.darkMode]);
    
    // Toggle notifications function
    const toggleNotifications = useCallback(() => {
        if (!socket || !user?.uid) return;
        
        // Create updated settings object
        const updatedSettings = {
            ...user.settings,
            notifications: !user.settings?.notifications
        };
        
        // Update user state optimistically
        setUser(prev => ({
            ...prev,
            settings: updatedSettings
        }));
        
        // Send update to server
        socket.emit('update-user-settings', {
            userId: user.uid,
            settings: { notifications: updatedSettings.notifications }
        });
    }, [socket, user]);
    
    // Toggle sound function
    const toggleSound = useCallback(() => {
        if (!socket || !user?.uid) return;
        
        // Create updated settings object
        const updatedSettings = {
            ...user.settings,
            sound: !user.settings?.sound
        };
        
        // Update user state optimistically
        setUser(prev => ({
            ...prev,
            settings: updatedSettings
        }));
        
        // Send update to server
        socket.emit('update-user-settings', {
            userId: user.uid,
            settings: { sound: updatedSettings.sound }
        });
    }, [socket, user]);

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

    // Handle global incoming calls
    useEffect(() => {
        if (!socket || !user) return;

        // Set up call event listeners at the ChatApp level
        socket.on('incoming-call', (callData) => {
            console.log('Global incoming call from:', callData);
            setIsIncomingCall(true);
            setCallInfo({
                callerId: callData.callerId,
                callerName: callData.callerName,
                callerProfilePic: callData.callerProfilePic,
                callType: callData.callType
            });
            setCallType(callData.callType || 'video');
            setShowGlobalCallUI(true);
        });
        
        socket.on('call-accepted', (data) => {
            console.log('Call accepted globally:', data);
            // Continue with the call if this event is relevant to us
        });
        
        socket.on('call-rejected', () => {
            setShowGlobalCallUI(false);
            setCallInfo(null);
        });
        
        socket.on('call-cancelled', (data) => {
            console.log('Call was cancelled by caller before pickup');
            // Only handle if this is related to our call
            if (callInfo && data.callerId === callInfo.callerId) {
                setShowGlobalCallUI(false);
                setCallInfo(null);
                setIsIncomingCall(false);
                setCallType('video');
            }
        });
        
        socket.on('call-ended', () => {
            setShowGlobalCallUI(false);
            setCallInfo(null);
        });
        
        // Clean up on unmount
        return () => {
            socket.off('incoming-call');
            socket.off('call-accepted');
            socket.off('call-rejected');
            socket.off('call-cancelled');
            socket.off('call-ended');
        };
    }, [socket, user, callInfo]);

    // Handle accepting a call globally
    const handleGlobalAcceptCall = () => {
        if (!socket || !callInfo) return;
        
        socket.emit('call-accepted', {
            callerId: callInfo.callerId,
            calleeId: user.uid
        });
    };
    
    // Handle rejecting a call globally
    const handleGlobalRejectCall = () => {
        if (!socket || !callInfo) return;
        
        socket.emit('call-rejected', {
            callerId: callInfo.callerId,
            calleeId: user.uid
        });
        
        setShowGlobalCallUI(false);
        setCallInfo(null);
    };
    
    // Handle ending a call globally
    const handleGlobalEndCall = () => {
        setShowGlobalCallUI(false);
        setCallInfo(null);
    };

    // Function to get caller user data
    const getCallerUserData = useCallback(async (callerId) => {
        if (!callerId) return null;
        
        try {
            const userData = await fetchUser(callerId);
            return userData;
        } catch (error) {
            console.error('Error fetching caller data:', error);
            return {
                uid: callerId,
                name: 'Unknown User',
                profilepicture: '/default-avatar.png'
            };
        }
    }, [fetchUser]);

    // Handle call UI mode change
    const handleCallUiModeChange = (mode) => {
        setCallUiMode(mode);
    };

    // Add this useEffect after the existing effects
    useEffect(() => {
      // Listen for classes added to body by the VideoCall component
      const handleBodyClassChange = () => {
        // We can add custom behavior here if needed when body classes change
        // For example, adjusting other UI elements based on call state
      };

      // Create a MutationObserver to detect class changes on the body
      const observer = new MutationObserver(handleBodyClassChange);
      observer.observe(document.body, { 
        attributes: true, 
        attributeFilter: ['class'] 
      });

      return () => {
        // Clean up the observer when component unmounts
        observer.disconnect();
      };
    }, []);

    // Add notification handler function
    const showNotification = useCallback((message, senderName, senderPic) => {
      const newNotification = {
        id: Date.now(),
        message: message.messagetext || `[${message.messageType || 'file'}]`,
        senderName,
        senderPic,
        senderId: message.senderid,
        timestamp: new Date()
      };
      
      // Play notification sound if enabled in user settings
      if (user?.settings?.sound) {
        // Use the programmatic sound generator
        const playSound = window.playNotificationSound;
        if (typeof playSound === 'function') {
          playSound();
        }
      }
      
      // Clear any existing timeouts
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
        notificationTimeoutRef.current = null;
      }
      
      // Force immediate transition regardless of current state
      setNotificationVisible(false);
      
      // Update notifications queue immediately - add the new one and keep only last 5
      setNotifications(prev => {
        const updatedQueue = [...prev, newNotification].slice(-5);
        return updatedQueue;
      });
      
      // After a very short delay to allow hide animation to start, show the new notification
      setTimeout(() => {
        // Show the newest notification (should be at the end of our queue)
        setNotifications(prev => {
          // Move the newest notification to the front of the queue for display
          if (prev.length > 1) {
            const newest = prev[prev.length - 1];
            const remaining = prev.slice(0, prev.length - 1);
            return [newest, ...remaining];
          }
          return prev;
        });
        
        // Now show the notification
        setNotificationVisible(true);
        
        // Set timeout to hide this notification after 5 seconds
        notificationTimeoutRef.current = setTimeout(() => {
          setNotificationVisible(false);
          
          // Remove from queue after animation completes
          setTimeout(() => {
            setNotifications(prev => {
              if (prev.length <= 1) return [];
              
              // Remove the current notification and prepare the next one
              const remaining = prev.slice(1);
              
              // If there are more notifications, show the next one
              if (remaining.length > 0) {
                // Small delay before showing next notification
                setTimeout(() => {
                  setNotificationVisible(true);
                  
                  // Set timeout to hide the next notification
                  notificationTimeoutRef.current = setTimeout(() => {
                    setNotificationVisible(false);
                  }, 5000);
                }, 50);
              }
              
              return remaining;
            });
          }, 200); // shorter transition duration for better responsiveness
        }, 5000); // Set to 5 seconds for proper notification display time
      }, 100); // Short delay, just enough for the hide animation to start
    }, [user?.settings?.sound]);

    // Handle edit profile functionality
    const handleEditProfile = async (formData) => {
        setIsUpdatingProfile(true);
        
        try {
            let dataToSend;
            if (formData instanceof FormData) {
                dataToSend = formData;
            } else {
                dataToSend = new FormData();
                for (const key in formData) {
                    dataToSend.append(key, formData[key]);
                }
            }

            const hasProfileImage = dataToSend.has('profileImage') && dataToSend.get('profileImage') instanceof File;
            
            const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
            const endpoint = hasProfileImage 
                ? `${API_URL}/update-profile-image` 
                : `${API_URL}/update-profile`;
                
            console.log('Sending profile update to:', endpoint);
            console.log('Has profile image:', hasProfileImage);
            if (hasProfileImage) {
                const file = dataToSend.get('profileImage');
                console.log('Profile image details:', {
                    name: file.name,
                    type: file.type,
                    size: file.size
                });
            }
                
            const response = await fetch(endpoint, {
                method: 'PUT',
                credentials: 'include',
                body: dataToSend
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Profile update failed:', errorData);
                throw new Error(errorData.message || 'Failed to update profile');
            }

            const data = await response.json();
            console.log('Profile update successful:', data);

            setUser(prev => ({
                ...prev,
                ...data.user
            }));

            // Refresh user data after profile update
            refreshUser();

        } catch (error) {
            console.error('Error updating profile:', error);
            throw error;
        } finally {
            setIsUpdatingProfile(false);
        }
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

          <div className={styles.logoutButtonWrapper}>
            <button 
              className={styles.logoutButton}
              onClick={() => setShowLogoutConfirm(true)}
              title="Logout"
            >
              <LogOut size={24} />
              <span className={styles.buttonLabel}>Logout</span>
            </button>
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
                <button 
                  className={styles.settingsItem}
                  onClick={() => setShowEditProfile(true)}
                >
                  <div className={styles.settingsLabel}>
                    <User size={20} className={styles.settingsIcon} />
                    <span>Profile Settings</span>
                  </div>
                  <span className={styles.settingsValue}>Edit</span>
                </button>
                
                <button 
                  className={styles.settingsItem}
                  onClick={toggleNotifications}
                >
                  <div className={styles.settingsLabel}>
                    <Bell size={20} className={styles.settingsIcon} />
                    <span>Notifications</span>
                  </div>
                  <span className={styles.settingsValue}>
                    {user?.settings?.notifications ? 'On' : 'Off'}
                  </span>
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
                
                <button 
                  className={styles.settingsItem}
                  onClick={toggleSound}
                >
                  <div className={styles.settingsLabel}>
                    <span className={styles.settingsIcon}>🔊</span>
                    <span>Notification Sound</span>
                  </div>
                  <span className={styles.settingsValue}>
                    {user?.settings?.sound ? 'On' : 'Off'}
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
              isDataLoading={isDataLoading}
              initialLoadComplete={initialLoadComplete}
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
              <button 
                className={`${styles.mobileNavButton} ${styles.logoutMobileButton}`}
                onClick={() => setShowLogoutConfirm(true)}
              >
                <LogOut size={24} />
              </button>
            </div>
          )}
        </main>
        
        {/* Global VideoCall Component - Positioned outside the main content to avoid layout issues */}
        {showGlobalCallUI && (
            <VideoCall
                isOpen={showGlobalCallUI}
                onClose={handleGlobalEndCall}
                isIncoming={isIncomingCall}
                caller={isIncomingCall ? {
                    uid: callInfo?.callerId,
                    name: callInfo?.callerName,
                    profilepicture: callInfo?.callerProfilePic || '/default-avatar.png'
                } : null}
                callee={!isIncomingCall ? talkingToUser : null}
                onAccept={handleGlobalAcceptCall}
                onReject={handleGlobalRejectCall}
                socket={socket}
                localUser={user}
                callType={callType}
                onUiModeChange={handleCallUiModeChange}
                isDarkMode={isDarkMode}
            />
        )}
        
        {/* Moved logout confirmation dialog outside of nav to be centered on whole screen */}
        {showLogoutConfirm && (
          <div className={styles.confirmOverlay}>
            <div className={styles.confirmDialog}>
              <h3>Confirm Logout</h3>
              <p>Are you sure you want to logout?</p>
              <div className={styles.confirmButtons}>
                <button 
                  className={styles.cancelButton}
                  onClick={() => setShowLogoutConfirm(false)}
                >
                  Cancel
                </button>
                <button 
                  className={styles.confirmButton}
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Notification Component */}
        {notifications.length > 0 && (
          <div className={`${styles.notificationContainer} ${isDarkMode ? styles.darkTheme : ''}`}>
            <div 
              className={`${styles.notification} ${!notificationVisible ? styles.hide : ''}`}
              onClick={() => {
                // Handle notification click - navigate to the chat if needed
                if (!notifications[0]) return;
                
                const senderId = notifications[0].senderId;
                const chatId = generateChatId(user.uid, senderId);
                
                if (ismobile) {
                  setActiveSection('chatSection');
                }
                
                // Find the chat and open it
                const chat = user.chats?.find(c => c.chatid === chatId);
                if (chat) {
                  handleUserChatClick(chat.userid, chat.chatid, user);
                }
                
                // Clear any existing timeouts
                if (notificationTimeoutRef.current) {
                  clearTimeout(notificationTimeoutRef.current);
                  notificationTimeoutRef.current = null;
                }
                
                // Hide notification immediately
                setNotificationVisible(false);
                
                // Clear current notification and prepare the next one after animation completes
                setTimeout(() => {
                  setNotifications(prev => {
                    if (prev.length <= 1) return [];
                    
                    const remaining = prev.slice(1);
                    
                    // If there are more notifications, prepare to show the next one
                    if (remaining.length > 0) {
                      setTimeout(() => {
                        setNotificationVisible(true);
                        
                        // Set timeout to auto-hide after 5 seconds
                        notificationTimeoutRef.current = setTimeout(() => {
                          setNotificationVisible(false);
                        }, 5000);
                      }, 50); // Short delay
                    }
                    
                    return remaining;
                  });
                }, 200); // Shorter transition for better UX
              }}
            >
              <img 
                src={notifications[0]?.senderPic || "/default-avatar.png"} 
                alt={notifications[0]?.senderName || "User"} 
                className={styles.notificationAvatar} 
              />
              <div className={styles.notificationContent}>
                <div className={styles.notificationSender}>
                  {notifications[0]?.senderName || "New message"}
                </div>
                <div className={styles.notificationMessage}>
                  {notifications[0]?.message || "You have a new message"}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {showEditProfile && (
          <EditProfileModal
            user={user}
            onClose={() => setShowEditProfile(false)}
            onSave={handleEditProfile}
          />
        )}
        
      </div>
    );
}

export default ChatApp;