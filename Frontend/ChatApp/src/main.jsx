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
    
    config = {
      ...config,
      credentials: 'include',
      headers: {
        ...(config?.headers || {}),
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
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
