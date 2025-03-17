import React, { useEffect, useState, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, X } from 'lucide-react';
import './VideoCall.css';

// Ringtone URL
const RINGTONE_URL = 'https://soundbible.com/mp3/phone-calling-1.mp3';

// Metered API key for fetching TURN credentials
const METERED_API_KEY = '0b3cef3685935b3424354cbea99c073db622';

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
  localUser 
}) => {
  // Call states
  const [isCallActive, setIsCallActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Media controls
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  
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
  
  // Audio refs for notifications
  const ringtoneRef = useRef(new Audio(RINGTONE_URL));
  
  // Fetch fresh ICE server credentials from Metered.ca
  useEffect(() => {
    const fetchIceServers = async () => {
      try {
        console.log('Fetching ICE servers from Metered.ca');
        const response = await fetch(
          `https://shashikant.metered.live/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`
        );
        
        if (!response.ok) {
          throw new Error(`Failed to fetch ICE servers: ${response.status}`);
        }
        
        const fetchedIceServers = await response.json();
        console.log('Successfully fetched ICE servers:', fetchedIceServers);
        setIceServers(fetchedIceServers);
      } catch (err) {
        console.error('Error fetching ICE servers:', err);
        console.log('Using fallback ICE servers');
        // Fallback to hardcoded credentials
        setIceServers(FALLBACK_ICE_SERVERS);
      }
    };
    
    if (isOpen) {
      fetchIceServers();
    }
  }, [isOpen]);
  
  // Initialize when component mounts
  useEffect(() => {
    if (isOpen) {
      if (isIncoming) {
        // Ready to accept incoming call
        setIsLoading(false);
      } else {
        // Start outgoing call
        initializeCall();
      }
    }
    
    return () => {
      cleanupCall();
    };
  }, [isOpen]);
  
  // Set up socket event listeners
  useEffect(() => {
    if (!socket || !isOpen) return;
    
    // When call is accepted
    const handleCallAccepted = async (data) => {
      console.log('Call accepted by remote user:', data);
      
      const otherUserId = isIncoming ? caller.uid : callee.uid;
      
      if (data.callerId === otherUserId || data.calleeId === otherUserId) {
        setIsCallActive(true);
        startCallTimer();
        await createPeerConnection();
      }
    };
    
    // When receiving an answer from the callee
    const handleCallAnswer = async (data) => {
      console.log('Call answer received:', data);
      
      try {
        const remoteDesc = new RTCSessionDescription(data.answer);
        if (peerConnectionRef.current && peerConnectionRef.current.signalingState !== 'closed') {
          await peerConnectionRef.current.setRemoteDescription(remoteDesc);
        }
      } catch (err) {
        console.error('Error setting remote description:', err);
        setError('Failed to establish connection');
      }
    };
    
    // When receiving an offer
    const handleCallOffer = async (data) => {
      console.log('Call offer received:', data);
      
      try {
        if (!peerConnectionRef.current) {
          await createPeerConnection();
        }
        
        const remoteDesc = new RTCSessionDescription(data.offer);
        await peerConnectionRef.current.setRemoteDescription(remoteDesc);
        
        // Create an answer after setting the remote description
        await createAndSendAnswer();
      } catch (err) {
        console.error('Error handling offer:', err);
        setError('Failed to process call offer');
      }
    };
    
    // When receiving an ICE candidate
    const handleIceCandidate = async (data) => {
      console.log('ICE candidate received:', data);
      
      if (!peerConnectionRef.current || peerConnectionRef.current.signalingState === 'closed') {
        console.warn('PeerConnection is closed or not initialized yet');
        return;
      }
      
      try {
        const candidate = new RTCIceCandidate({
          sdpMLineIndex: data.candidate.sdpMLineIndex,
          candidate: data.candidate.candidate
        });
        
        await peerConnectionRef.current.addIceCandidate(candidate);
      } catch (err) {
        console.error('Error adding received ice candidate', err);
      }
    };
    
    // Listen for socket events
    socket.on('call-accepted', handleCallAccepted);
    socket.on('call-answer', handleCallAnswer);
    socket.on('call-offer', handleCallOffer);
    socket.on('ice-candidate', handleIceCandidate);
    
    return () => {
      socket.off('call-accepted', handleCallAccepted);
      socket.off('call-answer', handleCallAnswer);
      socket.off('call-offer', handleCallOffer);
      socket.off('ice-candidate', handleIceCandidate);
    };
  }, [socket, isOpen, isIncoming, caller, callee]);
  
  // Initialize local media and start call
  const initializeCall = async () => {
    try {
      setIsLoading(true);
      
      // Get local media stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true, 
        video: true 
      });
      
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      setIsLoading(false);
      
      // If this is an outgoing call, start the call process
      if (!isIncoming) {
        startOutgoingCall();
      }
    } catch (err) {
      console.error("Error accessing media devices:", err);
      setError("Could not access camera or microphone. Please check permissions.");
      setIsLoading(false);
    }
  };
  
  // Create and initialize the peer connection
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
          const otherUserId = isIncoming ? caller.uid : callee.uid;
          
          socket.emit('ice-candidate', {
            candidate: event.candidate,
            callerId: isIncoming ? caller.uid : localUser.uid,
            calleeId: isIncoming ? localUser.uid : callee.uid
          });
        }
      };
      
      // Log ICE connection state changes
      peerConnectionRef.current.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', peerConnectionRef.current.iceConnectionState);
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
        }
      };
      
      // If this is incoming call, create and send an answer
      if (isIncoming) {
        // Create an answer to the offer
        await createAndSendAnswer();
      } else {
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
      const offer = await peerConnectionRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await peerConnectionRef.current.setLocalDescription(offer);
      
      // Send the offer to the remote peer
      socket.emit('call-offer', {
        offer: offer,
        callerId: localUser.uid,
        calleeId: callee.uid
      });
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
      const answer = await peerConnectionRef.current.createAnswer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      
      await peerConnectionRef.current.setLocalDescription(answer);
      
      // Send the answer to the remote peer
      socket.emit('call-answer', {
        answer: answer,
        callerId: caller.uid,
        calleeId: localUser.uid
      });
    } catch (err) {
      console.error('Error creating answer:', err);
      setError('Failed to create call answer. Please try again.');
    }
  };
  
  // Start outgoing call
  const startOutgoingCall = () => {
    if (!socket) return;
    
    // Emit call-user event to server
    socket.emit('call-user', {
      callerId: localUser.uid,
      callerName: localUser.username || localUser.name,
      calleeId: callee.uid,
      callerProfilePic: localUser.profilepicture
    });
  };
  
  // Handle call acceptance (for incoming calls)
  const handleAcceptCall = async () => {
    await initializeCall();
    onAccept();
    setIsCallActive(true);
    startCallTimer();
    
    // Create peer connection for the call
    await createPeerConnection();
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
      const notification = new Notification('Incoming Video Call', {
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
  
  return (
    <div className={`video-call-container ${isOpen ? 'active' : ''}`}>
      <div className="video-call-content">
        <div className="video-call-header">
          <h3>
            {isCallActive
              ? "Call in progress"
              : isIncoming
                ? "Incoming Call"
                : "Calling..."}
          </h3>
          <span className="call-duration">
            {isCallActive && formatDuration(callDuration)}
          </span>
          <button className="close-button" onClick={handleEndCall}>
            <X size={24} />
          </button>
        </div>
        
        <div className="video-streams">
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
          </div>
        </div>
        
        <div className="call-info">
          <div className="user-info">
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
              
              <button
                className={`call-control-button ${!isVideoEnabled ? 'disabled' : ''}`}
                onClick={toggleVideo}
              >
                {isVideoEnabled ? <Video size={24} /> : <VideoOff size={24} />}
                <span>{isVideoEnabled ? 'Hide Video' : 'Show Video'}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoCall; 