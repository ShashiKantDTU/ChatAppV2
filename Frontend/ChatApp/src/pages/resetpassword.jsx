import React, { useState, useEffect } from "react";
import { Lock, Eye, EyeOff, MessageSquare, ArrowLeft, CheckCircle } from "lucide-react";
import "./login.css"; // Reusing login styles
import { Link, useNavigate, useLocation } from "react-router-dom";

const ResetPasswordPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [formData, setFormData] = useState({
        password: "",
        confirmPassword: "",
    });
    const [token, setToken] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [resetSuccess, setResetSuccess] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState(0);

    // Extract token from URL parameters
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tokenParam = params.get("token");
        if (tokenParam) {
            setToken(tokenParam);
        } else {
            setErrors({ general: "Invalid or missing reset token. Please request a new password reset link." });
        }
    }, [location]);

    const validateForm = () => {
        const newErrors = {};
        if (formData.password.length < 8) {
            newErrors.password = "Password must be at least 8 characters long";
        }
        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = "Passwords do not match";
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const calculatePasswordStrength = (password) => {
        let strength = 0;
        // Length check
        if (password.length >= 8) strength += 20;
        if (password.length >= 12) strength += 10;
        
        // Complexity checks
        if (/[A-Z]/.test(password)) strength += 20; // Has uppercase
        if (/[a-z]/.test(password)) strength += 10; // Has lowercase
        if (/[0-9]/.test(password)) strength += 20; // Has number
        if (/[^A-Za-z0-9]/.test(password)) strength += 20; // Has special char
        
        return Math.min(strength, 100);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevState => ({
            ...prevState,
            [name]: value
        }));

        if (name === 'password') {
            setPasswordStrength(calculatePasswordStrength(value));
        }
    };

    const getStrengthColor = () => {
        if (passwordStrength >= 80) return 'var(--success-color)';
        if (passwordStrength >= 50) return 'var(--warning-color)';
        return 'var(--error-color)';
    };

    const getStrengthText = () => {
        if (passwordStrength >= 80) return 'Strong';
        if (passwordStrength >= 50) return 'Moderate';
        return 'Weak';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (validateForm()) {
            setIsLoading(true);
            try {
                const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
                const response = await fetch(`${API_URL}/reset-password`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        token,
                        password: formData.password
                    }),
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.message || 'Password reset failed');
                }

                // Show success message and redirect after a delay
                setResetSuccess(true);
                setTimeout(() => {
                    navigate('/login');
                }, 3000);
            } catch (error) {
                console.error("Password reset error:", error);
                setErrors({
                    general: error.message || 'An error occurred. Please try again.'
                });
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <div className="auth-page-container">
            {resetSuccess && (
                <div className="success-modal">
                    <div className="success-content">
                        <CheckCircle size={64} className="success-icon" />
                        <h2 className="success-title">Password Reset Successful!</h2>
                        <p className="success-message">
                            Your password has been reset successfully. You will be redirected to the login page shortly.
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
                    <h2>Create a new password</h2>
                    <p>Set a strong password to secure your account. Your new password must be different from previously used passwords.</p>
                    <div className="auth-features">
                        <div className="feature-item">
                            <div className="feature-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                </svg>
                            </div>
                            <div className="feature-text">
                                <h3>Security Tips</h3>
                                <p>Use a unique password you don't use elsewhere</p>
                            </div>
                        </div>
                        <div className="feature-item">
                            <div className="feature-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                </svg>
                            </div>
                            <div className="feature-text">
                                <h3>Strong Passwords</h3>
                                <p>Mix letters, numbers, and special characters</p>
                            </div>
                        </div>
                        <div className="feature-item">
                            <div className="feature-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                            </div>
                            <div className="feature-text">
                                <h3>Password Expiry</h3>
                                <p>Reset links expire after 24 hours</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div className="auth-page-right">
                <div className="auth-form-wrapper">
                    <div className="auth-form-header">
                        <h2>Reset Your Password</h2>
                        <p>Create a new password for your account</p>
                    </div>

                    {errors.general && (
                        <div className="auth-message error">
                            {errors.general}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="auth-form">
                        <div className={`form-group ${errors.password ? "error" : ""}`}>
                            <label htmlFor="password">New Password</label>
                            <div className="input-container">
                                <Lock size={18} className="input-icon" />
                                <input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    placeholder="Enter new password"
                                    disabled={isLoading || !token}
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

                        <div className="password-strength-meter">
                            <div className="strength-label">
                                <span>Password Strength:</span>
                                <span style={{ color: getStrengthColor() }}>{getStrengthText()}</span>
                            </div>
                            <div className="strength-bar">
                                <div 
                                    className="strength-indicator" 
                                    style={{ 
                                        width: `${passwordStrength}%`,
                                        backgroundColor: getStrengthColor()
                                    }}
                                />
                            </div>
                        </div>

                        <div className={`form-group ${errors.confirmPassword ? "error" : ""}`}>
                            <label htmlFor="confirmPassword">Confirm Password</label>
                            <div className="input-container">
                                <Lock size={18} className="input-icon" />
                                <input
                                    id="confirmPassword"
                                    type={showConfirmPassword ? "text" : "password"}
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleInputChange}
                                    placeholder="Confirm new password"
                                    disabled={isLoading || !token}
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

                        <button 
                            type="submit" 
                            className="primary-button"
                            disabled={isLoading || !token}
                        >
                            {isLoading ? 'Resetting Password...' : 'Reset Password'}
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

export default ResetPasswordPage; 