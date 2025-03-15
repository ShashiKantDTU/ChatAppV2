import React from 'react';
import styles from './message.module.css';

const TypingIndicator = ({ userdata }) => {
  return (
    <div className={`${styles.messageContainer} ${styles.received}`}>
      {/* User avatar */}
      <img
        src={userdata.profilepicture}
        alt="User Avatar"
        className={styles.userAvatar}
      />
      
      <div className={`${styles.messageBubble} ${styles.receivedBubble} ${styles.typingBubble}`}>
        <div className={styles.typingIndicator}>
          <span className={styles.typingDot}></span>
          <span className={styles.typingDot}></span>
          <span className={styles.typingDot}></span>
        </div>
      </div>
      
      {/* No reaction button for typing indicator */}
    </div>
  );
};

export default TypingIndicator;
