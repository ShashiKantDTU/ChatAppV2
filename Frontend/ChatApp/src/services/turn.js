/**
 * TURN Server Service
 * 
 * This service provides Metered.ca free TURN server credentials for WebRTC connections.
 */

// Metered.ca free TURN servers with credentials
const METERED_TURN_SERVERS = {
  urls: [
    'turn:openrelay.metered.ca:80',
    'turn:openrelay.metered.ca:443',
    'turn:openrelay.metered.ca:443?transport=tcp',
    'turn:openrelay.metered.ca:80?transport=tcp',
  ],
  username: 'openrelayproject',
  credential: 'openrelayproject'
};

// Free Google STUN servers as backup
const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' }
];

/**
 * Get standard WebRTC configuration with Metered.ca TURN servers
 */
export const getTurnServerConfig = () => {
  console.log('Using Metered.ca TURN servers');
  
  return {
    iceServers: [
      METERED_TURN_SERVERS,
      ...STUN_SERVERS
    ],
    iceCandidatePoolSize: 10,
    iceTransportPolicy: 'all',
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    sdpSemantics: 'unified-plan'
  };
};

/**
 * Get forced relay config (forces the use of TURN servers)
 */
export const getRelayOnlyConfig = () => {
  const config = getTurnServerConfig();
  config.iceTransportPolicy = 'relay';
  return config;
};

/**
 * Test TURN server connectivity
 * @returns {Promise<{success: boolean, relayWorks: boolean}>}
 */
export const testTurnServerConnectivity = async () => {
  return new Promise((resolve) => {
    console.log('Testing Metered.ca TURN server connectivity...');
    
    // Get a standard configuration
    const config = getTurnServerConfig();
    
    // Create a temporary connection for testing
    const pc = new RTCPeerConnection(config);
    let foundStun = false;
    let foundTurn = false;
    
    // Set a timeout for the test (8 seconds)
    const timeout = setTimeout(() => {
      console.warn('ICE gathering timed out');
      pc.close();
      resolve({ 
        success: foundStun, 
        relayWorks: foundTurn 
      });
    }, 8000);
    
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