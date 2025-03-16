import React, { useState, useEffect } from 'react';
import { LogIn } from 'lucide-react';

// Improved Google OAuth component that handles auth state properly
const GoogleAuth = ({ isDisabled = false, loginCallback = null }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [apiUrl, setApiUrl] = useState('');

  useEffect(() => {
    // Get the API URL from environment variable
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    setApiUrl(API_URL);
    
    // Check if we just returned from Google Auth
    const searchParams = new URLSearchParams(window.location.search);
    const authSource = searchParams.get('auth_source');
    
    if (authSource === 'google') {
      console.log('Returned from Google Auth, checking authentication...');
      // Clean up URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
      
      // Attempt to fetch user data
      checkAuthStatus();
    }
  }, []);
  
  // Function to check authentication status
  const checkAuthStatus = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const response = await fetch(`${API_URL}/me`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });
      
      console.log('Auth check response:', response);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Auth data:', data);
        
        if (data.user && loginCallback) {
          loginCallback(data.user);
        }
      } else {
        console.log('Authentication check failed');
      }
    } catch (error) {
      console.error('Error checking authentication:', error);
    }
  };

  const handleGoogleLogin = () => {
    setIsLoading(true);
    
    // Create the return URL with a special parameter to detect return from auth
    const currentUrl = window.location.href.split('?')[0]; // Remove any existing query params
    const returnUrl = `${currentUrl}?auth_source=google`;
    
    // Store the return URL in sessionStorage
    sessionStorage.setItem('auth_return_url', returnUrl);
    
    // Get the API URL from environment variable
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    
    // Construct the Google auth URL with the return URL as state
    const authUrl = `${API_URL}/auth/google?return_url=${encodeURIComponent(returnUrl)}`;
    
    console.log('Redirecting to Google Auth:', authUrl);
    
    // Redirect to Google auth
    window.location.href = authUrl;
  };

  return (
    <button 
      className="google-login-button" 
      onClick={handleGoogleLogin}
      disabled={isDisabled || isLoading}
    >
      <LogIn size={20} className="google-icon" />
      {isLoading ? 'Connecting...' : 'Continue with Google'}
    </button>
  );
};

export default GoogleAuth; 