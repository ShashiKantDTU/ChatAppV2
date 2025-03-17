/**
 * TURN Server Service
 * 
 * Simple service to provide TURN server credentials for WebRTC connections.
 * Uses Metered.ca for reliable TURN server access.
 */

// Basic STUN servers for initial connectivity
const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.relay.metered.ca:80' }
];

// Static Metered.ca TURN server credentials
const METERED_TURN_SERVERS = [
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

/**
 * Get basic WebRTC configuration
 * @returns {Object} WebRTC configuration with TURN servers
 */
export const getTurnServerConfig = () => {
  console.log('Getting TURN server configuration');
  
  return {
    iceServers: [
      ...METERED_TURN_SERVERS,
      ...STUN_SERVERS
    ],
    iceCandidatePoolSize: 10,
    iceTransportPolicy: 'all', // Try all connection types
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    sdpSemantics: 'unified-plan'
  };
};

/**
 * Get forced relay configuration to ensure TURN servers are used
 * @returns {Object} WebRTC configuration with forced relay
 */
export const getForcedRelayConfig = () => {
  console.log('Getting forced TURN relay configuration');
  
  return {
    iceServers: METERED_TURN_SERVERS,
    iceCandidatePoolSize: 10,
    iceTransportPolicy: 'relay', // Force using TURN servers only
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require',
    sdpSemantics: 'unified-plan'
  };
}; 