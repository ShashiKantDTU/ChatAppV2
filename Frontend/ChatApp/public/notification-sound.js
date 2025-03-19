/**
 * Play a custom notification sound from an MP3 file
 */

// Store AudioContext and audio element globally to reuse
let audioCtx = null;
let audioElement = null;
let hasUserInteracted = false;

// Track user interaction state
function markUserInteraction() {
  hasUserInteracted = true;
  
  // Initialize audio system if needed
  if (!audioCtx) {
    initAudioSystem();
  }
  
  // Remove event listeners once interaction is detected
  document.removeEventListener('click', markUserInteraction);
  document.removeEventListener('keydown', markUserInteraction);
  document.removeEventListener('touchstart', markUserInteraction);
}

// Add event listeners for user interaction
document.addEventListener('click', markUserInteraction);
document.addEventListener('keydown', markUserInteraction);
document.addEventListener('touchstart', markUserInteraction);

// Initialize the audio system after user interaction
function initAudioSystem() {
  if (!audioCtx) {
    try {
      // Create audio context for better control
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContext();
      
      // Create audio element once and reuse it
      audioElement = new Audio('/notification.mp3');
      
      // Pre-load the sound file
      audioElement.load();
      
      // If context is suspended (browser requirement), attempt to resume it
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      
      console.log('Notification sound system initialized');
      return true;
    } catch (error) {
      console.error('Failed to initialize audio system:', error);
      return false;
    }
  }
  return true;
}

function playNotificationSound() {
  // If user hasn't interacted yet, we can't play sounds (browser restriction)
  if (!hasUserInteracted) {
    console.log('Cannot play notification sound until user interacts with the page');
    return;
  }
  
  // Initialize if not already done
  if (!audioElement && !initAudioSystem()) {
    return;
  }
  
  try {
    // Make sure context is running
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    
    // Reset audio to beginning
    audioElement.currentTime = 0;
    
    // Play the sound
    const playPromise = audioElement.play();
    
    // Handle autoplay restrictions
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        console.log('Could not play notification sound:', error);
      });
    }
  } catch (error) {
    console.error('Error playing notification sound:', error);
  }
}

// Export the functions
window.playNotificationSound = playNotificationSound;
window.initNotificationSound = initAudioSystem; 