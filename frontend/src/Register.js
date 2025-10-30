import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { API_BASE_URL } from './config';

const Register = () => {
  const [formData, setFormData] = useState({
    employeeName: '',
    employeeID: '',
    email: '',
    password: '',
    confirmPassword: '',
    department: '',
    position: ''
  });
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    // Name validation
    if (!formData.employeeName.trim()) {
      newErrors.employeeName = 'Employee name is required';
    } else if (formData.employeeName.trim().length < 2) {
      newErrors.employeeName = 'Name must be at least 2 characters';
    }

    // Employee ID validation
    if (!formData.employeeID.trim()) {
      newErrors.employeeID = 'Employee ID is required';
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    // Confirm password
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    if (!validateForm()) {
      setMessage('Please fix the errors below');
      setIsError(true);
      setIsLoading(false);
      return;
    }

    try {
      const { confirmPassword, ...submitData } = formData;
      
    const response = await axios.post(`${API_BASE_URL}/api/auth/register`, submitData);
      setMessage('Registration successful! Redirecting to login...');
      setIsError(false);
      
      // DO NOT store token or user data - redirect to login instead
      // Wait 2 seconds then redirect to login page
      setTimeout(() => {
        navigate('/login');
      }, 2000);
      
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Registration failed. Please try again.';
      setMessage(errorMsg);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-form">
        <h2>Join Our Organization</h2>
        <p className="auth-subtitle">Create your account to start tracking attendance</p>
        
        {message && (
          <div className={`message ${isError ? 'error' : 'success'}`}>
            {message}
            {!isError && <div className="redirect-message">Taking you to login page...</div>}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="employeeName">Full Name *</label>
              <input
                type="text"
                id="employeeName"
                name="employeeName"
                value={formData.employeeName}
                onChange={handleChange}
                className={errors.employeeName ? 'error-input' : ''}
                placeholder="Enter your full name"
                disabled={isLoading}
              />
              {errors.employeeName && <span className="error-text">{errors.employeeName}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="employeeID">Employee ID *</label>
              <input
                type="text"
                id="employeeID"
                name="employeeID"
                value={formData.employeeID}
                onChange={handleChange}
                className={errors.employeeID ? 'error-input' : ''}
                placeholder="Your employee ID"
                disabled={isLoading}
              />
              {errors.employeeID && <span className="error-text">{errors.employeeID}</span>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={errors.email ? 'error-input' : ''}
              placeholder="your.email@company.com"
              disabled={isLoading}
            />
            {errors.email && <span className="error-text">{errors.email}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="department">Department</label>
              <input
                type="text"
                id="department"
                name="department"
                value={formData.department}
                onChange={handleChange}
                placeholder="e.g., IT, HR, Finance"
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="position">Position</label>
              <input
                type="text"
                id="position"
                name="position"
                value={formData.position}
                onChange={handleChange}
                placeholder="e.g., Developer, Manager"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="password">Password *</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={errors.password ? 'error-input' : ''}
                placeholder="At least 6 characters"
                disabled={isLoading}
              />
              {errors.password && <span className="error-text">{errors.password}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password *</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className={errors.confirmPassword ? 'error-input' : ''}
                placeholder="Re-enter your password"
                disabled={isLoading}
              />
              {errors.confirmPassword && <span className="error-text">{errors.confirmPassword}</span>}
            </div>
          </div>

          <button 
            type="submit" 
            className="auth-btn"
            disabled={isLoading}
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>

          <p className="auth-link">
            Already have an account? <Link to="/login">Sign In</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Register;