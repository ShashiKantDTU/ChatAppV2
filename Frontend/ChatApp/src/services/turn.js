/**
 * TURN Server Service
 * 
 * This service provides free TURN server credentials for WebRTC connections.
 * It rotates through multiple free TURN servers to avoid rate limits.
 */

// A collection of free TURN servers with credentials
const FREE_TURN_SERVERS = [
  // OpenRelay - free public TURN servers
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',  
      'turn:openrelay.metered.ca:443?transport=tcp',
      'turn:openrelay.metered.ca:80?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject'
  },
  // AnyFirewall - free public TURN server
  {
    urls: [
      'turn:turn.anyfirewall.com:443?transport=tcp'
    ],
    username: 'webrtc',
    credential: 'webrtc'
  },
  // WebRTC.ROCKS - free public TURN server
  {
    urls: [
      'turn:turn.webrtc.rocks:3478',
      'turn:turn.webrtc.rocks:443?transport=tcp'
    ],
    username: 'sample',
    credential: 'sample'
  },
  // Additional backup servers (fill these in if you have more)
  {
    urls: [
      'turn:freeturn.net:3478',
      'turn:freeturn.net:443?transport=tcp'
    ],
    username: 'free',
    credential: 'free'
  }
];

// A collection of reliable free STUN servers
const FREE_STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.stunprotocol.org:3478' }
];

/**
 * Get TURN server configuration with a rotation mechanism
 * to avoid hitting rate limits on any single provider
 */
export const getTurnServerConfig = () => {
  // Choose a TURN server based on time to distribute load
  // Rotate every hour to avoid hitting rate limits
  const rotationIndex = Math.floor(Date.now() / (1000 * 60 * 60)) % FREE_TURN_SERVERS.length;
  const selectedTurnServer = FREE_TURN_SERVERS[rotationIndex];
  
  // Create the final ICE server configuration
  const iceServers = [
    selectedTurnServer,
    // Add a different TURN server as backup
    FREE_TURN_SERVERS[(rotationIndex + 1) % FREE_TURN_SERVERS.length],
    // Add all STUN servers
    ...FREE_STUN_SERVERS
  ];

  console.log('Using TURN server:', selectedTurnServer.urls[0]);
  
  return {
    iceServers,
    iceCandidatePoolSize: 10,
    iceTransportPolicy: 'all', // Start with 'all' for wider compatibility
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    sdpSemantics: 'unified-plan'
  };
};

/**
 * Get TURN server configuration in relay-only mode (more reliable but uses more bandwidth)
 */
export const getRelayOnlyTurnConfig = () => {
  const config = getTurnServerConfig();
  
  // Force the use of TURN servers
  config.iceTransportPolicy = 'relay';
  
  return config;
};

/**
 * Get TCP-only TURN configuration for restrictive networks (corporate firewalls, etc.)
 */
export const getTcpOnlyTurnConfig = () => {
  const config = getTurnServerConfig();
  
  // Force the use of TURN servers with TCP transport
  config.iceTransportPolicy = 'relay';
  
  // Filter out non-TCP URLs
  config.iceServers = config.iceServers.map(server => {
    if (typeof server.urls === 'string') {
      // Skip non-TCP STUN servers
      return server;
    }
    
    return {
      ...server,
      urls: server.urls.filter(url => 
        url.includes('transport=tcp') || url.includes('turns:')
      )
    };
  });
  
  return config;
};

/**
 * Test TURN server connectivity
 * @returns {Promise<{success: boolean, relayWorks: boolean}>}
 */
export const testTurnServerConnectivity = async () => {
  return new Promise((resolve) => {
    console.log('Testing TURN server connectivity...');
    
    // Get a standard configuration
    const config = getTurnServerConfig();
    
    // Create a temporary connection for testing
    const pc = new RTCPeerConnection(config);
    let foundStun = false;
    let foundTurn = false;
    
    // Set a timeout for the test (10 seconds)
    const timeout = setTimeout(() => {
      if (!pc.iceGatheringState === 'complete') {
        console.warn('ICE gathering timed out');
        pc.close();
        resolve({ 
          success: foundStun, 
          relayWorks: foundTurn 
        });
      }
    }, 10000);
    
    // Create a data channel to trigger ICE gathering
    pc.createDataChannel('turnTestChannel');
    
    // Listen for ICE candidates
    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      
      // Check if we got a STUN or TURN candidate
      const candidateStr = e.candidate.candidate.toLowerCase();
      if (candidateStr.includes('typ srflx')) {
        foundStun = true;
      } else if (candidateStr.includes('typ relay')) {
        foundTurn = true;
      }
    };
    
    // Handle completion of ICE gathering
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(timeout);
        console.log('ICE gathering completed');
        console.log('STUN servers working:', foundStun);
        console.log('TURN servers working:', foundTurn);
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