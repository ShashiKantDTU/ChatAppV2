import React, { useState } from "react";
import { User, Mail, Lock, CheckCircle, Eye, EyeOff } from "lucide-react";
import "./signup.css";
import { useNavigate } from "react-router-dom";
import GoogleAuth from '../components/GoogleAuth';

const DarkSignupForm = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
          // Store user data in localStorage
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
    <div className="modern-login-container">
      <div className="modern-login-form">
        {isSubmitted && (
          <div className="success-overlay">
            <div className="success-content">
              <CheckCircle size={64} className="success-icon" />
              <h2 className="success-message">Registration Successful!</h2>
            </div>
          </div>
        )}

        <h1 className="form-title">
          Join The Platform
          <span>Join The Platform</span>
        </h1>

        <form onSubmit={handleSubmit}>
          <div className={`input-group ${errors.username ? "error" : ""}`}>
            <label>Username</label>
            <div className="input-field">
              <User size={20} className="icon" />
              <input
                name="username"
                type="text"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="Enter your username"
                disabled={isLoading}
              />
            </div>
            {errors.username && (
              <span className="error-message">{errors.username}</span>
            )}
          </div>

          <div className={`input-group ${errors.email ? "error" : ""}`}>
            <label>Email</label>
            <div className="input-field">
              <Mail size={20} className="icon" />
              <input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter your email"
                disabled={isLoading}
              />
            </div>
            {errors.email && (
              <span className="error-message">{errors.email}</span>
            )}
          </div>

          <div className={`input-group ${errors.password ? "error" : ""}`}>
            <label>Password</label>
            <div className="input-field">
              <Lock size={20} className="icon" />
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Enter your password"
                disabled={isLoading}
              />
              <button 
                type="button" 
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.password && (
              <span className="error-message">{errors.password}</span>
            )}
          </div>

          <div className={`input-group ${errors.confirmPassword ? "error" : ""}`}>
            <label>Confirm Password</label>
            <div className="input-field">
              <Lock size={20} className="icon" />
              <input
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="Confirm your password"
                disabled={isLoading}
              />
              <button 
                type="button" 
                className="toggle-password"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {errors.confirmPassword && (
              <span className="error-message">{errors.confirmPassword}</span>
            )}
          </div>

          <div className="password-strength">
            <div
              className="strength-indicator"
              style={{
                width: `${Math.min(formData.password.length * 10, 100)}%`,
              }}
            />
          </div>

          <button 
            type="submit" 
            className="submit-button"
            disabled={isLoading}
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="divider">
          <span>OR</span>
        </div>

        {/* Replace with our new GoogleAuth component */}
        <GoogleAuth 
          isDisabled={isLoading}
          loginCallback={handleGoogleLoginSuccess}
        />

        <div className="footer-text">
          Already have an account? <a href="/login">Sign in</a>
        </div>
      </div>
    </div>
  );
};

export default DarkSignupForm;
