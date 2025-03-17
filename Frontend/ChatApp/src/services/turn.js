/**
 * TURN Server Service
 * 
 * This service provides TURN server credentials for WebRTC connections.
 * Uses multiple providers for better reliability.
 */

// Primary TURN servers - Google's free STUN servers
const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' }
];

// Metered.ca free TURN servers - The most reliable free option
const METERED_TURN_SERVERS = {
  urls: [
    'turn:openrelay.metered.ca:443?transport=tcp',
    'turn:openrelay.metered.ca:443',
    'turn:openrelay.metered.ca:80?transport=tcp',
    'turn:openrelay.metered.ca:80'
  ],
  username: 'openrelayproject',
  credential: 'openrelayproject'
};

// Backup Google TURN servers
const GOOGLE_TURN_SERVERS = {
  urls: [
    'turn:66.96.239.203:3478?transport=udp',
    'turn:66.96.239.203:3478?transport=tcp',
    'turn:66.96.239.203:443?transport=tcp'
  ],
  username: 'openrelayproject',
  credential: 'openrelayproject'
};

// WebRTC.org free TURN servers for backup
const WEBRTC_ORG_TURN_SERVERS = {
  urls: [
    'turn:turn.webrtc.org:3478?transport=udp',
    'turn:turn.webrtc.org:3478?transport=tcp',
    'turn:turn.webrtc.org:443?transport=tcp'
  ],
  username: 'webrtc',
  credential: 'webrtc'
};

/**
 * Get enhanced WebRTC configuration with multiple TURN servers for reliability
 */
export const getTurnServerConfig = () => {
  console.log('Getting TURN server configuration with multiple providers');
  
  return {
    iceServers: [
      // Primary TURN servers
      METERED_TURN_SERVERS,
      // Backup TURN servers
      GOOGLE_TURN_SERVERS,
      WEBRTC_ORG_TURN_SERVERS,
      // STUN servers
      ...STUN_SERVERS
    ],
    iceCandidatePoolSize: 10,
    iceTransportPolicy: 'all', // Try all connection types first
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    sdpSemantics: 'unified-plan'
  };
};

/**
 * Get forced relay config (forces the use of TURN servers)
 * This is more reliable in restrictive networks but uses more bandwidth
 */
export const getRelayOnlyConfig = () => {
  console.log('Getting forced TURN relay configuration');
  
  return {
    iceServers: [
      // Primary TURN servers
      METERED_TURN_SERVERS,
      // Backup TURN servers
      GOOGLE_TURN_SERVERS,
      WEBRTC_ORG_TURN_SERVERS
    ],
    iceCandidatePoolSize: 10,
    iceTransportPolicy: 'relay', // Force using TURN servers only
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    sdpSemantics: 'unified-plan'
  };
};

/**
 * Test TURN server connectivity
 * @returns {Promise<{success: boolean, relayWorks: boolean}>}
 */
export const testTurnServerConnectivity = async () => {
  return new Promise((resolve) => {
    console.log('Testing TURN server connectivity...');
    
    // Get a standard configuration with multiple TURN servers
    const config = {
      iceServers: [
        METERED_TURN_SERVERS, 
        GOOGLE_TURN_SERVERS,
        WEBRTC_ORG_TURN_SERVERS,
        ...STUN_SERVERS
      ],
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