import React, { useState, useEffect } from "react";
import { User, Mail, Lock, CheckCircle, Eye, EyeOff, MessageSquare, UserPlus } from "lucide-react";
import "./signup.css";
import { useNavigate, useLocation } from "react-router-dom";
import GoogleAuth from '../components/GoogleAuth';

const DarkSignupForm = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState(null);

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  // State to hold validation errors
  const [errors, setErrors] = useState({});

  // State to show success message on submission
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Check URL for token from Google OAuth redirect
  useEffect(() => {
    // Look for token in URL hash fragment
    if (location.hash && location.hash.includes('token=')) {
      try {
        const tokenMatch = location.hash.match(/token=([^&]+)/);
        if (tokenMatch && tokenMatch[1]) {
          const token = decodeURIComponent(tokenMatch[1]);
          console.log('Found token in URL hash fragment');
          
          // Store token in localStorage
          localStorage.setItem('auth_token', token);
          
          // Check query params for Google auth source
          const isGoogleAuth = location.search.includes('auth_source=google');
          if (isGoogleAuth) {
            setAuthMessage('Successfully signed up with Google!');
          }
          
          // Clear the hash from URL without page reload
          window.history.replaceState(
            null, 
            document.title, 
            location.pathname + location.search
          );
          
          // Show success message and redirect
          setIsSubmitted(true);
          setTimeout(() => {
            navigate('/');
          }, 1500);
        }
      } catch (err) {
        console.error('Error processing auth token from URL:', err);
      }
    }
  }, [location, navigate]);

  // This function will be called if Google login succeeds
  const handleGoogleLoginSuccess = (userData) => {
    console.log('Google login successful:', userData);
    navigate('/');
  };

  // Handle form validation
  const validateForm = () => {
    const newErrors = {};

    if (!formData.username.trim()) newErrors.username = "Username is required!";
    if (!/^\S+@\S+\.\S+$/.test(formData.email))
      newErrors.email = "Invalid email!";
    if (formData.password.length < 8)
      newErrors.password = "Password must be at least 8 characters long!";
    if (formData.password !== formData.confirmPassword)
      newErrors.confirmPassword = "Passwords do not match!";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (validateForm()) {
      setIsLoading(true);
      setErrors({});

      try {
        const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
        const response = await fetch(`${API_URL}/signup`, {
          method: "POST",
          credentials: 'include',
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: formData.username,
            email: formData.email,
            password: formData.password,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Registration failed');
        }

        if (data.message === 'User registered successfully') {
          setIsSubmitted(true);
          
          // Store JWT token in localStorage if provided
          if (data.token) {
            console.log('Storing auth token in localStorage from signup');
            localStorage.setItem('auth_token', data.token);
          }
          
          // Store user email in localStorage
          localStorage.setItem('userEmail', formData.email);
          
          setTimeout(() => {
            navigate('/'); // Redirect to home page after success
          }, 2000);
        } else {
          setErrors({
            [data.message.includes('email') ? 'email' : 'username']: data.message
          });
        }
      } catch (error) {
        console.error("Registration error:", error);
        setErrors({
          email: error.message || 'An error occurred during registration'
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  return (
    <div className="auth-page-container">
      {isSubmitted && (
        <div className="success-modal">
          <div className="success-content">
            <CheckCircle size={64} className="success-icon" />
            <h2 className="success-title">
              {authMessage || "Registration Successful!"}
            </h2>
            <p className="success-message">Redirecting you to the app...</p>
          </div>
        </div>
      )}

      <div className="auth-page-left">
        <div className="auth-brand">
          <MessageSquare size={36} className="brand-icon" />
          <h1>ChatApp</h1>
        </div>
        <div className="auth-content">
          <h2>Join our community</h2>
          <p>Create an account to connect with millions of users worldwide.</p>
          <div className="auth-features">
            <div className="feature-item">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <div className="feature-text">
                <h3>Global Community</h3>
                <p>Connect with friends around the world</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
              </div>
              <div className="feature-text">
                <h3>Private & Secure</h3>
                <p>Your conversations are always protected</p>
              </div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
              </div>
              <div className="feature-text">
                <h3>Premium Features</h3>
                <p>Enjoy advanced features for free</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="auth-page-right">
        <div className="auth-form-wrapper">
          <div className="auth-form-header">
            <h2>Create an Account</h2>
            <p>Join ChatApp today</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className={`form-group ${errors.username ? "error" : ""}`}>
              <label htmlFor="username">Username</label>
              <div className="input-container">
                <User size={18} className="input-icon" />
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={formData.username}
                  onChange={handleInputChange}
                  placeholder="Enter your username"
                  disabled={isLoading}
                />
              </div>
              {errors.username && <span className="error-text">{errors.username}</span>}
            </div>

            <div className={`form-group ${errors.email ? "error" : ""}`}>
              <label htmlFor="email">Email</label>
              <div className="input-container">
                <Mail size={18} className="input-icon" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="Enter your email"
                  disabled={isLoading}
                />
              </div>
              {errors.email && <span className="error-text">{errors.email}</span>}
            </div>

            <div className={`form-group ${errors.password ? "error" : ""}`}>
              <label htmlFor="password">Password</label>
              <div className="input-container">
                <Lock size={18} className="input-icon" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Enter your password"
                  disabled={isLoading}
                />
                <button 
                  type="button" 
                  className="toggle-visibility"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <span className="error-text">{errors.password}</span>}
            </div>

            <div className={`form-group ${errors.confirmPassword ? "error" : ""}`}>
              <label htmlFor="confirmPassword">Confirm Password</label>
              <div className="input-container">
                <Lock size={18} className="input-icon" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  placeholder="Confirm your password"
                  disabled={isLoading}
                />
                <button 
                  type="button" 
                  className="toggle-visibility"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.confirmPassword && <span className="error-text">{errors.confirmPassword}</span>}
            </div>

            <div className="password-strength-meter">
              <div className="strength-label">Password Strength</div>
              <div className="strength-bar">
                <div
                  className="strength-indicator"
                  style={{
                    width: `${Math.min(formData.password.length * 10, 100)}%`,
                    backgroundColor: formData.password.length > 10 ? 'var(--success-color)' : 
                                    formData.password.length > 6 ? 'var(--warning-color)' : 
                                    'var(--error-color)'
                  }}
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="primary-button"
              disabled={isLoading}
            >
              {isLoading ? 'Creating Account...' : (
                <>
                  <UserPlus size={18} />
                  <span>Create Account</span>
                </>
              )}
            </button>
          </form>

          <div className="auth-divider">
            <span>or continue with</span>
          </div>

          <div className="social-auth">
            <GoogleAuth 
              isDisabled={isLoading}
              loginCallback={handleGoogleLoginSuccess}
            />
          </div>

          <div className="email-verification-note">
            <p>No email verification required to start using ChatApp. We only use your email if you need to reset your password in the future.</p>
          </div>

          <div className="auth-footer">
            Already have an account? <a href="/login">Sign in</a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DarkSignupForm;
