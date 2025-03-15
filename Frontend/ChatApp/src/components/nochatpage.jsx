import React from 'react';
import './nochatpage.css'; // Make sure this path is correct
import { MessageSquarePlus } from 'lucide-react';

function EmptyPage({ onNewChat }) {
  return (
    <div className="no-chat-wrapper">
      <div className="no-chat-content">
        <div className="chat-illustration">
          <MessageSquarePlus size={64} color="var(--text-secondary)" strokeWidth={1.5} />
        </div>
        <h1>Start a Conversation</h1>
        <p>Connect with friends and start chatting. Your conversations will appear here.</p>
        <button className="start-chat-button" onClick={onNewChat}>
          New Chat
        </button>
      </div>
    </div>
  );
}

export default EmptyPage;