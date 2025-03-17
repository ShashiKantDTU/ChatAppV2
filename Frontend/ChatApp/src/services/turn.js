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

// Metered.ca free TURN servers
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

// Backup TURN servers from Twilio (reliable free tier)
const TWILIO_TURN_SERVERS = {
  urls: [
    'turn:global.turn.twilio.com:3478?transport=udp',
    'turn:global.turn.twilio.com:3478?transport=tcp'
  ],
  username: 'f4b4035eaa76f4a55de5f4351a0e5378408e5a9cfc46a4d50cbf6038b0412870',
  credential: 'myL7C5qT8Acj7/lV40S5IvJhkfJdY3Sa5WqXWjZzgQQ='
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
      TWILIO_TURN_SERVERS,
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
      TWILIO_TURN_SERVERS
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
    
    // Get a standard configuration with all TURN servers
    const config = {
      iceServers: [METERED_TURN_SERVERS, TWILIO_TURN_SERVERS, ...STUN_SERVERS],
      iceCandidatePoolSize: 10
    };
    
    // Create a temporary connection for testing
    const pc = new RTCPeerConnection(config);
    let foundStun = false;
    let foundTurn = false;
    
    // Set a timeout for the test (10 seconds)
    const timeout = setTimeout(() => {
      console.warn('ICE gathering timed out - partial results');
      pc.close();
      resolve({ 
        success: foundStun, 
        relayWorks: foundTurn 
      });
    }, 10000);
    
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