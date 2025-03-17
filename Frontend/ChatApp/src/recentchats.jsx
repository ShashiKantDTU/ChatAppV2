import React, { useEffect, useState } from "react";
import styles from "./recentchats.module.css"; // Import CSS as a module
import ProfileHeader from "./profileheader";
import EditProfileModal from "./EditProfileModal";

// Enhanced Skeleton UI Component specifically for chat list loading
const ChatListSkeleton = () => {
  return (
    <div className={styles.chatList}>
      {[...Array(7)].map((_, index) => (
        <div className={styles.skeletonChatItem} key={`skeleton-${index}`}>
          <div className={styles.skeletonAvatar}></div>
          <div className={styles.skeletonContent}>
            <div className={styles.skeletonName}></div>
            <div className={styles.skeletonMessage}></div>
          </div>
          <div className={styles.skeletonTime}></div>
        </div>
      ))}
    </div>
  );
};

// Original full page skeleton for initial load
const ChatSkeleton = () => {
  return (
    <div className={styles.skeletonContainer}>
      <div className={styles.recentChatsHeader}>
        <div className={styles.skeletonHeaderText}></div>
        <div className={styles.skeletonButton}></div>
      </div>

      <div className={styles.searchContainer}>
        <div className={styles.skeletonSearch}></div>
      </div>

      <ChatListSkeleton />
    </div>
  );
};

const RecentChats = (props) => {
  const [user, setUser] = useState({}); // User object
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredChats, setFilteredChats] = useState([]);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, chatId: null });
  const [isLoading, setIsLoading] = useState(true);
  const [isChatsLoading, setIsChatsLoading] = useState(true);

  // Move the click outside handler useEffect here with other hooks
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu({ show: false, x: 0, y: 0, chatId: null });
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []); // Empty dependency array since we don't need any dependencies

  useEffect(() => {  
    setUser(prev => ({ ...prev, ...props.user }));
    // Set loading to false after a short delay to ensure UI is ready
    if (props.user) {
      setIsLoading(false);
      
      // Add a small delay for the chat list to simulate network load
      // This ensures the rest of the UI is visible while chats are "loading"
      if (props.user?.chats) {
        setTimeout(() => {
          setIsChatsLoading(false);
        }, 1000); // Simulated delay for chats loading
      }
    }
  }, [props.user]);

  useEffect(() => {
    if (user.chats) {
      setFilteredChats(
        user.chats.filter(chat => 
          chat.recievername.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }
  }, [searchQuery, user.chats]);

  const notifications = props.notifications; // Number of notifications

  // Show full skeleton loading state for initial load
  if (isLoading) {
    return (
      <>
        <ProfileHeader 
          user={{
            img: user.profilepicture,
            username: user.username || "Loading...",
            onlinestatus: user.onlinestatus?.status ? 'online' : 'offline',
            id: user.uid || "Loading..."
          }}
          notifications={notifications}
          onEditProfile={() => setShowEditProfile(true)}
        />
        <ChatSkeleton />
      </>
    );
  }

  const chats = user.chats; // Array of chat objects
  // console.log(chats)

  function copyCode() {
    const userId = document.getElementById('UID').textContent;
    navigator.clipboard.writeText(userId)
      .then(() => {
        alert("Code copied!");
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
        alert("Failed to copy code. Please try again.");
      });
  }

  const handleEditProfile = async (formData) => {
    setIsUpdating(true);
    console.log('formData' , formData)
    try {
      // Call the API endpoint to update profile
      const response = await fetch('http://localhost:3000/update-profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData)
        
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const data = await response.json();

      // Update local state
      setUser(prev => ({
        ...prev,
        ...data.user
      }));

      // Refresh user data after a short delay
      setTimeout(() => {
        props.refreshUser();
      }, 1000);

    } catch (error) {
      console.error('Error updating profile:', error);
      throw new Error('Failed to update profile');
    } finally {
      setIsUpdating(false);
    }
  };

  function formatChatTime(timestamp) {
    const now = new Date();
    const date = new Date(timestamp);
    const diffInSeconds = Math.floor((now - date) / 1000);
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInSeconds < 60) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    if (diffInHours < 24) return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
    if (diffInDays === 1) return "Yesterday";
    if (diffInDays < 7) return date.toLocaleDateString([], { weekday: "long" });
    if (now.getFullYear() === date.getFullYear()) return date.toLocaleDateString([], { month: "short", day: "numeric" });

    return date.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
  }
  
  const handleContextMenu = (e, chatId) => {
    e.preventDefault();
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      chatId: chatId
    });
  };

  const handleDeleteChat = (chatId) => {
    props.handleDeleteChat(chatId);
    setContextMenu({ show: false, x: 0, y: 0, chatId: null });
  };

  // Determine if we should show "no chats" message or skeleton while chats are loading
  const shouldShowNoChats = !isChatsLoading && (!filteredChats || filteredChats.length === 0) && !searchQuery;
  const shouldShowNoResults = !isChatsLoading && filteredChats.length === 0 && searchQuery;

  return (
    <>
      <ProfileHeader 
        user={{
          img: user.profilepicture,
          username: user.username,
          onlinestatus: user.onlinestatus?.status ? 'online' : 'offline',
          id: user.uid
        }}
        notifications={notifications}
        onEditProfile={() => setShowEditProfile(true)}
      />

      {showEditProfile && (
        <EditProfileModal
          user={user}
          onClose={() => setShowEditProfile(false)}
          onSave={handleEditProfile}
        />
      )}

      <div className={styles.recentChatsContainer}>
        <div className={styles.recentChatsHeader}>
          <h2>Recent Chats</h2>
          <button onClick={props.handlesearchbtn} className={styles.newChatButton}>+ New Chat</button>
        </div>

        <div className={styles.searchContainer}>
          <input
            type="text"
            className={styles.chatSearch}
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Show skeleton loader specifically for chat list */}
        {isChatsLoading ? (
          <ChatListSkeleton />
        ) : (
          <div className={styles.chatList}>
            {shouldShowNoChats ? (
              <div className={styles.noChatsContainer}>
                <div className={styles.noChatsIcon}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <h3>No Chats Yet</h3>
                <p>Start a new conversation to see your chats here</p>
                <button 
                  className={styles.startChatButton}
                  onClick={props.handlesearchbtn}
                >
                  Start New Chat
                </button>
              </div>
            ) : (
              filteredChats.map((chat) => (
                <button 
                  onClick={() => props.handlechatclick("", chat.chatid, user)} 
                  onContextMenu={(e) => handleContextMenu(e, chat.chatid)}
                  className={styles.chatmessagebtn} 
                  key={chat.chatid}
                >
                  <div className={`${styles.chatItem} ${chat.unread ? styles.newMessage : ""}`}>
                    <img src={`${chat.chatimage}`} alt={chat.recievername} />
                    <div className={styles.chatContent}>
                      <div className={styles.chatName}>{chat.recievername}</div>
                      <div className={styles.chatMessage}>{chat.lastmessage}</div>
                    </div>
                    <div className={styles.chatTime}>
                      {formatChatTime(chat.updatedat)}
                      {chat.unread && <span className={styles.unreadBadge}></span>}
                    </div>
                  </div>
                </button>
              ))
            )}
            
            {shouldShowNoResults && (
              <div className={styles.noResults}>
                <p>No chats found matching "{searchQuery}"</p>
              </div>
            )}
          </div>
        )}
      </div>

      {contextMenu.show && (
        <div 
          className={styles.contextMenu}
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 1000
          }}
        >
          <button 
            className={styles.contextMenuItem}
            onClick={() => handleDeleteChat(contextMenu.chatId)}
          >
            Delete Chat
          </button>
        </div>
      )}
    </>
  );
};

export default RecentChats; 