import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Configure global fetch defaults for cross-domain cookies
const originalFetch = window.fetch;
window.fetch = function(...args) {
  let [resource, config] = args;
  
  // Only apply defaults if this is our API call and no config was provided
  if (typeof resource === 'string' && 
      (resource.includes('localhost:3000') || 
       resource.includes('chatappv2-qa96.onrender.com'))) {
    
    // Check if this is a FormData upload
    const isFormDataUpload = config?.body instanceof FormData;
    
    // Clone headers to avoid modifying the original object
    const headers = { ...(config?.headers || {}) };
    
    // Only add Content-Type for non-FormData requests
    if (!isFormDataUpload) {
      headers['Content-Type'] = 'application/json';
    }
    
    headers['Accept'] = 'application/json';
    
    config = {
      ...config,
      credentials: 'include',
      headers: headers
    };
  }
  
  console.log('Fetch request:', resource, config);
  return originalFetch(resource, config);
};

// Log that our fetch override is active
console.log('Global fetch configured for cross-domain cookies');

createRoot(document.getElementById('root')).render(
   
        <App />
   
    
)
