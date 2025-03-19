import { useEffect, useState, useRef, useCallback } from 'react';
import './chatwindow.css';
import { Video, Check, Image, Paperclip, Send, X, AlertCircle, Upload, Mic, Square, File, FileText, FileCode, FileSpreadsheet, Presentation, FileArchive, Type, Play, Pause, Trash2, Download, ArrowDown, Phone } from 'lucide-react';
import Message from './message';
import scrollToBottom from '../../../scripts/scrolltobottom';
import TypingIndicator from './typingindicator';
import formatChatTime from '../../../scripts/converttime';
import VideoCall from '../VideoCall/VideoCall';

// Hook to force component re-render
const useForceUpdate = () => {
    const [, setTick] = useState(0);
    return useCallback(() => {
        setTick(tick => tick + 1);
    }, []);
};

const ChatWindow = (props) => {
    const [message, setMessage] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef(null);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [showPreview, setShowPreview] = useState(false);
    const [unsupportedFiles, setUnsupportedFiles] = useState([]);
    const [showUnsupportedDialog, setShowUnsupportedDialog] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const chatAreaRef = useRef(null);
    const dragCounter = useRef(0);
    const dragTimeout = useRef(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingTimerRef = useRef(null);
    const [showAudioConfirmation, setShowAudioConfirmation] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef(null);
    const [currentPlaybackTime, setCurrentPlaybackTime] = useState(0);
    const playbackTimerRef = useRef(null);
    const [showMediaPreview, setShowMediaPreview] = useState(false);
    const [previewMedia, setPreviewMedia] = useState(null);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const [hasNewMessages, setHasNewMessages] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const previousMessagesLength = useRef(0);
    const isNearBottom = useRef(true);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
    const [videoVolume, setVideoVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const imageRef = useRef(null);
    const videoRef = useRef(null);
    const [isImageDragging, setIsImageDragging] = useState(false);
    const [imageDisplayMode, setImageDisplayMode] = useState('auto'); // 'contain', 'cover', or 'auto'
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
    
    // Video calling state variables
    const [showCallUI, setShowCallUI] = useState(false);
    const [isIncomingCall, setIsIncomingCall] = useState(false);
    const [callInfo, setCallInfo] = useState(null);
    const [callType, setCallType] = useState('video');
    
    // Call the hook to get forceUpdate function
    const forceUpdate = useForceUpdate();

    // Add state to track remote user's online status
    const [remoteUserStatus, setRemoteUserStatus] = useState({
        online: props.userdata?.onlinestatus?.online || false,
        lastSeen: props.userdata?.onlinestatus?.lastSeen || new Date()
    });
    
    // Interval to update remote user's online status
    useEffect(() => {
        if (!props.socket || !props.userdata?.uid) return;
        
        // Initialize with current status
        setRemoteUserStatus({
            online: props.userdata?.onlinestatus?.online || false,
            lastSeen: props.userdata?.onlinestatus?.lastSeen || new Date()
        });
        
        // Function to fetch user status
        const fetchUserStatus = () => {
            props.socket.emit('get-user-status', props.userdata.uid);
        };
        
        // Set up listener for status updates
        props.socket.on('user-status-update', (data) => {
            if (data.userId === props.userdata.uid) {
                setRemoteUserStatus({
                    online: data.status.online,
                    lastSeen: data.status.lastSeen
                });
            }
        });
        
        // Fetch immediately and then set interval
        fetchUserStatus();
        const statusInterval = setInterval(fetchUserStatus, 30000); // Update every 30 seconds
        
        return () => {
            clearInterval(statusInterval);
            props.socket.off('user-status-update');
        };
    }, [props.socket, props.userdata?.uid]);
    
    // Update status when props change (switching chats)
    useEffect(() => {
        setRemoteUserStatus({
            online: props.userdata?.onlinestatus?.online || false,
            lastSeen: props.userdata?.onlinestatus?.lastSeen || new Date()
        });
    }, [props.userdata?.uid, props.userdata?.onlinestatus]);

    useEffect(() => {
        // Remove debug log for socket availability
    }, [props.socket, props.localUser, props.userdata]);

    // Add this new useEffect to close media preview when chat changes
    useEffect(() => {
        if (showMediaPreview) {
            handleCloseMediaPreview();
        }
    }, [props.userdata.uid]);

    if(!props.userdata || !props.userdata.messages){
        return <div className='Loading'>Loading Chats</div>
    }
    
    // Check if new messages have arrived and only auto-scroll if user is at the bottom
    useEffect(() => {
        // If the messages array exists and has changed
        if (props.userdata?.messages) {
            const currentLength = props.userdata.messages.length;
            
            // Check if we have new messages
            if (currentLength > previousMessagesLength.current) {
                // If user is already near bottom, scroll down
                if (isNearBottom.current) {
                    scrollToBottom('chatarea');
                } else {
                    // Otherwise, show notification on the button
                    setHasNewMessages(true);
                    // Count the number of unread messages - include the first message in the count
                    const newMessageCount = currentLength - previousMessagesLength.current;
                    setUnreadCount(prev => {
                        // If this is the first set of unread messages, start counting from the actual number
                        // Otherwise add to the existing count
                        return prev === 0 ? newMessageCount : prev + newMessageCount;
                    });
                }
            } else if (currentLength === 0) {
                // Reset when entering a new chat with no messages
                setHasNewMessages(false);
                setUnreadCount(0);
            }
            
            // Update our reference for next comparison
            previousMessagesLength.current = currentLength;
        }
    }, [props.userdata?.messages?.length]);

    // Add scroll event listener to detect when user scrolls up
    useEffect(() => {
        const chatArea = document.getElementById('chatarea');
        if (!chatArea) return;

        const handleScroll = () => {
            // Check if user is near the bottom (within 100px)
            const isScrolledNearBottom = chatArea.scrollHeight - chatArea.clientHeight - chatArea.scrollTop <= 100;
            
            // Update the ref for use in other effects
            isNearBottom.current = isScrolledNearBottom;
            
            // Show button when user has scrolled up at least 100px from bottom
            const isScrolledUp = chatArea.scrollHeight - chatArea.clientHeight - chatArea.scrollTop > 100;
            setShowScrollButton(isScrolledUp);
            
            // If user scrolled to bottom, clear the new messages notification
            if (isScrolledNearBottom) {
                setHasNewMessages(false);
                setUnreadCount(0);
            }
        };

        chatArea.addEventListener('scroll', handleScroll);
        return () => {
            chatArea.removeEventListener('scroll', handleScroll);
        };
    }, []);

    // Function to handle scroll to bottom button click
    const handleScrollToBottom = () => {
        scrollToBottom('chatarea');
        setHasNewMessages(false);  // Clear notification after scrolling
        setUnreadCount(0);  // Reset unread counter
    };

    console.log('chatwindow',props.userdata)
    // console.log(props.userdata)

    const handleFileUpload = async (files) => {
        if (!files || files.length === 0) return;

        const supportedTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'video/mp4', 'video/webm',
            'audio/mpeg', 'audio/wav',
            'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];

        const validFiles = [];
        const unsupported = [];

        Array.from(files).forEach(file => {
            if (supportedTypes.includes(file.type)) {
                validFiles.push(file);
            } else {
                unsupported.push(file);
            }
        });

        if (unsupported.length > 0) {
            setUnsupportedFiles(unsupported);
            setShowUnsupportedDialog(true);
        }

        if (validFiles.length > 0) {
            setSelectedFiles(validFiles);
            setShowPreview(true);
        }
    };

    const handleConfirmUpload = async () => {
        if (selectedFiles.length === 0) return;

        setIsUploading(true);
        setUploadProgress(0);
        setShowPreview(false);

        try {
            if (!props.socket?.connected) {
                throw new Error('Socket connection lost. Please wait for reconnection.');
            }

            const formData = new FormData();
            selectedFiles.forEach((file, index) => {
                formData.append('file', file);
            });

            const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
            
            const response = await fetch(`${API_URL}/upload`, {
                method: 'POST',
                body: formData,
                credentials: 'include',
                headers: {
                    ...(localStorage.getItem('token') ? {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    } : {})
                }
            });

            if (!response.ok) {
                let errorMessage = 'Upload to Cloudinary failed';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                    console.error('Upload error details:', errorData);
                } catch (jsonError) {
                    console.error('Could not parse error response:', jsonError);
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Upload failed');
            }

            for (let index = 0; index < data.files.length; index++) {
                let retryCount = 0;
                const maxRetries = 3;
                const file = data.files[index];
                
                while (retryCount < maxRetries) {
                    try {
                        const mimeType = file.mimeType;
                        let mediaType = 'file';
                        
                        if (mimeType.startsWith('image/')) {
                            mediaType = 'image';
                        } else if (mimeType.startsWith('video/')) {
                            mediaType = 'video';
                        } else if (mimeType.startsWith('audio/')) {
                            mediaType = 'audio';
                        }

                        const mediaMessage = {
                            chatid: props.userdata.chatid,
                            senderid: props.localUser.uid,
                            recieverid: props.userdata.uid,
                            messageType: mediaType,
                            media: {
                                type: mediaType,
                                url: file.url,
                                filename: file.filename,
                                size: file.size,
                                mimeType: file.mimeType,
                                cloudinary_id: file.public_id
                            },
                            sent: { issent: true, sentat: new Date() },
                            delivered: { isdelivered: false, deliveredat: null },
                            read: { isread: false, readat: null },
                            deletedfor: [],
                            deletedby: null,
                            createdat: new Date(),
                            _id: `temp_${Date.now()}_${index}`,
                            reactions: [],
                            isBeingSentToServer: true
                        };

                        props.handlesend(mediaMessage);
                        
                        const progress = ((index + 1) / data.files.length) * 100;
                        setUploadProgress(progress);
                        
                        break;
                    } catch (error) {
                        retryCount++;
                        console.error(`Error processing Cloudinary file ${index + 1}, attempt ${retryCount}:`, error);
                        
                        if (retryCount === maxRetries) {
                            throw new Error(`Failed to process Cloudinary file ${file.filename} after ${maxRetries} attempts`);
                        }
                        
                        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                    }
                }
            }

            setSelectedFiles([]);
        } catch (error) {
            console.error('Error in Cloudinary upload process:', error);
            alert('Failed to complete Cloudinary upload process: ' + error.message);
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    const handleCancelUpload = () => {
        setSelectedFiles([]);
        setShowPreview(false);
    };

    const handleFileSelect = (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleFileUpload(files);
        }
    };

    // Handle drag and drop events
    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current++;
        
        // Clear any existing timeout
        if (dragTimeout.current) {
            clearTimeout(dragTimeout.current);
        }

        // Set a new timeout to show the overlay
        dragTimeout.current = setTimeout(() => {
            if (dragCounter.current > 0) {
                setIsDragging(true);
                if (chatAreaRef.current) {
                    chatAreaRef.current.classList.add('drag-active');
                }
            }
        }, 100); // 100ms delay
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current--;
        
        // Clear any existing timeout
        if (dragTimeout.current) {
            clearTimeout(dragTimeout.current);
        }

        // Set a new timeout to hide the overlay
        dragTimeout.current = setTimeout(() => {
            if (dragCounter.current === 0) {
                setIsDragging(false);
                if (chatAreaRef.current) {
                    chatAreaRef.current.classList.remove('drag-active');
                }
            }
        }, 150); // 150ms delay
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Clear any existing timeout
        if (dragTimeout.current) {
            clearTimeout(dragTimeout.current);
        }

        dragCounter.current = 0;
        setIsDragging(false);
        if (chatAreaRef.current) {
            chatAreaRef.current.classList.remove('drag-active');
        }

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            handleFileUpload(files);
        }
    };

    // Cleanup timeouts on unmount
    useEffect(() => {
        return () => {
            if (dragTimeout.current) {
                clearTimeout(dragTimeout.current);
            }
        };
    }, []);

    // Add event listeners for drag and drop
    useEffect(() => {
        const chatArea = chatAreaRef.current;
        if (!chatArea) return;

        chatArea.addEventListener('dragenter', handleDragEnter);
        chatArea.addEventListener('dragleave', handleDragLeave);
        chatArea.addEventListener('dragover', handleDragOver);
        chatArea.addEventListener('drop', handleDrop);

        return () => {
            chatArea.removeEventListener('dragenter', handleDragEnter);
            chatArea.removeEventListener('dragleave', handleDragLeave);
            chatArea.removeEventListener('dragover', handleDragOver);
            chatArea.removeEventListener('drop', handleDrop);
        };
    }, []);

    const getFileIcon = (fileType) => {
        if (fileType.startsWith('image/')) return <Image size={40} />;
        if (fileType.startsWith('video/')) return <Video size={40} />;
        if (fileType.startsWith('audio/')) return <Mic size={40} />;
        if (fileType.startsWith('text/')) return <FileText size={40} />;
        if (fileType.startsWith('application/json') || fileType.startsWith('application/xml') || 
            fileType.startsWith('application/x-yaml') || fileType.startsWith('application/x-python-code')) {
            return <FileCode size={40} />;
        }
        if (fileType.includes('spreadsheet')) return <FileSpreadsheet size={40} />;
        if (fileType.includes('presentation')) return <Presentation size={40} />;
        if (fileType.includes('zip') || fileType.includes('rar') || fileType.includes('7z') || fileType.includes('tar')) {
            return <FileArchive size={40} />;
        }
        if (fileType.startsWith('font/')) return <Type size={40} />;
        return <File size={40} />;
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Function to start recording
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setAudioBlob(audioBlob);
                
                const audioURL = URL.createObjectURL(audioBlob);
                
                if (audioRef.current) {
                    audioRef.current.src = audioURL;
                    audioRef.current.load();
                    
                    audioRef.current.onloadedmetadata = () => {
                    };
                    
                    audioRef.current.onerror = (e) => {
                        console.error('Audio error:', e);
                        setIsPlaying(false);
                    };
                }
                
                setShowAudioConfirmation(true);
                audioChunksRef.current = [];
                setIsRecording(false);
                setRecordingTime(0);
                if (recordingTimerRef.current) {
                    clearInterval(recordingTimerRef.current);
                }
            };

            mediaRecorderRef.current.start(100);
            setIsRecording(true);
            setRecordingTime(0);

            recordingTimerRef.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);
        } catch (error) {
            console.error('Error accessing microphone:', error);
            alert('Could not access microphone. Please check your permissions.');
        }
    };

    const handleAudioConfirmation = async (shouldSend) => {
        if (shouldSend && audioBlob) {
            await handleAudioUpload(audioBlob);
        }
        
        if (audioRef.current) {
            const oldSrc = audioRef.current.src;
            audioRef.current.pause();
            audioRef.current.src = '';
            audioRef.current.load();
            
            if (oldSrc && oldSrc.startsWith('blob:')) {
                URL.revokeObjectURL(oldSrc);
            }
        }
        
        if (playbackTimerRef.current) {
            clearInterval(playbackTimerRef.current);
        }
        
        setShowAudioConfirmation(false);
        setAudioBlob(null);
        setIsPlaying(false);
        setCurrentPlaybackTime(0);
    };

    const toggleAudioPlayback = () => {
        if (!audioRef.current || !audioBlob) return;
        
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
            if (playbackTimerRef.current) {
                clearInterval(playbackTimerRef.current);
            }
        } else {
            if (!audioRef.current.src) {
                const audioURL = URL.createObjectURL(audioBlob);
                audioRef.current.src = audioURL;
                audioRef.current.load();
            }
            
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                playPromise
                    .then(() => {
                        setIsPlaying(true);
                        playbackTimerRef.current = setInterval(handleTimeUpdate, 100);
                    })
                    .catch(error => {
                        console.error('Error playing audio:', error);
                        setIsPlaying(false);
                        if (playbackTimerRef.current) {
                            clearInterval(playbackTimerRef.current);
                        }
                    });
            }
        }
    };

    // Function to stop recording
    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            setIsRecording(false);
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
            }
        }
    };

    // Function to handle audio upload
    const handleAudioUpload = async (audioBlob) => {
        setIsUploading(true);
        setUploadProgress(0);

        try {
            const formData = new FormData();
            formData.append('file', audioBlob, 'audio.webm');
            
            const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
            const response = await fetch(`${API_URL}/upload`, {
                method: 'POST',
                body: formData,
                credentials: 'include',
                headers: {
                    ...(localStorage.getItem('token') ? {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    } : {})
                }
            });
            
            if (!response.ok) {
                let errorMessage = 'Cloudinary audio upload failed';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                    console.error('Audio upload error details:', errorData);
                } catch (jsonError) {
                    console.error('Could not parse error response:', jsonError);
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Audio upload to Cloudinary failed');
            }

            const uploadedFile = data.files && data.files.length > 0 ? data.files[0] : null;
            
            if (!uploadedFile) {
                throw new Error('No file data returned from Cloudinary');
            }

            const audioMessage = {
                chatid: props.userdata.chatid,
                senderid: props.localUser.uid,
                recieverid: props.userdata.uid,
                messageType: 'audio',
                media: {
                    type: 'audio',
                    url: uploadedFile.url,
                    filename: uploadedFile.filename,
                    size: uploadedFile.size,
                    mimeType: uploadedFile.mimeType,
                    cloudinary_id: uploadedFile.public_id
                },
                sent: { issent: true, sentat: new Date() },
                delivered: { isdelivered: false, deliveredat: null },
                read: { isread: false, readat: null },
                deletedfor: [],
                deletedby: null,
                createdat: new Date(),
                _id: `temp_audio_${Date.now()}`,
                reactions: [],
                isBeingSentToServer: true
            };
            
            props.handlesend(audioMessage);

            setAudioBlob(null);
            setIsRecording(false);
            setRecordingTime(0);
            setUploadProgress(100);
        } catch (error) {
            console.error('Error uploading audio to Cloudinary:', error);
            alert('Failed to upload audio to Cloudinary: ' + error.message);
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
    };

    // Add this new function to format playback time
    const formatPlaybackTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Add this new function to handle time updates
    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentPlaybackTime(audioRef.current.currentTime);
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (recordingTimerRef.current) {
                clearInterval(recordingTimerRef.current);
            }
            if (playbackTimerRef.current) {
                clearInterval(playbackTimerRef.current);
            }
            if (mediaRecorderRef.current && isRecording) {
                stopRecording();
            }
        };
    }, []);

    // Format recording time
    const formatRecordingTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // Update the handleMediaPreview function to reset image-related states
    const handleMediaPreview = (message) => {
        if (message.media) {
            setPreviewMedia(message);
            setShowMediaPreview(true);
            
            // Reset image-related states
            setZoomLevel(1);
            setDragPosition({ x: 0, y: 0 });
            setImageLoaded(false);
            setImageDimensions({ width: 0, height: 0 });
        }
    };

    // Add this new function to handle media download
    const handleMediaDownload = async (mediaUrl, filename) => {
        try {
            const response = await fetch(mediaUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading media:', error);
            alert('Failed to download media. Please try again.');
        }
    };

    // Update the handleCloseMediaPreview function to also reset image-related states
    const handleCloseMediaPreview = () => {
        setShowMediaPreview(false);
        setZoomLevel(1);
        setDragPosition({ x: 0, y: 0 });
        setImageLoaded(false);
        setImageDimensions({ width: 0, height: 0 });
        setImageDisplayMode('auto'); // Reset to default display mode
    };

    // Add this function to handle zoom in
    const handleZoomIn = () => {
        setZoomLevel(prev => Math.min(prev + 0.25, 3));
    };

    // Add this function to handle zoom out
    const handleZoomOut = () => {
        setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
    };

    // Add this function to handle reset zoom
    const handleResetZoom = () => {
        setZoomLevel(1);
        setDragPosition({ x: 0, y: 0 });
    };

    // Add this function to handle image dragging
    const handleImageDragStart = (e) => {
        if (zoomLevel > 1) {
            setIsImageDragging(true);
        }
    };

    const handleImageDrag = (e) => {
        if (isImageDragging) {
            setDragPosition(prev => ({
                x: prev.x + e.movementX,
                y: prev.y + e.movementY
            }));
        }
    };

    const handleImageDragEnd = () => {
        setIsImageDragging(false);
    };

    // Add this function to handle video volume control
    const handleVolumeChange = (e) => {
        const volume = parseFloat(e.target.value);
        setVideoVolume(volume);
        if (videoRef.current) {
            videoRef.current.volume = volume;
        }
        setIsMuted(volume === 0);
    };

    // Add this function to handle mute toggle
    const handleMuteToggle = () => {
        if (videoRef.current) {
            if (isMuted) {
                videoRef.current.volume = videoVolume || 1;
                setIsMuted(false);
            } else {
                videoRef.current.volume = 0;
                setIsMuted(true);
            }
        }
    };

    // Update the toggleImageDisplayMode function to cycle through three modes
    const toggleImageDisplayMode = () => {
        setImageDisplayMode(prev => {
            if (prev === 'contain') return 'cover';
            if (prev === 'cover') return 'auto';
            return 'contain';
        });
    };

    // Get display text for the current mode
    const getDisplayModeText = () => {
        switch (imageDisplayMode) {
            case 'contain': return 'Fill';
            case 'cover': return 'Auto';
            case 'auto': return 'Fit';
            default: return 'Mode';
        }
    };

    // Function to calculate the appropriate object-fit value based on the mode and image dimensions
    const getObjectFitStyle = () => {
        if (imageDisplayMode !== 'auto') return imageDisplayMode;
        
        // For 'auto' mode, we'll return undefined and let CSS handle it with a class
        return undefined;
    };

    // Add this function to handle image loading
    const handleImageLoad = (e) => {
        setImageLoaded(true);
        setImageDimensions({
            width: e.target.naturalWidth,
            height: e.target.naturalHeight
        });
    };

    // Listen for call-related socket events
    useEffect(() => {
        if (!props.socket) return;
        
        // Set up call event listeners - but only handle outgoing calls here
        // Incoming calls will be handled by the parent ChatApp component
        props.socket.on('call-accepted', (data) => {
            console.log('Call accepted in chat window:', data);
            // Only handle if this is related to a call we initiated
            if (data.calleeId === props.userdata.uid && data.callerId === props.localUser.uid) {
                // Continue with the call - the caller will send an offer next
            }
        });
        
        props.socket.on('call-rejected', (data) => {
            // Only handle if this is related to a call we initiated
            if (data.calleeId === props.userdata.uid && data.callerId === props.localUser.uid) {
                setShowCallUI(false);
                setCallInfo(null);
                alert('Call was rejected');
            }
        });
        
        props.socket.on('call-cancelled', (data) => {
            // Only handle if this is related to a call we're receiving
            if (data.calleeId === props.localUser.uid && data.callerId === props.userdata.uid) {
                console.log('Call cancelled by caller before pickup');
                setShowCallUI(false);
                setCallInfo(null);
            }
        });
        
        props.socket.on('call-ended', (data) => {
            // Only handle if this is related to a call we're in
            if ((data.calleeId === props.userdata.uid && data.callerId === props.localUser.uid) ||
                (data.callerId === props.userdata.uid && data.calleeId === props.localUser.uid)) {
                setShowCallUI(false);
                setCallInfo(null);
            }
        });
        
        // Clean up on unmount
        return () => {
            props.socket.off('call-accepted');
            props.socket.off('call-rejected');
            props.socket.off('call-cancelled');
            props.socket.off('call-ended');
        };
    }, [props.socket, props.userdata, props.localUser]);
    
    // Use these handlers for outgoing calls initiated from ChatWindow
    const handleStartCall = () => {
        setIsIncomingCall(false);
        setShowCallUI(true);
        setCallInfo({
            calleeId: props.userdata.uid,
            calleeName: props.userdata.name,
            calleeProfilePic: props.userdata.profilepicture
        });
        // Default to video call
        setCallType('video');
    };
    
    const handleVoiceCall = () => {
        setIsIncomingCall(false);
        setShowCallUI(true);
        setCallInfo({
            calleeId: props.userdata.uid,
            calleeName: props.userdata.name,
            calleeProfilePic: props.userdata.profilepicture
        });
        // Set call type to audio only
        setCallType('audio');
    };
    
    // Handle accepting a call
    const handleAcceptCall = () => {
        if (!props.socket || !callInfo) return;
        
        props.socket.emit('call-accepted', {
            callerId: callInfo.callerId,
            calleeId: props.localUser.uid
        });
    };
    
    // Handle rejecting a call
    const handleRejectCall = () => {
        if (!props.socket || !callInfo) return;
        
        props.socket.emit('call-rejected', {
            callerId: callInfo.callerId,
            calleeId: props.localUser.uid
        });
        
        setShowCallUI(false);
        setCallInfo(null);
    };
    
    // Handle ending a call
    const handleEndCall = () => {
        setShowCallUI(false);
        setCallInfo(null);
    };

    return (
        <div className="chat-window">
            <div className='chatheader'>
                <div className='chatheaderleft'>
                    {props.onBack && (
                        <button 
                            className='back-button'
                            onClick={props.onBack}
                            aria-label="Go back to recent chats"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 12H5M12 19l-7-7 7-7"/>
                            </svg>
                        </button>
                    )}
                    <img src={`${props.userdata.profilepicture}`} alt='props.userdata' className='chatheaderimg' />
                    <div>
                        <h3>{props.userdata.name}</h3>
                        <p>{remoteUserStatus.online ? <span style={{color:'green'}} >Online</span> : formatChatTime(remoteUserStatus.lastSeen)}</p>
                    </div>
                </div>
                <div className='chatheaderright'>
                    <button className='chatheaderbtn' onClick={handleVoiceCall} title="Voice Call">
                        <Phone size={24} color='white' />
                    </button>
                    <button className='chatheaderbtn' onClick={handleStartCall} title="Video Call">
                        <Video size={24} color='white' />
                    </button>
                </div>
            </div>
            <div 
                id='chatarea' 
                className='chatarea'
                ref={chatAreaRef}
            >
                {props.userdata.messages.map((message, index) => (
                    <Message 
                        key={index} 
                        message={message} 
                        userdata={props.userdata} 
                        onReactionAdd={props.onReactionAdd} 
                        onDeleteMessage={props.onDeleteMessage}
                        onMediaClick={() => handleMediaPreview(message)}
                    />
                ))}
                {props.isTyping && <TypingIndicator userdata={props.userdata} />}
                
                {/* Scroll to bottom button */}
                {showScrollButton && (
                    <button 
                        className={`scroll-to-bottom-btn ${hasNewMessages ? 'has-new-messages' : ''}`}
                        onClick={handleScrollToBottom}
                        aria-label="Scroll to latest messages"
                    >
                        <ArrowDown size={20} />
                        {hasNewMessages && (
                            <>
                                <span className="new-message-dot"></span>
                                <span className="unread-count">{unreadCount}</span>
                            </>
                        )}
                    </button>
                )}
            </div>

            <div className='inputarea'>
                <form className='inputarea-form' onSubmit={(e) => { e.preventDefault(); return false; }}>
                    <input 
                        type='file' 
                        ref={fileInputRef}
                        onChange={handleFileSelect}
                        style={{ display: 'none' }}
                        multiple
                        accept="image/*,video/*,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/zip,application/x-rar-compressed,application/x-7z-compressed,application/x-tar,text/*,application/json,application/xml,application/x-yaml,application/x-python-code,font/*"
                    />
                    
                    <div className="input-buttons">
                        <button 
                            type="button" 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading || isRecording}
                        >
                            <Paperclip size={20} />
                        </button>
                        <button 
                            type="button" 
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading || isRecording}
                        >
                            <Image size={20} />
                        </button>
                        <button 
                            type="button"
                            onClick={isRecording ? stopRecording : startRecording}
                            className={`${isRecording ? 'recording' : ''} audio-record-btn`}
                            disabled={isUploading}
                        >
                            {isRecording ? (
                                <div className="recording-animation">
                                    <div className="pulse-ring"></div>
                                    <Square size={20} />
                                </div>
                            ) : (
                                <Mic size={20} />
                            )}
                        </button>
                        <button 
                            type='submit' 
                            onClick={() => {
                                if (message.trim()) {
                                    props.handlesend(message);
                                    setMessage('');
                                }
                            }}
                            disabled={isUploading || isRecording}
                        >
                            <Send size={20} />
                        </button>
                    </div>

                    {isRecording ? (
                        <div className="recording-indicator">
                            <div className="recording-wave">
                                <div className="wave-bar"></div>
                                <div className="wave-bar"></div>
                                <div className="wave-bar"></div>
                            </div>
                            <span className="recording-time">{formatRecordingTime(recordingTime)}</span>
                        </div>
                    ) : (
                        <input 
                            type='text' 
                            value={message} 
                            onChange={(e) => {
                                props.handletyping(e);
                                setMessage(e.target.value);
                            }}
                            placeholder='Type a message'
                            disabled={isUploading || isRecording}
                        />
                    )}

                    {isUploading && (
                        <div className="upload-progress">
                            <div 
                                className="progress-bar" 
                                style={{ width: `${uploadProgress}%` }}
                            />
                            <span>{Math.round(uploadProgress)}%</span>
                        </div>
                    )}
                </form>
            </div>

            {showPreview && selectedFiles.length > 0 && (
                <div className="file-preview-overlay">
                    <div className="file-preview-content">
                        <div className="file-preview-header">
                            <h3>Preview Files ({selectedFiles.length})</h3>
                            <button onClick={handleCancelUpload} className="close-preview">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="file-preview-body">
                            <div className="files-grid">
                                {selectedFiles.map((file, index) => (
                                    <div key={index} className="file-preview-item">
                                        {file.type.startsWith('image/') ? (
                                            <img 
                                                src={URL.createObjectURL(file)} 
                                                alt={`Preview ${index + 1}`} 
                                                className="image-preview"
                                            />
                                        ) : (
                                            <div className="file-info">
                                                {getFileIcon(file.type)}
                                                <p className="file-name">{file.name}</p>
                                                <p className="file-size">{formatFileSize(file.size)}</p>
                                                <p className="file-type">{file.type.split('/')[1].toUpperCase()}</p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="file-preview-footer">
                            <button onClick={handleCancelUpload} className="cancel-button">
                                Cancel
                            </button>
                            <button 
                                onClick={handleConfirmUpload} 
                                className="send-button"
                                disabled={isUploading}
                            >
                                {isUploading ? 'Uploading...' : 'Send All'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showUnsupportedDialog && (
                <div className="file-preview-overlay">
                    <div className="file-preview-content">
                        <div className="file-preview-header">
                            <h3>Unsupported Files</h3>
                            <button onClick={() => setShowUnsupportedDialog(false)} className="close-preview">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="file-preview-body">
                            <div className="unsupported-files">
                                <AlertCircle size={24} className="alert-icon" />
                                <p>The following files are not supported:</p>
                                <ul>
                                    {unsupportedFiles.map((file, index) => (
                                        <li key={index}>
                                            {file.name} ({file.type})
                                        </li>
                                    ))}
                                </ul>
                                <p>Supported file types: Images (JPEG, PNG, GIF, WebP), Videos (MP4, WebM), Audio (MP3, WAV), and Documents (PDF, DOC, DOCX)</p>
                            </div>
                        </div>
                        <div className="file-preview-footer">
                            <button 
                                onClick={() => setShowUnsupportedDialog(false)} 
                                className="send-button"
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Drag and Drop Overlay */}
            {isDragging && (
                <div className="drag-overlay active">
                    <div className="drag-overlay-content">
                        <Upload className="drag-overlay-icon" size={64} />
                        <p className="drag-overlay-text">Drop files to send</p>
                        <p className="drag-overlay-subtext">
                            Supported files: Images, Videos, Audio, and Documents
                        </p>
                    </div>
                </div>
            )}

            {/* Audio Confirmation Dialog */}
            {showAudioConfirmation && (
                <div className="file-preview-overlay">
                    <div className="file-preview-content audio-confirmation">
                        <div className="file-preview-header">
                            <h3>Voice Message Preview</h3>
                            <button onClick={() => handleAudioConfirmation(false)} className="close-preview">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="file-preview-body">
                            <div className="audio-preview-container">
                                <div className="audio-player">
                                    <button 
                                        className="play-button"
                                        onClick={toggleAudioPlayback}
                                    >
                                        {isPlaying ? <Pause size={24} /> : <Play size={24} />}
                                    </button>
                                    <div className="audio-waveform">
                                        <div className="waveform-bars">
                                            {[...Array(20)].map((_, i) => (
                                                <div key={i} className="waveform-bar"></div>
                                            ))}
                                        </div>
                                    </div>
                                    <span className="audio-duration">
                                        {isPlaying ? formatPlaybackTime(currentPlaybackTime) : formatRecordingTime(recordingTime)}
                                    </span>
                                </div>
                                <audio 
                                    ref={audioRef} 
                                    controls={false}
                                    preload="auto"
                                    onEnded={() => {
                                        setIsPlaying(false);
                                        if (playbackTimerRef.current) {
                                            clearInterval(playbackTimerRef.current);
                                        }
                                        setCurrentPlaybackTime(0);
                                    }}
                                    onError={(e) => {
                                        console.error('Audio playback error:', e);
                                        setIsPlaying(false);
                                        if (playbackTimerRef.current) {
                                            clearInterval(playbackTimerRef.current);
                                        }
                                    }}
                                    onLoadedMetadata={() => console.log('Audio metadata loaded')}
                                />
                            </div>
                        </div>
                        <div className="file-preview-footer">
                            <button 
                                onClick={() => handleAudioConfirmation(false)} 
                                className="cancel-button"
                            >
                                <Trash2 size={16} />
                                Delete
                            </button>
                            <button 
                                onClick={() => handleAudioConfirmation(true)} 
                                className="send-button"
                            >
                                Send Voice Message
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Media Preview Overlay */}
            {showMediaPreview && previewMedia && (
                <div className="file-preview-overlay">
                    <div className="file-preview-content media-preview">
                        <div className="file-preview-header">
                            <h3>Media Preview</h3>
                            <button onClick={handleCloseMediaPreview} className="close-preview">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="file-preview-body">
                            <div className="media-preview-container">
                                {previewMedia.media.type === 'image' && (
                                    <div 
                                        className="image-preview-wrapper"
                                        onMouseDown={handleImageDragStart}
                                        onMouseMove={handleImageDrag}
                                        onMouseUp={handleImageDragEnd}
                                        onMouseLeave={handleImageDragEnd}
                                    >
                                        {imageLoaded && (
                                            <div className="image-info">
                                                {imageDimensions.width} × {imageDimensions.height}
                                                {previewMedia.media.size && (
                                                    <span> • {formatFileSize(previewMedia.media.size)}</span>
                                                )}
                                            </div>
                                        )}
                                        <div className="image-zoom-controls">
                                            <button onClick={handleZoomOut} className="zoom-btn">
                                                -
                                            </button>
                                            <span className="zoom-level">{Math.round(zoomLevel * 100)}%</span>
                                            <button onClick={handleZoomIn} className="zoom-btn">
                                                +
                                            </button>
                                            <button onClick={handleResetZoom} className="zoom-reset-btn">
                                                Reset
                                            </button>
                                            <button onClick={toggleImageDisplayMode} className="display-mode-btn">
                                                {getDisplayModeText()}
                                            </button>
                                        </div>
                                        <img 
                                            ref={imageRef}
                                            src={previewMedia.media.url} 
                                            alt={previewMedia.media.filename}
                                            className={`preview-image ${imageDisplayMode === 'auto' ? 'preview-image-auto' : ''} ${!imageLoaded ? 'loading' : ''}`}
                                            style={{
                                                transform: `scale(${zoomLevel}) translate(${dragPosition.x}px, ${dragPosition.y}px)`,
                                                cursor: zoomLevel > 1 ? 'move' : 'default',
                                                objectFit: getObjectFitStyle()
                                            }}
                                            onLoad={handleImageLoad}
                                        />
                                    </div>
                                )}
                                {previewMedia.media.type === 'video' && (
                                    <div className="video-preview-wrapper">
                                        <video 
                                            ref={videoRef}
                                            src={previewMedia.media.url}
                                            controls
                                            className="preview-video"
                                        />
                                        <div className="video-controls-wrapper">
                                            <div className="volume-control">
                                                <button 
                                                    onClick={handleMuteToggle} 
                                                    className="mute-btn"
                                                >
                                                    {isMuted ? 'Unmute' : 'Mute'}
                                                </button>
                                                <input 
                                                    type="range" 
                                                    min="0" 
                                                    max="1" 
                                                    step="0.1" 
                                                    value={isMuted ? 0 : videoVolume}
                                                    onChange={handleVolumeChange}
                                                    className="volume-slider"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {previewMedia.media.type === 'audio' && (
                                    <div className="audio-preview-wrapper">
                                        <audio 
                                            src={previewMedia.media.url}
                                            controls
                                            className="preview-audio"
                                        />
                                    </div>
                                )}
                                {previewMedia.media.type === 'file' && (
                                    <div className="file-preview-wrapper">
                                        <div className="file-info">
                                            {getFileIcon(previewMedia.media.mimeType)}
                                            <p className="file-name">{previewMedia.media.filename}</p>
                                            <p className="file-size">{formatFileSize(previewMedia.media.size)}</p>
                                            <p className="file-type">{previewMedia.media.mimeType.split('/')[1].toUpperCase()}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="file-preview-footer">
                            <button 
                                onClick={() => handleMediaDownload(previewMedia.media.url, previewMedia.media.filename)}
                                className="download-button"
                            >
                                <Download size={16} />
                                Download
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Video Call UI */}
            {showCallUI && !isIncomingCall && (
                <VideoCall 
                    isOpen={showCallUI}
                    onClose={handleEndCall}
                    isIncoming={false}
                    callee={{
                        uid: props.userdata.uid,
                        name: props.userdata.name,
                        profilepicture: props.userdata.profilepicture
                    }}
                    onAccept={handleAcceptCall}
                    onReject={handleRejectCall}
                    socket={props.socket}
                    localUser={props.localUser}
                    callType={callType}
                />
            )}
        </div>
    );
};

export default ChatWindow;