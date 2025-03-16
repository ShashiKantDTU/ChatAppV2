import React, { useState, useEffect, useContext, useRef } from 'react';
import { CheckIcon, StarIcon, SmileIcon, ThumbsUpIcon, HeartIcon, Trash2Icon } from "lucide-react";
import formatChatTime from '../../../scripts/converttime';
import styles from './message.module.css';
import { AuthContext } from '../authcontext/authcontext';
import EmojiPicker from 'emoji-picker-react';

const Message = ({ message, userdata, onReactionAdd, onDeleteMessage }) => {
  const isSent = message.recieverid === userdata.uid;
  const timestamp = message.sent.sentat ? formatChatTime(message.sent.sentat) : "N/A";
  const [animate, setAnimate] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const { user, setUser } = useContext(AuthContext);
  const [showOptions, setShowOptions] = useState(false);
  const messageRef = useRef(null);
  const [pickerPosition, setPickerPosition] = useState({ top: 0 });

  // Common emoji reactions (still used for displaying reactions in bubbles)
  const commonReactions = {
    '👍': 'thumbs_up',
    '❤️': 'heart',
    '😂': 'joy',
    '😮': 'wow',
    '😢': 'sad',
    '😡': 'angry',
    '👏': 'clap',
    '🔥': 'fire',
    '🤔': 'thinking',
    '🎉': 'party'
  };

  // Map emoji unified codes to reaction types for backward compatibility
  const emojiToReactionType = (unified) => {
    // Convert emoji unified code to actual emoji
    const emoji = String.fromCodePoint(
      ...unified.split('-').map(u => parseInt(u, 16))
    );
    
    // Return predefined type if it exists, or use emoji as the type
    return commonReactions[emoji] || unified;
  };

  // Check if current user has already reacted to this message
  const userExistingReaction = message.reactions &&
    message.reactions.find(reaction => reaction.userId === user.uid);

  useEffect(() => {
    setAnimate(true);
    return () => setAnimate(false);
  }, [message.id]);

  // Handle reaction click from emoji picker
  const handleEmojiClick = (emojiData) => {
    // Extract unified code from emoji data
    const reactionType = emojiToReactionType(emojiData.unified);
    
    if (onReactionAdd) {
      onReactionAdd(message._id, reactionType, user.uid, emojiData.emoji);
    }
    setShowReactionPicker(false);
  };

  // Toggle reaction picker
  const toggleReactionPicker = (e) => {
    e.stopPropagation();
    
    // Calculate picker position
    if (messageRef.current) {
      const rect = messageRef.current.getBoundingClientRect();
      setPickerPosition({ 
        top: isSent ? -320 : -320 // Position above the message
      });
    }
    
    setShowReactionPicker(!showReactionPicker);
  };
  
  // Toggle options menu
  const toggleOptions = (e) => {
    e.stopPropagation();
    setShowOptions(!showOptions);
  };
  
  // Close emoji picker on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showReactionPicker && messageRef.current && !messageRef.current.contains(event.target)) {
        setShowReactionPicker(false);
      }
      if (showOptions && messageRef.current && !messageRef.current.contains(event.target)) {
        setShowOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showReactionPicker, showOptions]);

  // Handle delete message
  const handleDelete = (e, deleteFor) => {
    e.stopPropagation();
    if (onDeleteMessage) {
      onDeleteMessage(message._id, deleteFor);
    }
    setShowOptions(false);
  };

  // Function to convert reaction type to displayed emoji
  const getEmojiFromReactionType = (type) => {
    // Try to find the emoji in our common reactions map (reversed)
    for (const [emoji, reactionType] of Object.entries(commonReactions)) {
      if (reactionType === type) {
        return emoji;
      }
    }
    
    // If not found in our map, try to convert unified code back to emoji
    try {
      if (type.includes('-')) {
        return String.fromCodePoint(
          ...type.split('-').map(u => parseInt(u, 16))
        );
      }
    } catch (error) {
      console.error('Error converting reaction type to emoji:', error);
    }
    
    // Fallback to the reaction type itself or a default emoji
    return type || '👍';
  };

  // Check if message is deleted
  const isDeletedForEveryone = message.deletedby !== null;
  const isDeletedForCurrentUser = message.deletedfor && message.deletedfor.includes(user.uid);
  const isDeleted = isDeletedForEveryone || isDeletedForCurrentUser;

  // Determine if current user can delete the message
  const canDelete = message.senderid === user.uid;

  return (
    <div 
      ref={messageRef}
      className={`${styles.messageContainer} ${isSent ? styles.sent : styles.received} ${animate ? styles.animate : ''}`}
    >
      {/* Only show avatar for received messages */}
      {!isSent && (
        <img 
          src={userdata.profilepicture} 
          alt={userdata.name} 
          className={styles.userAvatar} 
        />
      )}

      <div className={styles.bubbleWrapper}>
        {/* Add the reaction button for sent messages before the bubble */}
        {isSent && !isDeleted && (
          <div className={styles.reactionButton}>
            <button 
              onClick={toggleReactionPicker}
              className={styles.reactionIcon}
              aria-label="Add reaction"
            >
              <SmileIcon size={16} />
            </button>
          </div>
        )}

        <div 
          className={`${styles.messageBubble} ${isSent ? styles.sentBubble : styles.receivedBubble} ${isDeleted ? styles.deletedMessage : ''}`}
        >
          {/* Show delete icon and options for messages sent by current user */}
          {canDelete && !isDeleted && (
            <div className={styles.messageOptions}>
              <button 
                onClick={toggleOptions}
                className={styles.optionsButton}
                aria-label="Message options"
              >
                <Trash2Icon size={16} />
              </button>
              
              {showOptions && (
                <div className={styles.optionsMenu}>
                  <button 
                    onClick={(e) => handleDelete(e, 'me')}
                    className={styles.optionItem}
                  >
                    Delete for me
                  </button>
                  <button 
                    onClick={(e) => handleDelete(e, 'everyone')}
                    className={styles.optionItem}
                  >
                    Delete for everyone
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Show deleted message indicator if deleted */}
          {isDeleted ? (
            <p className={styles.deletedMessageText}>
              {isDeletedForEveryone ? "This message was deleted" : "You deleted this message"}
            </p>
          ) : (
            <>
              <div className={styles.messageContent}>
                <p className={styles.messageText}>{message.messagetext}</p>
                <div className={styles.messageMeta}>
                  <span className={styles.timestamp}>
                    {timestamp}
                  </span>
                  {isSent && (
                    <span className={styles.deliveryStatus}>
                      {message.delivered.isdelivered ? (
                        <>
                          <CheckIcon size={14} color={message.read.isread ? '#76b5c5' : 'white'} className={`${styles.deliveryIcon} ${styles.delivered} ${styles.first}`} />
                          <CheckIcon size={14} color={message.read.isread ? '#76b5c5' : 'white'} className={`${styles.deliveryIcon} ${styles.delivered} ${styles.second}`} />
                        </>
                      ) : (
                        <CheckIcon size={14} className={`${styles.deliveryIcon} ${styles.pending}`} />
                      )}
                    </span>
                  )}
                </div>
              </div>
              <div className={styles.messageDecoration}></div>
            </>
          )}

          {/* Display message reactions */}
          {message.reactions && message.reactions.length > 0 && (
            <div className={styles.reactionsContainer}>
              {Object.entries(
                message.reactions.reduce((acc, reaction) => {
                  acc[reaction.type] = {
                    count: (acc[reaction.type]?.count || 0) + 1,
                    emoji: reaction.emoji || getEmojiFromReactionType(reaction.type)
                  };
                  return acc;
                }, {})
              ).map(([type, data]) => (
                <div key={type} className={styles.reactionBadge}>
                  <span className={styles.emojiIcon}>{data.emoji}</span>
                  <span className={styles.reactionCount}>{data.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Show emoji picker */}
        {showReactionPicker && (
          <div 
            className={styles.emojiPickerContainer}
            style={{ 
              [isSent ? 'right' : 'left']: 0,
              top: `${pickerPosition.top}px`
            }}
          >
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              width={280}
              height={300}
              previewConfig={{ showPreview: false }}
              searchDisabled={false}
              skinTonesDisabled={true}
              autoFocusSearch={false}
            />
          </div>
        )}

        {/* Add the reaction button for received messages after the bubble */}
        {!isSent && !isDeleted && (
          <div className={styles.reactionButton}>
            <button 
              onClick={toggleReactionPicker}
              className={styles.reactionIcon}
              aria-label="Add reaction"
            >
              <SmileIcon size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Message;
