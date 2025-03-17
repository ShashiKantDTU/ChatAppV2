/**
 * TURN Server Service
 * 
 * This service provides TURN server credentials for WebRTC connections.
 * Uses Metered.ca for reliable TURN server access with public fallbacks.
 */

// STUN servers for basic connectivity
const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.relay.metered.ca:80' }
];

// Static Metered.ca TURN server credentials (used as fallback)
const STATIC_METERED_TURN_SERVERS = [
  {
    urls: "turn:global.relay.metered.ca:80",
    username: "54802f233bc4f94626bf76e1",
    credential: "ipCZUvoLoYzVeHVz",
  },
  {
    urls: "turn:global.relay.metered.ca:80?transport=tcp",
    username: "54802f233bc4f94626bf76e1",
    credential: "ipCZUvoLoYzVeHVz",
  },
  {
    urls: "turn:global.relay.metered.ca:443",
    username: "54802f233bc4f94626bf76e1",
    credential: "ipCZUvoLoYzVeHVz",
  },
  {
    urls: "turns:global.relay.metered.ca:443?transport=tcp",
    username: "54802f233bc4f94626bf76e1",
    credential: "ipCZUvoLoYzVeHVz",
  }
];

// Public free TURN servers as additional fallbacks
const PUBLIC_TURN_SERVERS = [
  // OpenRelay - free public TURN servers
  {
    urls: "turn:openrelay.metered.ca:80",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  {
    urls: "turn:openrelay.metered.ca:443?transport=tcp",
    username: "openrelayproject",
    credential: "openrelayproject",
  },
  // Google's free TURN server (limited but reliable)
  {
    urls: "turn:142.250.189.127:19305?transport=udp",
    username: "CmV5JCzBRJeRiVuxULKk/1606748935",
    credential: "W0KP/oXVLBs7Ifm9GdgKZsFET/0=",
  }
];

// Cache for dynamic TURN credentials
let cachedTurnCredentials = null;
let lastFetchTime = 0;
const CREDENTIALS_TTL = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

/**
 * Fetch TURN server credentials from Metered.ca API
 * @returns {Promise<Array>} Array of ICE server configurations
 */
async function fetchTurnCredentials() {
  try {
    console.log('Fetching fresh TURN credentials from Metered.ca');
    const response = await fetch(
      "https://shashikant.metered.live/api/v1/turn/credentials?apiKey=0b3cef3685935b3424354cbea99c073db622",
      { 
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        // Adds a cache-busting parameter to avoid cached responses
        cache: 'no-cache',
        credentials: 'omit'
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch TURN credentials: ${response.status}`);
    }
    
    const credentials = await response.json();
    console.log('Successfully retrieved TURN credentials');
    
    // Validate the credentials format
    if (!Array.isArray(credentials) || !credentials.length || !credentials[0].urls) {
      console.warn('Received invalid TURN credentials format:', credentials);
      throw new Error('Invalid TURN credentials format');
    }
    
    // Cache the credentials and timestamp
    cachedTurnCredentials = credentials;
    lastFetchTime = Date.now();
    
    return credentials;
  } catch (error) {
    console.error('Error fetching TURN credentials:', error);
    return null;
  }
}

/**
 * Get TURN credentials, either from cache or by fetching fresh ones
 * @returns {Promise<Array>} Array of ICE server configurations
 */
async function getTurnCredentials() {
  // If we have cached credentials that are less than 12 hours old, use them
  if (cachedTurnCredentials && (Date.now() - lastFetchTime < CREDENTIALS_TTL)) {
    console.log('Using cached TURN credentials');
    return cachedTurnCredentials;
  }
  
  // Otherwise fetch new credentials
  const credentials = await fetchTurnCredentials();
  
  // If fetching fails, use static credentials
  if (!credentials) {
    console.log('Falling back to static TURN credentials');
    return STATIC_METERED_TURN_SERVERS;
  }
  
  return credentials;
}

/**
 * Get enhanced WebRTC configuration with dynamic TURN servers
 * @returns {Promise<Object>} WebRTC configuration object
 */
export const getTurnServerConfig = async () => {
  console.log('Getting TURN server configuration from Metered.ca');
  
  try {
    // Get credentials dynamically
    const iceServers = await getTurnCredentials();
    
    return {
      iceServers: [
        ...iceServers,
        ...PUBLIC_TURN_SERVERS, // Add public TURN servers as fallback
        ...STUN_SERVERS
      ],
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all', // Try all connection types first
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      sdpSemantics: 'unified-plan'
    };
  } catch (error) {
    console.error('Error getting TURN configuration:', error);
    
    // Fallback configuration with all available servers
    return {
      iceServers: [
        ...STATIC_METERED_TURN_SERVERS,
        ...PUBLIC_TURN_SERVERS,
        ...STUN_SERVERS
      ],
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      sdpSemantics: 'unified-plan'
    };
  }
};

/**
 * Get forced relay config (forces the use of TURN servers)
 * This is more reliable in restrictive networks but uses more bandwidth
 * @returns {Promise<Object>} WebRTC configuration with forced relay
 */
export const getRelayOnlyConfig = async () => {
  console.log('Getting forced TURN relay configuration');
  
  try {
    // Get credentials dynamically
    const iceServers = await getTurnCredentials();
    
    // Combine with public TURN servers for maximum reliability
    return {
      iceServers: [
        ...iceServers,
        ...PUBLIC_TURN_SERVERS // Add public TURN servers for more reliability
      ],
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'relay', // Force using TURN servers only
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      sdpSemantics: 'unified-plan'
    };
  } catch (error) {
    console.error('Error getting relay configuration:', error);
    
    // Fallback configuration
    return {
      iceServers: [
        ...STATIC_METERED_TURN_SERVERS,
        ...PUBLIC_TURN_SERVERS
      ],
      iceCandidatePoolSize: 10,
      iceTransportPolicy: 'relay',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      sdpSemantics: 'unified-plan'
    };
  }
};

/**
 * Test TURN server connectivity
 * @returns {Promise<{success: boolean, relayWorks: boolean}>}
 */
export const testTurnServerConnectivity = async () => {
  return new Promise(async (resolve) => {
    console.log('Testing TURN server connectivity...');
    
    // Get credentials for testing - include all available servers for testing
    let iceServers;
    try {
      const dynamicIceServers = await getTurnCredentials();
      iceServers = [
        ...dynamicIceServers,
        ...PUBLIC_TURN_SERVERS,
        ...STUN_SERVERS
      ];
    } catch (error) {
      console.error('Error getting TURN credentials for testing:', error);
      iceServers = [
        ...STATIC_METERED_TURN_SERVERS,
        ...PUBLIC_TURN_SERVERS,
        ...STUN_SERVERS
      ];
    }
    
    // Get a testing configuration
    const config = {
      iceServers: iceServers,
      iceCandidatePoolSize: 10
    };
    
    // Create a temporary connection for testing
    const pc = new RTCPeerConnection(config);
    let foundStun = false;
    let foundTurn = false;
    
    // Set a timeout for the test (15 seconds)
    const timeout = setTimeout(() => {
      console.warn('ICE gathering timed out - partial results');
      pc.close();
      resolve({ 
        success: foundStun, 
        relayWorks: foundTurn 
      });
    }, 15000);
    
    // Create a data channel to trigger ICE gathering
    pc.createDataChannel('turnTestChannel');
    
    // Listen for ICE candidates
    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      
      const candidate = e.candidate.candidate.toLowerCase();
      console.log('Test candidate:', candidate);
      
      // Check candidate type
      if (candidate.includes('typ srflx')) {
        console.log('✓ STUN candidate found - STUN servers working');
        foundStun = true;
      } else if (candidate.includes('typ relay')) {
        console.log('✓ TURN/relay candidate found - TURN servers working');
        foundTurn = true;
        
        // Since we found a relay candidate, we can resolve early
        clearTimeout(timeout);
        pc.close();
        resolve({ 
          success: true, 
          relayWorks: true 
        });
      }
    };
    
    // Handle completion of ICE gathering
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(timeout);
        console.log('ICE gathering complete');
        console.log('Final results:');
        console.log('- STUN servers working:', foundStun);
        console.log('- TURN servers working:', foundTurn);
        pc.close();
        resolve({ 
          success: foundStun, 
          relayWorks: foundTurn 
        });
      }
    };
    
    // Create an offer to start ICE gathering
    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .catch(err => {
        console.error('Error creating offer:', err);
        clearTimeout(timeout);
        pc.close();
        resolve({ success: false, relayWorks: false });
      });
  });
}; 