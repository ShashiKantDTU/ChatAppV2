import React, { useState } from "react";
import { User, Lock, LogIn, Eye, EyeOff } from "lucide-react"; // Added Eye icons <sup data-citation="3" className="inline select-none [&>a]:rounded-2xl [&>a]:border [&>a]:px-1.5 [&>a]:py-0.5 [&>a]:transition-colors shadow [&>a]:bg-ds-bg-subtle [&>a]:text-xs [&>svg]:w-4 [&>svg]:h-4 relative -top-[2px] citation-shimmer"><a href="https://bootstrapfriendly.com/blog/login-form-with-password-show-and-hide-button-using-javascript">3</a></sup>
import "./login.css";
import { useNavigate } from "react-router-dom";

const DarkLoginForm = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        email: "",
        password: "",
        rememberMe: false
    });

    const [showPassword, setShowPassword] = useState(false);
    const [errors, setErrors] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    const validateForm = () => {
        const newErrors = {};
        if (!formData.email.trim()) newErrors.email = "Email is required!";
        if (formData.password.length < 8)
            newErrors.password = "Password must be at least 8 characters long!";
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
                    // Store user data in localStorage if remember me is checked
                    if (formData.rememberMe) {
                        localStorage.setItem('userEmail', formData.email);
                    }
                    navigate('/'); // Redirect to home page
                } else {
                    setErrors({
                        [data.message.includes('email') ? 'email' : 'password']: data.message
                    });
                }
            } catch (error) {
                console.error("Login error:", error);
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

    const handleGoogleLogin = () => {
        const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
        // First logout, then redirect to Google auth
        window.location.href = `${API_URL}/auth/google/logout`;
    };

    const togglePasswordVisibility = () => {
        setShowPassword(!showPassword);
    };

    return (
        <div className="modern-login-container">
            <div className="modern-login-form">
                <h1 className="form-title">
                    Welcome Back
                    <span>Welcome Back</span>
                </h1>
                <p className="form-subtitle">Please enter your details</p>

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

                <button 
                    className="google-login-button" 
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                >
                    <LogIn size={20} className="google-icon" />
                    Continue with Google
                </button>

                <div className="footer-text">
                    Don't have an account? <a href="/signup">Sign up</a>
                </div>
            </div>
        </div>
    );
};

export default DarkLoginForm;
