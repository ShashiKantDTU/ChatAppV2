import React, { useEffect, useRef, useState } from 'react';
import styles from './Call.module.css';
import { PhoneCall, PhoneOff, Mic, MicOff, RefreshCw } from 'lucide-react';
import { getTurnServerConfig, getForcedRelayConfig } from '../../services/turn';

// Connection timeout in milliseconds
const CONNECTION_TIMEOUT = 10000;

const Call = ({ 
    isOpen, 
    onClose, 
    remoteUser, 
    socket, 
    localUser,
    callType = 'outgoing', // 'outgoing' or 'incoming'
    initialOffer = null 
}) => {
    // Component state
    const [callStatus, setCallStatus] = useState(callType === 'incoming' ? 'incoming' : 'idle');
    const [callDuration, setCallDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [error, setError] = useState('');
    const [storedOffer, setStoredOffer] = useState(initialOffer);
    
    // Refs
    const peerConnectionRef = useRef(null);
    const localStreamRef = useRef(null);
    const remoteStreamRef = useRef(null);
    const timerRef = useRef(null);
    const iceCandidatesQueue = useRef([]);
    const localAudioRef = useRef(null);
    const remoteAudioRef = useRef(null);
    const connectionTimeoutRef = useRef(null);
    
    // Save initial offer if provided (for incoming calls)
    useEffect(() => {
        if (initialOffer && callType === 'incoming') {
            console.log('Received initial offer:', initialOffer);
            setStoredOffer(initialOffer);
        }
    }, [initialOffer, callType]);
    
    // Log component mounting and props
    useEffect(() => {
        console.log('Call component mounted', { 
            isOpen, callType, remoteUser, 
            localUser: localUser ? {
                uid: localUser.uid,
                username: localUser.username,
                photoURL: localUser.photoURL,
                hasData: !!localUser
            } : 'undefined',
            hasSocket: !!socket, hasInitialOffer: !!initialOffer 
        });
        
        if (!localUser) {
            console.error('LocalUser is undefined in Call component');
        } else if (!localUser.uid) {
            console.error('LocalUser.uid is undefined in Call component', localUser);
        }
    }, []);
    
    // Validate props
    useEffect(() => {
        if (!socket) {
            setError('Socket connection not available');
            setCallStatus('ended');
            return;
        }
        if (!remoteUser?.uid) {
            setError('Invalid remote user');
            setCallStatus('ended');
            return;
        }
        if (!localUser?.uid) {
            setError('Invalid local user');
            setCallStatus('ended');
            return;
        }
    }, [socket, remoteUser, localUser]);
    
    // Initialize call
    const initializeCall = async (isOutgoing, forceRelay = false) => {
        try {
            console.log(`Initializing ${isOutgoing ? 'outgoing' : 'incoming'} call`);
            
            // Clean up any existing connection first
            cleanupPeerConnection();
            
            // Reset ICE candidates queue
            iceCandidatesQueue.current = [];
            
            // Get TURN server config
            const config = forceRelay ? getForcedRelayConfig() : getTurnServerConfig();
            console.log('Using WebRTC configuration:', config);
            
            // Request audio permissions
            console.log('Requesting audio stream');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('Audio stream obtained');
            localStreamRef.current = stream;
            
            if (localAudioRef.current) {
                localAudioRef.current.srcObject = stream;
            }
            
            // Create peer connection
            const peerConnection = new RTCPeerConnection(config);
            peerConnectionRef.current = peerConnection;
            
            // Add audio tracks
            stream.getAudioTracks().forEach(track => {
                console.log('Adding audio track to peer connection');
                peerConnection.addTrack(track, stream);
            });
            
            // Set up event handlers
            setupPeerConnectionEventHandlers(peerConnection);
            
            // Set connection timeout
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = setTimeout(() => {
                if (peerConnectionRef.current?.iceConnectionState !== 'connected' &&
                    peerConnectionRef.current?.iceConnectionState !== 'completed') {
                    console.log(`Connection attempt timed out after ${CONNECTION_TIMEOUT/1000}s`);
                    if (!forceRelay) {
                        setError('Connection taking too long. Retrying with relay...');
                        retryCall();
                    } else {
                        setError('Could not establish connection. Please try again later.');
                        setCallStatus('ended');
                    }
                }
            }, CONNECTION_TIMEOUT);
            
            return peerConnection;
        } catch (error) {
            console.error('Error initializing call:', error);
            setError(`Failed to initialize call: ${error.message || 'Unknown error'}`);
            setCallStatus('ended');
            throw error;
        }
    };
    
    // Set up event handlers for the peer connection
    const setupPeerConnectionEventHandlers = (peerConnection) => {
        // Track event - receiving remote media
        peerConnection.ontrack = (event) => {
            console.log('Received remote track:', event.track.kind);
            
            if (event.streams && event.streams[0]) {
                console.log('Setting remote stream');
                remoteStreamRef.current = event.streams[0];
                
                if (remoteAudioRef.current) {
                    remoteAudioRef.current.srcObject = event.streams[0];
                }
            }
        };
        
        // ICE candidate event
        peerConnection.onicecandidate = (event) => {
            if (!event.candidate) {
                console.log('ICE candidate gathering complete');
                return;
            }
            
            // Extract candidate type for debug info
            const candidateStr = event.candidate.candidate;
            let candidateType = 'unknown';
            if (candidateStr.includes(' host ')) candidateType = 'host';
            else if (candidateStr.includes(' srflx ')) candidateType = 'srflx';
            else if (candidateStr.includes(' relay ')) candidateType = 'relay';
            
            // Log candidate type for debugging
            console.log(`Generated ICE candidate (${candidateType}):`);
            
            if (socket && remoteUser?.uid) {
                socket.emit('ice-candidate', {
                    candidate: event.candidate,
                    to: remoteUser.uid,
                    from: localUser.uid
                });
            }
        };
        
        // Connection state change
        peerConnection.onconnectionstatechange = () => {
            const state = peerConnection.connectionState;
            console.log('Connection state changed:', state);
            
            switch (state) {
                case 'connected':
                    console.log('WebRTC connection established!');
                    clearTimeout(connectionTimeoutRef.current);
                    setCallStatus('ongoing');
                    startTimer();
                    break;
                    
                case 'disconnected':
                    console.log('Connection disconnected');
                    setCallStatus('reconnecting');
                    break;
                    
                case 'failed':
                    console.error('Connection failed');
                    if (callStatus !== 'ended') {
                        setError('Connection failed. Please try again.');
                        setCallStatus('ended');
                    }
                    break;
                    
                case 'closed':
                    console.log('Connection closed');
                    cleanup();
                    break;
            }
        };
        
        // ICE connection state change
        peerConnection.oniceconnectionstatechange = () => {
            const state = peerConnection.iceConnectionState;
            console.log('ICE connection state changed:', state);
            
            if (state === 'connected' || state === 'completed') {
                clearTimeout(connectionTimeoutRef.current);
            }
            else if (state === 'failed') {
                clearTimeout(connectionTimeoutRef.current);
                console.log('ICE connection failed');
            }
        };
        
        // Signaling state change
        peerConnection.onsignalingstatechange = () => {
            console.log('Signaling state changed:', peerConnection.signalingState);
        };
    };
    
    // Set up socket event handlers
    useEffect(() => {
        if (!socket || !isOpen) return;
        
        console.log('Setting up socket event listeners');
        
        // Handle incoming ICE candidates
        socket.on('ice-candidate', handleIceCandidate);
        
        // Handle call answered
        socket.on('call-answered', (data) => {
            console.log('Received call answer:', data);
            handleAnswer(data);
        });
        
        // Handle incoming call
        socket.on('incoming-call', (data) => {
            console.log('Incoming call:', data);

            // Prevent client from handling its own call
            if (data.from === localUser.uid) {
                console.log('Ignoring call from self');
                return;
            }
            
            // Check if already in a call - only reject if we're actively in a call
            if (callStatus === 'calling' || callStatus === 'connecting' || callStatus === 'ongoing') {
                console.log('Already in a call, rejecting incoming call');
                if (socket && data.from) {
                    socket.emit('call-rejected', { to: data.from });
                }
                return;
            }
            
            if (data.offer) {
                console.log('Setting up incoming call with offer');
                setStoredOffer(data.offer);
                setCallStatus('incoming');
            }
        });
        
        // Handle call ended by remote user
        socket.on('call-ended', () => {
            console.log('Call ended by remote user');
            cleanup();
            onClose();
        });
        
        // Handle call rejected
        socket.on('call-rejected', () => {
            console.log('Call rejected by remote user');
            setError('Call rejected');
            cleanup();
            onClose();
        });
        
        return () => {
            console.log('Cleaning up socket listeners');
            socket.off('ice-candidate', handleIceCandidate);
            socket.off('call-answered');
            socket.off('incoming-call');
            socket.off('call-ended');
            socket.off('call-rejected');
        };
    }, [isOpen, socket, localUser?.uid, callStatus]);
    
    // Start an outgoing call
    const startCall = async () => {
        try {
            console.log('Starting outgoing call');
            setCallStatus('calling');
            
            // Create and initialize peer connection
            const peerConnection = await initializeCall(true);
            if (!peerConnection) {
                throw new Error('Failed to create peer connection');
            }
            
            // Create and set local description
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            
            console.log('Created and set local offer:', offer);
            
            // Send call offer to remote user
            if (socket && remoteUser?.uid) {
                console.log('Sending call offer to:', remoteUser.uid);
                socket.emit('call-user', {
                    userToCall: remoteUser.uid,
                    from: localUser.uid,
                    offer: {
                        type: offer.type,
                        sdp: offer.sdp
                    }
                });
            } else {
                throw new Error('Socket or remote user not available');
            }
        } catch (error) {
            console.error('Error starting call:', error);
            setError(`Call failed: ${error.message || 'Connection error'}`);
            setCallStatus('ended');
        }
    };
    
    // Handle incoming answer for outgoing call
    const handleAnswer = async (data) => {
        try {
            console.log('Handling call answer:', data);
            const { answer } = data;
            
            if (!answer?.sdp) {
                throw new Error('Invalid answer format');
            }
            
            if (!peerConnectionRef.current) {
                throw new Error('No active peer connection');
            }
            
            // Format answer
            const formattedAnswer = {
                type: answer.type || 'answer',
                sdp: answer.sdp
            };
            
            console.log('Setting remote description from answer');
            // Set remote description
            await peerConnectionRef.current.setRemoteDescription(
                new RTCSessionDescription(formattedAnswer)
            );
            
            console.log('Remote description set successfully');
            
            // Process any queued candidates
            await processQueuedCandidates();
            
            setCallStatus('connecting');
        } catch (error) {
            console.error('Error handling call answer:', error);
            setError('Failed to establish connection');
            cleanup();
        }
    };
    
    // Process queued ICE candidates
    const processQueuedCandidates = async () => {
        if (!peerConnectionRef.current || !iceCandidatesQueue.current.length) {
            return;
        }
        
        console.log(`Processing ${iceCandidatesQueue.current.length} queued ICE candidates`);
        
        const candidates = [...iceCandidatesQueue.current];
        iceCandidatesQueue.current = [];
        
        for (const candidate of candidates) {
            try {
                if (peerConnectionRef.current.remoteDescription) {
                    await peerConnectionRef.current.addIceCandidate(
                        new RTCIceCandidate(candidate)
                    );
                    console.log('Added queued ICE candidate');
                } else {
                    console.warn('Remote description not set, re-queuing candidate');
                    iceCandidatesQueue.current.push(candidate);
                }
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
        }
    };
    
    // Handle an incoming call
    const handleIncomingCall = async (forceRelay = false) => {
        try {
            console.log('Handling incoming call', storedOffer);
            setCallStatus('connecting');
            
            if (!storedOffer) {
                throw new Error('No offer available for incoming call');
            }
            
            const peerConnection = await initializeCall(false, forceRelay);
            
            if (!peerConnection) {
                throw new Error('Failed to create peer connection');
            }
            
            // Set remote description from offer
            console.log('Setting remote description from offer');
            await peerConnection.setRemoteDescription(
                new RTCSessionDescription(storedOffer)
            );
            
            // Process any queued candidates
            await processQueuedCandidates();
            
            // Create and send answer
            console.log('Creating answer');
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            
            console.log('Sending answer to caller:', storedOffer.from);
            socket.emit('call-answered', {
                answer: {
                    type: answer.type,
                    sdp: answer.sdp
                },
                to: storedOffer.from
            });
            
            console.log('Answer sent, waiting for connection');
            setCallStatus('connecting');
        } catch (error) {
            console.error('Error handling incoming call:', error);
            setError(`Failed to answer call: ${error.message || 'Connection error'}`);
            setCallStatus('ended');
        }
    };
    
    // Handle incoming ICE candidate
    const handleIceCandidate = async ({ candidate, from }) => {
        try {
            if (from === localUser.uid) {
                console.log('Ignoring ICE candidate from self');
                return;
            }
            
            if (!peerConnectionRef.current) {
                console.warn('No peer connection available for ICE candidate');
                return;
            }
            
            if (!candidate) {
                console.warn('Received empty ICE candidate');
                return;
            }
            
            // Log candidate type for debugging
            const candidateType = candidate.candidate.split(' ')[7]; // host, srflx, or relay
            console.log(`Received ICE candidate (${candidateType})`);
            
            // Queue candidate if remote description not set yet
            if (peerConnectionRef.current.remoteDescription === null) {
                console.log('Remote description not set, queuing ICE candidate');
                iceCandidatesQueue.current.push(candidate);
                return;
            }
            
            // Add candidate
            await peerConnectionRef.current.addIceCandidate(
                new RTCIceCandidate(candidate)
            );
            
            console.log('ICE candidate added successfully');
        } catch (error) {
            console.error('Error handling ICE candidate:', error);
        }
    };

    // Start call timer
    const startTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }
        
        setCallDuration(0);
        
        timerRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
        }, 1000);
    };

    // Format call duration
    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Toggle mute
    const toggleMute = () => {
        if (!localStreamRef.current) return;
        
        const audioTracks = localStreamRef.current.getAudioTracks();
        if (!audioTracks.length) return;
        
        const newMuteState = !isMuted;
        
        audioTracks.forEach(track => {
            track.enabled = !newMuteState;
        });
        
        setIsMuted(newMuteState);
        console.log(`Microphone ${newMuteState ? 'muted' : 'unmuted'}`);
    };
    
    // End call
    const endCall = () => {
        console.log('Ending call');
        
        // Notify remote user
        if (socket && remoteUser?.uid) {
            socket.emit('call-ended', { to: remoteUser.uid });
        }
        
        // Clean up
        cleanup();
        
        // Close modal
        onClose();
    };
    
    // Reject incoming call
    const rejectCall = () => {
        console.log('Rejecting call');
        
        if (socket && storedOffer?.from) {
            socket.emit('call-rejected', { to: storedOffer.from });
        }
        
        cleanup();
        onClose();
    };
    
    // Retry call with forced relay
    const retryCall = () => {
        console.log('Retrying call with forced relay');
        setError('');
        
        // Re-initialize with forced relay
        cleanupPeerConnection();
        
        if (callType === 'outgoing') {
            initializeCall(true, true).catch(err => {
                console.error('Error retrying call:', err);
                setError('Failed to retry call. Please try again.');
                setCallStatus('ended');
            });
        } else {
            handleIncomingCall(true).catch(err => {
                console.error('Error retrying incoming call:', err);
                setError('Failed to retry call. Please try again.');
                setCallStatus('ended');
            });
        }
    };
    
    // Clean up peer connection
    const cleanupPeerConnection = () => {
        if (peerConnectionRef.current) {
            try {
                peerConnectionRef.current.close();
            } catch (error) {
                console.error('Error closing peer connection:', error);
            }
            
            peerConnectionRef.current = null;
        }
        
        clearTimeout(connectionTimeoutRef.current);
    };
    
    // Full cleanup
    const cleanup = () => {
        console.log('Cleaning up resources');
        
        // Stop timer
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        
        // Clean up peer connection
        cleanupPeerConnection();
        
        // Stop audio tracks
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                track.stop();
            });
            
            localStreamRef.current = null;
        }
        
        // Clear audio elements
        if (localAudioRef.current) {
            localAudioRef.current.srcObject = null;
        }
        
        if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = null;
        }

        // Reset state
        setCallStatus('ended');
    };
    
    // Clean up on unmount
    useEffect(() => {
        return () => {
            cleanup();
        };
    }, []);
    
    // Don't render anything if not open
    if (!isOpen) return null;

    return (
        <div className={styles.callContainer}>
            <div className={styles.callModal}>
                <div className={styles.callHeader}>
                    <h2>Voice Call</h2>
                    {error && <div className={styles.errorMessage}>{error}</div>}
                </div>
                
                <div className={styles.userInfo}>
                    <div className={styles.avatar}>
                        {remoteUser.profilepicture ? (
                            <img src={remoteUser.profilepicture} alt={remoteUser.name || 'User'} />
                        ) : (
                            <div className={styles.defaultAvatar}>
                                {remoteUser.name ? remoteUser.name.charAt(0).toUpperCase() : '?'}
                            </div>
                        )}
                    </div>
                    <div className={styles.username}>{remoteUser.name || 'User'}</div>
                </div>
                
                {/* Audio elements */}
                <audio id="localAudio" autoPlay muted ref={localAudioRef} />
                <audio id="remoteAudio" autoPlay ref={remoteAudioRef} />
                
                <div className={styles.callActions}>
                    {/* Idle state */}
                    {callStatus === 'idle' && (
                        <>
                            <div className={styles.callDetails}>
                                <span>Call {remoteUser?.name || 'User'}</span>
                            </div>
                            <div className={styles.buttons}>
                                <button 
                                    className={`${styles.callButton} ${styles.callingButton}`}
                                    onClick={startCall}
                                >
                                    <PhoneCall size={24} />
                                </button>
                            </div>
                        </>
                    )}
                    
                    {/* Calling state (outgoing call) */}
                    {callStatus === 'calling' && (
                        <>
                            <div className={styles.callDetails}>
                                <span>Calling {remoteUser?.name || 'User'}...</span>
                            </div>
                            <div className={styles.spinner}></div>
                            <div className={styles.buttons}>
                                <button 
                                    className={`${styles.callButton} ${styles.endButton}`}
                                    onClick={endCall}
                                >
                                    <PhoneOff size={24} />
                                </button>
                            </div>
                        </>
                    )}
                    
                    {/* Incoming call state */}
                    {callStatus === 'incoming' && (
                        <>
                            <div className={styles.callDetails}>
                                <span>Incoming call from {remoteUser?.name || 'User'}</span>
                            </div>
                            <div className={styles.buttons}>
                                <button 
                                    className={`${styles.callButton} ${styles.rejectButton}`}
                                    onClick={rejectCall}
                                >
                                    <PhoneOff size={24} />
                                </button>
                                <button 
                                    className={`${styles.callButton} ${styles.acceptButton}`} 
                                    onClick={() => handleIncomingCall()}
                                >
                                    <PhoneCall size={24} />
                                </button>
                            </div>
                        </>
                    )}
                    
                    {/* Connecting state */}
                    {callStatus === 'connecting' && (
                        <>
                            <div className={styles.callDetails}>
                                <span>Connecting...</span>
                            </div>
                            <div className={styles.spinner}></div>
                            <div className={styles.buttons}>
                                <button 
                                    className={`${styles.callButton} ${styles.endButton}`}
                                    onClick={endCall}
                                >
                                    <PhoneOff size={24} />
                                </button>
                            </div>
                        </>
                    )}
                    
                    {/* Ongoing call state */}
                    {callStatus === 'ongoing' && (
                        <>
                            <div className={styles.callDetails}>
                                <span>In call with {remoteUser?.name || 'User'}</span>
                                <span className={styles.duration}>{formatDuration(callDuration)}</span>
                            </div>
                            <div className={styles.buttons}>
                                <button 
                                    className={`${styles.callButton} ${isMuted ? styles.active : ''}`} 
                                    onClick={toggleMute}
                                >
                                    {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                                </button>
                                <button 
                                    className={`${styles.callButton} ${styles.endButton}`} 
                                    onClick={endCall}
                                >
                                    <PhoneOff size={24} />
                                </button>
                            </div>
                        </>
                    )}
                    
                    {/* Reconnecting state */}
                    {callStatus === 'reconnecting' && (
                        <>
                            <div className={styles.callDetails}>
                                <span>Connection issues. Reconnecting...</span>
                            </div>
                            <div className={styles.spinner}></div>
                            <div className={styles.buttons}>
                                <button 
                                    className={`${styles.callButton} ${styles.endButton}`}
                                    onClick={endCall}
                                >
                                    <PhoneOff size={24} />
                                </button>
                            </div>
                        </>
                    )}
                    
                    {/* Ended state */}
                    {callStatus === 'ended' && (
                        <>
                            <div className={styles.callDetails}>
                                <span>Call ended</span>
                            </div>
                            <div className={styles.buttons}>
                                <button 
                                    className={`${styles.callButton} ${styles.retryButton}`}
                                    onClick={retryCall}
                                >
                                    <RefreshCw size={24} />
                                </button>
                                <button 
                                    className={`${styles.callButton} ${styles.endButton}`}
                                    onClick={onClose}
                                >
                                    <PhoneOff size={24} />
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Call; 