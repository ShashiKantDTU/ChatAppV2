import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Authloading.css';

const Authloading = () => {
  const [dots, setDots] = useState('');
  const [loadingTime, setLoadingTime] = useState(0);
  const [showReloadMessage, setShowReloadMessage] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    // Dots animation
    const dotsInterval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 400);
    
    // Timer for loading
    const timerInterval = setInterval(() => {
      setLoadingTime(prev => {
        const newTime = prev + 1;
        if (newTime === 10) {
          setShowReloadMessage(true);
        }
        return newTime;
      });
    }, 1000);
    
    return () => {
      clearInterval(dotsInterval);
      clearInterval(timerInterval);
    };
  }, []);

  const handleReload = () => {
    // Redirect to home page and then reload
    window.location.href = '/';
  };

  return (
    <div className="loading-container" style={{ background: 'linear-gradient(135deg, #0f0f1e 0%, #1f1f3a 100%)' }}>
      <div className="loading-content">
        <h2 className="loading-title">Authenticating<span className="dots">{dots}</span></h2>
        
        <div className="loader">
          <div className="spinner-container">
            <div className="spinner primary"></div>
            <div className="spinner secondary"></div>
            <div className="spinner tertiary"></div>
          </div>
        </div>
        
        <div className="loading-message">
          <p>Please wait while we securely log you in</p>
          <p className="loading-timer">Time elapsed: {loadingTime}s</p>
          
          {loadingTime >= 5 && !showReloadMessage && (
            <div className="loading-info fade-in">
              <p>Our server may be waking up from sleep mode...</p>
            </div>
          )}
          
          {showReloadMessage && (
            <div className="reload-message fade-in">
              <p>We're using a free hosting tier that sometimes requires a server wake-up.</p>
              <p>This can take up to 2 minute on first connection.</p>
              <p>Server Wakeup has initiated server will be Live , You can come back</p>
              <button className="reload-button" onClick={handleReload}>
                Reload Page
              </button>
            </div>
          )}
        </div>
        
        <div className="loading-particles">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="particle" style={{
              '--delay': `${Math.random() * 2}s`,
              '--position': `${Math.random() * 100}%`
            }}></div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Authloading; 