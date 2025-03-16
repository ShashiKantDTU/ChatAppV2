// Add this debugging code to your Login component:

// Put this in the useEffect of your login component
useEffect(() => {
  // Check for visible debug cookie
  const hasAuthDebug = document.cookie.includes('auth_debug=true');
  
  if (hasAuthDebug) {
    console.log('OAuth cookie debug detected! Checking authentication...');
    // Try an immediate auth check
    setTimeout(() => {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
      fetch(`${API_URL}/me`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      })
      .then(response => {
        console.log('Debug auth check response:', response);
        return response.json();
      })
      .then(data => {
        console.log('Debug auth check data:', data);
        if (data.user) {
          console.log('Authentication successful in debug!');
        } else {
          console.log('Authentication failed in debug!');
          // Display cookie information
          console.log('All cookies:', document.cookie);
        }
      })
      .catch(error => {
        console.error('Debug auth check error:', error);
      });
    }, 500);
  }
}, []);

// Function to manually test authentication
function testAuthentication() {
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
  
  // Display all cookies
  console.log('Current cookies:', document.cookie);
  
  // Make auth request with explicit credentials
  fetch(`${API_URL}/me`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  })
  .then(response => {
    console.log('Manual auth test - Status:', response.status);
    console.log('Manual auth test - Headers:', Object.fromEntries([...response.headers]));
    return response.json();
  })
  .then(data => {
    console.log('Manual auth test - Data:', data);
  })
  .catch(error => {
    console.error('Manual auth test - Error:', error);
  });
}

// Add a button to your component with:
// <button type="button" onClick={testAuthentication}>Test Auth</button> 