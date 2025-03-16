import { useEffect, useState, useRef, useCallback } from 'react';
import './chatwindow.css';
import { Phone, Video, Check, Send, X, Mic, Square, Play, Pause, Trash2, ArrowDown } from 'lucide-react';
import Message from './message';
import scrollToBottom from '../../../scripts/scrolltobottom';
import TypingIndicator from './typingindicator';
import formatChatTime from '../../../scripts/converttime';
import VoiceCall from '../voicecall/VoiceCall';

// Hook to force component re-render
const useForceUpdate = () => {
    const [, setTick] = useState(0);
    return useCallback(() => {
        setTick(tick => tick + 1);
    }, []);
};

const ChatWindow = (props) => {
    const [message, setMessage] = useState('');
    const [showVoiceCall, setShowVoiceCall] = useState(false);
    const [callType, setCallType] = useState('outgoing');
    const [incomingCallOffer, setIncomingCallOffer] = useState(null);
    const chatAreaRef = useRef(null);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [hasNewMessages, setHasNewMessages] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const previousMessagesLength = useRef(0);
    const isNearBottom = useRef(true);
    
    // Call the hook to get forceUpdate function
    const forceUpdate = useForceUpdate();

    // Render messages, typing indicators, and call UI
    const renderMessages = () => {
        const messages = [];
        if (props?.messages) {
            props.messages.forEach((msg, index) => {
                // Check if message is meant for current user
                if (msg.deletedfor && msg.deletedfor.includes(props.localUser.uid)) {
                    // Skip this message as it's deleted for the current user
                    return;
                }
                
                // Add the message component
                messages.push(
                    <Message
                        key={msg._id || `temp-${index}`}
                        message={msg}
                        userdata={props.userdata}
                        onReactionAdd={props.handleReactionAdd}
                        onDeleteMessage={props.handleDeleteMessage}
                    />
                );
            });
        }
        
        // Add typing indicator if user is typing
        if (props.isTyping) {
            messages.push(
                <TypingIndicator
                    key="typing-indicator"
                    userdata={props.userdata}
                />
            );
        }
        
        return messages;
    };

    // Function to handle scroll to see new messages
    const handleScrollToBottom = () => {
        scrollToBottom(chatAreaRef.current);
        setShowScrollButton(false);
        setHasNewMessages(false);
        setUnreadCount(0);
    };

    // Check if scroll position is near bottom
    const handleScroll = () => {
        if (chatAreaRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = chatAreaRef.current;
            const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
            
            // Consider "near bottom" if within 100px of the bottom
            isNearBottom.current = distanceFromBottom < 100;
            
            // Show scroll button only if not near bottom
            setShowScrollButton(!isNearBottom.current);
        }
    };

    // Handle chat area scroll
    useEffect(() => {
        const chatArea = chatAreaRef.current;
        if (chatArea) {
            chatArea.addEventListener('scroll', handleScroll);
            return () => chatArea.removeEventListener('scroll', handleScroll);
        }
    }, []);

    // Scroll to bottom on initial load or when messages change
    useEffect(() => {
        if (props.messages && props.messages.length > 0) {
            const chatArea = chatAreaRef.current;
            
            // Auto-scroll on first load
            if (previousMessagesLength.current === 0) {
                scrollToBottom(chatArea);
            } 
            // If near bottom, auto-scroll for any new message
            else if (isNearBottom.current) {
                scrollToBottom(chatArea);
            } 
            // If not near bottom and new messages arrived, show the button
            else if (props.messages.length > previousMessagesLength.current) {
                setHasNewMessages(true);
                setUnreadCount(prevCount => prevCount + (props.messages.length - previousMessagesLength.current));
            }
            
            // Update the previous length reference
            previousMessagesLength.current = props.messages.length;
        }
    }, [props.messages]);

    // Handle voice call
    useEffect(() => {
        if (props.incomingCall) {
            setIncomingCallOffer(props.incomingCall.offer);
            setCallType('incoming');
            setShowVoiceCall(true);
        }
    }, [props.incomingCall]);

    const startCall = () => {
        setCallType('outgoing');
        setShowVoiceCall(true);
    };

    // Cleanup function when component unmounts
    useEffect(() => {
        return () => {
            // Any cleanup needed
        };
    }, []);

    return (
        <div className="chat-window-container">
            <div className='headerarea'>
                <div className='nameheader'>
                    {props.userdata.profilepicture && (
                        <img
                            src={props.userdata.profilepicture}
                            className='chatavatar'
                            alt={props.userdata.name}
                        />
                    )}
                    <div className='user-info'>
                        <h3 className='chatname'>{props.userdata.name}</h3>
                        <span className='onlinestatus'>
                            {props.userdata.onlinestatus.online ? (
                                <span className='online-indicator'>Online</span>
                            ) : (
                                <span className='offline-indicator'>
                                    Last seen: {formatChatTime(props.userdata.onlinestatus.lastSeen)}
                                </span>
                            )}
                        </span>
                    </div>
                </div>
                <div className='actions'>
                    <button className='call-button' onClick={startCall}>
                        <Phone size={20} />
                    </button>
                    <button className='video-button'>
                        <Video size={20} />
                    </button>
                </div>
            </div>

            <div className='chatarea' ref={chatAreaRef}>
                {renderMessages()}
            </div>

            {/* Scroll to bottom button */}
            {showScrollButton && (
                <button
                    className={`scroll-to-bottom-btn ${hasNewMessages ? 'has-new-messages' : ''}`}
                    onClick={handleScrollToBottom}
                >
                    {hasNewMessages ? (
                        <div className="new-messages-indicator">
                            <span>{unreadCount}</span>
                        </div>
                    ) : (
                        <ArrowDown size={18} />
                    )}
                </button>
            )}

            <div className='inputarea'>
                <form className='inputarea-form' onSubmit={(e) => { e.preventDefault(); return false; }}>
                    <div className="input-buttons">
                        <button 
                            type='submit' 
                            onClick={() => {
                                if (message.trim()) {
                                    props.handlesend(message);
                                    setMessage('');
                                }
                            }}
                        >
                            <Send size={20} />
                        </button>
                    </div>

                    <input 
                        type='text' 
                        value={message} 
                        onChange={(e) => {
                            props.handletyping(e);
                            setMessage(e.target.value);
                        }}
                        placeholder='Type a message'
                    />
                </form>
            </div>

            {/* Voice Call UI */}
            {showVoiceCall && (
                <VoiceCall
                    type={callType}
                    remote={{
                        uid: props.userdata.uid,
                        name: props.userdata.name,
                        avatar: props.userdata.profilepicture
                    }}
                    local={{
                        uid: props.localUser.uid,
                        name: props.localUser.username
                    }}
                    offer={incomingCallOffer}
                    onClose={() => setShowVoiceCall(false)}
                    onCallUser={props.onCallUser}
                    onAnswerCall={props.onAnswerCall}
                    onSendIceCandidate={props.onSendIceCandidate} 
                    onEndCall={props.onEndCall}
                    onIceCandidate={props.onIceCandidate}
                    onCallAnswered={props.onCallAnswered}
                />
            )}
        </div>
    );
};

export default ChatWindow;