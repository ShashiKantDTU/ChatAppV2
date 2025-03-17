import React, { useState, useEffect } from "react";
import { User, Lock, Eye, EyeOff } from "lucide-react"; 
import "./login.css";
import { useNavigate, useLocation } from "react-router-dom";
import GoogleAuth from '../components/GoogleAuth';
import Authloading from '../components/Loading/Authloading';

const DarkLoginForm = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [formData, setFormData] = useState({
        email: "",
        password: "",
        rememberMe: false
    });

    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [authMessage, setAuthMessage] = useState(null);
    const [showAuthLoading, setShowAuthLoading] = useState(false);

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
                        setAuthMessage('Successfully logged in with Google!');
                    }
                    
                    // Clear the hash from URL without page reload
                    window.history.replaceState(
                        null, 
                        document.title, 
                        location.pathname + location.search
                    );
                    
                    // Redirect to home after short delay
                    setTimeout(() => {
                        navigate('/');
                    }, 1500);
                }
            } catch (err) {
                console.error('Error processing auth token from URL:', err);
            }
        }
    }, [location, navigate]);

    const validateForm = () => {
        const newErrors = {};
        if (!formData.email.trim()) newErrors.email = "Email is required!";
        if (formData.password.length < 8)
            newErrors.password = "Password must be at least 8 characters long!";
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // This function will be called if Google login succeeds
    const handleGoogleLoginSuccess = (userData) => {
        console.log('Google login successful:', userData);
        navigate('/');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (validateForm()) {
            setIsLoading(true);
            setErrors({});
            // Show the AuthLoading component
            setShowAuthLoading(true);

            try {
                const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
                const response = await fetch(`${API_URL}/login`, {
                    method: "POST",
                    credentials: 'include',
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        email: formData.email,
                        password: formData.password,
                    }),
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'Login failed');
                }

                if (data.message === 'User Loggedin successfully') {
                    // Store the JWT token in localStorage for authentication
                    if (data.token) {
                        console.log('Storing auth token in localStorage');
                        localStorage.setItem('auth_token', data.token);
                    }
                    
                    // Store user email in localStorage if remember me is checked
                    if (formData.rememberMe) {
                        localStorage.setItem('userEmail', formData.email);
                    }
                    
                    navigate('/'); // Redirect to home page
                } else {
                    // Hide the AuthLoading component on error
                    setShowAuthLoading(false);
                    setErrors({
                        [data.message.includes('email') ? 'email' : 'password']: data.message
                    });
                }
            } catch (error) {
                console.error("Login error:", error);
                // Hide the AuthLoading component on error
                setShowAuthLoading(false);
                setErrors({
                    email: error.message || 'An error occurred during login'
                });
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prevState => ({
            ...prevState,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    // If authentication is in progress, show the AuthLoading component
    if (showAuthLoading) {
        return <Authloading />;
    }

    return (
        <div className="modern-login-container">
            <div className="modern-login-form">
                <h1 className="form-title">
                    Welcome Back
                    <span>Welcome Back</span>
                </h1>
                <p className="form-subtitle">Please enter your details</p>

                {authMessage && (
                    <div className="auth-message success">
                        {authMessage}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className={`input-group ${errors.email ? "error" : ""}`}>
                        <label>Email</label>
                        <div className="input-field">
                            <User size={20} className="icon" />
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                placeholder="Enter your email"
                                disabled={isLoading}
                            />
                        </div>
                        {errors.email && <span className="error-message">{errors.email}</span>}
                    </div>

                    <div className={`input-group ${errors.password ? "error" : ""}`}>
                        <label>Password</label>
                        <div className="input-field">
                            <Lock size={20} className="icon" />
                            <input
                                type={showPassword ? "text" : "password"}
                                name="password"
                                value={formData.password}
                                onChange={handleInputChange}
                                placeholder="Enter password"
                                disabled={isLoading}
                            />
                            <button 
                                type="button" 
                                className="toggle-password"
                                onClick={togglePasswordVisibility}
                            >
                                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                        </div>
                        {errors.password && <span className="error-message">{errors.password}</span>}
                    </div>

                    <div className="remember-forgot">
                        <label className="remember-me">
                            <input
                                type="checkbox"
                                name="rememberMe"
                                checked={formData.rememberMe}
                                onChange={handleInputChange}
                                disabled={isLoading}
                            />
                            Remember me
                        </label>
                        <a href="/forgot-password" className="forgot-password">Forgot password?</a>
                    </div>

                    <button 
                        type="submit" 
                        className="submit-button"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Signing in...' : 'Sign in'}
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
                    Don't have an account? <a href="/signup">Sign up</a>
                </div>
            </div>
        </div>
    );
};

export default DarkLoginForm;
