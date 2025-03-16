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
    const tokenFromUrl = searchParams.get('token');
    
    // If we have a token in the URL, store it and use it
    if (tokenFromUrl) {
      console.log('Token received from URL, storing in localStorage');
      localStorage.setItem('auth_token', tokenFromUrl);
      
      // Clean up URL - but preserve auth_source for state management
      const newUrl = window.location.pathname + '?auth_source=google';
      window.history.replaceState({}, document.title, newUrl);
      
      // Try to use the token immediately
      checkAuthStatus();
    }
    // If we just returned from Google OAuth flow but no token in URL
    else if (authSource === 'google') {
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
      const token = localStorage.getItem('auth_token');
      
      console.log('Checking auth with token from localStorage:', token ? 'Token exists' : 'No token');
      
      if (!token) {
        console.log('No token found in localStorage to use for authentication');
        return;
      }
      
      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };
      
      console.log('Making request to /me with Authorization header');
      
      const response = await fetch(`${API_URL}/me`, {
        method: 'GET',
        credentials: 'include',
        headers: headers
      });
      
      console.log('Auth check response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Auth success! User data:', data);
        
        if (data.user && loginCallback) {
          console.log('Calling login callback with user data');
          loginCallback(data.user);
        }
      } else {
        console.log('Authentication check failed, status:', response.status);
        try {
          const errorData = await response.json();
          console.log('Error response:', errorData);
        } catch (e) {
          console.log('No JSON error response');
        }
      }
    } catch (error) {
      console.error('Error checking authentication:', error);
    }
  };

  const handleGoogleLogin = () => {
    setIsLoading(true);
    
    // Get the current origin (domain) for return URL
    const origin = window.location.origin;
    // Use current path (whether login or signup) for return
    const path = window.location.pathname;
    // Create a clean return URL
    const returnUrl = `${origin}${path}?auth_source=google`;
    
    console.log('Constructed return URL:', returnUrl);
    
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