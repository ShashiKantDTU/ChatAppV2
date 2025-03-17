import React, { useEffect, useRef, useState } from 'react';
import styles from './VoiceCall.module.css';
import { FiPhoneCall as PhoneCallIcon, FiPhoneOff as PhoneOffIcon, FiMic as MicIcon, FiMicOff as MicOffIcon, FiRefreshCw as RefreshIcon } from 'react-icons/fi';
import { getTurnServerConfig, getRelayOnlyConfig, testTurnServerConnectivity } from '../../services/turn';

const VoiceCall = ({ 
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
    const [isRetrying, setIsRetrying] = useState(false);
    
    // Refs
    const peerConnectionRef = useRef(null);
    const localStreamRef = useRef(null);
    const remoteStreamRef = useRef(null);
    const timerRef = useRef(null);
    const iceCandidatesQueue = useRef([]);
    const localAudioRef = useRef(null);
    const remoteAudioRef = useRef(null);
    const connectionTimeoutRef = useRef(null);
    
    // Constants
    const CONNECTION_TIMEOUT = 12000; // 12 seconds
    
    // Initialize storedOffer when initialOffer changes
    useEffect(() => {
        if (initialOffer && callType === 'incoming') {
            console.log('Received initial offer:', initialOffer);
            
            if (!initialOffer.from && remoteUser?.uid) {
                console.log('Using remoteUser.uid as fallback for from field');
                setStoredOffer({ ...initialOffer, from: remoteUser.uid });
            } else {
                setStoredOffer(initialOffer);
            }
        }
    }, [initialOffer, callType, remoteUser?.uid]);
    
    // Log component mounting and props
    useEffect(() => {
        console.log('VoiceCall component mounted', { 
            isOpen, callType, remoteUser, localUser,
            hasSocket: !!socket, hasInitialOffer: !!initialOffer 
        });
        
        // Socket listener for incoming call (only used during incoming call setup)
        if (socket && callType === 'incoming') {
            const handleIncomingCallOffer = ({ from, offer }) => {
                console.log('Received incoming call offer:', { from, offer });
                
                if (from === remoteUser?.uid && offer?.sdp) {
                    const formattedOffer = {
                        type: 'offer',
                        sdp: offer.sdp,
                        from: from
                    };
                    console.log('Storing formatted offer with from:', formattedOffer);
                    setStoredOffer(formattedOffer);
                }
            };
            
            socket.on('incoming-call', handleIncomingCallOffer);
            return () => socket.off('incoming-call', handleIncomingCallOffer);
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
    
    // Main call initialization logic
    const initializeCall = async (isOutgoing, forceRelay = false) => {
        try {
            console.log(`Initializing ${isOutgoing ? 'outgoing' : 'incoming'} call`);
            
            // Clean up any existing connection first
            cleanupPeerConnection();
            
            // Reset ICE candidates queue
            iceCandidatesQueue.current = [];
            
            // Get Metered.ca TURN config
            const config = forceRelay ? getRelayOnlyConfig() : getTurnServerConfig();
            console.log('Using WebRTC configuration:', config);
            
            // Request audio permissions
            console.log('Requesting audio stream');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
                .catch(error => {
                    console.error('Error getting audio stream:', error);
                    handleMediaError(error);
                    throw error;
                });
            
            // Set up local audio
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
            
            // For outgoing calls, create and send offer
            if (isOutgoing) {
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);
                
                console.log('Created offer:', offer);
                
                socket.emit('call-user', {
                    userToCall: remoteUser.uid,
                    from: localUser.uid,
                    offer: {
                        type: 'offer',
                        sdp: offer.sdp
                    }
                });
                
                setCallStatus('calling');
            }
            
            return peerConnection;
        } catch (error) {
            console.error('Error initializing call:', error);
            setError(`Failed to initialize call: ${error.message || 'Unknown error'}`);
            setCallStatus('ended');
            setIsRetrying(false);
            throw error;
        }
    };
    
    // Set up all event handlers for peer connection
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
            
            // Log candidate type for debugging
            const candidateType = event.candidate.candidate.split(' ')[7]; // host, srflx, or relay
            console.log(`Generated ICE candidate (${candidateType}):`, event.candidate);
            
            if (socket && remoteUser?.uid) {
                try {
                    socket.emit('ice-candidate', {
                        candidate: event.candidate,
                        to: remoteUser.uid,
                        from: localUser.uid
                    });
                } catch (error) {
                    console.error('Error sending ICE candidate:', error);
                }
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
                    monitorCallQuality(peerConnection);
                    break;
                    
                case 'disconnected':
                    console.log('Connection disconnected, attempting to recover');
                    setCallStatus('reconnecting');
                    
                    // Try to auto-recover
                    setTimeout(() => {
                        if (peerConnectionRef.current?.connectionState === 'disconnected') {
                            attemptReconnection();
                        }
                    }, 5000);
                    break;
                    
                case 'failed':
                    console.error('Connection failed');
                    
                    // Only retry once with forced TURN relay
                    if (!isRetrying) {
                        console.log('Retrying with forced TURN relay');
                        setIsRetrying(true);
                        
                        // Re-initialize with forced relay
                        cleanupPeerConnection();
                        if (callType === 'outgoing') {
                            initializeCall(true, true);
                        } else {
                            handleIncomingCall(true);
                        }
                    } else {
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
            
            if (state === 'checking') {
                // Set timeout for connection attempt
                clearTimeout(connectionTimeoutRef.current);
                connectionTimeoutRef.current = setTimeout(() => {
                    if (peerConnectionRef.current?.iceConnectionState === 'checking') {
                        console.log('Connection attempt timed out');
                        setError('Connection attempt timed out. Try again or check your network.');
                        
                        // Retry with forced relay if not already retrying
                        if (!isRetrying) {
                            console.log('Retrying with forced TURN relay');
                            setIsRetrying(true);
                            
                            // Re-initialize with forced relay
                            cleanupPeerConnection();
                            if (callType === 'outgoing') {
                                initializeCall(true, true);
                            } else {
                                handleIncomingCall(true);
                            }
                        } else {
                            setCallStatus('ended');
                        }
                    }
                }, CONNECTION_TIMEOUT);
            } 
            else if (state === 'connected' || state === 'completed') {
                clearTimeout(connectionTimeoutRef.current);
                
                // Log connection information
                peerConnection.getStats(null).then(stats => {
                    let selectedCandidate = null;
                    
                    stats.forEach(report => {
                        if (report.type === 'transport') {
                            console.log('Active transport:', report);
                        } else if (report.type === 'candidate-pair' && report.selected) {
                            console.log('Selected candidate pair:', report);
                            selectedCandidate = report;
                        }
                    });
                    
                    if (selectedCandidate) {
                        console.log('Call connected successfully with selected candidate');
                    }
                });
            }
            else if (state === 'failed') {
                clearTimeout(connectionTimeoutRef.current);
                console.log('ICE connection failed');
                
                // Try to restart ICE
                try {
                    if (peerConnection.restartIce) {
                        console.log('Attempting to restart ICE connection');
                        peerConnection.restartIce();
                    }
                } catch (err) {
                    console.error('Error during ICE restart:', err);
                }
            }
        };
        
        // Signaling state change
        peerConnection.onsignalingstatechange = () => {
            console.log('Signaling state changed:', peerConnection.signalingState);
        };
        
        // ICE gathering state change
        peerConnection.onicegatheringstatechange = () => {
            console.log('ICE gathering state changed:', peerConnection.iceGatheringState);
        };
    };
    
    // Start an outgoing call
    const startCall = async () => {
        try {
            console.log('Starting outgoing call');
            setCallStatus('preparing');
            
            // Test TURN server connectivity first
            const testResult = await testTurnServerConnectivity();
            console.log('TURN connectivity test result:', testResult);
            
            // Start with forced relay if TURN test fails
            const shouldForceRelay = !testResult.success || !testResult.relayWorks;
            
            // Initialize and start the call
            await initializeCall(true, shouldForceRelay);
        } catch (error) {
            console.error('Error starting call:', error);
            setError(`Call failed: ${error.message || 'Connection error'}`);
            setCallStatus('ended');
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
            
            // Make sure we have the caller ID
            if (!storedOffer.from && remoteUser?.uid) {
                console.log('Using remoteUser.uid as caller ID');
                storedOffer.from = remoteUser.uid;
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
        } catch (error) {
            console.error('Error handling incoming call:', error);
            setError(`Failed to answer call: ${error.message || 'Connection error'}`);
            setCallStatus('ended');
        }
    };
    
    // Handle incoming answer for outgoing call
    const handleAnswer = async (data) => {
        try {
            console.log('Received answer:', data);
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
    
    // Attempt reconnection when connection is lost
    const attemptReconnection = () => {
        if (!peerConnectionRef.current) return;
        
        console.log('Attempting to reconnect...');
        
        try {
            if (peerConnectionRef.current.restartIce) {
                peerConnectionRef.current.restartIce();
                console.log('ICE restart initiated');
            }
        } catch (error) {
            console.error('Error during reconnection:', error);
            setError('Reconnection failed');
            cleanup();
        }
    };
    
    // Monitor call quality
    const monitorCallQuality = (peerConnection) => {
        if (!peerConnection) return;
        
        const interval = setInterval(() => {
            if (!peerConnectionRef.current || 
                peerConnectionRef.current.connectionState !== 'connected') {
                clearInterval(interval);
                return;
            }
            
            peerConnection.getStats(null).then(stats => {
                let audioStats = {
                    packetsLost: 0,
                    packetsReceived: 0,
                    jitter: 0
                };
                
                stats.forEach(report => {
                    if (report.type === 'inbound-rtp' && report.kind === 'audio') {
                        audioStats.packetsLost = report.packetsLost || 0;
                        audioStats.packetsReceived = report.packetsReceived || 0;
                        audioStats.jitter = report.jitter || 0;
                    }
                });
                
                // Calculate packet loss rate
                if (audioStats.packetsReceived > 0) {
                    const lossRate = (audioStats.packetsLost / 
                        (audioStats.packetsLost + audioStats.packetsReceived)) * 100;
                    
                    console.log(`Call quality: Loss ${lossRate.toFixed(1)}%, Jitter ${(audioStats.jitter * 1000).toFixed(2)}ms`);
                    
                    // Warn if quality is poor
                    if (lossRate > 5) {
                        console.warn('Poor call quality detected');
                    }
                }
            }).catch(err => {
                console.error('Error getting call stats:', err);
            });
        }, 5000);
    };
    
    // Handle incoming ICE candidate
    const handleIceCandidate = async ({ candidate, from }) => {
        try {
            // Skip our own candidates
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
        // Clear existing timer if any
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }
        
        setCallDuration(0);
        
        // Start new timer
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
    
    // Handle media errors
    const handleMediaError = (error) => {
        console.error('Media error:', error);
        
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            setError('Microphone access denied. Please allow microphone access in your browser settings.');
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            setError('No microphone found. Please connect a microphone and try again.');
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            setError('Could not access your microphone. It might be in use by another application.');
        } else {
            setError(`Microphone error: ${error.message || 'Unknown error'}`);
        }
        
        setCallStatus('ended');
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
        remoteStreamRef.current = null;
        setStoredOffer(null);
        setIsRetrying(false);
    };
    
    // Retry call
    const retryCall = () => {
        console.log('Retrying call with forced TURN relay');
        setError('');
        setIsRetrying(true);
        
        // Re-initialize call
        if (callType === 'outgoing') {
            startCall();
        } else {
            setCallStatus('incoming');
        }
    };
    
    // Set up socket event handlers
    useEffect(() => {
        if (!socket || !isOpen) return;
        
        console.log('Setting up socket event listeners');
        
        // Handle incoming ICE candidates
        socket.on('ice-candidate', handleIceCandidate);
        
        // Handle call answered
        socket.on('call-answered', handleAnswer);
        
        // Handle call ended by remote user
        socket.on('call-ended', () => {
            console.log('Call ended by remote user');
            setError('Call ended by remote user');
            cleanup();
            onClose();
        });
        
        // Handle call failed
        socket.on('call-failed', ({ error: callError }) => {
            console.log('Call failed:', callError);
            setError(callError || 'Call failed');
            setCallStatus('ended');
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
            socket.off('call-answered', handleAnswer);
            socket.off('call-ended');
            socket.off('call-failed');
            socket.off('call-rejected');
        };
    }, [isOpen, socket, localUser?.uid]);
    
    // Clean up on unmount
    useEffect(() => {
        return () => {
            cleanup();
        };
    }, []);
    
    // Don't render anything if not open
    if (!isOpen) return null;
    
    return (
        <div className={styles.voiceCallContainer}>
            <div className={styles.voiceCallModal}>
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
                                    <PhoneCallIcon />
                                </button>
                            </div>
                        </>
                    )}
                    
                    {/* Preparing state (testing connectivity) */}
                    {callStatus === 'preparing' && (
                        <>
                            <div className={styles.callDetails}>
                                <span>Preparing call...</span>
                            </div>
                            <div className={styles.spinner}></div>
                        </>
                    )}
                    
                    {/* Calling state (outgoing call) */}
                    {callStatus === 'calling' && (
                        <>
                            <div className={styles.callDetails}>
                                <span>Calling {remoteUser?.name || 'User'}...</span>
                            </div>
                            <div className={styles.buttons}>
                                <button 
                                    className={`${styles.callButton} ${styles.endButton}`}
                                    onClick={endCall}
                                >
                                    <PhoneOffIcon />
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
                                    <PhoneOffIcon />
                                </button>
                                <button 
                                    className={`${styles.callButton} ${styles.acceptButton}`}
                                    onClick={() => handleIncomingCall()}
                                >
                                    <PhoneCallIcon />
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
                            <div className={styles.buttons}>
                                <button 
                                    className={`${styles.callButton} ${styles.endButton}`}
                                    onClick={endCall}
                                >
                                    <PhoneOffIcon />
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
                                    {isMuted ? <MicOffIcon /> : <MicIcon />}
                                </button>
                                <button 
                                    className={`${styles.callButton} ${styles.endButton}`}
                                    onClick={endCall}
                                >
                                    <PhoneOffIcon />
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
                            <div className={styles.buttons}>
                                <button 
                                    className={`${styles.callButton} ${styles.endButton}`}
                                    onClick={endCall}
                                >
                                    <PhoneOffIcon />
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
                                    <RefreshIcon />
                                </button>
                                <button 
                                    className={`${styles.callButton} ${styles.endButton}`}
                                    onClick={onClose}
                                >
                                    <PhoneOffIcon />
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VoiceCall; 