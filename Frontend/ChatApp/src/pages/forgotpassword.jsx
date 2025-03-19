import React, { useState } from "react";
import { Mail, MessageSquare, ArrowLeft, CheckCircle } from "lucide-react";
import "./login.css"; // Reusing login styles
import { Link } from "react-router-dom";

const ForgotPasswordPage = () => {
    const [email, setEmail] = useState("");
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [resetRequested, setResetRequested] = useState(false);
    const [authMessage, setAuthMessage] = useState(null);

    const validateForm = () => {
        const newErrors = {};
        if (!email.trim()) newErrors.email = "Email is required!";
        else if (!/^\S+@\S+\.\S+$/.test(email)) newErrors.email = "Invalid email format!";
        
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (validateForm()) {
            setIsLoading(true);
            setErrors({});

            try {
                const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
                const response = await fetch(`${API_URL}/forgot-password`, {
                    method: "POST",
                    credentials: 'include',
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ email }),
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'Request failed');
                }

                // Show success message on successful request
                setResetRequested(true);
                setAuthMessage("Password reset link sent! Please check your email.");
            } catch (error) {
                console.error("Password reset request error:", error);
                setErrors({
                    email: error.message || 'An error occurred. Please try again.'
                });
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <div className="auth-page-container">
            {resetRequested && (
                <div className="success-modal">
                    <div className="success-content">
                        <CheckCircle size={64} className="success-icon" />
                        <h2 className="success-title">Check Your Email</h2>
                        <p className="success-message">
                            We've sent a password reset link to <strong>{email}</strong>. 
                            Please check your email and follow the instructions to reset your password.
                        </p>
                    </div>
                </div>
            )}
            
            <div className="auth-page-left">
                <div className="auth-brand">
                    <MessageSquare size={36} className="brand-icon" />
                    <h1>ChatApp</h1>
                </div>
                <div className="auth-content">
                    <h2>Forgot your password?</h2>
                    <p>Don't worry, it happens to the best of us. Enter your email and we'll send you a link to reset your password.</p>
                    <div className="auth-features">
                        <div className="feature-item">
                            <div className="feature-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                </svg>
                            </div>
                            <div className="feature-text">
                                <h3>Secure Reset</h3>
                                <p>We use secure tokens to protect your account</p>
                            </div>
                        </div>
                        <div className="feature-item">
                            <div className="feature-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                </svg>
                            </div>
                            <div className="feature-text">
                                <h3>Account Protection</h3>
                                <p>Your data is always protected</p>
                            </div>
                        </div>
                        <div className="feature-item">
                            <div className="feature-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <line x1="12" y1="8" x2="12" y2="12"></line>
                                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                </svg>
                            </div>
                            <div className="feature-text">
                                <h3>Need Help?</h3>
                                <p>Our support team is here to assist you</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="auth-page-right">
                <div className="auth-form-wrapper">
                    <div className="auth-form-header">
                        <h2>Reset Password</h2>
                        <p>Enter your email address to receive reset instructions</p>
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
                                <Mail size={18} className="input-icon" />
                                <input
                                    id="email"
                                    type="email"
                                    name="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter your email"
                                    disabled={isLoading}
                                />
                            </div>
                            {errors.email && <span className="error-text">{errors.email}</span>}
                        </div>

                        <button 
                            type="submit" 
                            className="primary-button"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Sending...' : 'Send Reset Link'}
                        </button>

                        <div className="auth-footer" style={{ marginTop: "20px", textAlign: "center" }}>
                            <Link to="/login" className="back-to-login">
                                <ArrowLeft size={16} style={{ marginRight: "6px" }} />
                                Back to Login
                            </Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ForgotPasswordPage; 