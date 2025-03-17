import React, { useEffect, useRef, useState } from 'react';
import styles from './VoiceCall.module.css';
import { FiPhoneCall as PhoneCallIcon, FiPhoneOff as PhoneOffIcon, FiMic as MicIcon, FiMicOff as MicOffIcon } from 'react-icons/fi';

const VoiceCall = ({ 
    isOpen, 
    onClose, 
    remoteUser, 
    socket, 
    localUser,
    callType = 'outgoing', // 'outgoing' or 'incoming'
    initialOffer = null // Add initialOffer prop
}) => {
    const [callStatus, setCallStatus] = useState(callType === 'incoming' ? 'incoming' : 'idle');
    const [callDuration, setCallDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [error, setError] = useState('');
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);
    const [storedOffer, setStoredOffer] = useState(initialOffer);
    
    // Refs
    const peerConnectionRef = useRef(null);
    const localStreamRef = useRef(null);
    const remoteStreamRef = useRef(null);
    const timerRef = useRef(null);
    const iceCandidatesQueue = useRef([]);
    const localAudioRef = useRef(null);
    const remoteAudioRef = useRef(null);

    // Update storedOffer when initialOffer changes
    useEffect(() => {
        if (initialOffer && callType === 'incoming') {
            console.log('Received initial offer:', initialOffer);
            setStoredOffer(initialOffer);
        }
    }, [initialOffer, callType]);

    // Debug log for component mount and props
    useEffect(() => {
        console.log('VoiceCall component mounted', {
            isOpen,
            callType,
            remoteUser,
            localUser,
            hasSocket: !!socket,
            hasInitialOffer: !!initialOffer
        });

        // Set up socket listener for incoming call immediately
        if (socket && callType === 'incoming') {
            const handleIncomingCallOffer = ({ from, offer }) => {
                console.log('Received incoming call offer:', { from, offer });
                if (from === remoteUser?.uid && offer?.sdp) {
                    const formattedOffer = {
                        type: 'offer',
                        sdp: offer.sdp
                    };
                    console.log('Storing formatted offer:', formattedOffer);
                    setStoredOffer(formattedOffer);
                }
            };

            socket.on('incoming-call', handleIncomingCallOffer);
            return () => socket.off('incoming-call', handleIncomingCallOffer);
        }
    }, []);

    // Validate required props
    useEffect(() => {
        console.log('Validating props', {
            socket: !!socket,
            remoteUser,
            localUser
        });

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

    // WebRTC configuration
    const configuration = {
        iceServers: [
            // Google's public STUN servers
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            
            // Free TURN servers - Note: For production, use your own TURN server
            {
                urls: 'turn:openrelay.metered.ca:80',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            {
                urls: 'turn:openrelay.metered.ca:443',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            {
                urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                username: 'openrelayproject',
                credential: 'openrelayproject'
            },
            // Backup TURN servers from Twilio or other providers could be added here
        ],
        iceCandidatePoolSize: 10,
        iceTransportPolicy: 'all', // Try 'relay' if still having issues
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
        sdpSemantics: 'unified-plan'
    };

    useEffect(() => {
        if (!socket || !isOpen) {
            console.log('Call initialization skipped', { hasSocket: !!socket, isOpen });
            return;
        }

        if (callType === 'outgoing') {
            console.log('Initializing outgoing call');
            initializeCall(true);
        }
        
        return () => {
            console.log('Cleaning up call effect');
            cleanup();
        };
    }, [isOpen, socket]);

    // Initialize the WebRTC peer connection and media stream
    const initializeCall = async (isOutgoing) => {
        try {
            console.log('Initializing call as', isOutgoing ? 'outgoing' : 'incoming');
            
            // Clean up any existing connection first
            if (peerConnectionRef.current) {
                console.log('Cleaning up existing peer connection');
                peerConnectionRef.current.close();
                peerConnectionRef.current = null;
            }
            
            // Reset our queue of ICE candidates
            iceCandidatesQueue.current = [];
            
            // Request audio permissions
            console.log('Requesting audio stream');
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true
            }).catch(error => {
                // Handle permission errors
                console.error('Error getting user media:', error);
                handlePermissionIssues(error);
                throw error; // Re-throw to stop initialization
            });
            
            console.log('Audio stream obtained, setting local stream');
            localStreamRef.current = stream;
            
            // Set up the audio element for the local stream
            const localAudio = document.getElementById('localAudio');
            if (localAudio) {
                localAudio.srcObject = stream;
                localAudio.muted = true; // Mute local audio to avoid echo
            }
            
            // Create a new peer connection with our enhanced configuration
            console.log('Creating new RTCPeerConnection with config:', configuration);
            const peerConnection = new RTCPeerConnection(configuration);
            peerConnectionRef.current = peerConnection;
            
            // Add all audio tracks from our stream to the peer connection
            stream.getAudioTracks().forEach(track => {
                console.log('Adding audio track to peer connection:', track.label);
                peerConnection.addTrack(track, stream);
            });
            
            // Handle incoming audio streams
            peerConnection.ontrack = (event) => {
                console.log('Received remote track:', event.track.kind);
                if (event.streams && event.streams[0]) {
                    console.log('Setting remote stream from ontrack event');
                    remoteStreamRef.current = event.streams[0];
                    
                    // Set up the audio element for the remote stream
                    const remoteAudio = document.getElementById('remoteAudio');
                    if (remoteAudio) {
                        console.log('Setting srcObject for remote audio element');
                        remoteAudio.srcObject = event.streams[0];
                    }
                }
            };
            
            // Add comprehensive logging for connection state
            peerConnection.onconnectionstatechange = () => {
                const state = peerConnection.connectionState;
                console.log('Connection state changed:', state);
                
                if (state === 'connected') {
                    console.log('WebRTC connection established successfully');
                    setCallStatus('ongoing');
                    startTimer();
                } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
                    console.log(`WebRTC connection ${state}`);
                    if (state === 'failed') {
                        setError('Connection failed. Please ensure both devices have good network connectivity.');
                        cleanup();
                    }
                }
            };
            
            // Log signaling state changes
            peerConnection.onsignalingstatechange = () => {
                console.log('Signaling state changed:', peerConnection.signalingState);
            };
            
            // Log ICE gathering state changes
            peerConnection.onicegatheringstatechange = () => {
                console.log('ICE gathering state changed:', peerConnection.iceGatheringState);
            };
            
            // Handle ICE candidates
            peerConnection.onicecandidate = (event) => {
                if (event.candidate && socket && remoteUser?.uid) {
                    console.log('Generated ICE candidate', event.candidate);
                    
                    // Make sure we're sending the full candidate information
                    socket.emit('ice-candidate', {
                        candidate: event.candidate,
                        to: remoteUser.uid,
                        from: localUser.uid
                    });
                } else if (!event.candidate) {
                    console.log('ICE candidate gathering complete');
                }
            };

            // For outgoing calls, create and send offer
            if (isOutgoing) {
                console.log('Creating call offer');
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);
                
                // Log the complete offer object
                console.log('Generated offer:', {
                    type: offer.type,
                    sdp: offer.sdp,
                    complete: offer
                });
                
                socket.emit('call-user', {
                    userToCall: remoteUser.uid,
                    from: localUser.uid,
                    offer: {
                        type: 'offer',
                        sdp: offer.sdp
                    }
                });
            }

            console.log('Call initialization completed successfully');
            return peerConnection;
        } catch (error) {
            console.error('Error initializing call:', error);
            setError('Failed to access microphone: ' + (error.message || 'Permission denied'));
            setCallStatus('ended');
            throw error; // Re-throw to be handled by the caller
        }
    };

    // Handle incoming answer for outgoing call
    const handleAnswer = async (data) => {
        try {
            console.log('Call answered, received data:', data);
            const { answer } = data;
            
            if (!answer || !answer.sdp) {
                console.error('Invalid answer format received:', answer);
                throw new Error('Invalid answer format');
            }
            
            if (peerConnectionRef.current) {
                console.log('Setting remote description from answer:', answer);
                
                // Ensure answer is properly formatted as RTCSessionDescription
                const formattedAnswer = {
                    type: answer.type || 'answer',
                    sdp: answer.sdp
                };
                
                await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(formattedAnswer));
                console.log('Remote description set successfully');
                
                // Process any queued ICE candidates now that remote description is set
                await processIceCandidates();
                
                setCallStatus('connecting');
                console.log('Call status updated to connecting');
            }
        } catch (error) {
            console.error('Error handling call answer:', error);
            setError('Failed to establish connection');
            cleanup();
        }
    };

    // Handle incoming call offer
    const handleIncomingCall = async () => {
        try {
            console.log('Handling incoming call with offer:', storedOffer);
            if (!storedOffer) {
                console.error('No offer available for incoming call');
                setError('Call setup failed - missing offer');
                return;
            }

            await initializeCall(false);

            if (peerConnectionRef.current) {
                console.log('Setting remote description from offer');
                await peerConnectionRef.current.setRemoteDescription(
                    new RTCSessionDescription(storedOffer)
                );
                console.log('Remote description set successfully');
                
                // Process any queued ICE candidates
                await processIceCandidates();

                console.log('Creating answer');
                const answer = await peerConnectionRef.current.createAnswer();
                console.log('Answer created');

                await peerConnectionRef.current.setLocalDescription(answer);
                console.log('Local description set');

                // Format the answer properly before sending
                const formattedAnswer = {
                    type: answer.type,
                    sdp: answer.sdp
                };

                console.log('Sending answer to caller with ID:', storedOffer.from);
                socket.emit('call-answered', {
                    answer: formattedAnswer,
                    to: storedOffer.from
                });
                console.log('Answer sent to caller');

                setCallStatus('connecting');
                console.log('Call status updated to connecting after creating answer');
            }
        } catch (error) {
            console.error('Error handling incoming call:', error);
            setError('Failed to answer call: ' + (error.message || 'Connection error'));
            cleanup();
        }
    };

    const handleIceCandidate = async (candidate) => {
        try {
            console.log('Handling ICE candidate');
            if (peerConnectionRef.current && peerConnectionRef.current.signalingState !== 'closed') {
                await peerConnectionRef.current.addIceCandidate(
                    new RTCIceCandidate(candidate)
                );
            }
        } catch (error) {
            console.error('Error handling ICE candidate:', error);
        }
    };

    const startTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }
        
        setCallDuration(0);
        
        timerRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
        }, 1000);
    };

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const toggleMute = () => {
        if (!localStreamRef.current) return;
        
        const audioTracks = localStreamRef.current.getAudioTracks();
        if (audioTracks.length === 0) return;
        
        const newMuteState = !isMuted;
        console.log(newMuteState ? 'Muting audio' : 'Unmuting audio');
        
        audioTracks.forEach(track => {
            track.enabled = !newMuteState;
        });
        
        setIsMuted(newMuteState);
    };

    const endCall = () => {
        console.log('User ended call');
        
        // Notify the remote user that the call has ended
        if (socket && remoteUser?.uid) {
            console.log('Sending call-ended event to:', remoteUser.uid);
            socket.emit('call-ended', {
                to: remoteUser.uid
            });
        }
        
        // Clean up resources
        cleanup();
        
        // Close the call modal
        onClose();
    };

    const rejectCall = () => {
        console.log('Rejecting incoming call');
        
        if (socket && storedOffer && storedOffer.from) {
            console.log('Sending call-rejected event to:', storedOffer.from);
            socket.emit('call-rejected', {
                to: storedOffer.from
            });
        }
        
        // Clean up and close
        cleanup();
        onClose();
    };

    const cleanup = () => {
        console.log('Cleaning up call resources');
        
        // Stop the call timer if running
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        
        // Close and clean up peer connection
        if (peerConnectionRef.current) {
            try {
                // Remove all event listeners
                peerConnectionRef.current.ontrack = null;
                peerConnectionRef.current.onicecandidate = null;
                peerConnectionRef.current.oniceconnectionstatechange = null;
                peerConnectionRef.current.onsignalingstatechange = null;
                peerConnectionRef.current.onicegatheringstatechange = null;
                peerConnectionRef.current.onconnectionstatechange = null;
                
                // Close the connection
                peerConnectionRef.current.close();
                console.log('Peer connection closed');
            } catch (err) {
                console.error('Error closing peer connection:', err);
            } finally {
                peerConnectionRef.current = null;
            }
        }
        
        // Stop and clean up local audio stream
        if (localStreamRef.current) {
            try {
                localStreamRef.current.getTracks().forEach(track => {
                    track.stop();
                    console.log('Local track stopped:', track.kind);
                });
            } catch (err) {
                console.error('Error stopping local tracks:', err);
            } finally {
                setLocalStream(null);
                localStreamRef.current = null;
            }
        }
        
        // Clear remote stream
        setRemoteStream(null);
        remoteStreamRef.current = null;
        
        // Clear audio elements
        const localAudio = document.getElementById('localAudio');
        if (localAudio) localAudio.srcObject = null;
        
        const remoteAudio = document.getElementById('remoteAudio');
        if (remoteAudio) remoteAudio.srcObject = null;
        
        // Reset call status if not already ended
        if (callStatus !== 'ended') {
            setCallStatus('ended');
        }
        
        // Clear any stored offers or errors
        setStoredOffer(null);
        
        console.log('Call resources cleaned up successfully');
    };

    // Setup socket event listeners for call handling
    useEffect(() => {
        if (!socket || !isOpen) return;
        
        console.log('Setting up socket event listeners for call handling');
        
        // Handle remote ICE candidates
        const handleIceCandidate = async ({ candidate, from }) => {
            try {
                // Ignore ICE candidates from ourselves
                if (from === localUser.uid) {
                    console.log('Ignoring ICE candidate from self');
                    return;
                }
                
                if (peerConnectionRef.current && candidate) {
                    console.log('Received ICE candidate from:', from);
                    
                    if (peerConnectionRef.current.remoteDescription === null) {
                        // Queue the candidate if remote description not set yet
                        console.log('Remote description not set yet, queuing ICE candidate');
                        iceCandidatesQueue.current.push(candidate);
                    } else {
                        // Add the candidate immediately
                        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                        console.log('Added ICE candidate successfully');
                    }
                }
            } catch (err) {
                console.error('Error adding received ICE candidate', err);
            }
        };
        
        // Handle call answered event
        const handleCallAnswered = async (data) => {
            console.log('Call answered event received', data);
            
            // Validate the data structure
            if (!data || !data.answer) {
                console.error('Invalid call-answered data format:', data);
                setError('Call connection failed due to invalid data');
                return;
            }
            
            await handleAnswer(data);
        };
        
        // Handle incoming call event
        const handleIncomingCallEvent = ({ from, offer }) => {
            console.log('Incoming call received:', { from, offer });
            if (!offer) {
                console.error('No offer received in incoming-call');
                return;
            }
            
            // Store the complete offer object with from field
            const processedOffer = {
                type: offer.type,
                sdp: offer.sdp,
                from: from // Ensure the from field is at the top level
            };
            
            console.log('Setting incoming offer with from:', processedOffer);
            setStoredOffer(processedOffer);
            setCallStatus('incoming');
        };
        
        // Handle call ended by remote user
        const handleCallEnded = () => {
            console.log('Call ended by remote user');
            setError('Call ended by remote user');
            cleanup();
            onClose();
        };
        
        // Handle call failed
        const handleCallFailed = ({ error }) => {
            console.log('Call failed:', error);
            setError(error || 'Call failed');
            setCallStatus('ended');
        };
        
        // Register event handlers
        socket.on('ice-candidate', handleIceCandidate);
        socket.on('call-answered', handleCallAnswered);
        socket.on('incoming-call', handleIncomingCallEvent);
        socket.on('call-ended', handleCallEnded);
        socket.on('call-failed', handleCallFailed);
        
        // Clean up event listeners when component unmounts
        return () => {
            console.log('Cleaning up socket event listeners');
            socket.off('ice-candidate', handleIceCandidate);
            socket.off('call-answered', handleCallAnswered);
            socket.off('incoming-call', handleIncomingCallEvent);
            socket.off('call-ended', handleCallEnded);
            socket.off('call-failed', handleCallFailed);
        };
    }, [isOpen, socket, onClose, localUser.uid]);
    
    // Handle call status changes to update UI
    useEffect(() => {
        console.log('Call status changed to:', callStatus);
        
        // Start timer when call becomes ongoing
        if (callStatus === 'ongoing') {
            startTimer();
        }
        
        // Clean up when call ends
        if (callStatus === 'ended') {
            cleanup();
        }
    }, [callStatus]);

    // Add debugging for incomingOffer state
    useEffect(() => {
        console.log('incomingOffer updated:', storedOffer);
    }, [storedOffer]);

    // Function to apply queued ICE candidates after setting remote description
    const processIceCandidates = async () => {
        try {
            if (peerConnectionRef.current && iceCandidatesQueue.current.length > 0) {
                console.log(`Processing ${iceCandidatesQueue.current.length} queued ICE candidates`);
                
                // Make a copy of the queue to prevent issues during processing
                const candidates = [...iceCandidatesQueue.current];
                iceCandidatesQueue.current = [];
                
                // Process all queued candidates
                for (const candidate of candidates) {
                    try {
                        if (peerConnectionRef.current.remoteDescription) {
                            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
                            console.log('Added queued ICE candidate successfully');
                        } else {
                            console.warn('Remote description still not set, re-queuing candidate');
                            iceCandidatesQueue.current.push(candidate);
                        }
                    } catch (candidateError) {
                        console.error('Error adding specific ICE candidate:', candidateError);
                        // Continue processing other candidates even if one fails
                    }
                }
                
                // If we had to re-queue some, log this fact
                if (iceCandidatesQueue.current.length > 0) {
                    console.log(`${iceCandidatesQueue.current.length} candidates re-queued due to missing remote description`);
                }
            }
        } catch (err) {
            console.error('Error processing queued ICE candidates:', err);
        }
    };

    // Create and send an offer for an outgoing call
    const makeCall = async () => {
        try {
            console.log('Initiating outgoing call to:', remoteUser?.username || 'User');
            
            // Check if remoteUser is available
            if (!remoteUser?.uid) {
                throw new Error('Remote user not available for call');
            }
            
            await initializeCall(true);
            
            if (peerConnectionRef.current) {
                console.log('Creating offer for outgoing call');
                const offer = await peerConnectionRef.current.createOffer({
                    offerToReceiveAudio: true
                });
                console.log('Offer created:', offer);
                
                await peerConnectionRef.current.setLocalDescription(offer);
                console.log('Local description set successfully');
                
                // Log the complete offer for debugging
                console.log('Sending call offer:', {
                    to: remoteUser.uid,
                    from: localUser.uid,
                    offer: peerConnectionRef.current.localDescription
                });
                
                socket.emit('call-user', {
                    userToCall: remoteUser.uid,
                    from: localUser.uid,
                    offer: peerConnectionRef.current.localDescription
                });
                
                setCallStatus('calling');
                console.log('Call status updated to calling');
            } else {
                throw new Error('Peer connection failed to initialize');
            }
        } catch (error) {
            console.error('Error making call:', error);
            setError('Failed to initiate call: ' + (error.message || 'Connection error'));
            cleanup();
        }
    };

    // Function to detect and handle permission issues
    const handlePermissionIssues = (error) => {
        console.error('Permission or initialization error:', error);
        
        // Check for different error types
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            setError('Microphone access denied. Please allow microphone access in your browser settings.');
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            setError('No microphone found. Please connect a microphone and try again.');
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            setError('Could not access your microphone. It might be in use by another application.');
        } else if (error.name === 'OverconstrainedError') {
            setError('Your microphone does not meet the required constraints.');
        } else if (error.name === 'TypeError' || error.message.includes('getUserMedia is not a function')) {
            setError('Your browser does not support audio calls or is running in a non-secure context.');
        } else {
            setError(`Call initialization failed: ${error.message || 'Unknown error'}`);
        }
        
        setCallStatus('ended');
    };
    
    // Separate function to pre-check permissions before initiating a call
    const preCheckPermissions = async () => {
        try {
            console.log('Pre-checking audio permissions');
            await navigator.mediaDevices.getUserMedia({ audio: true })
                .then(stream => {
                    // Stop all tracks from the test stream
                    stream.getTracks().forEach(track => track.stop());
                    console.log('Audio permissions pre-check successful');
                    // Now we can proceed with making the call
                    makeCall();
                })
                .catch(error => {
                    console.error('Pre-check permissions failed:', error);
                    handlePermissionIssues(error);
                });
        } catch (error) {
            console.error('Error in permission pre-check:', error);
            handlePermissionIssues(error);
        }
    };

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
                        {remoteUser.profilePicture ? (
                            <img src={remoteUser.profilePicture} alt={remoteUser.username} />
                        ) : (
                            <div className={styles.defaultAvatar}>
                                {remoteUser.username ? remoteUser.username.charAt(0).toUpperCase() : '?'}
                            </div>
                        )}
                    </div>
                    <div className={styles.username}>{remoteUser.username || 'User'}</div>
                </div>
                
                {/* Hidden audio elements for streams */}
                <audio id="localAudio" autoPlay muted ref={localAudioRef} />
                <audio id="remoteAudio" autoPlay ref={remoteAudioRef} />
                
                <div className={styles.callActions}>
                    {callStatus === 'idle' && (
                        <>
                            <div className={styles.callDetails}>
                                {callType === 'incoming' ? (
                                    <span>Incoming call from {remoteUser?.username || 'User'}</span>
                                ) : (
                                    <span>Call {remoteUser?.username || 'User'}</span>
                                )}
                            </div>
                            <div className={styles.buttons}>
                                {callType === 'incoming' ? (
                                    <>
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
                                    </>
                                ) : (
                                    <button 
                                        className={`${styles.callButton} ${styles.callingButton}`} 
                                        onClick={preCheckPermissions}
                                    >
                                        <PhoneCallIcon />
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                    
                    {callStatus === 'calling' && (
                        <>
                            <div className={styles.callDetails}>
                                <span>Calling {remoteUser?.username || 'User'}...</span>
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
                    
                    {callStatus === 'incoming' && (
                        <>
                            <div className={styles.callDetails}>
                                <span>Incoming call from {remoteUser?.username || 'User'}</span>
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
                    
                    {callStatus === 'ongoing' && (
                        <>
                            <div className={styles.callDetails}>
                                <span>In call with {remoteUser?.username || 'User'}</span>
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
                </div>
            </div>
        </div>
    );
};

export default VoiceCall; 