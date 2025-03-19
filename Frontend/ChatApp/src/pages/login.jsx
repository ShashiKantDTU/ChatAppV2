import React, { useState, useEffect } from "react";
import { User, Lock, Eye, EyeOff, MessageSquare, LogIn } from "lucide-react"; 
import "./login.css";
import { useNavigate, useLocation, Link } from "react-router-dom";
import GoogleAuth from '../components/GoogleAuth';
import Authloading from '../components/Loading/Authloading';

const DarkLoginForm = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [formData, setFormData] = useState({
        email: "",
        password: ""
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
        const { name, value } = e.target;
        setFormData(prevState => ({
            ...prevState,
            [name]: value
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
        <div className="auth-page-container">
            <div className="auth-page-left">
                <div className="auth-brand">
                    <MessageSquare size={36} className="brand-icon" />
                    <h1>ChatApp</h1>
                </div>
                <div className="auth-content">
                    <h2>Connect with friends and family</h2>
                    <p>Stay connected with your loved ones through instant messaging, voice calls, and video chats.</p>
                    <div className="auth-features">
                        <div className="feature-item">
                            <div className="feature-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                                </svg>
                            </div>
                            <div className="feature-text">
                                <h3>Instant Messaging</h3>
                                <p>Send and receive messages in real-time</p>
                            </div>
                        </div>
                        <div className="feature-item">
                            <div className="feature-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <path d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"></path>
                                </svg>
                            </div>
                            <div className="feature-text">
                                <h3>Secure Chats</h3>
                                <p>End-to-end encryption for your privacy</p>
                            </div>
                        </div>
                        <div className="feature-item">
                            <div className="feature-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                    <polyline points="21 15 16 10 5 21"></polyline>
                                </svg>
                            </div>
                            <div className="feature-text">
                                <h3>Media Sharing</h3>
                                <p>Share photos and videos instantly</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="auth-page-right">
                <div className="auth-form-wrapper">
                    <div className="auth-form-header">
                        <h2>Welcome back</h2>
                        <p>Sign in to continue to ChatApp</p>
                    </div>

                    {authMessage && (
                        <div className="auth-message success">
                            {authMessage}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className={`form-group ${errors.email ? "error" : ""}`}>
                            <label htmlFor="email">Email</label>
                            <div className="input-container">
                                <User size={18} className="input-icon" />
                                <input
                                    id="email"
                                    type="email"
                                    name="email"
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
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    placeholder="Enter password"
                                    disabled={isLoading}
                                />
                                <button 
                                    type="button" 
                                    className="toggle-visibility"
                                    onClick={togglePasswordVisibility}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            {errors.password && <span className="error-text">{errors.password}</span>}
                        </div>

                        <div className="form-options">
                            <Link to="/forgot-password" className="forgot-link">Forgot password?</Link>
                        </div>

                        <button 
                            type="submit" 
                            className="primary-button"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Signing in...' : (
                                <>
                                    <LogIn size={18} />
                                    <span>Sign in</span>
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

                    <div className="auth-footer">
                        Don't have an account? <a href="/signup">Create account</a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DarkLoginForm;
