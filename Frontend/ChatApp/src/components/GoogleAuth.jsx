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
    const authSuccess = searchParams.get('auth_success');
    
    // Check for token in URL fragment
    let tokenFromFragment = null;
    if (window.location.hash && window.location.hash.includes('token=')) {
      const tokenMatch = window.location.hash.match(/token=([^&]+)/);
      if (tokenMatch && tokenMatch[1]) {
        tokenFromFragment = decodeURIComponent(tokenMatch[1]);
        console.log('Found token in URL hash fragment in GoogleAuth component');
      }
    }
    
    // Prioritize fragment token over URL param token
    if (tokenFromFragment) {
      console.log('Token received from URL fragment, storing in localStorage');
      localStorage.setItem('auth_token', tokenFromFragment);
      
      // Clean up URL fragment - but preserve auth_source for state management
      window.history.replaceState(
        null, 
        document.title, 
        window.location.pathname + (authSource ? `?auth_source=${authSource}` : '')
      );
      
      // Try to use the token immediately
      checkAuthStatus();
    }
    // If we just returned from Google OAuth flow but need to check auth
    else if (authSuccess === 'true' || authSource === 'google') {
      console.log('Returned from Google Auth, checking authentication...');
      
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
      {/* Google "G" logo SVG */}
      <svg className="google-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M21.8055 10.0415H21V10H12V14H17.6515C16.827 16.3285 14.6115 18 12 18C8.6865 18 6 15.3135 6 12C6 8.6865 8.6865 6 12 6C13.5295 6 14.921 6.577 15.9805 7.5195L18.809 4.691C17.023 3.0265 14.634 2 12 2C6.4775 2 2 6.4775 2 12C2 17.5225 6.4775 22 12 22C17.5225 22 22 17.5225 22 12C22 11.3295 21.931 10.675 21.8055 10.0415Z" fill="#FFC107"/>
        <path d="M3.15302 7.3455L6.43852 9.755C7.32752 7.554 9.48052 6 12 6C13.5295 6 14.921 6.577 15.9805 7.5195L18.809 4.691C17.023 3.0265 14.634 2 12 2C8.15902 2 4.82802 4.1685 3.15302 7.3455Z" fill="#FF3D00"/>
        <path d="M12 22C14.583 22 16.93 21.0115 18.7045 19.404L15.6095 16.785C14.5717 17.5742 13.3037 18.001 12 18C9.39897 18 7.19047 16.3415 6.35847 14.027L3.09747 16.5395C4.75247 19.778 8.11347 22 12 22Z" fill="#4CAF50"/>
        <path d="M21.8055 10.0415H21V10H12V14H17.6515C17.2571 15.1082 16.5467 16.0766 15.608 16.7855L15.6095 16.7845L18.7045 19.4035C18.4855 19.6025 22 17 22 12C22 11.3295 21.931 10.675 21.8055 10.0415Z" fill="#1976D2"/>
      </svg>
      {isLoading ? 'Connecting...' : 'Continue with Google'}
    </button>
  );
};

export default GoogleAuth; 