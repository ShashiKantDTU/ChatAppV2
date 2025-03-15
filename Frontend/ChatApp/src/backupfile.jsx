import { useEffect, useState, useContext, useRef } from 'react';
import styles from './ChatApp.module.css'; // Correct import for CSS Modules
import { Home, Search, SettingsIcon } from 'lucide-react'
import EmptyPage from './components/nochatpage';
import ChatWindow from './components/chatwindow/chatwindow';
import { io } from 'socket.io-client';
import { AuthContext } from './components/authcontext/authcontext';
import RecentChats from './components/recentchats';




function ChatApp() {
    //   fetch self user data from server
    const { user, setUser } = useContext(AuthContext);
    const [socket, setsocket] = useState(null);
    const [talkingtouser, settalkuser] = useState(null);
    const [inputvalue, setinputvalue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const typingTimer = useRef(null);
    // VARIABLE TO STORE SEARCH DIV STATE
    const [searchdiv, setsearchdiv] = useState(false);

    console.log("run code");
    // console.log(user) , user;

    // Establish socket connection
    useEffect(() => {
        const newSocket = io("http://localhost:3000");
        setsocket(newSocket);

        return () => newSocket.disconnect(); // Cleanup on unmount
    }, []);
    // FUNCTION TO FETCH USER DATA FROM SERVER
    function fetchuser(uid) {
        return new Promise((resolve, reject) => {
            socket.emit('request user', uid);
            console.log('Requesting user data');

            socket.once('send user', (user) => {
                if (!user) {
                    alert('User not found');
                    reject('User not found');
                } else {
                    console.log('User data received:', user);
                    resolve(user);
                }
            });
        });
    }

    // FUNCTION TO REFRESH AND UPDATE ALL DATA USER AND CHATS 
    const refreshUser = async () => {
        console.log('Refreshing user data');
        console.log('User:', user);
        try {
            setTimeout(async () => {
            const updateduser = await fetchuser(user.uid);
            setUser((prev) => ({ ...prev, ...updateduser }));

            }, 1000); // 1 second delay
        } catch (error) {
            console.error('Error:', error);
        }
    };

        // UPDATES MESSAGE IN CHAT WINDOW 
        const UpdateMessageInChat =  (updatedmessage) => {
            console.log('Message update fucntion called', updatedmessage);
            if(!socket) {
                alert('No internet connection');
                return;
            }
            
            settalkuser((prev) => {
                if (!prev || !prev.messages){ 
                    console.log('No messages found');
                    return prev;} // Prevent potential errors
            
                return {
                    ...prev,
                    messages: prev.messages.map((msg) =>
                        msg._id.toString() === updatedmessage._id.toString() ? updatedmessage : msg
                    )
                };
            });
            
            
        }



    function genratechatid(uid1, uid2) {
        const sortedid = [uid1, uid2].sort();
        return sortedid[0] + sortedid[1];
    }


    // console.log(user)
    // Attach event listeners once `socket` is initialized
    // THIS GETTING PROCESSED :-
    // ATTACHING EVENT LISTENERS & EMIT TO SOCKET
    // 1. CONNECT
    // 2. EMIT REGISTER SOCKET
    // 3. YOUR DETAILS
    // 4. DISCONNECT
    // 5. PRIVATE MESSAGE

    useEffect(() => {
        if (!socket) return;
    
        // REGISTER USER SOCKET WHEN CONNECTED (MOVE OUTSIDE OF "connect" LISTENER)
        socket.emit('registersocket', user.email);
    
        socket.on("connect", () => {
            console.log("Connected to server");
        });
    
        socket.on("disconnect", () => {
            console.log("Disconnected from server");
            alert("Disconnected from server, please refresh the page.");
        });
    
        // LISTEN FOR USER DETAILS FROM SERVER
        socket.off("YourDetails"); // Avoid duplicates
        socket.on("YourDetails", (user) => {
            setUser((prev) => ({ ...prev, ...user }));
        });
    
        // HANDLE INCOMING PRIVATE MESSAGE
        socket.off("private message"); // Avoid duplicates
        socket.on("private message", (message) => {
            // console.log("Message received", message);
            if(talkingtouser){console.log('Talking to user:', talkingtouser);
                if(message.senderid === talkingtouser.uid) {
                    settalkuser((prev) => {
                        if (!prev) return prev;
                        return {
                            ...prev,
                            messages: [...prev.messages, message]
                        };
                    });
                }}
            
            // SEND DELIVERY CONFIRMATION BACK TO SERVER
            const modifiedmessage = {
                ...message,
                delivered: { isdelivered: true, deliveredat: new Date() }
            };
            // THIS WILL EMIT MESSAGE RECIEVE CONFIRMATION TO SERVER AND USED TO UPDATE LAST CHAT OF USER IN RECENT CHATS
            
            socket.emit("private message recieve confirmation", modifiedmessage);
            refreshUser();
            
        });
        
        // HANDLE MESSAGE DELIVERY CONFIRMATION FROM SERVER
        socket.off("private message recieve confirmation from server"); // Avoid duplicates
        socket.on("private message recieve confirmation from server", (updatedmessage) => {
            settalkuser((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    messages: prev.messages.map((msg) =>
                        msg._id === updatedmessage._id ? updatedmessage : msg
                    )
                };
            });
        });
    
        // HANDLE SENT MESSAGE CONFIRMATION FROM SERVER
        socket.off("private message sent confirmation"); // Avoid duplicates
        socket.on("private message sent confirmation", (updatedmessage) => {
            console.log("Message sent confirmation received");
    
            settalkuser((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    messages: [...prev.messages, updatedmessage]
                };
            });
        });

        // LISTEN FOR CHANGES TO ANY MESSAGE ON MESSAGE UPDATES CHANNEL AND UPDATE MESSAGE IN CHAT WINDOW
        socket.on("private message update from server", (updatedmessage) => {
            console.log('Message updated recieved:', updatedmessage);
            UpdateMessageInChat(updatedmessage);
        }
        );

        // Listen for when other user starts typing
      socket.on('typing-start', (data) => {
 
        
        if (data.receiverId === user.uid) {
          setIsTyping(true);
        }
      });
      
      // Listen for when other user stops typing
      socket.on('typing-stop', (data) => {
        console.log('Typing start:', data);
       
        if (data.receiverId === user.uid) {
          setIsTyping(false);
        }
      });

        
    
        // CLEANUP FUNCTION
        return () => {
            if (socket) {
                socket.off("connect");
                socket.off("disconnect");
                socket.off("YourDetails");
                socket.off("private message");
                socket.off("private message recieve confirmation from server");
                socket.off("private message sent confirmation");
                socket.off('private message update from server');
                socket.off('typing-start');
                socket.off('typing-stop');
            }
        };

        // LISTEN FOR CHANGES TO ANY MESSAGE ON MESSAGE UPDATES CHANNEL AND UPDATE MESSAGE IN CHAT WINDOW



    }, [socket]); // Runs only when `socket` changes
    


    // HANDLE REACTION ADD AND EMITS UPDATED MESSAGE TO SERVER A FUNCTION USED IN MESSAGE.JSX TO HANDLE REACTION ADD
    const handleReactionAdd = (messageId, reactionType, userId) => {
        const updatedMessage = talkingtouser.messages.map(message => {

          if (message._id === messageId) {
            // Filter out any existing reaction from this user
            console.log('Message:', messageId);
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


        }).find(message => message._id === messageId);

        socket.emit('private message update', updatedMessage);
        console.log('Updated message for emit:', updatedMessage);
        // UPDATES MESSAGE IN CHAT WINDOW
        UpdateMessageInChat(updatedMessage);
      };
      
    



    // Handle user selection
    // HERE A FUNCTION IS CREATED TO HANDLE USER SELECTION
    // 1. FETCH RECIEVE USER DATA FROM SERVER
    // 2. SETTING TALK USER AND PASSING DATA TO CHAT WINDOW
    const handleuserselect = (e) => {
        e.preventDefault();
        const uid = inputvalue;
        console.log('input', uid);
        handleuserchatclick(uid,'',user);
    };
  
    const handleuserchatclick = async (uid,chatid, loggeduser) => {
   
        
        
            // function recieveruid(chatid) {
                if (!uid || uid === '') {
                    // function recieveruid(chatid) {
                    let id1 = chatid.slice(0, 4);
                    let id2 = chatid.slice(4, 8);
                    if (id1 === loggeduser.uid) {
                        uid= id2;
                    } else {
                        uid = id1;
                    }
                }
        

        const reciever = {
            name: 'Unable to fetch',
            uid: uid,
            onlinestatus: { online: false, lastSeen: 'long ago' },
            profilepicture: '',
            messages: []
        };
        
        function fetchchats(chatid) {
            return new Promise((resolve) => {
                socket.emit('fetch chats', chatid);
                console.log('Emitted fetch chats');
    
                // Listen only once per call
                socket.once('send chats', (chatobject) => {
                    console.log('Chat object received:', chatobject);
                    resolve(chatobject);
                });
            });
        }
        
        
    
        try {
            const user = await fetchuser(uid);
            const chatid = await genratechatid(loggeduser.uid, uid);
            const messages = await fetchchats(chatid);
            console.log('user:', user);
            console.log('UID:', uid);
            console.log('Chatid:', chatid);

            const updatedUser = {
                ...reciever,
                name: user.name,
                onlinestatus: user.onlinestatus,
                profilepicture: user.profilepicture,
                messages: messages,
            };
            console.log('setting talk user:', updatedUser);
            settalkuser((prevUser) => ({ ...prevUser, ...updatedUser }));
    
        } catch (error) {
            console.error('Error:', error);
        }
    };
    

    // HANDLE USER TYPING STATUS
    // HERE A FUNCTION IS CREATED TO HANDLE USER TYPING STATUS
    // will be passed into chatwindow component
     // Emit typing events
  const handleusertyping = (e) => {
    
    if (e.target.value.length > 0 && !isTyping) {
    //   setIsTyping(true);
      socket.emit('typing-start', { receiverId: talkingtouser.uid });
    }

    // ✅ Fix: Use useRef instead of undefined variable
    if (typingTimer.current) {
      clearTimeout(typingTimer.current);
    }

    typingTimer.current = setTimeout(() => {
    //   setIsTyping(false);
      socket.emit('typing-stop', { receiverId: talkingtouser.uid });
    }, 1500); // 1.5 seconds after user stops typing
  };




    // Handle sending messages
    // HERE A FUNCTION IS CREATED TO HANDLE SENDING MESSAGES
    // 1. EMIT PRIVATE MESSAGE
    // 2. UPDATE CHAT WINDOW WITH NEW MESSAGE RECIEVED WITH MESSAGEID RECIEVED FROM SERVER


   // FUNCTION TO SEND MESSAGE
   const handlesend = (message) => {
    if (!socket) {
        console.error("Socket is not connected yet.");
        return;
    }

    const chatid = genratechatid(user.uid, talkingtouser.uid);

    const newmessage = {
        chatid: chatid,
        senderid: user.uid,
        recieverid: talkingtouser.uid,
        groupid: null,
        messagetext: message,
        sent: { issent: false, sentat: new Date() },
        delivered: { isdelivered: false, deliveredat: null },
        read: { isread: false, readat: null },
        deletedfor: [],
        deletedby: null,
        createdat: new Date()
    };

    // UPDATE USER CHATS WITH NEW MESSAGE
    // CHECK IF USER HAS THIS CHAT ALREADY
    console.log('User:', user);
    const isexistingchat = user.chats.find((chat) => chat.chatid === chatid);
    console.log('Existing chat:', isexistingchat);
    let newchatarray = [];
    if (isexistingchat) {
         newchatarray = user.chats.map((chat) => {
            if(chatid === chat.chatid){
                chat = {
                    ...chat,
                    lastmessage: message,
                    updatedat: new Date(),
                    unread: false
                }
                return chat;
            }
            return chat;
        })
        // UPDATE USER CHATS IN RECENT CHATS    

        setUser((prev) => ({ ...prev, chats: newchatarray }));
    }else{
        // ADD NEW CHAT TO USER CHATS
        const newchat = {
            typeofchat: 'private',
            recievername: talkingtouser.name,
            chatid: chatid,
            userid: talkingtouser.uid,
            lastmessage: message,
            updatedat: new Date(),
            chatimage: talkingtouser.profilepicture,
            unread: false
        };
        newchatarray.push(newchat);
        setUser((prev) => ({ ...prev, chats: [...prev.chats, newchat] }));
    }
    console.log(' Updated user chats:', newchatarray);
    socket.emit("private message", { newmessage: newmessage, chats: newchatarray });

};

    // check if confirmation message is received to client and then continue tommorow



    const handlesearchbtn = () => {
        setsearchdiv(!searchdiv);
    }

    const handlehomebtn = () => {
        setsearchdiv(false);
    }


    return <>
        <div className={styles.main}>
            <div className={styles.panel}>
                <button className={styles.panelbtns}>
                    <Home onClick={handlehomebtn} size={34} color='white' />
                </button>
                <button onClick={handlesearchbtn} className={styles.panelbtns}>
                    <Search size={34} color='white' />
                </button>
                <button className='panelbtns'>
                    <SettingsIcon size={34} color='white' />
                </button>
            </div>

            <div className={styles.searchdiv} style={{ width: searchdiv ? '400px' : '0', opacity: searchdiv ? '1' : '0' }}>
                <div className={styles.searchdivcontent}>
                    <h2>Search for a user</h2>
                    <form onSubmit={handleuserselect}>

                        <input type="text" value={inputvalue} onChange={(e) => { setinputvalue(e.target.value) }} placeholder="Search" />
                        <button type="submit">Search
                        </button>

                    </form>
                </div>
            </div>

            <div className={styles.aside} style={{ width: searchdiv ? '0' : '400px', opacity: searchdiv ? '0' : '1' }}>
                <div className={styles.asidecontent}>
                    {/* FETCHED USER DATA FROM SERVER 
                        USER IN THIS FORMAT
                            {user }
                        {
                        "email": "test@mail.com",
                        "username": "test",
                        "_id": "67be37d67698defeb8b251a2",
                        "password": "$2b$10$JddZwZv23eKBYBLXGOXAuulmVDKxz5xmgr.mMTkCgB.KCXZdn2FSa",
                        "profilepicture": "https://api.dicebear.com/7.x/bottts/svg?seed=F7L6",
                        "role": "user",
                        "onlinestatus": false,
                        "uid": "F7L6",
                        "__v": 0,
                        "socketid": "QRLvxpRaFk2F0g6-AACX"
                    } */}

                    <div className={styles.recentchatscontainer}>
                        <RecentChats handlechatclick={handleuserchatclick} handlesearchbtn={handlesearchbtn} user={user} notifications={8} />
                    </div>


                </div>
            </div>

            <div className={styles.chat}>
                      
                {talkingtouser &&
                    <ChatWindow handlesend={handlesend} userdata={talkingtouser} isTyping={isTyping} handletyping={handleusertyping} onReactionAdd={handleReactionAdd} />
                }

                {!talkingtouser &&
                    <EmptyPage />
                }

            </div>

        </div>
    </>
}

export default ChatApp;