import { useState, useEffect } from 'react';
import styles from './profileheader.module.css';
import { FaBell, FaCopy } from 'react-icons/fa';

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
  const [isInstallable, setIsInstallable] = useState(window.appIsInstallable || false);
  
  useEffect(() => {
    // Check if the app is already installable when component mounts
    if (window.appIsInstallable || window.deferredPrompt) {
      setIsInstallable(true);
    }
    
    // For events that occur after component mount
    const handleBeforeInstallPrompt = (e) => {
      console.log('Component caught beforeinstallprompt event');
      setIsInstallable(true);
    };
    
    // Listen for custom event from early detection
    const handleAppInstallable = (e) => {
      console.log('Component received app-installable event');
      setIsInstallable(true);
    };
    
    // Listen for install completed
    const handleAppInstalled = () => {
      setIsInstallable(false);
    };
    
    // Add event listeners
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    document.addEventListener('app-installable', handleAppInstallable);
    window.addEventListener('appinstalled', handleAppInstalled);
    
    // Force a check for installability one second after mount
    const timer = setTimeout(() => {
      if (window.appIsInstallable || window.deferredPrompt) {
        console.log('Timer check: App is installable');
        setIsInstallable(true);
      }
    }, 1000);
    
    // Clean up
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      document.removeEventListener('app-installable', handleAppInstallable);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearTimeout(timer);
    };
  }, []);
  
  // Function to handle install click
  const handleInstallClick = () => {
    const promptEvent = window.deferredPrompt;
    if (!promptEvent) {
      console.log('No prompt event saved');
      return;
    }
    
    // Show the install prompt
    promptEvent.prompt();
    
    // Wait for the user response
    promptEvent.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      window.deferredPrompt = null;
      window.appIsInstallable = false;
      setIsInstallable(false);
    });
  };
  
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
        
        {isInstallable && (
          <button className={styles.editButton} onClick={handleInstallClick}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v12M12 14l-4-4M12 14l4-4M20 7v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7"/>
            </svg>
            <span>Install App</span>
          </button>
        )}
      </div>
    </header>
  );
};

export default ProfileHeader;
