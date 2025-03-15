import React, { useState } from "react";
import { User, Mail, Lock, CheckCircle } from "lucide-react";
import "./signup.css";

const DarkSignupForm = () => {
  // State to hold form data
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });

  // State to hold validation errors
  const [errors, setErrors] = useState({});

  // State to show success message on submission
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Handle form validation
  const validateForm = () => {
    const newErrors = {};

    if (!formData.username.trim()) newErrors.username = "Username is required!";
    if (!/^\S+@\S+\.\S+$/.test(formData.email)) newErrors.email = "Invalid email!";
    if (formData.password.length < 8)
      newErrors.password = "Password must be at least 8 characters long!";

    setErrors(newErrors); // Update errors state
    return Object.keys(newErrors).length === 0; // Return true if no errors
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();

    if (validateForm()) {
      setIsSubmitted(true); // Show success message
        
        const formdata = {
          username: formData.username,
          email: formData.email,
          password: formData.password,
        };
     
        fetch("http://localhost:3000/signup", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(formdata),
        })
            .then((response) => response.json())
            .then((data) => {
                console.log("Success:", data);
            })
            .catch((error) => {
                console.error("Error:", error);
            });

      // Clear form data after 2 seconds
      setTimeout(() => {
        setIsSubmitted(false);
        setFormData({ username: "", email: "", password: "" });
      }, 2000);
    }
  };

  // Handle change in input fields
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  return (
    <div className="signup-container">
      {/* Form */}
      <div className="signup-form">
        {/* Success Message */}
        {isSubmitted && (
          <div className="success-overlay">
            <div className="success-content">
              <CheckCircle size={64} className="success-icon" />
              <h2 className="success-message">Registration Successful!</h2>
            </div>
          </div>
        )}

        {/* Header */}
        <h1 className="form-title">Join The Platform</h1>

        {/* Form Fields */}
        <form onSubmit={handleSubmit}>
          {/* Username Field */}
          <div className={`input-container ${errors.username ? "error" : ""}`}>
            <div className="input-field">
              <User size={20} className="icon" />
              <input
                name="username"
                type="text"
                value={formData.username}
                onChange={handleInputChange}
                placeholder="Enter your username"
              />
            </div>
            {errors.username && <span className="error-message">{errors.username}</span>}
          </div>

          {/* Email Field */}
          <div className={`input-container ${errors.email ? "error" : ""}`}>
            <div className="input-field">
              <Mail size={20} className="icon" />
              <input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="Enter your email"
              />
            </div>
            {errors.email && <span className="error-message">{errors.email}</span>}
          </div>

          {/* Password Field */}
          <div className={`input-container ${errors.password ? "error" : ""}`}>
            <div className="input-field">
              <Lock size={20} className="icon" />
              <input
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Enter your password"
              />
            </div>
            {errors.password && <span className="error-message">{errors.password}</span>}
          </div>

          {/* Password Strength Indicator */}
          <div className="password-strength">
            <div
              className="strength-indicator"
              style={{
                width: `${Math.min(formData.password.length * 10, 100)}%`,
              }}
            />
          </div>

          {/* Submit Button */}
          <button className="submit-button" type="submit">
            Create Account
          </button>
        </form>

        {/* Agreement */}
        <div>
        <p className="terms-text">Already have a account ? <a href="">Login</a></p>
        </div>
      </div>
    </div>
  );
};

export default DarkSignupForm;
