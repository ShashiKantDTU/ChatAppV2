import { useState } from 'react';
import styles from './profileheader.module.css';
import { FaBell, FaEdit, FaCopy } from 'react-icons/fa';

// Skeleton UI for profile header when loading
const SkeletonProfileHeader = () => {
  return (
    <header className={styles.header}>
      <div className={styles.userInfo}>
        <div className={styles.avatarContainer}>
          <div className={`${styles.avatar} ${styles.skeletonAvatar}`}></div>
          <div className={`${styles.statusIndicator} ${styles.skeletonStatus}`}></div>
        </div>
        
        <div className={styles.userDetails}>
          <div className={`${styles.skeletonText} ${styles.skeletonUsername}`}></div>
          <div className={styles.uidRow}>
            <div className={`${styles.skeletonText} ${styles.skeletonProfession}`}></div>
          </div>
        </div>
      </div>
      
      <div className={styles.actions}>
        <div className={`${styles.iconButton} ${styles.skeletonIconButton}`}></div>
        <div className={`${styles.editButton} ${styles.skeletonEditButton}`}></div>
      </div>
    </header>
  );
};

const ProfileHeader = (props) => {
  const [showTooltip, setShowTooltip] = useState(false);
  
  // If loading state is true, show skeleton UI
  if (props.isLoading) {
    return <SkeletonProfileHeader />;
  }
  
  // Default avatar if not provided
  const defaultImg = '/user.png';
   
  // User data
  const user = {
    ...props.user,
    img: props.user.img || defaultImg
  };
  const notifications = props.notifications || 0;

  const copyUID = () => {
    navigator.clipboard.writeText(user.id || 'user-id');
    setShowTooltip(true);
    setTimeout(() => setShowTooltip(false), 2000);
  };

  return (
    <header className={styles.header}>
      <div className={styles.userInfo}>
        <div className={styles.avatarContainer}>
          <img src={user.img} alt="Profile" className={styles.avatar} />
          <div 
            className={styles.statusIndicator} 
            style={{ backgroundColor: user.onlinestatus === 'online' ? '#10b981' : '#dc2626' }}
            title={user.onlinestatus === 'online' ? 'Online' : 'Offline'}
          />
        </div>
        
        <div className={styles.userDetails}>
          <h3 className={styles.username}>{user.username}</h3>
          <div className={styles.uidRow}>
            <p className={styles.profession}>{user.id}</p>
            <button className={styles.uidcopybtn} onClick={copyUID} title="Copy User ID">
              <FaCopy size={12} color="#a0aec0" />
              {showTooltip && <span className={styles.tooltip}>Copied!</span>}
            </button>
          </div>
        </div>
      </div>
      
      <div className={styles.actions}>
        <button className={styles.iconButton} title="Notifications">
          {notifications > 0 && (
            <span className={styles.notificationCount}>{notifications > 9 ? '9+' : notifications}</span>
          )}
          <FaBell size={16} color="#a0aec0" />
        </button>
        
        <button className={styles.editButton} onClick={props.onEditProfile}>
          <FaEdit size={14} />
          <span>Edit Profile</span>
        </button>
      </div>
    </header>
  );
};

export default ProfileHeader;
