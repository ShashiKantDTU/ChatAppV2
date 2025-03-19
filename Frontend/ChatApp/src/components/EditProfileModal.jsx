import React, { useState, useRef, useCallback } from 'react';
import styles from './EditProfileModal.module.css';
import { X, User, Camera, Save, RotateCw, Check, Crop as CropIcon } from 'react-feather';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

const EditProfileModal = ({ user, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    username: user.username || '',
    profilepicture: user.profilepicture || '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(user.profilepicture || '');
  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const imgRef = useRef(null);
  const cropCanvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Function to handle input changes (for username)
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Function to handle file selection
  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onload = () => {
        setSelectedImage(file);
        setPreviewUrl(reader.result);
        setIsCropping(true);
      };
      
      reader.readAsDataURL(file);
    }
  };

  // Function to trigger file input click
  const handleChangeAvatarClick = () => {
    fileInputRef.current.click();
  };

  // Function to center and create the initial crop
  const centerAspectCrop = (mediaWidth, mediaHeight, aspect) => {
    return centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 90,
        },
        aspect,
        mediaWidth,
        mediaHeight
      ),
      mediaWidth,
      mediaHeight
    );
  };

  // Function to handle image load and set initial crop
  const onImageLoad = useCallback((e) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 1));
  }, []);

  // Function to cancel cropping
  const handleCancelCrop = () => {
    setIsCropping(false);
    setSelectedImage(null);
    setPreviewUrl(user.profilepicture || '');
  };

  // Function to complete cropping
  const handleCompleteCrop = () => {
    if (!completedCrop || !cropCanvasRef.current || !imgRef.current) {
      console.error('Missing crop data or references');
      return;
    }

    const canvas = cropCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const image = imgRef.current;
    
    // Calculate pixel values from percentage crop data
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    const pixelCrop = {
      x: completedCrop.x * scaleX,
      y: completedCrop.y * scaleY,
      width: completedCrop.width * scaleX,
      height: completedCrop.height * scaleY,
    };
    
    // Set canvas dimensions to match crop dimensions
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    
    console.log('Creating crop with dimensions:', pixelCrop.width, 'x', pixelCrop.height);
    console.log('Original image dimensions:', image.naturalWidth, 'x', image.naturalHeight);
    
    // Clear canvas before drawing
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw the cropped image onto the canvas
    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );
    
    // Convert canvas to blob and create FormData for uploading
    canvas.toBlob((blob) => {
      if (!blob) {
        console.error('Canvas is empty or failed to create blob');
        return;
      }
      
      console.log('Created blob with size:', blob.size, 'bytes', 'and type:', blob.type);
      
      // Create a new file from the blob with timestamp to avoid caching issues
      const filename = `profile-${Date.now()}.jpg`;
      const croppedImageFile = new File([blob], filename, { type: 'image/jpeg' });
      setSelectedImage(croppedImageFile);
      
      // Update preview with cropped image
      const croppedImageUrl = URL.createObjectURL(blob);
      setPreviewUrl(croppedImageUrl);
      
      // Clean up the old preview URL to prevent memory leaks
      setTimeout(() => {
        URL.revokeObjectURL(croppedImageUrl);
      }, 60000); // Revoke after 1 minute
      
      setIsCropping(false);
      
    }, 'image/jpeg', 0.95);
  };

  // Function to handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Create FormData for Cloudinary upload
      const uploadData = new FormData();
      
      // If a new image was selected, add it to the form data
      if (selectedImage) {
        uploadData.append('profileImage', selectedImage);
        console.log('Uploading new profile image:', selectedImage.name);
      }
      
      // Add username to FormData
      uploadData.append('username', formData.username);
      
      console.log('Submitting profile update with new image:', !!selectedImage);
      
      // Let the parent component handle the saving
      await onSave(uploadData);
      onClose();
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>Edit Profile</h2>
          <button className={styles.closeButton} onClick={onClose} disabled={isLoading}>
            <X size={20} />
          </button>
        </div>

        {isCropping ? (
          <div className={styles.cropContainer}>
            <h3>Crop Your Profile Picture</h3>
            <div className={styles.cropArea}>
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={1}
                circularCrop
              >
                <img
                  ref={imgRef}
                  src={previewUrl}
                  onLoad={onImageLoad}
                  alt="Crop preview"
                  className={styles.cropImage}
                />
              </ReactCrop>
            </div>
            <div className={styles.cropControls}>
              <button 
                type="button" 
                className={styles.cancelButton} 
                onClick={handleCancelCrop}
              >
                <X size={16} />
                Cancel
              </button>
              <button 
                type="button" 
                className={styles.confirmButton} 
                onClick={handleCompleteCrop}
              >
                <Check size={16} />
                Apply Crop
              </button>
            </div>
            <canvas ref={cropCanvasRef} style={{ display: 'none' }} />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.avatarSection}>
              <div className={styles.avatarWrapper}>
                <img 
                  src={previewUrl || user.profilepicture || '/default-avatar.png'} 
                  alt="Profile" 
                  className={styles.avatar}
                />
                <button 
                  type="button" 
                  className={styles.changeAvatarButton}
                  onClick={handleChangeAvatarClick}
                  disabled={isLoading}
                >
                  <Camera size={16} />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef}
                  style={{ display: 'none' }} 
                  accept="image/*"
                  onChange={handleFileSelect}
                  disabled={isLoading}
                />
              </div>
              <p className={styles.avatarHint}>Click to change profile picture</p>
              {selectedImage && (
                <div className={styles.previewInfo}>
                  <span>New image selected: {selectedImage.name}</span>
                  <button 
                    type="button" 
                    className={styles.cropButton}
                    onClick={() => setIsCropping(true)}
                  >
                    <CropIcon size={14} />
                    Adjust Crop
                  </button>
                </div>
              )}
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="username">
                <User size={16} />
                Username
              </label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="Enter your username"
                disabled={isLoading}
              />
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.buttonGroup}>
              <button 
                type="button" 
                className={styles.cancelButton} 
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className={styles.saveButton}
                disabled={isLoading}
              >
                <Save size={16} />
                {isLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default EditProfileModal; 