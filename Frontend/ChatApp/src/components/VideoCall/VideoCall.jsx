import React, { useEffect, useState, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, X, RefreshCw } from 'lucide-react';
import './VideoCall.css';

// Ringtone URL
const RINGTONE_URL = 'https://cdn.pixabay.com/audio/2022/11/20/audio_662f2ae340.mp3';

// Metered API key for TURN server credentials
const METERED_API_KEY = "54802f233bc4f94626bf76e1";

// Fallback ICE servers with hardcoded credentials
const FALLBACK_ICE_SERVERS = [
  {
    urls: "stun:stun.relay.metered.ca:80",
  },
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
  },
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
  callType = 'video' // 'video' or 'audio'
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

  // After the state variables declarations, add a useEffect that reacts to callType changes
  useEffect(() => {
    // Update audio/video states when callType changes
    setIsAudioOnly(callType === 'audio');
    setIsVideoEnabled(callType === 'video');
    
    console.log(`Call type changed to: ${callType}, isAudioOnly: ${callType === 'audio'}`);
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
      console.log('Fetching ICE servers from Metered API...');
      const response = await fetch(`https://chatappv2.metered.live/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch ICE servers: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Received ICE servers:', data);
      
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
  
  // Initialize local media and start call
  const initializeCall = async () => {
    try {
      console.log(`Initializing call with type: ${callType}, isAudioOnly: ${isAudioOnly}`);
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
      const currentIsAudioOnly = callType === 'audio'; // Use callType directly to be safe
      console.log(`Setting up media with callType=${callType}, isAudioOnly=${currentIsAudioOnly}`);

      const mediaConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
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
    
    // Add debug logging
    console.log(`Starting outgoing call: callType=${callType}, isAudioOnly=${isAudioOnly}`);
    
    // Emit call-user event to server
    try {
      const callTypeToSend = isAudioOnly ? 'audio' : 'video';
      console.log(`Emitting call-user with callType: ${callTypeToSend}`);
      
      socket.emit('call-user', {
        callerId: localUser.uid,
        callerName: localUser.username || localUser.name,
        calleeId: callee.uid,
        callerProfilePic: localUser.profilepicture,
        callType: callTypeToSend
      });
      
      // Listen for call-accepted event
      socket.once('call-accepted', async (data) => {
        console.log('Call accepted by:', data);
        setIsCallActive(true);
        startCallTimer();
        
        // Now create peer connection and send offer
        await createPeerConnection();
      });
    } catch (socketError) {
      console.error('Error initiating call via socket:', socketError);
      setError('Failed to start call. Please check your connection and try again.');
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
        
        if (!isForUs) return;
        
        // Create an RTCIceCandidate
        const candidate = new RTCIceCandidate(data.candidate);
        
        // If peer connection exists and remote description is set, add candidate
        if (peerConnectionRef.current && remoteSdpSet.current) {
          await peerConnectionRef.current.addIceCandidate(candidate);
          console.log('Added ICE candidate');
        } else {
          // Otherwise, store for later
          console.log('Storing ICE candidate for later');
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
              localStreamRef.current.getTracks().forEach(track => {
                peerConnectionRef.current.addTrack(track, localStreamRef.current);
              });
            }
            
            // Listen for ICE candidates
            peerConnectionRef.current.onicecandidate = (event) => {
              if (event.candidate) {
                // Send the candidate to the remote peer
                try {
                  socket.emit('ice-candidate', {
                    candidate: event.candidate,
                    callerId: caller.uid,
                    calleeId: localUser.uid
                  });
                } catch (socketError) {
                  console.error('Error sending ICE candidate via socket:', socketError);
                }
              }
            };
            
            // Listen for remote stream
            peerConnectionRef.current.ontrack = (event) => {
              console.log('Remote track received:', event);
              
              if (remoteVideoRef.current && event.streams && event.streams[0]) {
                remoteVideoRef.current.srcObject = event.streams[0];
                
                // Set up audio monitoring for the remote stream
                setupRemoteAudioMonitoring(event.streams[0]);
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
      console.log('Creating peer connection with ICE servers:', iceServers);
      
      // Create a new RTCPeerConnection
      peerConnectionRef.current = new RTCPeerConnection({ 
        iceServers: iceServers
      });
      
      // Add local stream tracks to the connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          peerConnectionRef.current.addTrack(track, localStreamRef.current);
        });
      } else {
        console.error('No local stream available');
        await initializeCall();
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach(track => {
            peerConnectionRef.current.addTrack(track, localStreamRef.current);
          });
        }
      }
      
      // Listen for ICE candidates
      peerConnectionRef.current.onicecandidate = (event) => {
        if (event.candidate) {
          // Send the candidate to the remote peer
          try {
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
        } else if (peerConnectionRef.current.connectionState === 'failed') {
          console.error('WebRTC connection failed');
          setError('Connection failed. Please try again.');
          handleEndCall();
        }
      };
      
      // Listen for remote stream
      peerConnectionRef.current.ontrack = (event) => {
        console.log('Remote track received:', event);
        
        if (remoteVideoRef.current && event.streams && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
          
          // Set up audio monitoring for the remote stream
          setupRemoteAudioMonitoring(event.streams[0]);
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
      
      const offer = await peerConnectionRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: !isAudioOnlyCall
      });
      
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
      
      const answer = await peerConnectionRef.current.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: !isAudioOnlyCall
      });
      
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
    if (socket) {
      // Notify the other user that call is ended
      socket.emit('call-ended', {
        callerId: isIncoming ? caller.uid : localUser.uid,
        calleeId: isIncoming ? localUser.uid : callee.uid
      });
    }
    
    cleanupCall();
    onClose();
  };
  
  // Clean up media streams and connections
  const cleanupCall = () => {
    // Stop the timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    // Close the peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    // Stop all tracks in the local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    // Reset video elements
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
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
  
  // Play sound for incoming calls
  useEffect(() => {
    if (isOpen && isIncoming && !isCallActive) {
      // Play ringtone for incoming calls
      const ringtone = ringtoneRef.current;
      ringtone.loop = true;
      ringtone.volume = 0.7;
      ringtone.play().catch(err => console.error('Error playing ringtone:', err));
      
      // Show browser notification if possible
      showCallNotification();
      
      return () => {
        ringtone.pause();
        ringtone.currentTime = 0;
      };
    }
  }, [isOpen, isIncoming, isCallActive]);
  
  // Show browser notification for incoming call
  const showCallNotification = () => {
    // Check if browser notifications are supported and permission is granted
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification(`Incoming ${isAudioOnly ? 'Voice' : 'Video'} Call`, {
        body: `${caller.name || 'Someone'} is calling you`,
        icon: caller.profilepicture || '',
        requireInteraction: true
      });
      
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } 
    // Request permission if not already granted
    else if ('Notification' in window && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }
  };

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
          
          // Set the remote description (the answer)
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
          remoteSdpSet.current = true;
          
          // Add any pending ICE candidates
          if (pendingIceCandidates.length > 0) {
            console.log(`Adding ${pendingIceCandidates.length} pending ICE candidates`);
            for (const candidate of pendingIceCandidates) {
              await peerConnectionRef.current.addIceCandidate(candidate);
            }
            setPendingIceCandidates([]);
          }
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

  return (
    <div className={`video-call-container ${isOpen ? 'active' : ''}`}>
      <div className="video-call-content">
        <div className="video-call-header">
          <h3>
            {isCallActive
              ? `${isAudioOnly ? 'Voice' : 'Video'} Call in progress`
              : isIncoming
                ? `Incoming ${isAudioOnly ? 'Voice' : 'Video'} Call`
                : `${isAudioOnly ? 'Calling' : 'Video Calling'}...`}
          </h3>
          <span className="call-duration">
            {isCallActive && formatDuration(callDuration)}
          </span>
          <button className="close-button" onClick={handleEndCall}>
            <X size={24} />
          </button>
        </div>
        
        <div className={`video-streams ${isAudioOnly ? 'audio-only' : ''}`}>
          {isAudioOnly ? (
            <div className="audio-only-container">
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
                </div>
              )}
              
              {isLoading && (
                <div className="loading-indicator">
                  <div className="spinner"></div>
                  <p>Connecting...</p>
                </div>
              )}
              {error && (
                <div className="error-message">
                  <p>{error}</p>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="remote-video-container">
                {isLoading ? (
                  <div className="loading-indicator">
                    <div className="spinner"></div>
                    <p>Connecting...</p>
                  </div>
                ) : error ? (
                  <div className="error-message">
                    <p>{error}</p>
                  </div>
                ) : (
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="remote-video"
                  />
                )}
              </div>
              
              <div className="local-video-container">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="local-video"
                />
                
                {isCameraSupported && isCallActive && !isAudioOnly && (
                  <button 
                    className={`camera-switch-button ${isSwitchingCamera ? 'switching' : ''}`}
                    onClick={switchCamera}
                    disabled={isSwitchingCamera}
                    title="Switch Camera"
                  >
                    <RefreshCw size={20} />
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
                <PhoneOff size={24} />
                <span>Decline</span>
              </button>
              <button 
                className="call-control-button accept" 
                onClick={handleAcceptCall}
              >
                <Phone size={24} />
                <span>Accept</span>
              </button>
            </>
          ) : (
            <>
              <button
                className={`call-control-button ${isMuted ? 'disabled' : ''}`}
                onClick={toggleMute}
              >
                {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                <span>{isMuted ? 'Unmute' : 'Mute'}</span>
              </button>
              
              <button
                className="call-control-button end-call"
                onClick={handleEndCall}
              >
                <PhoneOff size={24} />
                <span>End</span>
              </button>
              
              {!isAudioOnly && (
                <button
                  className={`call-control-button ${!isVideoEnabled ? 'disabled' : ''}`}
                  onClick={toggleVideo}
                >
                  {isVideoEnabled ? <Video size={24} /> : <VideoOff size={24} />}
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