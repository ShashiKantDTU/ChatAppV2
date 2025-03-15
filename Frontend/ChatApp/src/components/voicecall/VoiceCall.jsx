import React, { useEffect, useRef, useState } from 'react';
import styles from './VoiceCall.module.css';
import { Mic, MicOff, PhoneOff, PhoneCallIcon } from 'lucide-react';

const VoiceCall = ({ 
    isOpen, 
    onClose, 
    remoteUser, 
    socket, 
    localUser,
    callType = 'outgoing', // 'outgoing' or 'incoming'
    initialOffer = null // Add initialOffer prop
}) => {
    const [isMuted, setIsMuted] = useState(false);
    const [callStatus, setCallStatus] = useState(callType === 'incoming' ? 'incoming' : 'connecting');
    const [callDuration, setCallDuration] = useState(0);
    const [error, setError] = useState(null);
    const [storedOffer, setStoredOffer] = useState(initialOffer); // Initialize with initialOffer
    
    const localStreamRef = useRef(null);
    const remoteStreamRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const timerRef = useRef(null);

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
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    };

    useEffect(() => {
        if (!socket || !isOpen) {
            console.log('Call initialization skipped', { hasSocket: !!socket, isOpen });
            return;
        }

        if (callType === 'outgoing') {
            console.log('Initializing outgoing call');
            initializeCall();
        }
        
        return () => {
            console.log('Cleaning up call effect');
            cleanup();
        };
    }, [isOpen, socket]);

    const initializeCall = async () => {
        try {
            console.log('Starting call initialization');
            if (!socket) {
                throw new Error('Socket connection not available');
            }

            // Request media permissions
            console.log('Requesting audio permissions');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('Audio permissions granted');
            localStreamRef.current = stream;

            // Create peer connection
            console.log('Creating peer connection');
            const peerConnection = new RTCPeerConnection(configuration);
            peerConnectionRef.current = peerConnection;

            // Add local stream
            stream.getTracks().forEach(track => {
                console.log('Adding local track to peer connection');
                peerConnection.addTrack(track, stream);
            });

            // Handle incoming stream
            peerConnection.ontrack = (event) => {
                console.log('Received remote track', event.streams[0]);
                remoteStreamRef.current = event.streams[0];
                const remoteAudio = document.getElementById('remoteAudio');
                if (remoteAudio) {
                    remoteAudio.srcObject = event.streams[0];
                }
            };

            // Handle connection state changes
            peerConnection.oniceconnectionstatechange = () => {
                const state = peerConnection.iceConnectionState;
                console.log('ICE connection state changed:', state);
                
                if (state === 'connected') {
                    console.log('Call connected successfully');
                    setCallStatus('ongoing');
                    startTimer();
                } else if (state === 'failed' || state === 'disconnected') {
                    console.log('Call connection failed');
                    setError('Connection failed');
                    cleanup();
                }
            };

            // For outgoing calls, create and send offer
            if (callType === 'outgoing') {
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

            // Handle ICE candidates
            peerConnection.onicecandidate = (event) => {
                if (event.candidate && socket) {
                    console.log('Generated ICE candidate');
                    socket.emit('ice-candidate', {
                        candidate: event.candidate,
                        to: remoteUser.uid
                    });
                }
            };

        } catch (error) {
            console.error('Call initialization failed:', error);
            setError(error.message);
            setCallStatus('ended');
        }
    };

    const handleAnswer = async (answer) => {
        try {
            console.log('Received call answer');
            if (peerConnectionRef.current && peerConnectionRef.current.signalingState !== 'closed') {
                await peerConnectionRef.current.setRemoteDescription(
                    new RTCSessionDescription(answer)
                );
                setCallStatus('connecting');
            }
        } catch (error) {
            console.error('Error handling answer:', error);
            setError(error.message);
        }
    };

    const handleIncomingCall = async (offer) => {
        try {
            console.log('Handling incoming call with offer:', {
                offerReceived: offer,
                type: offer?.type,
                sdp: offer?.sdp
            });
            
            if (!offer) {
                throw new Error('No offer received');
            }

            if (!offer.sdp) {
                throw new Error('Offer missing SDP');
            }

            // Ensure offer has the correct type
            const formattedOffer = {
                type: 'offer',
                sdp: offer.sdp
            };

            console.log('Using formatted offer:', formattedOffer);

            await initializeCall();
            
            if (!peerConnectionRef.current) {
                throw new Error('Peer connection not initialized');
            }

            if (peerConnectionRef.current.signalingState === 'closed') {
                throw new Error('Peer connection is closed');
            }

            console.log('Setting remote description');
            await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(formattedOffer));
            
            console.log('Creating answer');
            const answer = await peerConnectionRef.current.createAnswer();
            
            console.log('Setting local description');
            await peerConnectionRef.current.setLocalDescription(answer);
            
            // Log the complete answer object
            console.log('Generated answer:', {
                type: answer.type,
                sdp: answer.sdp,
                complete: answer
            });

            socket.emit('call-answered', {
                to: remoteUser.uid,
                answer: {
                    type: 'answer',
                    sdp: answer.sdp
                }
            });
            
            setCallStatus('connecting');
        } catch (error) {
            console.error('Error handling incoming call:', error);
            setError(error.message);
            setCallStatus('ended');
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
        timerRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
        }, 1000);
    };

    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const toggleMute = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            audioTrack.enabled = !audioTrack.enabled;
            setIsMuted(!isMuted);
        }
    };

    const endCall = () => {
        console.log('Ending call');
        socket.emit('end-call', {
            to: remoteUser.uid
        });
        cleanup();
        onClose();
    };

    const cleanup = () => {
        console.log('Cleaning up call resources');
        // Stop all tracks in local stream
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
        }

        // Close peer connection
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
        }

        // Clear timer
        if (timerRef.current) {
            clearInterval(timerRef.current);
        }

        // Reset state
        setCallDuration(0);
        if (callStatus !== 'ended') {
            setCallStatus('ended');
        }
    };

    // Update socket event listeners to check for socket
    useEffect(() => {
        if (!socket) return;

        const socketHandlers = {
            'call-answered': ({ answer }) => {
                console.log('Call answered');
                handleAnswer(answer);
            },
            'incoming-call': ({ from, offer }) => {
                console.log('Incoming call received:', { from, offer });
                if (!offer) {
                    console.error('No offer received in incoming-call');
                    return;
                }
                // Store the complete offer object with type
                const formattedOffer = {
                    type: 'offer',
                    sdp: offer.sdp
                };
                console.log('Setting incoming offer:', formattedOffer);
                setStoredOffer(formattedOffer);
                setCallStatus('incoming');
            },
            'ice-candidate': ({ candidate }) => {
                handleIceCandidate(candidate);
            },
            'call-ended': () => {
                console.log('Call ended by remote user');
                cleanup();
                onClose();
            },
            'call-failed': ({ error }) => {
                console.log('Call failed:', error);
                setError(error);
                setCallStatus('ended');
            }
        };

        // Register all handlers
        Object.entries(socketHandlers).forEach(([event, handler]) => {
            socket.on(event, handler);
        });

        // Cleanup function
        return () => {
            Object.keys(socketHandlers).forEach(event => {
                socket.off(event);
            });
        };
    }, [socket]);

    // Add debugging for incomingOffer state
    useEffect(() => {
        console.log('incomingOffer updated:', storedOffer);
    }, [storedOffer]);

    if (!isOpen) return null;

    return (
        <div className={styles.voiceCallContainer}>
            <div className={styles.callContent}>
                <img 
                    src={remoteUser?.profilepicture} 
                    alt={remoteUser?.name} 
                    className={styles.callerImage} 
                />
                <h2 className={styles.callerName}>{remoteUser?.name}</h2>
                <p className={styles.callStatus}>
                    {error ? `Error: ${error}` :
                     callStatus === 'connecting' ? 'Connecting...' : 
                     callStatus === 'ongoing' ? formatDuration(callDuration) : 
                     callStatus === 'incoming' ? 'Incoming call...' :
                     'Call ended'}
                </p>

                <div className={styles.controls}>
                    {callStatus === 'incoming' ? (
                        // Show Accept/Decline buttons for incoming calls
                        <>
                            <button 
                                className={`${styles.controlButton} ${styles.acceptCall}`}
                                onClick={() => {
                                    console.log('Accept button clicked, stored offer:', storedOffer);
                                    if (!storedOffer) {
                                        console.error('No stored offer available');
                                        setError('Failed to accept call: No offer available');
                                        return;
                                    }
                                    handleIncomingCall(storedOffer);
                                }}
                            >
                                <PhoneCallIcon size={24} />
                            </button>
                            <button 
                                className={`${styles.controlButton} ${styles.endCall}`}
                                onClick={endCall}
                            >
                                <PhoneOff size={24} />
                            </button>
                        </>
                    ) : (
                        // Show Mute/End buttons for ongoing calls
                        <>
                            <button 
                                className={`${styles.controlButton} ${isMuted ? styles.muted : ''}`}
                                onClick={toggleMute}
                                disabled={callStatus === 'ended'}
                            >
                                {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                            </button>
                            <button 
                                className={`${styles.controlButton} ${styles.endCall}`}
                                onClick={endCall}
                            >
                                <PhoneOff size={24} />
                            </button>
                        </>
                    )}
                </div>
            </div>
            
            {/* Hidden audio element for remote stream */}
            <audio id="remoteAudio" autoPlay />
        </div>
    );
};

export default VoiceCall; 