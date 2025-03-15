import React, { useState, useEffect, useContext, useRef } from 'react';
import { CheckIcon, StarIcon, SmileIcon, ThumbsUpIcon, HeartIcon, Trash2Icon, ImageIcon, VideoIcon, FileIcon, PlayIcon } from "lucide-react";
import formatChatTime from '../../../scripts/converttime';
import styles from './message.module.css';
import { AuthContext } from '../authcontext/authcontext';
import EmojiPicker from 'emoji-picker-react';

const Message = ({ message, userdata, onReactionAdd, onDeleteMessage, onMediaClick }) => {
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

  // Handle reaction click
  const handleReactionClick = (reactionType) => {
    if (onReactionAdd) {
      onReactionAdd(message._id, reactionType, user.uid);
    }
    setShowReactionPicker(false);
  };

  // Handle emoji selection from the emoji picker
  const handleEmojiClick = (emojiData) => {
    console.log('Emoji selected:', emojiData);
    
    // Map common emojis to their predefined reaction types for backward compatibility
    // This ensures the server gets the expected reaction type values
    const emojiMappings = {
      '1f44d': 'thumbs_up',      // 👍
      '2764-fe0f': 'heart',      // ❤️
      '1f602': 'joy',            // 😂
      '1f62e': 'wow',            // 😮
      '1f622': 'sad',            // 😢
      '1f621': 'angry',          // 😡
      '1f44f': 'clap',           // 👏
      '1f525': 'fire',           // 🔥
      '1f914': 'thinking',       // 🤔
      '1f389': 'party'           // 🎉
    };
    
    // Check if the emoji is one of our predefined ones (server expects specific values)
    const unifiedLower = emojiData.unified.toLowerCase();
    let reactionType;
    
    if (emojiMappings[unifiedLower]) {
      // Use the mapped value for common emojis
      reactionType = emojiMappings[unifiedLower];
      console.log('Using predefined reaction type:', reactionType);
    } else {
      // For other emojis, use the unified code
      reactionType = emojiData.unified;
      console.log('Using unified code as reaction type:', reactionType);
    }
    
    // Check if user has already used this reaction
    const hasExistingReaction = userExistingReaction && 
      (userExistingReaction.type === reactionType || 
       (reactionType === emojiMappings[userExistingReaction.type?.toLowerCase()]));
    
    if (hasExistingReaction) {
      // If the user clicks the same emoji again, remove the reaction
      console.log('Removing existing reaction:', reactionType);
      if (onReactionAdd) {
        // Pass null to indicate reaction removal
        onReactionAdd(message._id, null, user.uid);
      }
    } else {
      // Otherwise add the new reaction
      console.log('Adding new reaction:', reactionType);
      if (onReactionAdd) {
        onReactionAdd(message._id, reactionType, user.uid);
      }
    }
    
    setShowReactionPicker(false);
  };

  // Toggle reaction picker 
  const handleReactionButtonClick = (e) => {
    e.stopPropagation();
    
    // Calculate position before toggling
    if (!showReactionPicker && messageRef.current) {
      const rect = messageRef.current.getBoundingClientRect();
      
      // Calculate proper vertical position
      let topPosition = rect.top;
      
      // Check if the picker would go off the top of the screen
      if (topPosition < 20) {
        topPosition = 20; // Add some padding from the top
      }
      
      // Check if the picker would go off the bottom of the screen
      const viewportHeight = window.innerHeight;
      const pickerHeight = 400; // Approximate height of the picker
      
      if (topPosition + pickerHeight > viewportHeight) {
        topPosition = viewportHeight - pickerHeight - 20; // 20px padding from bottom
      }
      
      setPickerPosition({ 
        top: topPosition
      });
      
      console.log('Positioning picker at:', topPosition);
    }
    
    // Always toggle the reaction picker whether the user has an existing reaction or not
    toggleReactionPicker();
    
    // Add helpful log
    console.log('Toggling reaction picker, current state:', !showReactionPicker);
  };

  // Toggle reaction picker
  const toggleReactionPicker = () => {
    setShowReactionPicker(!showReactionPicker);
  };

  // Check if message is deleted for current user
  const isDeletedForCurrentUser = message.deletedfor &&
    message.deletedfor.includes(user.uid);

  // Toggle message options menu
  const toggleOptions = (e) => {
    if (e) e.preventDefault();
    setShowOptions(prev => !prev);
  };

  // Handle message deletion
  const handleDelete = (deleteType) => {
    console.log('handleDelete called with type:', deleteType);
    console.log('Message ID:', message._id);
    console.log('onDeleteMessage available:', !!onDeleteMessage);
    
    if (onDeleteMessage) {
      console.log('Calling onDeleteMessage...');
      onDeleteMessage(message._id, deleteType);
    } else {
      console.error('onDeleteMessage function is not provided!');
    }
    setShowOptions(false);
  };

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowOptions(false);
      setShowReactionPicker(false);
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const renderMediaContent = () => {
    if (!message.media) return null;

    switch (message.media.type) {
      case 'image':
        return (
          <div className={styles.mediaContainer}>
            <img 
              src={message.media.url} 
              alt={message.media.filename}
              className={styles.mediaImage}
              onClick={() => onMediaClick ? onMediaClick(message) : window.open(message.media.url, '_blank')}
            />
            <div className={styles.mediaInfo}>
              <span className={styles.mediaName}>{message.media.filename}</span>
              <span className={styles.mediaSize}>{(message.media.size / 1024).toFixed(2)} KB</span>
            </div>
          </div>
        );

      case 'video':
        return (
          <div className={styles.mediaContainer} onClick={() => onMediaClick ? onMediaClick(message) : null}>
            <div className={styles.videoWrapper}>
              <video 
                src={message.media.url}
                controls
                className={styles.mediaVideo}
                onClick={(e) => e.stopPropagation()}
              />
              <div className={styles.videoOverlay}>
                <PlayIcon size={24} />
              </div>
            </div>
            <div className={styles.mediaInfo}>
              <span className={styles.mediaName}>{message.media.filename}</span>
              <span className={styles.mediaSize}>{(message.media.size / 1024).toFixed(2)} KB</span>
            </div>
          </div>
        );

      case 'audio':
        return (
          <div className={styles.mediaContainer} onClick={() => onMediaClick ? onMediaClick(message) : null}>
            <div className={styles.audioWrapper}>
              <audio 
                src={message.media.url}
                controls
                className={styles.mediaAudio}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className={styles.mediaInfo}>
              <span className={styles.mediaName}>{message.media.filename}</span>
              <span className={styles.mediaSize}>{(message.media.size / 1024).toFixed(2)} KB</span>
            </div>
          </div>
        );

      case 'file':
        return (
          <div className={styles.mediaContainer} onClick={() => onMediaClick ? onMediaClick(message) : null}>
            <div className={styles.fileWrapper}>
              <FileIcon size={24} />
              <a 
                href={message.media.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className={styles.fileLink}
                onClick={(e) => e.stopPropagation()}
              >
                {message.media.filename}
              </a>
            </div>
            <div className={styles.mediaInfo}>
              <span className={styles.mediaSize}>{(message.media.size / 1024).toFixed(2)} KB</span>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Function to convert reaction type to displayed emoji
  const getEmojiFromReactionType = (reactionType) => {
    // Map common predefined reaction types to their emoji representations
    const reactionToEmoji = {
      'thumbs_up': '👍',
      'heart': '❤️',
      'joy': '😂',
      'wow': '😮',
      'sad': '😢',
      'angry': '😡',
      'clap': '👏',
      'fire': '🔥',
      'thinking': '🤔',
      'party': '🎉'
    };
    
    // If it's a predefined type, return its emoji
    if (reactionToEmoji[reactionType]) {
      return reactionToEmoji[reactionType];
    }
    
    // If it's a unified code, convert it to an emoji
    try {
      if (reactionType.includes('-')) {
        return String.fromCodePoint(...reactionType.split('-').map(u => parseInt(u, 16)));
      }
      // Try as a single code point
      return String.fromCodePoint(parseInt(reactionType, 16));
    } catch (error) {
      console.error('Error converting reaction type to emoji:', error);
      return '👍'; // Fallback
    }
  };

  // Handle click on a reaction badge
  const handleReactionBadgeClick = (emoji, reactionType) => {
    // Get the reaction type for this emoji
    const emojiToTypeMap = {
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
    
    // Find the reaction type for this emoji
    let reactionTypeToToggle = emojiToTypeMap[emoji] || reactionType;
    
    // Check if user already has this reaction
    const hasThisReaction = userExistingReaction && 
      userExistingReaction.type === reactionTypeToToggle;
    
    if (hasThisReaction) {
      // If user already has this reaction, remove it
      console.log('Removing reaction via badge click:', emoji);
      if (onReactionAdd) {
        onReactionAdd(message._id, null, user.uid);
      }
    } else {
      // Otherwise add this reaction
      console.log('Adding reaction via badge click:', emoji, reactionTypeToToggle);
      if (onReactionAdd) {
        onReactionAdd(message._id, reactionTypeToToggle, user.uid);
      }
    }
  };

  return (
    <div 
      className={`${styles.messageContainer} ${isSent ? styles.sent : styles.received} ${animate ? styles.animate : ''}`}
      onContextMenu={toggleOptions}
      ref={messageRef}
    >
      {/* For received messages, avatar comes first */}
      {!isSent && (
        <img
          src={userdata.profilepicture}
          alt="User Avatar"
          className={styles.userAvatar}
        />
      )}

      {/* For sent messages, reaction button comes before the message */}
      {isSent && (
        <div className={styles.messageReaction}>
          <div
            className={`${styles.reactionButton} ${userExistingReaction ? styles.activeReaction : ''}`}
            onClick={handleReactionButtonClick}
            >
            {userExistingReaction
              ? <span className={styles.selectedEmoji}>
                  {getEmojiFromReactionType(userExistingReaction.type)}
                </span>
              : <SmileIcon size={16} className={styles.reactionIcon} />}
            </div>
            {showReactionPicker && (
            <div 
              className={styles.reactionPicker} 
              style={{ top: pickerPosition.top }}
            >
              <div className={styles.reactionPickerContent}>
                {userExistingReaction && (
                  <div className={styles.removeReactionHeader}>
                    <div className={styles.currentReaction}>
                      <span className={styles.currentReactionEmoji}>
                        {getEmojiFromReactionType(userExistingReaction.type)}
                      </span>
                      <span className={styles.currentReactionText}>Your current reaction</span>
                    </div>
                    <button 
                      className={styles.removeReactionButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onReactionAdd) {
                          onReactionAdd(message._id, null, user.uid);
                        }
                        setShowReactionPicker(false);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )}
                <EmojiPicker 
                  onEmojiClick={handleEmojiClick}
                  searchPlaceHolder="Search emoji..."
                  width={300}
                  height={350}
                  previewConfig={{
                    showPreview: false
                  }}
                  skinTonesDisabled
                  lazyLoadEmojis
                />
              </div>
            </div>
            )}
            </div>
            )}

            <div className={`${styles.messageBubble} ${isSent ? styles.sentBubble : styles.receivedBubble}`}>
            {isDeletedForCurrentUser ? (
            <div 
              className={`${styles.messageContent} ${styles.deletedMessage}`} 
              data-deleted-by={
                message.deletedby === user.uid 
                  ? "current-user" 
                  : message.deletedby === userdata.uid 
                    ? "other-user" 
                    : "unknown"
              }
            >
              <p className={styles.messageText}>
                <em>
                  {message.deletedby === user.uid 
                    ? "You deleted this message" 
                    : message.deletedby === userdata.uid 
                      ? `${userdata.username || 'This user'} deleted this message`
                      : "This message was deleted"}
                </em>
              </p>
              <div className={styles.messageMeta}>
                <span className={styles.timestamp}>{timestamp}</span>
              </div>
            </div>
            ) : (
            <>
            <div className={styles.messageContent}>
              {message.messageType === 'text' ? (
                <p className={styles.messageText}>{message.messagetext}</p>
              ) : (
                renderMediaContent()
              )}
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
                // Get emoji representation for the reaction type
                const emoji = getEmojiFromReactionType(reaction.type);
                // Store the original reaction type with the emoji for reference
                if (!acc[emoji]) {
                  acc[emoji] = { count: 0, type: reaction.type };
                }
                acc[emoji].count += 1;
                return acc;
              }, {})
            ).map(([emoji, data]) => (
              <div 
                key={emoji} 
                className={`${styles.reactionBadge} ${
                  userExistingReaction && userExistingReaction.type === data.type 
                    ? styles.userReacted 
                    : ''
                }`}
                onClick={() => handleReactionBadgeClick(emoji, data.type)}
                title={userExistingReaction && userExistingReaction.type === data.type 
                  ? "Click to remove your reaction" 
                  : "Click to add this reaction"}
              >
                <span className={styles.reactionEmoji}>{emoji}</span>
                <span className={styles.reactionCount}>{data.count}</span>
              </div>
            ))}
          </div>
        )}

        {/* Show options menu with delete option - only visible for sent messages */}
        {showOptions && isSent && !isDeletedForCurrentUser && (
          <div className={styles.messageOptions} onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => handleDelete('for_me')} 
              className={styles.deleteButton}
            >
              <Trash2Icon size={14} />
              <span>Delete for me</span>
            </button>
            <button 
              onClick={() => handleDelete('for_everyone')} 
              className={`${styles.deleteButton} ${styles.deleteForEveryone}`}
            >
              <Trash2Icon size={14} />
              <span>Delete for everyone</span>
            </button>
          </div>
        )}
      </div>

      {/* For received messages, reaction button comes after the message */}
      {!isSent && (
        <div className={styles.messageReaction}>
          <div
            className={`${styles.reactionButton} ${userExistingReaction ? styles.activeReaction : ''}`}
            onClick={handleReactionButtonClick}
          >
            {userExistingReaction
              ? <span className={styles.selectedEmoji}>
                  {getEmojiFromReactionType(userExistingReaction.type)}
                </span>
              : <SmileIcon size={16} className={styles.reactionIcon} />}
          </div>
          {showReactionPicker && (
            <div 
              className={styles.reactionPicker}
              style={{ top: pickerPosition.top }}
            >
              <div className={styles.reactionPickerContent}>
                {userExistingReaction && (
                  <div className={styles.removeReactionHeader}>
                    <div className={styles.currentReaction}>
                      <span className={styles.currentReactionEmoji}>
                        {getEmojiFromReactionType(userExistingReaction.type)}
                      </span>
                      <span className={styles.currentReactionText}>Your current reaction</span>
                    </div>
                    <button 
                      className={styles.removeReactionButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onReactionAdd) {
                          onReactionAdd(message._id, null, user.uid);
                        }
                        setShowReactionPicker(false);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                )}
                <EmojiPicker 
                  onEmojiClick={handleEmojiClick}
                  searchPlaceHolder="Search emoji..."
                  width={300}
                  height={350}
                  previewConfig={{
                    showPreview: false
                  }}
                  skinTonesDisabled
                  lazyLoadEmojis
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* For sent messages, avatar comes last */}
      {isSent && (
        <img
          src={user.profilepicture}
          alt="User Avatar"
          className={styles.userAvatar}
        />
      )}
    </div>
  );
};

export default Message;
