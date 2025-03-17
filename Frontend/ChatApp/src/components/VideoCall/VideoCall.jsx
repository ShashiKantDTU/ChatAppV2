import React, { useEffect, useState, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, X, RefreshCw, Minimize, Maximize } from 'lucide-react';
import './VideoCall.css';

// Ringtone URL
const RINGTONE_URL = 'https://cdn.pixabay.com/audio/2022/11/20/audio_662f2ae340.mp3';

// Metered API key for TURN server credentials
const METERED_API_KEY = "0b3cef3685935b3424354cbea99c073db622";

// Fallback ICE servers with hardcoded credentials
const FALLBACK_ICE_SERVERS = [
  {
    urls: "stun:stun.l.google.com:19302"
  },
  {
    urls: "stun:stun1.l.google.com:19302"
  },
  {
    urls: "stun:stun2.l.google.com:19302"
  },
  {
    urls: "stun:stun.relay.metered.ca:80",
  },
  {
    urls: "turn:global.relay.metered.ca:80",
    username: "0b3cef3685935b3424354cbea99c073db622",
    credential: "ipCZUvoLoYzVeHVz",
  },
  {
    urls: "turn:global.relay.metered.ca:443",
    username: "0b3cef3685935b3424354cbea99c073db622",
    credential: "ipCZUvoLoYzVeHVz",
  },
  {
    urls: "turn:relay.backups.cz:3478",
    username: "webrtc",
    credential: "webrtc"
  }
];

const VideoCall = ({ 
  isOpen, 
  onClose, 
  isIncoming = false, 
  caller = {}, 
  callee = {}, 
  onAccept, 
  onReject, 
  socket, 
  localUser,
  callType = 'video', // 'video' or 'audio'
  initialMinimized = false, // New prop to control initial minimized state
  onMinimizeChange = null // Callback when minimized state changes
}) => {
  // Call states
  const [isCallActive, setIsCallActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Media controls
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  const [isAudioOnly, setIsAudioOnly] = useState(callType === 'audio');
  const [currentFacingMode, setCurrentFacingMode] = useState('user'); // 'user' or 'environment'
  const [isCameraSupported, setIsCameraSupported] = useState(false);
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  
  // Audio monitoring
  const [localAudioLevel, setLocalAudioLevel] = useState(0);
  const [remoteAudioLevel, setRemoteAudioLevel] = useState(0);
  const audioContextRef = useRef(null);
  const localAnalyserRef = useRef(null);
  const remoteAnalyserRef = useRef(null);
  const audioMonitoringIntervalRef = useRef(null);
  
  // Media elements
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  
  // WebRTC references
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  
  // Call duration timer
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef(null);

  // ICE servers state
  const [iceServers, setIceServers] = useState(FALLBACK_ICE_SERVERS);
  const [areIceServersReady, setAreIceServersReady] = useState(false);
  
  // Audio refs for notifications
  const ringtoneRef = useRef(new Audio(RINGTONE_URL));

  // Add these state variables near the other state declarations
  const [pendingIceCandidates, setPendingIceCandidates] = useState([]);
  const remoteSdpSet = useRef(false);

  // Add a ref to track if call initialization has started to prevent double initialization
  const callInitializedRef = useRef(false);

  // Add a ref for an audio element specifically for audio-only calls
  const audioElementRef = useRef(null);

  // Add a new ref for call timeout
  const callTimeoutRef = useRef(null);

  // Replace the simple isMinimized state with one that uses initialMinimized
  const [isMinimized, setIsMinimized] = useState(initialMinimized);
  
  // Update isMinimized when initialMinimized changes
  useEffect(() => {
    setIsMinimized(initialMinimized);
  }, [initialMinimized]);

  // After the state variables declarations, modify the useEffect that reacts to callType changes
  useEffect(() => {
    // Update audio/video states when callType changes - use a callback to ensure state consistency
    setIsAudioOnly(prevState => {
      const newState = callType === 'audio';
      if (prevState !== newState) {
        console.log(`Updating isAudioOnly from ${prevState} to ${newState} (callType=${callType})`);
      }
      return newState;
    });
    
    setIsVideoEnabled(prevState => {
      const newState = callType === 'video';
      if (prevState !== newState) {
        console.log(`Updating isVideoEnabled from ${prevState} to ${newState} (callType=${callType})`);
      }
      return newState;
    });
  }, [callType]);

  // Function to set up audio monitoring
  const setupAudioMonitoring = (stream) => {
    try {
      // Clean up any existing audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      
      if (!window.AudioContext && !window.webkitAudioContext) {
        console.warn('AudioContext not supported in this browser');
        return;
      }
      
      // Create audio context
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();
      
      // Set up local audio analyzer
      if (stream && stream.getAudioTracks().length > 0) {
        const source = audioContextRef.current.createMediaStreamSource(stream);
        localAnalyserRef.current = audioContextRef.current.createAnalyser();
        localAnalyserRef.current.fftSize = 256;
        localAnalyserRef.current.smoothingTimeConstant = 0.8;
        source.connect(localAnalyserRef.current);
      }
      
      // Start monitoring interval
      if (audioMonitoringIntervalRef.current) {
        clearInterval(audioMonitoringIntervalRef.current);
      }
      
      audioMonitoringIntervalRef.current = setInterval(() => {
        // Monitor local audio level
        if (localAnalyserRef.current) {
          const dataArray = new Uint8Array(localAnalyserRef.current.frequencyBinCount);
          localAnalyserRef.current.getByteFrequencyData(dataArray);
          
          // Calculate average audio level
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avgLevel = sum / dataArray.length;
          const normalizedLevel = Math.min(avgLevel / 128, 1); // Normalize to 0-1 range
          
          setLocalAudioLevel(normalizedLevel);
        }
        
        // Monitor remote audio level (if available)
        if (remoteAnalyserRef.current) {
          const dataArray = new Uint8Array(remoteAnalyserRef.current.frequencyBinCount);
          remoteAnalyserRef.current.getByteFrequencyData(dataArray);
          
          // Calculate average audio level
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avgLevel = sum / dataArray.length;
          const normalizedLevel = Math.min(avgLevel / 128, 1); // Normalize to 0-1 range
          
          setRemoteAudioLevel(normalizedLevel);
        }
      }, 100); // Update every 100ms
    } catch (err) {
      console.error('Error setting up audio monitoring:', err);
    }
  };
  
  // Set up remote audio monitoring when track is received
  const setupRemoteAudioMonitoring = (stream) => {
    try {
      if (!audioContextRef.current) {
        // Create audio context if it doesn't exist yet
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContextRef.current = new AudioContext();
      }
      
      if (stream && stream.getAudioTracks().length > 0) {
        const source = audioContextRef.current.createMediaStreamSource(stream);
        remoteAnalyserRef.current = audioContextRef.current.createAnalyser();
        remoteAnalyserRef.current.fftSize = 256;
        remoteAnalyserRef.current.smoothingTimeConstant = 0.8;
        source.connect(remoteAnalyserRef.current);
      }
    } catch (err) {
      console.error('Error setting up remote audio monitoring:', err);
    }
  };
  
  // Clean up audio monitoring on component unmount
  useEffect(() => {
    return () => {
      if (audioMonitoringIntervalRef.current) {
        clearInterval(audioMonitoringIntervalRef.current);
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Fetch ICE servers from Metered when component opens
  useEffect(() => {
    if (isOpen) {
      fetchIceServers();
    }
  }, [isOpen]);

  // Function to fetch ICE servers from Metered API
  const fetchIceServers = async () => {
    try {
      console.log('Fetching ICE servers from Metered API with key:', METERED_API_KEY.substring(0, 5) + '...');
      // Updated endpoint with the correct subdomain
      const response = await fetch(`https://shashikant.metered.live/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ICE servers: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Received ICE servers:', data);
      
      // Add a message to check if we have valid TURN servers
      const hasTurnServers = data.some(server => server.urls.indexOf('turn:') === 0);
      console.log('Valid TURN servers found:', hasTurnServers);
      
      setIceServers(data);
      setAreIceServersReady(true);
    } catch (error) {
      console.error('Error fetching ICE servers:', error);
      console.log('Using fallback ICE servers');
      setAreIceServersReady(true); // Proceed with fallback servers
    }
  };

  // Initialize when component mounts
  useEffect(() => {
    if (isOpen) {
      // Ensure the audio/video state is set correctly based on current callType
      setIsAudioOnly(callType === 'audio');
      setIsVideoEnabled(callType === 'video');
      
      if (isIncoming) {
        // Ready to accept incoming call
        setIsLoading(false);
      } else {
        // Start outgoing call, but only after ICE servers are ready
        const initializeCallWithIceServers = async () => {
          // Wait for ICE servers to be ready or timeout after 3 seconds
          let attempts = 0;
          while (!areIceServersReady && attempts < 30) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
          }
          
          // Proceed with call initialization
          await initializeCall();
        };
        
        initializeCallWithIceServers();
      }
    }
    
    return () => {
      cleanupCall();
    };
  }, [isOpen, areIceServersReady, callType]);
  
  // Modify the initialize call function to check if already initialized
  const initializeCall = async () => {
    try {
      // Prevent double initialization
      if (callInitializedRef.current) {
        console.log('Call already initialized, skipping duplicate initialization');
        return;
      }
      
      callInitializedRef.current = true;
      
      // Read the current callType directly to ensure we're using the latest value
      const currentIsAudioOnly = callType === 'audio';
      
      console.log(`Initializing call with type: ${callType}, isAudioOnly: ${currentIsAudioOnly}`);
      setIsLoading(true);
      setError(null);
      
      // Detect if the device is mobile or has limited capabilities
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isLowEndDevice = navigator.hardwareConcurrency <= 4; // Devices with 4 or fewer cores
      
      // Get current network information if available
      let networkType = 'unknown';
      let networkDownlink = Infinity;
      if ('connection' in navigator) {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (connection) {
          networkType = connection.effectiveType || 'unknown'; // 4g, 3g, 2g, slow-2g
          networkDownlink = connection.downlink || Infinity; // Mbps
          console.log(`Network condition: ${networkType}, Downlink: ${networkDownlink}Mbps`);
        }
      }
      
      // Configure quality based on device and network
      const isLowBandwidth = networkType === '2g' || networkType === 'slow-2g' || networkDownlink < 1;
      const isModerateConnection = networkType === '3g' || (networkDownlink >= 1 && networkDownlink < 5);
      
      console.log(`Device info - Mobile: ${isMobile}, Low-end: ${isLowEndDevice}, Network: ${networkType}`);
      
      // Optimize video constraints based on device and network
      let idealWidth, idealHeight, maxFrameRate, idealQuality;
      
      if (isLowBandwidth || (isMobile && isLowEndDevice)) {
        // Low quality for poor connections or low-end mobile devices
        idealWidth = 320;
        idealHeight = 240;
        maxFrameRate = 15;
        idealQuality = 0.5;
      } else if (isModerateConnection || isMobile) {
        // Medium quality for moderate connections or standard mobile
        idealWidth = 640;
        idealHeight = 480;
        maxFrameRate = 20;
        idealQuality = 0.7;
      } else {
        // High quality for good connections on desktop
        idealWidth = 1280;
        idealHeight = 720;
        maxFrameRate = 30;
        idealQuality = 0.9;
      }
      
      // Get local media stream based on call type and optimized constraints
      console.log(`Setting up media with callType=${callType}, isAudioOnly=${currentIsAudioOnly}`);

      const mediaConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Add these parameters for better audio quality
          sampleRate: 48000,
          channelCount: 2
        },
        video: !currentIsAudioOnly ? {
          width: { ideal: idealWidth, max: idealWidth * 1.5 },
          height: { ideal: idealHeight, max: idealHeight * 1.5 },
          frameRate: { max: maxFrameRate },
          facingMode: currentFacingMode
        } : false
      };
      
      console.log(`Requesting media with optimized constraints:`, mediaConstraints);
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
        localStreamRef.current = stream;
        
        // Set up audio monitoring for the local stream
        setupAudioMonitoring(stream);
        
        // For video calls, apply quality constraints to video tracks
        if (!currentIsAudioOnly && stream.getVideoTracks().length > 0) {
          const videoTrack = stream.getVideoTracks()[0];
          
          try {
            // Apply constraints to track if supported
            const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
            
            if (videoTrack.applyConstraints && capabilities.height) {
              console.log("Applying optimized constraints to video track");
              await videoTrack.applyConstraints({
                width: { ideal: idealWidth },
                height: { ideal: idealHeight },
                frameRate: { max: maxFrameRate }
              });
            }
          } catch (constraintErr) {
            console.warn('Could not apply optimized constraints:', constraintErr);
          }
        }
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        setIsLoading(false);
        
        // If this is an outgoing call, start the call process
        if (!isIncoming) {
          startOutgoingCall();
        }
      } catch (mediaError) {
        console.error("Media access error:", mediaError.name, mediaError.message);
        
        // Handle specific media errors with appropriate feedback
        if (mediaError.name === "NotAllowedError") {
          // Permission denied by user
          setError("Camera or microphone access was denied. Please grant permissions and try again.");
        } else if (mediaError.name === "NotFoundError") {
          // Required device not found
          setError("Camera or microphone not found. Please check your devices.");
          
          if (!currentIsAudioOnly) {
            console.log("Attempting to fall back to audio-only mode");
            // Try to fallback to audio only if video was requested but failed
            try {
              const audioOnlyStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                  echoCancellation: true,
                  noiseSuppression: true,
                  autoGainControl: true
                } 
              });
              localStreamRef.current = audioOnlyStream;
              
              if (localVideoRef.current) {
                localVideoRef.current.srcObject = audioOnlyStream;
              }
              
              // Switch to audio-only mode
              setIsAudioOnly(true);
              setIsVideoEnabled(false);
              setError("Video camera not available. Switched to audio-only mode.");
              setIsLoading(false);
              
              // If this is an outgoing call, start the call process
              if (!isIncoming) {
                startOutgoingCall();
              }
              return;
            } catch (audioError) {
              console.error("Audio fallback error:", audioError);
              setError("Could not access microphone. Please check permissions and device.");
            }
          }
        } else if (mediaError.name === "NotReadableError" || mediaError.name === "AbortError") {
          // Hardware error or device already in use
          setError("Camera or microphone is already in use or not working properly.");
        } else if (mediaError.name === "OverconstrainedError") {
          // Constraints cannot be satisfied - try with lower quality
          console.log("Constraints too high for device, attempting with lower quality");
          try {
            const lowerQualityConstraints = {
              audio: true,
              video: !currentIsAudioOnly ? {
                width: { ideal: 320 },
                height: { ideal: 240 },
                frameRate: { max: 15 }
              } : false
            };
            
            const fallbackStream = await navigator.mediaDevices.getUserMedia(lowerQualityConstraints);
            localStreamRef.current = fallbackStream;
            
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = fallbackStream;
            }
            
            setIsLoading(false);
            
            if (!isIncoming) {
              startOutgoingCall();
            }
            return;
          } catch (fallbackErr) {
            console.error("Fallback media error:", fallbackErr);
            setError("Could not access camera with supported settings. Please try audio-only.");
          }
        } else {
          // Generic error message
          const errorMessage = currentIsAudioOnly 
            ? "Could not access microphone. Please check permissions and try again." 
            : "Could not access camera or microphone. Please check permissions and try again.";
          setError(errorMessage);
        }
        
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Unexpected error during call initialization:", err);
      setError("An unexpected error occurred. Please try again later.");
      setIsLoading(false);
    }
  };
  
  // Start outgoing call
  const startOutgoingCall = () => {
    if (!socket) return;
    
    // Use callType directly rather than the potentially stale isAudioOnly state
    const isAudioOnlyCall = callType === 'audio';
    
    console.log(`Starting outgoing call: callType=${callType}, isAudioOnly=${isAudioOnlyCall}`);
    
    // Set a timeout to end the call if not picked up within 45 seconds
    callTimeoutRef.current = setTimeout(() => {
      console.log('Call timeout reached (45 seconds) - ending unanswered call');
      setError('Call not answered. Please try again later.');
      // Wait 2 seconds to show the error message before closing
      setTimeout(() => {
        cleanupCall();
        onClose();
      }, 2000);
    }, 45000);
    
    // Emit call-user event to server
    try {
      console.log(`Emitting call-user with callType: ${isAudioOnlyCall ? 'audio' : 'video'}`);
      
      socket.emit('call-user', {
        callerId: localUser.uid,
        callerName: localUser.username || localUser.name,
        calleeId: callee.uid,
        callerProfilePic: localUser.profilepicture,
        callType: isAudioOnlyCall ? 'audio' : 'video'
      });
      
      // Listen for call-accepted event
      socket.once('call-accepted', async (data) => {
        console.log('Call accepted by:', data);
        
        // Clear the timeout since the call was answered
        if (callTimeoutRef.current) {
          clearTimeout(callTimeoutRef.current);
          callTimeoutRef.current = null;
        }
        
        setIsCallActive(true);
        startCallTimer();
        
        // Now create peer connection and send offer
        await createPeerConnection();
      });
    } catch (socketError) {
      console.error('Error initiating call via socket:', socketError);
      setError('Failed to start call. Please check your connection and try again.');
      
      // Clear the timeout
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
      }
      
      // Clean up and close the call UI if we can't even start the call
      cleanupCall();
      onClose();
    }
  };
  
  // Handle call acceptance (for incoming calls)
  const handleAcceptCall = async () => {
    if (!socket) return;
    
    try {
      // Initialize local media first
      await initializeCall();
      
      // Notify the caller that we accepted the call
      socket.emit('call-accepted', {
        callerId: caller.uid,
        calleeId: localUser.uid
      });
      
      // Update UI state
      onAccept();
      setIsCallActive(true);
      startCallTimer();
      
      // The peer connection will be created when we receive the offer
      // in the call-offer handler
    } catch (err) {
      console.error('Error accepting call:', err);
      setError('Failed to accept call. Please try again.');
    }
  };
  
  // Add this new useEffect for handling ICE candidates
  useEffect(() => {
    if (!socket || !isOpen) return;
    
    // Handler for ICE candidates from the remote peer
    const handleIceCandidate = async (data) => {
      try {
        console.log('Received ICE candidate:', data);
        
        // For incoming calls, check if this candidate is for us
        const isForUs = (isIncoming && 
                         data.callerId === caller.uid && 
                         data.calleeId === localUser.uid) ||
                        (!isIncoming && 
                         data.callerId === localUser.uid && 
                         data.calleeId === callee.uid);
        
        if (!isForUs) {
          console.log('Ignoring ICE candidate not intended for us');
          return;
        }
        
        // Create an RTCIceCandidate
        const candidate = new RTCIceCandidate(data.candidate);
        console.log(`ICE candidate type: ${candidate.type}, protocol: ${candidate.protocol}, address: ${candidate.address}`);
        
        // If peer connection exists and remote description is set, add candidate
        if (peerConnectionRef.current && remoteSdpSet.current) {
          console.log('Peer connection ready, adding ICE candidate directly');
          try {
            await peerConnectionRef.current.addIceCandidate(candidate);
            console.log('Successfully added ICE candidate');
            
            // Check connection state after adding candidate
            const iceState = peerConnectionRef.current.iceConnectionState;
            console.log(`ICE connection state after adding candidate: ${iceState}`);
          } catch (addErr) {
            console.error('Error adding ICE candidate:', addErr);
            // Even if we fail to add one candidate, don't give up - it's normal for some to fail
          }
        } else {
          // Otherwise, store for later
          console.log('Storing ICE candidate for later - peer connection not ready');
          setPendingIceCandidates(prev => [...prev, candidate]);
        }
      } catch (err) {
        console.error('Error handling ICE candidate:', err);
      }
    };
    
    socket.on('ice-candidate', handleIceCandidate);
    
    return () => {
      socket.off('ice-candidate', handleIceCandidate);
    };
  }, [socket, isOpen, isIncoming, caller, callee, localUser]);
  
  // Modify the useEffect that handles call offers
  useEffect(() => {
    if (!socket || !isOpen) return;

    // Listen for call-offer events (this contains the actual WebRTC offer)
    const handleCallOffer = async (data) => {
      try {
        console.log('Received call offer:', data);
        
        // For incoming calls, now we create the peer connection when we have the offer
        if (isIncoming && data.callerId === caller.uid && data.calleeId === localUser.uid) {
          // Update isAudioOnly based on the offer's callType if it's provided
          if (data.callType) {
            const isAudioOnlyCall = data.callType === 'audio';
            console.log(`Offer specifies callType=${data.callType}, updating isAudioOnly=${isAudioOnlyCall}`);
            setIsAudioOnly(isAudioOnlyCall);
            setIsVideoEnabled(!isAudioOnlyCall);
          }
          
          // Create peer connection
          if (!peerConnectionRef.current) {
            // Create a new RTCPeerConnection
            peerConnectionRef.current = new RTCPeerConnection({ 
              iceServers: iceServers
            });
            
            // Add local stream tracks to the connection
            if (localStreamRef.current) {
              console.log('Adding local tracks to peer connection for incoming call');
              const tracks = localStreamRef.current.getTracks();
              console.log(`Local stream has ${tracks.length} tracks to add`, 
                tracks.map(t => `${t.kind} (enabled: ${t.enabled}, muted: ${t.muted})`));
              
              tracks.forEach(track => {
                console.log(`Adding ${track.kind} track to peer connection`);
                peerConnectionRef.current.addTrack(track, localStreamRef.current);
              });
            }
            
            // Listen for ICE candidates
            peerConnectionRef.current.onicecandidate = (event) => {
              if (event.candidate) {
                // Log the candidate for debugging
                console.log(`Generated local ICE candidate:`, {
                  type: event.candidate.type,
                  protocol: event.candidate.protocol,
                  address: event.candidate.address,
                  port: event.candidate.port,
                  candidateType: event.candidate.candidateType
                });
                
                // Send the candidate to the remote peer
                try {
                  const targetId = isIncoming ? caller.uid : callee.uid;
                  console.log(`Sending ICE candidate to ${isIncoming ? 'caller' : 'callee'} with ID ${targetId}`);
                  
                  socket.emit('ice-candidate', {
                    candidate: event.candidate,
                    callerId: isIncoming ? caller.uid : localUser.uid,
                    calleeId: isIncoming ? localUser.uid : callee.uid
                  });
                } catch (socketError) {
                  console.error('Error sending ICE candidate via socket:', socketError);
                  // ICE candidate errors are not fatal, so just log them
                  console.warn('This may affect connection quality');
                }
              } else {
                console.log('All ICE candidates have been generated');
              }
            };
            
            // CRITICAL FIX: Improved ontrack handler for incoming calls
            peerConnectionRef.current.ontrack = (event) => {
              console.log('FIXED INCOMING: Remote track received:', event);
              
              // Debug the incoming track
              if (event.track) {
                console.log(`FIXED INCOMING: Track details - kind: ${event.track.kind}, enabled: ${event.track.enabled}, muted: ${event.track.muted}, id: ${event.track.id}`);
                
                // Add listeners to track state changes
                event.track.onmute = () => console.log('Remote track muted');
                event.track.onunmute = () => console.log('Remote track unmuted');
                event.track.onended = () => console.log('Remote track ended');
                
                // For audio-only calls, route audio to the dedicated audio element
                if (event.track.kind === 'audio' && isAudioOnly && audioElementRef.current) {
                  console.log('FIXED INCOMING: Setting up dedicated audio element for audio-only call');
                  
                  try {
                    // Create a new stream with just this audio track
                    const audioStream = new MediaStream([event.track]);
                    
                    // Set the stream to the audio element
                    audioElementRef.current.srcObject = audioStream;
                    audioElementRef.current.volume = 1.0;
                    audioElementRef.current.muted = false;
                    
                    // Force autoplay
                    const playPromise = audioElementRef.current.play();
                    
                    if (playPromise !== undefined) {
                      playPromise.catch(err => {
                        console.error('Error playing audio:', err);
                        
                        // Try again with user interaction
                        setTimeout(() => {
                          audioElementRef.current.play().catch(e => 
                            console.warn('Still unable to autoplay audio:', e)
                          );
                        }, 1000);
                      });
                    }
                  } catch (err) {
                    console.error('Error setting up audio element:', err);
                  }
                }
              }
              
              // Process remote streams - this is the critical part for fixing remote stream issues
              if (event.streams && event.streams.length > 0) {
                console.log(`FIXED INCOMING: Got remote stream with ${event.streams[0].getTracks().length} tracks`);
                
                if (remoteVideoRef.current) {
                  console.log('FIXED INCOMING: Setting remote stream to video element');
                  
                  try {
                    // Always set the stream to the video element, even for audio-only calls as backup
                    remoteVideoRef.current.srcObject = event.streams[0];
                    
                    // Add explicit volume settings
                    remoteVideoRef.current.volume = 1.0;
                    remoteVideoRef.current.muted = false;
                    
                    // Force play
                    remoteVideoRef.current.play().catch(e => {
                      console.warn('Failed to autoplay remote video:', e);
                      
                      // Try again after a delay
                      setTimeout(() => {
                        remoteVideoRef.current.play().catch(e2 => {
                          console.warn('Second autoplay attempt failed:', e2);
                        });
                      }, 1000);
                    });
                    
                    console.log('FIXED INCOMING: Remote video element setup complete');
                  } catch (err) {
                    console.error('Error setting up remote video element:', err);
                  }
                } else {
                  console.warn('FIXED INCOMING: Remote video ref is not available');
                }
                
                // Set up audio monitoring for the remote stream
                setupRemoteAudioMonitoring(event.streams[0]);
              } else if (event.track) {
                // Fallback: If no stream is provided but we have a track, create our own MediaStream
                console.log('FIXED INCOMING: No streams array, creating new MediaStream from track');
                const newStream = new MediaStream([event.track]);
                
                if (remoteVideoRef.current) {
                  remoteVideoRef.current.srcObject = newStream;
                  remoteVideoRef.current.volume = 1.0;
                  remoteVideoRef.current.muted = false;
                  remoteVideoRef.current.play().catch(e => console.warn('Play failed for fallback stream:', e));
                }
              }
            };
          }
          
          // Set the remote description (this is the offer)
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
          remoteSdpSet.current = true;
          
          // Add any pending ICE candidates
          if (pendingIceCandidates.length > 0) {
            console.log(`Adding ${pendingIceCandidates.length} pending ICE candidates`);
            for (const candidate of pendingIceCandidates) {
              await peerConnectionRef.current.addIceCandidate(candidate);
            }
            setPendingIceCandidates([]);
          }
          
          // Now create and send an answer
          await createAndSendAnswer();
        }
      } catch (err) {
        console.error('Error handling call offer:', err);
        setError('Failed to process incoming call. Please try again.');
      }
    };

    socket.on('call-offer', handleCallOffer);
    
    return () => {
      socket.off('call-offer', handleCallOffer);
    };
  }, [socket, isOpen, isIncoming, caller, localUser, iceServers, pendingIceCandidates]);
  
  // Create and initialize the peer connection - only for outgoing calls now
  const createPeerConnection = async () => {
    try {
      console.log('Creating peer connection with ICE servers:');
      // Log each ICE server for debugging
      iceServers.forEach((server, i) => {
        console.log(`ICE Server ${i + 1}:`, {
          urls: server.urls,
          hasCredentials: !!server.username && !!server.credential
        });
      });
      
      // Create a new RTCPeerConnection with improved configuration
      peerConnectionRef.current = new RTCPeerConnection({ 
        iceServers: iceServers,
        iceTransportPolicy: 'all',
        iceCandidatePoolSize: 10,
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
        sdpSemantics: 'unified-plan'
      });
      
      console.log(`Adding local tracks to peer connection (isIncoming: ${isIncoming})`);
      // Add local stream tracks to the connection
      if (localStreamRef.current) {
        const tracks = localStreamRef.current.getTracks();
        console.log(`Local stream has ${tracks.length} tracks to add:`, 
          tracks.map(t => `${t.kind} (enabled: ${t.enabled}, muted: ${t.muted})`));
        
        tracks.forEach(track => {
          console.log(`Adding ${track.kind} track to peer connection`);
          peerConnectionRef.current.addTrack(track, localStreamRef.current);
        });
      } else {
        console.error('No local stream available');
        await initializeCall();
        if (localStreamRef.current) {
          const tracks = localStreamRef.current.getTracks();
          console.log(`Initialized stream has ${tracks.length} tracks`);
          tracks.forEach(track => {
            console.log(`Adding ${track.kind} track to peer connection after init`);
            peerConnectionRef.current.addTrack(track, localStreamRef.current);
          });
        }
      }
      
      // Log all transceivers to check directionality
      const transceivers = peerConnectionRef.current.getTransceivers();
      transceivers.forEach((transceiver, i) => {
        console.log(`Initial transceiver ${i}:`, {
          mid: transceiver.mid,
          direction: transceiver.direction,
          currentDirection: transceiver.currentDirection,
          kind: transceiver.receiver.track ? transceiver.receiver.track.kind : 'unknown'
        });
        
        // Ensure bidirectional for both audio and video
        if (!isAudioOnly || (isAudioOnly && transceiver.receiver.track && transceiver.receiver.track.kind === 'audio')) {
          console.log(`Setting transceiver ${i} direction to sendrecv`);
          transceiver.direction = 'sendrecv';
        }
      });
      
      // Listen for ICE candidates
      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate) {
          // Log the candidate for debugging
          console.log(`Generated local ICE candidate:`, {
            type: event.candidate.type,
            protocol: event.candidate.protocol,
            address: event.candidate.address,
            port: event.candidate.port,
            candidateType: event.candidate.candidateType
          });
          
          // Send the candidate to the remote peer
          try {
            const targetId = isIncoming ? caller.uid : callee.uid;
            console.log(`Sending ICE candidate to ${isIncoming ? 'caller' : 'callee'} with ID ${targetId}`);
            
            socket.emit('ice-candidate', {
              candidate: event.candidate,
              callerId: isIncoming ? caller.uid : localUser.uid,
              calleeId: isIncoming ? localUser.uid : callee.uid
            });
          } catch (socketError) {
            console.error('Error sending ICE candidate via socket:', socketError);
            // ICE candidate errors are not fatal, so just log them
            console.warn('This may affect connection quality');
          }
        } else {
          console.log('All ICE candidates have been generated');
        }
      };
      
      // Connection stability variables
      let reconnectAttempts = 0;
      const maxReconnectAttempts = 3;
      let reconnectionTimer = null;
      let connectionHealthCheckTimer = null;
      let lastIceState = null;
      
      // Enhanced ICE connection state monitoring
      peerConnectionRef.current.oniceconnectionstatechange = () => {
        const iceState = peerConnectionRef.current.iceConnectionState;
        console.log('ICE connection state changed:', iceState);
        
        // Update UI based on connection state
        switch (iceState) {
          case 'checking':
            setError('Establishing connection...');
            break;
            
          case 'connected':
          case 'completed':
            setError(null);
            // Connection is stable, reset reconnect attempts
            reconnectAttempts = 0;
            
            // Check and fix audio issues after connection is established
            setTimeout(checkAndFixAudioIssues, 1000);
            
            // Add this call to ensure media flow
            setTimeout(() => {
              console.log('Running media flow check after ICE connected...');
              ensureMediaFlow();
            }, 1000);
            
            // Clear any pending reconnection timers
            if (reconnectionTimer) {
              clearTimeout(reconnectionTimer);
              reconnectionTimer = null;
            }
            
            // Start a health check timer to monitor connection quality
            if (!connectionHealthCheckTimer) {
              connectionHealthCheckTimer = setInterval(() => {
                // Get connection stats to monitor quality
                if (peerConnectionRef.current) {
                  peerConnectionRef.current.getStats().then(stats => {
                    stats.forEach(report => {
                      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                        console.log('Connection RTT:', report.currentRoundTripTime);
                        // Could update UI with connection quality indicator
                      }
                    });
                  }).catch(err => console.error('Error getting connection stats:', err));
                }
              }, 5000);
            }
            break;
            
          case 'disconnected':
            setError('Connection interrupted. Attempting to reconnect...');
            
            // Try to reconnect if disconnected
            if (reconnectAttempts < maxReconnectAttempts) {
              reconnectionTimer = setTimeout(() => {
                console.log(`Attempting reconnection #${reconnectAttempts + 1}`);
                
                // Refresh ICE candidates by restarting ICE
                if (peerConnectionRef.current) {
                  try {
                    peerConnectionRef.current.restartIce();
                    reconnectAttempts++;
                  } catch (err) {
                    console.error('Error restarting ICE:', err);
                  }
                }
              }, 2000);
            } else {
              setError('Connection lost. Please try again later.');
            }
            break;
            
          case 'failed':
            setError('Connection failed. Please check your network and try again.');
            
            // If we reach max attempts, suggest user to end and retry
            if (reconnectAttempts >= maxReconnectAttempts) {
              setError('Unable to establish a stable connection. Please end the call and try again.');
            } else if (reconnectAttempts < maxReconnectAttempts) {
              // One last attempt with a complete reconnection
              reconnectionTimer = setTimeout(async () => {
                console.log(`Final reconnection attempt #${reconnectAttempts + 1}`);
                
                try {
                  // Try creating a new peer connection
                  if (peerConnectionRef.current) {
                    peerConnectionRef.current.close();
                  }
                  await createPeerConnection();
                  reconnectAttempts++;
                } catch (err) {
                  console.error('Error during reconnection:', err);
                  setError('Reconnection failed. Please end the call and try again.');
                }
              }, 3000);
            }
            break;
            
          case 'closed':
            // Connection was closed, clear timers
            if (connectionHealthCheckTimer) {
              clearInterval(connectionHealthCheckTimer);
              connectionHealthCheckTimer = null;
            }
            if (reconnectionTimer) {
              clearTimeout(reconnectionTimer);
              reconnectionTimer = null;
            }
            break;
            
          default:
            break;
        }
        
        // Track state change for analytics
        lastIceState = iceState;
      };
      
      // Listen for connection state changes
      peerConnectionRef.current.onconnectionstatechange = (event) => {
        console.log('Connection state change:', peerConnectionRef.current.connectionState);
        
        if (peerConnectionRef.current.connectionState === 'connected') {
          console.log('WebRTC connection established successfully!');
          
          // Add this call to ensure media flow
          setTimeout(() => {
            console.log('Running media flow check after connection established...');
            ensureMediaFlow();
          }, 1000);
        } else if (peerConnectionRef.current.connectionState === 'failed') {
          console.error('WebRTC connection failed');
          setError('Connection failed. Please try again.');
          handleEndCall();
        }
      };
      
      // Listen for remote stream
      peerConnectionRef.current.ontrack = (event) => {
        console.log('Remote track received:', event);
        
        // Debug the incoming track
        if (event.track) {
          console.log(`Received track of kind: ${event.track.kind}, enabled: ${event.track.enabled}, muted: ${event.track.muted}`);
          
          // Add listeners to track state changes
          event.track.onmute = () => console.log('Remote track muted');
          event.track.onunmute = () => console.log('Remote track unmuted');
          event.track.onended = () => console.log('Remote track ended');
          
          // For audio-only calls, route audio to the dedicated audio element
          if (event.track.kind === 'audio' && isAudioOnly && audioElementRef.current) {
            console.log('Setting up dedicated audio element for audio-only call');
            
            try {
              // Create a new stream with just this audio track
              const audioStream = new MediaStream([event.track]);
              
              // Set the stream to the audio element
              audioElementRef.current.srcObject = audioStream;
              audioElementRef.current.volume = 1.0;
              audioElementRef.current.muted = false;
              
              // Force autoplay
              const playPromise = audioElementRef.current.play();
              
              if (playPromise !== undefined) {
                playPromise.catch(err => {
                  console.error('Error playing audio:', err);
                  // Try again with user interaction
                  console.log('Will attempt to play audio again on next user interaction');
                  
                  // Setup retry mechanism that will try to play again
                  setTimeout(() => {
                    audioElementRef.current.play().catch(e => 
                      console.warn('Still unable to autoplay audio:', e)
                    );
                  }, 1000);
                });
              }
              
              console.log('Audio element setup complete:', {
                srcObject: !!audioElementRef.current.srcObject,
                volume: audioElementRef.current.volume,
                muted: audioElementRef.current.muted,
                paused: audioElementRef.current.paused
              });
            } catch (err) {
              console.error('Error setting up audio element:', err);
            }
          }
        }
        
        // CRITICAL FIX: Ensure we process the remote stream correctly
        // and attach it to our video/audio elements
        if (event.streams && event.streams[0]) {
          const remoteStream = event.streams[0];
          console.log(`FIXING: Setting remote stream - has video tracks: ${remoteStream.getVideoTracks().length > 0}, has audio tracks: ${remoteStream.getAudioTracks().length > 0}`);
          
          if (remoteVideoRef.current) {
            console.log('FIXING: Explicitly setting remote stream to video element');
            
            // Force set the stream to our video element
            remoteVideoRef.current.srcObject = remoteStream;
            
            // Ensure volume is up and not muted
            remoteVideoRef.current.volume = 1.0;
            remoteVideoRef.current.muted = false;
            
            // Force play
            if (remoteVideoRef.current.paused) {
              console.log('FIXING: Remote video is paused, force playing...');
              const playPromise = remoteVideoRef.current.play();
              if (playPromise !== undefined) {
                playPromise.catch(err => {
                  console.error('Error playing remote video:', err);
                  // Try again after a short delay
                  setTimeout(() => {
                    remoteVideoRef.current.play().catch(e => 
                      console.warn('Still unable to play remote video:', e)
                    );
                  }, 1000);
                });
              }
            }
            
            // Add play/pause listeners for debugging
            remoteVideoRef.current.onplay = () => {
              console.log('Remote video element started playing');
            };
            
            remoteVideoRef.current.onpause = () => {
              console.log('Remote video element paused - attempting autoplay again');
              remoteVideoRef.current.play().catch(e => console.warn('Autoplay retry failed:', e));
            };
          }
          
          // Also set up audio monitoring for the remote stream
          setupRemoteAudioMonitoring(remoteStream);
          
          // Additional check for audio/video tracks after a short delay
          setTimeout(() => {
            if (!remoteVideoRef.current || !remoteVideoRef.current.srcObject) {
              console.log('FIXING: Remote video element has no stream after timeout, retry setting');
              if (remoteVideoRef.current && remoteStream) {
                remoteVideoRef.current.srcObject = remoteStream;
                remoteVideoRef.current.play().catch(e => console.warn('Play retry failed:', e));
              }
            }
            
            const currentStream = remoteVideoRef.current?.srcObject;
            if (currentStream) {
              const audioTracks = currentStream.getAudioTracks();
              const videoTracks = currentStream.getVideoTracks();
              console.log(`After delay - remote stream has ${audioTracks.length} audio tracks and ${videoTracks.length} video tracks`);
              
              // Log and ensure all tracks are enabled
              [...audioTracks, ...videoTracks].forEach((track, index) => {
                console.log(`Track ${index} (${track.kind}) - enabled: ${track.enabled}, muted: ${track.muted}, readyState: ${track.readyState}`);
                
                // Ensure tracks are enabled
                if (!track.enabled) {
                  console.log(`FIXING: Enabling previously disabled ${track.kind} track`);
                  track.enabled = true;
                }
              });
            }
          }, 2000);
        } else {
          console.error('FIXING: Remote track event has no streams array or empty streams!');
          
          // Fallback: create our own MediaStream if event.streams is missing
          if (event.track) {
            console.log('FIXING: Creating new MediaStream from received track');
            const newStream = new MediaStream([event.track]);
            
            if (remoteVideoRef.current) {
              console.log('FIXING: Setting newly created stream to remote video element');
              remoteVideoRef.current.srcObject = newStream;
              remoteVideoRef.current.volume = 1.0;
              remoteVideoRef.current.muted = false;
              remoteVideoRef.current.play().catch(e => console.warn('Play failed for fallback stream:', e));
            }
          }
        }
      };
      
      // For outgoing calls, create and send an offer
      if (!isIncoming) {
        // Create and send an offer
        await createAndSendOffer();
      }
      
      return peerConnectionRef.current;
    } catch (err) {
      console.error('Error creating peer connection:', err);
      setError('Failed to establish connection. Please try again.');
      return null;
    }
  };
  
  // Create and send an offer (outgoing call)
  const createAndSendOffer = async () => {
    if (!peerConnectionRef.current) {
      console.error('PeerConnection not initialized');
      return;
    }
    
    try {
      // Use callType directly to be safe
      const isAudioOnlyCall = callType === 'audio';
      console.log(`Creating offer with callType=${callType}, isAudioOnly=${isAudioOnlyCall}`);
      
      // Ensure all transceivers are set to sendrecv before creating offer
      const transceivers = peerConnectionRef.current.getTransceivers();
      transceivers.forEach(transceiver => {
        // For audio-only, only set audio to sendrecv
        if (isAudioOnlyCall && transceiver.receiver.track && transceiver.receiver.track.kind === 'audio') {
          console.log(`Setting audio transceiver to sendrecv`);
          transceiver.direction = 'sendrecv';
        } 
        // For video call, set all transceivers to sendrecv
        else if (!isAudioOnlyCall) {
          console.log(`Setting ${transceiver.receiver.track ? transceiver.receiver.track.kind : 'unknown'} transceiver to sendrecv`);
          transceiver.direction = 'sendrecv';
        }
      });
      
      const offer = await peerConnectionRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: !isAudioOnlyCall,
        voiceActivityDetection: true
      });
      
      console.log(`Offer SDP created:`, 
        offer.sdp.split('\n').filter(line => 
          line.includes('a=sendrecv') || 
          line.includes('a=sendonly') || 
          line.includes('a=recvonly') || 
          line.includes('a=inactive')
        )
      );
      
      await peerConnectionRef.current.setLocalDescription(offer);
      
      // Send the offer to the remote peer with callType
      try {
        socket.emit('call-offer', {
          offer: offer,
          callerId: localUser.uid,
          calleeId: callee.uid,
          callType: isAudioOnlyCall ? 'audio' : 'video'
        });
        
        // Set this flag so we know we can add ICE candidates directly
        remoteSdpSet.current = false; // We haven't received the answer yet
      } catch (socketError) {
        console.error('Error sending call offer via socket:', socketError);
        setError('Failed to send call offer. Please check your connection and try again.');
      }
    } catch (err) {
      console.error('Error creating offer:', err);
      setError('Failed to create call offer. Please try again.');
    }
  };
  
  // Create and send an answer (incoming call)
  const createAndSendAnswer = async () => {
    if (!peerConnectionRef.current) {
      console.error('PeerConnection not initialized');
      return;
    }
    
    try {
      // Use callType directly to be safe
      const isAudioOnlyCall = callType === 'audio';
      console.log(`Creating answer with callType=${callType}, isAudioOnly=${isAudioOnlyCall}`);
      
      // Ensure all transceivers are set to sendrecv before creating answer
      const transceivers = peerConnectionRef.current.getTransceivers();
      transceivers.forEach(transceiver => {
        // For audio-only, only set audio to sendrecv
        if (isAudioOnlyCall && transceiver.receiver.track && transceiver.receiver.track.kind === 'audio') {
          console.log(`Setting audio transceiver to sendrecv`);
          transceiver.direction = 'sendrecv';
        } 
        // For video call, set all transceivers to sendrecv
        else if (!isAudioOnlyCall) {
          console.log(`Setting ${transceiver.receiver.track ? transceiver.receiver.track.kind : 'unknown'} transceiver to sendrecv`);
          transceiver.direction = 'sendrecv';
        }
      });
      
      const answer = await peerConnectionRef.current.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: !isAudioOnlyCall,
        voiceActivityDetection: true
      });
      
      console.log(`Answer SDP created:`, 
        answer.sdp.split('\n').filter(line => 
          line.includes('a=sendrecv') || 
          line.includes('a=sendonly') || 
          line.includes('a=recvonly') || 
          line.includes('a=inactive')
        )
      );
      
      await peerConnectionRef.current.setLocalDescription(answer);
      
      // Send the answer to the remote peer
      try {
        socket.emit('call-answer', {
          answer: answer,
          callerId: caller.uid,
          calleeId: localUser.uid,
          callType: isAudioOnlyCall ? 'audio' : 'video'
        });
        
        // We've already set the remote description (the offer)
        // and now we've set our local description (the answer)
        remoteSdpSet.current = true;
      } catch (socketError) {
        console.error('Error sending call answer via socket:', socketError);
        setError('Failed to send call answer. Please check your connection and try again.');
      }
    } catch (err) {
      console.error('Error creating answer:', err);
      setError('Failed to create call answer. Please try again.');
    }
  };
  
  // Handle rejection/ending call
  const handleEndCall = () => {
    console.log('Ending call and notifying remote peer');
    
    // Clear the call timeout if it exists
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    
    // Before cleanup, send call-ended event to notify the other user
    if (socket) {
      try {
        socket.emit('call-ended', {
          callerId: isIncoming ? caller.uid : localUser.uid,
          calleeId: isIncoming ? localUser.uid : callee.uid
        });
        
        // Give a small delay to let the message go through before cleanup
        setTimeout(() => {
          cleanupCall();
          onClose();
        }, 100);
      } catch (socketError) {
        console.error('Error sending call-ended event:', socketError);
        cleanupCall();
        onClose();
      }
    } else {
      cleanupCall();
      onClose();
    }
  };
  
  // Clean up media streams and connections
  const cleanupCall = () => {
    console.log('Cleaning up call resources and resetting states');
    
    // Reset initialization flag
    callInitializedRef.current = false;
    
    // Clear the call timeout if it exists
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
    
    // Stop the timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Reset media states
    setIsCallActive(false);
    setIsLoading(false);
    setError(null);
    setIsMuted(false);
    setIsVideoEnabled(callType === 'video'); // Reset to original value based on callType
    setIsAudioOnly(callType === 'audio'); // Reset to original value based on callType
    setCallDuration(0);
    
    // Remove any socket event listeners for specific call events
    if (socket) {
      // Not removing the main socket listeners managed by useEffect hooks
      // But we can explicitly remove one-time listeners if needed
      socket.off('call-accepted');
      socket.off('call-offer');
      socket.off('call-answer');
      socket.off('call-ended');
    }
    
    // Reset SDP state
    remoteSdpSet.current = false;
    
    // Clear pending ICE candidates
    setPendingIceCandidates([]);
    
    // Close the peer connection
    if (peerConnectionRef.current) {
      try {
        // First close all tracks to ensure proper cleanup
        const senders = peerConnectionRef.current.getSenders();
        senders.forEach(sender => {
          if (sender.track) {
            sender.track.stop();
          }
        });
        
        // Then close the connection
        peerConnectionRef.current.close();
      } catch (err) {
        console.error('Error closing peer connection:', err);
      } finally {
        peerConnectionRef.current = null;
      }
    }
    
    // Stop all tracks in the local stream
    if (localStreamRef.current) {
      try {
        localStreamRef.current.getTracks().forEach(track => {
          track.stop();
        });
      } catch (err) {
        console.error('Error stopping local tracks:', err);
      } finally {
        localStreamRef.current = null;
      }
    }
    
    // Reset video elements
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    
    // Reset audio element for audio-only calls
    if (audioElementRef.current) {
      audioElementRef.current.srcObject = null;
      audioElementRef.current.pause();
    }
    
    // Close any audio contexts
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (err) {
        console.error('Error closing audio context:', err);
      }
    }
    
    // Stop audio monitoring
    if (audioMonitoringIntervalRef.current) {
      clearInterval(audioMonitoringIntervalRef.current);
      audioMonitoringIntervalRef.current = null;
    }
    
    console.log('Call cleanup completed');
  };
  
  // Toggle microphone
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };
  
  // Toggle camera
  const toggleVideo = () => {
    if (isAudioOnly) return; // Don't toggle video in audio-only calls
    
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };
  
  // Start the call timer
  const startCallTimer = () => {
    timerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };
  
  // Format the call duration into MM:SS
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Play sound for incoming calls (but remove notification code)
  useEffect(() => {
    if (isOpen && isIncoming && !isCallActive) {
      // Play ringtone for incoming calls
      const ringtone = ringtoneRef.current;
      ringtone.loop = true;
      ringtone.volume = 0.7;
      ringtone.play().catch(err => console.error('Error playing ringtone:', err));
      
      return () => {
        ringtone.pause();
        ringtone.currentTime = 0;
      };
    }
  }, [isOpen, isIncoming, isCallActive]);

  // Function to switch between front and back cameras
  const switchCamera = async () => {
    if (isAudioOnly || !isVideoEnabled || !localStreamRef.current) return;
    
    try {
      setIsSwitchingCamera(true);
      
      // Determine the new facing mode
      const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
      console.log(`Switching camera from ${currentFacingMode} to ${newFacingMode}`);
      
      // Stop all existing video tracks
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach(track => track.stop());
      
      // Get new video stream with the opposite camera
      const newConstraints = {
        video: {
          facingMode: { exact: newFacingMode },
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false // Don't request audio again since we already have it
      };
      
      const newVideoStream = await navigator.mediaDevices.getUserMedia(newConstraints);
      const newVideoTrack = newVideoStream.getVideoTracks()[0];
      
      // Replace the track in the local stream
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      const newStream = new MediaStream([audioTrack, newVideoTrack]);
      localStreamRef.current = newStream;
      
      // Update video element
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = newStream;
      }
      
      // Replace the track in the peer connection
      if (peerConnectionRef.current) {
        const senders = peerConnectionRef.current.getSenders();
        const videoSender = senders.find(sender => 
          sender.track && sender.track.kind === 'video'
        );
        
        if (videoSender) {
          await videoSender.replaceTrack(newVideoTrack);
        }
      }
      
      // Update facing mode state
      setCurrentFacingMode(newFacingMode);
      
    } catch (err) {
      console.error('Error switching camera:', err);
      setError(`Failed to switch camera: ${err.message}`);
    } finally {
      setIsSwitchingCamera(false);
    }
  };
  
  // Check if device has multiple cameras
  useEffect(() => {
    const checkCameraSupport = async () => {
      if (!isAudioOnly && navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoDevices = devices.filter(device => device.kind === 'videoinput');
          setIsCameraSupported(videoDevices.length > 1);
        } catch (err) {
          console.error('Error checking camera support:', err);
          setIsCameraSupported(false);
        }
      }
    };
    
    if (isOpen) {
      checkCameraSupport();
    }
  }, [isOpen, isAudioOnly]);

  // Add a new useEffect for handling call answers
  useEffect(() => {
    if (!socket || !isOpen || isIncoming) return; // Only for outgoing calls
    
    // Handler for call answer from the callee
    const handleCallAnswer = async (data) => {
      try {
        console.log('Received call answer:', data);
        
        // Make sure this answer is for our call
        if (data.callerId === localUser.uid && data.calleeId === callee.uid) {
          if (!peerConnectionRef.current) {
            console.error('Peer connection not initialized when answer received');
            return;
          }
          
          // Log the answer SDP for debugging
          console.log(`Processing answer SDP:`, 
            data.answer.sdp.split('\n').filter(line => 
              line.includes('a=sendrecv') || 
              line.includes('a=sendonly') || 
              line.includes('a=recvonly') || 
              line.includes('a=inactive')
            )
          );
          
          // Set the remote description (the answer)
          console.log('Setting remote description from answer');
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
          remoteSdpSet.current = true;
          
          // Log the state of all transceivers after setting remote description
          const transceivers = peerConnectionRef.current.getTransceivers();
          transceivers.forEach((transceiver, i) => {
            console.log(`Transceiver ${i} after answer:`, {
              mid: transceiver.mid,
              direction: transceiver.direction,
              currentDirection: transceiver.currentDirection,
              kind: transceiver.receiver.track ? transceiver.receiver.track.kind : 'unknown'
            });
          });
          
          // Force state check for the connection
          const connectionState = peerConnectionRef.current.connectionState;
          const iceConnectionState = peerConnectionRef.current.iceConnectionState;
          console.log(`Connection state after answer: ${connectionState}, ICE state: ${iceConnectionState}`);
          
          // Add any pending ICE candidates
          if (pendingIceCandidates.length > 0) {
            console.log(`Adding ${pendingIceCandidates.length} pending ICE candidates`);
            for (const candidate of pendingIceCandidates) {
              await peerConnectionRef.current.addIceCandidate(candidate);
              console.log('Added pending ICE candidate');
            }
            setPendingIceCandidates([]);
          }
          
          // Ensure the peer connection is ready to receive remote tracks
          if (iceConnectionState === 'new' || iceConnectionState === 'checking') {
            console.log('Connection still being established, waiting for tracks...');
          } else if (iceConnectionState === 'failed' || iceConnectionState === 'disconnected') {
            console.warn('Connection in bad state, attempting to restart ICE');
            
            // Try to restart ICE if needed
            if (peerConnectionRef.current.restartIce) {
              console.log('Restarting ICE connection');
              peerConnectionRef.current.restartIce();
            }
          }
          
          // Add this call to ensure media flow
          setTimeout(() => {
            console.log('Running media flow check after answer...');
            ensureMediaFlow();
          }, 2000);
        }
      } catch (err) {
        console.error('Error handling call answer:', err);
        setError('Failed to establish connection. Please try again.');
      }
    };
    
    socket.on('call-answer', handleCallAnswer);
    
    return () => {
      socket.off('call-answer', handleCallAnswer);
    };
  }, [socket, isOpen, isIncoming, localUser, callee, pendingIceCandidates]);

  // Add a function to check and fix audio issues
  const checkAndFixAudioIssues = () => {
    try {
      if (!remoteVideoRef.current || !remoteVideoRef.current.srcObject) {
        console.log("Cannot check audio - no remote stream");
        return;
      }

      const audioTracks = remoteVideoRef.current.srcObject.getAudioTracks();
      console.log(`Checking audio - found ${audioTracks.length} audio tracks`);

      if (audioTracks.length > 0) {
        audioTracks.forEach(track => {
          // Make sure tracks are enabled
          if (!track.enabled) {
            console.log("Found disabled audio track - enabling");
            track.enabled = true;
          }
        });
      } else {
        console.warn("No audio tracks found in remote stream");
      }

      // Make sure volume is set
      remoteVideoRef.current.volume = 1.0;
      
      // Make sure it's not muted
      remoteVideoRef.current.muted = false;
      
      console.log(`Remote video element - volume: ${remoteVideoRef.current.volume}, muted: ${remoteVideoRef.current.muted}`);
    } catch (err) {
      console.error("Error checking audio state:", err);
    }
  };

  // Add this new function near the checkAndFixAudioIssues function
  const runAudioDiagnostics = () => {
    console.log('=== RUNNING AUDIO DIAGNOSTICS ===');
    
    // 1. Check for audio element state
    if (audioElementRef.current) {
      console.log('Audio element state:', {
        volume: audioElementRef.current.volume,
        muted: audioElementRef.current.muted,
        paused: audioElementRef.current.paused,
        hasStream: !!audioElementRef.current.srcObject,
        streamActive: audioElementRef.current.srcObject ? 
          audioElementRef.current.srcObject.active : false,
        audioTracks: audioElementRef.current.srcObject ?
          audioElementRef.current.srcObject.getAudioTracks().length : 0
      });
      
      // Check if tracks are enabled/active
      if (audioElementRef.current.srcObject) {
        const audioTracks = audioElementRef.current.srcObject.getAudioTracks();
        audioTracks.forEach((track, i) => {
          console.log(`Audio track ${i}:`, {
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState,
            id: track.id
          });
          
          // Force enable
          if (!track.enabled) {
            track.enabled = true;
            console.log(`Forced track ${i} to enabled state`);
          }
        });
      }
      
      // Force play
      if (audioElementRef.current.paused) {
        console.log('Audio element is paused, attempting to play...');
        audioElementRef.current.play().catch(err => {
          console.error('Failed to play audio element:', err);
        });
      }
    } else {
      console.warn('Audio element reference not available');
    }
    
    // 2. Check remote video element (backup for audio)
    if (remoteVideoRef.current) {
      console.log('Remote video element state:', {
        volume: remoteVideoRef.current.volume,
        muted: remoteVideoRef.current.muted,
        paused: remoteVideoRef.current.paused,
        hasStream: !!remoteVideoRef.current.srcObject,
        streamActive: remoteVideoRef.current.srcObject ? 
          remoteVideoRef.current.srcObject.active : false,
        audioTracks: remoteVideoRef.current.srcObject ?
          remoteVideoRef.current.srcObject.getAudioTracks().length : 0
      });
      
      // Check if tracks are enabled/active
      if (remoteVideoRef.current.srcObject) {
        const audioTracks = remoteVideoRef.current.srcObject.getAudioTracks();
        audioTracks.forEach((track, i) => {
          console.log(`Video element audio track ${i}:`, {
            enabled: track.enabled,
            muted: track.muted,
            readyState: track.readyState,
            id: track.id
          });
          
          // Force enable
          if (!track.enabled) {
            track.enabled = true;
            console.log(`Forced video element track ${i} to enabled state`);
          }
        });
      }
      
      // Force unmute
      remoteVideoRef.current.muted = false;
      remoteVideoRef.current.volume = 1.0;
    } else {
      console.warn('Remote video element reference not available');
    }
    
    // 3. Check peer connection state
    if (peerConnectionRef.current) {
      console.log('Peer connection state:', {
        connectionState: peerConnectionRef.current.connectionState,
        iceConnectionState: peerConnectionRef.current.iceConnectionState,
        iceGatheringState: peerConnectionRef.current.iceGatheringState,
        signalingState: peerConnectionRef.current.signalingState
      });
      
      // Check transceivers
      const transceivers = peerConnectionRef.current.getTransceivers();
      transceivers.forEach((transceiver, i) => {
        console.log(`Transceiver ${i}:`, {
          currentDirection: transceiver.currentDirection,
          direction: transceiver.direction,
          stopped: transceiver.stopped,
          kind: transceiver.receiver.track ? transceiver.receiver.track.kind : 'unknown'
        });
      });
    } else {
      console.warn('Peer connection reference not available');
    }
    
    // 4. Try alternative playback approach with AudioContext
    try {
      console.log('Attempting direct AudioContext playback...');
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContext();
      
      // Try with audio element's stream
      if (audioElementRef.current && audioElementRef.current.srcObject) {
        const source = audioCtx.createMediaStreamSource(audioElementRef.current.srcObject);
        source.connect(audioCtx.destination);
        console.log('Connected audio element stream to audio context destination');
      } 
      // Try with remote video's stream
      else if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
        const source = audioCtx.createMediaStreamSource(remoteVideoRef.current.srcObject);
        source.connect(audioCtx.destination);
        console.log('Connected remote video stream to audio context destination');
      } else {
        console.warn('No streams available for direct audio context playback');
      }
    } catch (err) {
      console.error('Error with AudioContext approach:', err);
    }
    
    console.log('=== AUDIO DIAGNOSTICS COMPLETE ===');
    
    // Return a summary message to show to the user
    return 'Audio diagnostics complete. Check browser console for details.';
  };

  // Add a new function to ensure audio stream is properly connected
  const forcePeerConnectionAudio = () => {
    if (!peerConnectionRef.current || !remoteVideoRef.current || !remoteVideoRef.current.srcObject) {
      console.log('Cannot force audio - peer connection or remote stream not ready');
      return;
    }

    try {
      console.log('Attempting to force audio playback via manual connection...');
      
      // Create a new audio context
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContext();
      
      // Get remote stream from video element
      const remoteStream = remoteVideoRef.current.srcObject;
      
      if (!remoteStream.getAudioTracks().length) {
        console.warn('No audio tracks found in remote stream');
        return;
      }
      
      // Create audio source from the remote stream
      const source = audioCtx.createMediaStreamSource(remoteStream);
      
      // Create a gain node to control volume
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 1.0; // Full volume
      
      // Connect the source to the gain node and the gain node to the destination
      source.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      console.log('Manual audio connection established');
      
      // Store the audio context in a ref for cleanup
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      audioContextRef.current = audioCtx;
      
      return audioCtx;
    } catch (err) {
      console.error('Error forcing audio playback:', err);
    }
  };

  // Add a new useEffect to handle connection recovery
  useEffect(() => {
    // Only run this effect when a call is active
    if (!isCallActive || !peerConnectionRef.current) return;
    
    // Helper to check if we need to renegotiate based on connection state
    const checkConnectionHealth = () => {
      if (!peerConnectionRef.current) return;
      
      const iceState = peerConnectionRef.current.iceConnectionState;
      console.log(`Checking connection health: ICE state is ${iceState}`);
      
      if (iceState === 'disconnected' || iceState === 'failed') {
        console.log('Connection in bad state, triggering recovery');
        attemptConnectionRecovery();
      }
    };
    
    // Function to try to recover the connection
    const attemptConnectionRecovery = async () => {
      console.log('Attempting connection recovery...');
      
      try {
        // 1. First try simple ICE restart
        if (peerConnectionRef.current.restartIce) {
          console.log('Restarting ICE');
          peerConnectionRef.current.restartIce();
        }
        
        // 2. If we're the caller, create and send a new offer with ICE restart flag
        if (!isIncoming && peerConnectionRef.current.signalingState === 'stable') {
          console.log('Creating recovery offer with ICE restart');
          const offer = await peerConnectionRef.current.createOffer({
            iceRestart: true,
            offerToReceiveAudio: true,
            offerToReceiveVideo: callType === 'video'
          });
          
          await peerConnectionRef.current.setLocalDescription(offer);
          
          // Send the recovery offer
          try {
            socket.emit('call-offer', {
              offer: offer,
              callerId: localUser.uid,
              calleeId: isIncoming ? caller.uid : callee.uid,
              callType: callType,
              isRecoveryOffer: true
            });
            
            console.log('Sent recovery offer');
          } catch (socketError) {
            console.error('Failed to send recovery offer:', socketError);
          }
        }
      } catch (err) {
        console.error('Recovery attempt failed:', err);
      }
    };
    
    // Set up a periodic connection health check
    const healthCheckInterval = setInterval(checkConnectionHealth, 5000);
    
    // Clean up
    return () => {
      clearInterval(healthCheckInterval);
    };
  }, [isCallActive, peerConnectionRef.current, isIncoming, callType, socket, localUser, caller, callee]);

  // Add this helper function after setupRemoteAudioMonitoring or somewhere appropriate
  const ensureMediaFlow = () => {
    console.log('FIXING: Running media flow check...');
    
    // 1. Check if remote video element has a stream
    if (remoteVideoRef.current) {
      const hasStream = !!remoteVideoRef.current.srcObject;
      const streamActive = hasStream && remoteVideoRef.current.srcObject.active;
      const videoTracks = hasStream ? remoteVideoRef.current.srcObject.getVideoTracks().length : 0;
      const audioTracks = hasStream ? remoteVideoRef.current.srcObject.getAudioTracks().length : 0;
      
      console.log('FIXING: Remote video element status:', {
        hasStream,
        streamActive,
        videoTracks,
        audioTracks,
        paused: remoteVideoRef.current.paused,
        volume: remoteVideoRef.current.volume,
        muted: remoteVideoRef.current.muted
      });
      
      // If no stream is set but we have a peer connection, try to get receivers
      if (!hasStream && peerConnectionRef.current) {
        console.log('FIXING: No stream in remote video element, checking receivers');
        
        const receivers = peerConnectionRef.current.getReceivers();
        const hasReceivers = receivers.length > 0;
        
        console.log(`FIXING: Found ${receivers.length} receivers`);
        
        if (hasReceivers) {
          // Create a new MediaStream from receiver tracks
          const newStream = new MediaStream();
          let hasAddedTracks = false;
          
          receivers.forEach(receiver => {
            if (receiver.track && receiver.track.readyState === 'live') {
              console.log(`FIXING: Adding ${receiver.track.kind} track from receiver to new stream`);
              newStream.addTrack(receiver.track);
              hasAddedTracks = true;
            }
          });
          
          if (hasAddedTracks) {
            console.log('FIXING: Setting newly created stream from receivers to remote video element');
            remoteVideoRef.current.srcObject = newStream;
            remoteVideoRef.current.volume = 1.0;
            remoteVideoRef.current.muted = false;
            remoteVideoRef.current.play().catch(e => console.warn('Play failed:', e));
          }
        }
      }
      
      // If stream exists but is paused, try to play it
      if (hasStream && remoteVideoRef.current.paused) {
        console.log('FIXING: Remote video is paused, trying to play');
        remoteVideoRef.current.play().catch(e => console.warn('Play attempt failed:', e));
      }
      
      // If stream exists but has no tracks, check transceivers
      if (hasStream && videoTracks === 0 && audioTracks === 0 && peerConnectionRef.current) {
        console.log('FIXING: Stream has no tracks, checking transceivers');
        
        const transceivers = peerConnectionRef.current.getTransceivers();
        
        console.log(`FIXING: Connection has ${transceivers.length} transceivers`);
        transceivers.forEach((transceiver, i) => {
          console.log(`FIXING: Transceiver ${i}:`, {
            mid: transceiver.mid,
            direction: transceiver.direction,
            currentDirection: transceiver.currentDirection,
            stopped: transceiver.stopped,
            kind: transceiver.receiver.track ? transceiver.receiver.track.kind : 'unknown'
          });
          
          // Ensure all transceivers are set to sendrecv
          if (transceiver.direction !== 'sendrecv') {
            console.log(`FIXING: Setting transceiver ${i} to sendrecv`);
            transceiver.direction = 'sendrecv';
          }
        });
      }
    }
    
    // 2. Check if dedicated audio element has a stream (for audio-only calls)
    if (isAudioOnly && audioElementRef.current) {
      const hasStream = !!audioElementRef.current.srcObject;
      const streamActive = hasStream && audioElementRef.current.srcObject.active;
      const audioTracks = hasStream ? audioElementRef.current.srcObject.getAudioTracks().length : 0;
      
      console.log('FIXING: Audio element status:', {
        hasStream,
        streamActive,
        audioTracks,
        paused: audioElementRef.current.paused,
        volume: audioElementRef.current.volume,
        muted: audioElementRef.current.muted
      });
      
      // If stream exists but is paused, try to play it
      if (hasStream && audioElementRef.current.paused) {
        console.log('FIXING: Audio element is paused, trying to play');
        audioElementRef.current.play().catch(e => console.warn('Audio play attempt failed:', e));
      }
    }
    
    // 3. Check peer connection state
    if (peerConnectionRef.current) {
      const connectionState = peerConnectionRef.current.connectionState;
      const iceConnectionState = peerConnectionRef.current.iceConnectionState;
      const signalingState = peerConnectionRef.current.signalingState;
      
      console.log('FIXING: Connection states:', {
        connectionState,
        iceConnectionState,
        signalingState
      });
      
      // If connection has issues, try restarting ICE
      if (iceConnectionState === 'disconnected' || iceConnectionState === 'failed') {
        console.log('FIXING: Connection in bad state, trying to restart ICE');
        if (peerConnectionRef.current.restartIce) {
          peerConnectionRef.current.restartIce();
        }
      }
    }
  };

  // Add this useEffect to reset state when the component opens/closes (minimal changes)
  useEffect(() => {
    // When the component opens, reset important states
    if (isOpen) {
      console.log('VideoCall component opened - resetting states');
      callInitializedRef.current = false;
      remoteSdpSet.current = false;
      setPendingIceCandidates([]);
    }
    
    // Full cleanup when component closes
    return () => {
      if (!isOpen) {
        console.log('VideoCall component closed - full cleanup');
        cleanupCall();
      }
    };
  }, [isOpen]);

  // Add a useEffect to listen for call-ended events from the remote peer
  useEffect(() => {
    if (!socket || !isOpen) return;
    
    // Handler for call-ended event from the remote peer
    const handleRemoteCallEnded = (data) => {
      console.log('Remote peer ended call:', data);
      
      // Check if this event is for our call
      const isForUs = (isIncoming && 
                       data.callerId === caller.uid && 
                       data.calleeId === localUser.uid) ||
                      (!isIncoming && 
                       data.callerId === localUser.uid && 
                       data.calleeId === callee.uid);
      
      if (isForUs) {
        console.log('Call ended by remote peer, cleaning up resources');
        setError('Call ended by the other user');
        
        // Short delay to show the message before closing
        setTimeout(() => {
          cleanupCall();
          onClose();
        }, 1500);
      }
    };
    
    // Listen for call-ended events
    socket.on('call-ended', handleRemoteCallEnded);
    
    return () => {
      // Remove listener when component unmounts or isOpen changes
      socket.off('call-ended', handleRemoteCallEnded);
    };
  }, [socket, isOpen, isIncoming, caller, callee, localUser]);

  // Toggle minimized/maximized state
  const toggleMinimized = () => {
    const newValue = !isMinimized;
    setIsMinimized(newValue);
    
    // Call the onMinimizeChange callback if provided
    if (onMinimizeChange) {
      onMinimizeChange(newValue);
    }
  };

  // Determine the appropriate container class based on call state
  const getContainerClassName = () => {
    const baseClass = `video-call-container ${isOpen ? 'active' : ''}`;
    
    if (isMinimized) {
      return `${baseClass} minimized`;
    }
    
    if (!isCallActive && isIncoming) {
      return `${baseClass} ringing`;
    }
    
    return baseClass;
  };

  return (
    <div className={getContainerClassName()}>
      <div className="video-call-content">
        <div className="video-call-header">
          <h3>
            {isCallActive
              ? `${isAudioOnly ? 'Voice' : 'Video'} Call`
              : isIncoming
                ? `Incoming ${isAudioOnly ? 'Voice' : 'Video'} Call`
                : `${isAudioOnly ? 'Calling' : 'Video Calling'}...`}
          </h3>
          <span className="call-duration">
            {isCallActive && formatDuration(callDuration)}
          </span>
          <div className="call-header-controls">
            <button 
              className="minimize-button" 
              onClick={toggleMinimized}
              title={isMinimized ? "Maximize" : "Minimize"}
            >
              {isMinimized ? <Maximize size={isMinimized ? 14 : 18} /> : <Minimize size={18} />}
            </button>
            <button className="close-button" onClick={handleEndCall}>
              <X size={isMinimized ? 14 : 18} />
            </button>
          </div>
        </div>
        
        <div className={`video-streams ${isAudioOnly ? 'audio-only' : ''}`}>
          {isAudioOnly ? (
            <div className="audio-only-container">
              {/* Hidden audio element for audio-only calls */}
              <audio 
                ref={audioElementRef}
                autoPlay
                playsInline
                controls={false}
                style={{ display: 'none' }}
              />
              
              <div className="audio-only-avatar">
                <img 
                  src={isIncoming ? caller.profilepicture : callee.profilepicture} 
                  alt={isIncoming ? caller.name : callee.name}
                />
              </div>
              <h2>{isIncoming ? caller.name : callee.name}</h2>
              
              {isCallActive && (
                <div className="audio-waves">
                  <div 
                    className="audio-wave" 
                    style={{ height: `${Math.max(10, remoteAudioLevel * 40)}px` }}
                  ></div>
                  <div 
                    className="audio-wave" 
                    style={{ height: `${Math.max(10, remoteAudioLevel * 30)}px` }}
                  ></div>
                  <div 
                    className="audio-wave" 
                    style={{ height: `${Math.max(10, remoteAudioLevel * 50)}px` }}
                  ></div>
                  <div 
                    className="audio-wave" 
                    style={{ height: `${Math.max(10, remoteAudioLevel * 35)}px` }}
                  ></div>
                  <div 
                    className="audio-wave" 
                    style={{ height: `${Math.max(10, remoteAudioLevel * 45)}px` }}
                  ></div>
                </div>
              )}
              
              {isCallActive && (
                <div className="speaking-indicator">
                  {localAudioLevel > 0.05 && (
                    <div className="local-speaking">You are speaking</div>
                  )}
                  
                  {/* Don't show debug button in minimized mode */}
                  {!isMinimized && (
                    <button 
                      className="debug-audio-button"
                      onClick={() => {
                        const diagMessage = runAudioDiagnostics();
                        
                        // Try alternative playback method
                        const audioCtx = forcePeerConnectionAudio();
                        
                        // Show diagnostic results to user
                        setError(diagMessage + (audioCtx ? ' Forced audio connection active.' : ''));
                        
                        // Clear the error message after 3 seconds
                        setTimeout(() => {
                          setError(null);
                        }, 3000);
                        
                        // Also try the regular audio fix
                        checkAndFixAudioIssues();
                      }}
                    >
                      Fix Audio Issues
                    </button>
                  )}
                </div>
              )}
              
              {/* Error message */}
              {error && <div className="error-message">{error}</div>}
              
              {/* Loading indicator */}
              {isLoading && (
                <div className="loading-indicator">
                  <div className="spinner"></div>
                  <p>Initializing call...</p>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Remote video */}
              <div className="remote-video-container">
                {remoteStream ? (
                  <video 
                    ref={remoteVideoRef}
                    className="remote-video"
                    autoPlay
                    playsInline
                  />
                ) : (
                  <div className="loading-indicator">
                    {isLoading ? (
                      <>
                        <div className="spinner"></div>
                        <p>Connecting...</p>
                      </>
                    ) : (
                      error ? <div className="error-message">{error}</div> : <p>Waiting for video...</p>
                    )}
                  </div>
                )}
              </div>
              
              {/* Local video */}
              <div className="local-video-container">
                <video 
                  ref={localVideoRef}
                  className="local-video"
                  autoPlay
                  playsInline
                  muted
                />
                
                {/* Only show camera switch button on mobile and if not minimized */}
                {hasCameraSwitch && !isMinimized && (
                  <button
                    className={`camera-switch-button ${isSwitchingCamera ? 'switching' : ''}`}
                    onClick={switchCamera}
                    disabled={isSwitchingCamera}
                  >
                    <RefreshCw size={isMinimized ? 14 : 18} />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        
        <div className="call-info">
          <div className="user-info">
            {!isAudioOnly && (
              <>
                {isIncoming ? (
                  <>
                    <img 
                      src={caller.profilepicture} 
                      alt={caller.name} 
                      className="caller-avatar" 
                    />
                    <h4>{caller.name}</h4>
                  </>
                ) : (
                  <>
                    <img 
                      src={callee.profilepicture} 
                      alt={callee.name} 
                      className="callee-avatar" 
                    />
                    <h4>{callee.name}</h4>
                  </>
                )}
              </>
            )}
          </div>
        </div>
        
        <div className="call-controls">
          {isIncoming && !isCallActive ? (
            <>
              <button 
                className="call-control-button reject" 
                onClick={() => {
                  onReject();
                  onClose();
                }}
              >
                <PhoneOff size={isMinimized ? 18 : 24} />
                <span>Decline</span>
              </button>
              <button 
                className="call-control-button accept" 
                onClick={handleAcceptCall}
              >
                <Phone size={isMinimized ? 18 : 24} />
                <span>Accept</span>
              </button>
            </>
          ) : (
            <>
              <button
                className={`call-control-button ${isMuted ? 'disabled' : ''}`}
                onClick={toggleMute}
              >
                {isMuted ? <MicOff size={isMinimized ? 18 : 24} /> : <Mic size={isMinimized ? 18 : 24} />}
                <span>{isMuted ? 'Unmute' : 'Mute'}</span>
              </button>
              
              <button
                className="call-control-button end-call"
                onClick={handleEndCall}
              >
                <PhoneOff size={isMinimized ? 18 : 24} />
                <span>End</span>
              </button>
              
              {!isAudioOnly && (
                <button
                  className={`call-control-button ${!isVideoEnabled ? 'disabled' : ''}`}
                  onClick={toggleVideo}
                >
                  {isVideoEnabled ? <Video size={isMinimized ? 18 : 24} /> : <VideoOff size={isMinimized ? 18 : 24} />}
                  <span>{isVideoEnabled ? 'Hide Video' : 'Show Video'}</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoCall; 