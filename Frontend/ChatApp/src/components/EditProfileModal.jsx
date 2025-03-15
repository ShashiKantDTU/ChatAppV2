import React, { useState } from 'react';
import styles from './EditProfileModal.module.css';
import { X, User, Camera, Save } from 'react-feather';

const EditProfileModal = ({ user, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    username: user.username || '',
    profilepicture: user.profilepicture || '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
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
            <div className={styles.avatarWrapper}>
              <img 
                src={formData.profilepicture || user.profilepicture} 
                alt="Profile" 
                className={styles.avatar}
              />
              <button type="button" className={styles.changeAvatarButton}>
                <Camera size={16} />
              </button>
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
      </div>
    </div>
  );
};

export default EditProfileModal; 