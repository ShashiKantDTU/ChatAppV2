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
    
    // Check if this is a FormData upload using multiple detection methods
    const bodyToString = config?.body?.toString ? config.body.toString() : '';
    const constructorName = config?.body?.constructor?.name;
    
    // Use multiple methods to detect FormData
    const isFormDataUpload = 
      // Method 1: toString check
      (bodyToString === '[object FormData]') ||
      // Method 2: constructor name check
      (constructorName === 'FormData') ||
      // Method 3: Content-Type header check (if manually set)
      (config?.headers && 
       typeof config.headers['Content-Type'] === 'string' && 
       config.headers['Content-Type'].includes('multipart/form-data'));
    
    console.log('FormData detection:', { 
      isFormData: isFormDataUpload,
      bodyType: config?.body ? (typeof config.body) : 'none',
      bodyToString,
      constructorName
    });
    
    // Clone headers to avoid modifying the original object
    const headers = { ...(config?.headers || {}) };
    
    // Only add Content-Type for non-FormData requests
    if (!isFormDataUpload) {
      headers['Content-Type'] = 'application/json';
      console.log('Setting Content-Type: application/json');
    } else {
      console.log('FormData detected - not setting Content-Type header');
      
      // If this is a FormData request, ensure we don't have a Content-Type header
      // as the browser needs to set this with the boundary
      if (headers['Content-Type']) {
        console.log('Removing existing Content-Type for FormData request');
        delete headers['Content-Type'];
      }
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
