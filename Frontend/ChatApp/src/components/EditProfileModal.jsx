import React, { useState, useRef } from 'react';
import styles from './EditProfileModal.module.css';
import { X, User, Camera, Save, Loader } from 'react-feather';

const EditProfileModal = ({ user, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    username: user.username || '',
    profilepicture: user.profilepicture || '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleProfileImageClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check if file is an image
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file (PNG, JPG, WEBP, GIF)');
      return;
    }

    // Check file size - max 5MB
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size should be less than 5MB');
      return;
    }

    setUploadingImage(true);
    setError('');

    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
      
      // Create FormData object
      const formData = new FormData();
      formData.append('profileImage', file);
      
      // Include userId as a query parameter
      const uploadUrl = `${API_URL}/upload-profile-image?userId=${user.uid || 'user'}`;
      
      // Upload image to server
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${errorText}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to upload image');
      }

      // Update form data with new profile image URL
      setFormData(prev => ({
        ...prev,
        profilepicture: data.profileImageUrl
      }));
      
    } catch (err) {
      console.error('Error uploading profile image:', err);
      setError(err.message || 'Failed to upload profile image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await onSave(formData);
      onClose();
    } catch (err) {
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
          <button className={styles.closeButton} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.avatarSection}>
            <div 
              className={`${styles.avatarWrapper} ${uploadingImage ? styles.uploading : ''}`}
              onClick={handleProfileImageClick}
            >
              <img 
                src={formData.profilepicture || user.profilepicture} 
                alt="Profile" 
                className={styles.avatar}
              />
              {uploadingImage ? (
                <div className={styles.uploadingOverlay}>
                  <Loader size={24} className={styles.spinner} />
                </div>
              ) : (
                <button 
                  type="button" 
                  className={styles.changeAvatarButton}
                  onClick={handleProfileImageClick}
                >
                  <Camera size={16} />
                </button>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/jpeg,image/png,image/gif,image/webp"
                style={{ display: 'none' }}
              />
            </div>
            <p className={styles.avatarHint}>Click to change profile picture</p>
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
              disabled={isLoading || uploadingImage}
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.buttonGroup}>
            <button 
              type="button" 
              className={styles.cancelButton} 
              onClick={onClose}
              disabled={isLoading || uploadingImage}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className={styles.saveButton}
              disabled={isLoading || uploadingImage}
            >
              <Save size={16} />
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProfileModal; 