// Message.jsx
import React, { useState, useEffect } from 'react';
import { CheckIcon, StarIcon, SmileIcon, ThumbsUpIcon, HeartIcon } from "lucide-react";
import formatChatTime from '../../../scripts/converttime';
import styles from './message.module.css';
import { useContext } from 'react';
import { AuthContext } from '../authcontext/authcontext';
import TypingIndicator from './typingindicator';

const Message = ({ message, userdata, onReactionAdd }) => {
  const isSent = message.recieverid === userdata.uid;
  const timestamp = message.sent.sentat ? formatChatTime(message.sent.sentat) : "N/A";
  const [animate, setAnimate] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const { user, setUser } = useContext(AuthContext);
  const [showOptions, setShowOptions] = useState(false);

  // Available reactions
  const reactions = [
    { icon: <ThumbsUpIcon size={16} color='black' />, type: 'like' },
    { icon: <HeartIcon size={16} color='black' />, type: 'love' },
    { icon: <SmileIcon size={16} color='black' />, type: 'smile' },
    { icon: <StarIcon size={16} color='black' />, type: 'star' }
  ];

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

  // Toggle reaction picker
  const toggleReactionPicker = () => {
    setShowReactionPicker(!showReactionPicker);
  };

  // Check if message is deleted for current user
  const isDeletedForCurrentUser = message.deletedfor && 
    message.deletedfor.includes(currentUserId);
  
  // Function to toggle options menu
  const toggleOptions = () => {
    setShowOptions(prev => !prev);
  };
  
  // Function to handle delete
  const handleDelete = () => {
    onDeleteMessage(message._id);
    setShowOptions(false);
  };

  return (
    <div className={`${styles.messageContainer} ${isSent ? styles.sent : styles.received} ${animate ? styles.animate : ''}`}>
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
            onClick={toggleReactionPicker}
          >
            {userExistingReaction 
              ? reactions.find(r => r.type === userExistingReaction.type)?.icon 
              : <SmileIcon size={16} className={styles.reactionIcon} />}
          </div>
          
          {showReactionPicker && (
            <div className={styles.reactionPicker}>
              {reactions.map((reaction, index) => (
                <div 
                  key={index} 
                  className={`${styles.reactionOption} ${
                    userExistingReaction && userExistingReaction.type === reaction.type 
                      ? styles.selectedReaction 
                      : ''
                  }`}
                  onClick={() => handleReactionClick(reaction.type)}
                >
                  {reaction.icon}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      <div className={`${styles.messageBubble} ${isSent ? styles.sentBubble : styles.receivedBubble}`}>
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
                    <CheckIcon size={14} className={`${styles.deliveryIcon} ${styles.delivered} ${styles.first}`} />
                    <CheckIcon size={14} className={`${styles.deliveryIcon} ${styles.delivered} ${styles.second}`} />
                  </>
                ) : (
                  <CheckIcon size={14} className={`${styles.deliveryIcon} ${styles.pending}`} />
                )}
              </span>
            )}
          </div>
        </div>
        
        <div className={styles.messageDecoration}></div>
        
        {/* Display message reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className={styles.reactionsContainer}>
            {Object.entries(
              message.reactions.reduce((acc, reaction) => {
                acc[reaction.type] = (acc[reaction.type] || 0) + 1;
                return acc;
              }, {})
            ).map(([type, count]) => (
              <div key={type} className={styles.reactionBadge}>
                {reactions.find(r => r.type === type)?.icon}
                <span className={styles.reactionCount}>{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* For received messages, reaction button comes after the message */}
      {!isSent && (
        <div className={styles.messageReaction}>
          <div 
            className={`${styles.reactionButton} ${userExistingReaction ? styles.activeReaction : ''}`}
            onClick={toggleReactionPicker}
          >
            {userExistingReaction 
              ? reactions.find(r => r.type === userExistingReaction.type)?.icon 
              : <SmileIcon size={16} className={styles.reactionIcon} />}
          </div>
          
          {showReactionPicker && (
            <div className={`${styles.reactionPicker} ${styles.rightAligned}`}>
              {reactions.map((reaction, index) => (
                <div 
                  key={index} 
                  className={`${styles.reactionOption} ${
                    userExistingReaction && userExistingReaction.type === reaction.type 
                      ? styles.selectedReaction 
                      : ''
                  }`}
                  onClick={() => handleReactionClick(reaction.type)}
                >
                  {reaction.icon}
                </div>
              ))}
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
