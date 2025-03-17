import React from 'react';
import './RecentChatsSkeleton.css';

const RecentChatsSkeleton = () => {
  // Generate array of chat skeleton items
  const skeletonItems = Array(5).fill(null);

  return (
    <div className="recent-chats-skeleton">
      {/* Header skeleton */}
      <div className="skeleton-header">
        <div className="skeleton-title"></div>
        <div className="skeleton-button"></div>
      </div>
      
      {/* Search bar skeleton */}
      <div className="skeleton-search-container">
        <div className="skeleton-search"></div>
      </div>
      
      {/* Chat list skeleton */}
      <div className="skeleton-chat-list">
        {skeletonItems.map((_, index) => (
          <div key={index} className="skeleton-chat-item">
            <div className="skeleton-avatar pulse"></div>
            <div className="skeleton-content">
              <div className="skeleton-name pulse"></div>
              <div className="skeleton-message pulse"></div>
            </div>
            <div className="skeleton-time">
              <div className="skeleton-timestamp pulse"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentChatsSkeleton; 