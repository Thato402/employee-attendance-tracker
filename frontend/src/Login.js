import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import { API_BASE_URL } from './config';

const Login = () => {
  const [formData, setFormData] = useState({
    employeeID: '',
    password: ''
  });
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    if (!formData.employeeID || !formData.password) {
      setMessage('Please fill in all fields');
      setIsError(true);
      setIsLoading(false);
      return;
    }

    try {
      console.log('Attempting login...');
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, formData);
      console.log('Login successful:', response.data);
      setMessage('Login successful! Redirecting to attendance form...');
      setIsError(false);
      
      // Store token and user data
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      console.log('Data stored in localStorage');
      
      // Redirect to main app (which will show attendance form)
      setTimeout(() => {
        console.log('Redirecting to main app...');
        window.location.href = '/'; // This will reload the app and show authenticated view
      }, 1000);
      
    } catch (error) {
      console.error('Login error:', error);
      const errorMsg = error.response?.data?.error || 'Login failed. Please check your credentials.';
      setMessage(errorMsg);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-form">
        <h2>Welcome Back</h2>
        <p className="auth-subtitle">Sign in to your account</p>
        
        {message && (
          <div className={`message ${isError ? 'error' : 'success'}`}>
            {message}
            {!isError && <div className="redirect-message">Taking you to attendance form...</div>}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="employeeID">Employee ID</label>
            <input
              type="text"
              id="employeeID"
              name="employeeID"
              value={formData.employeeID}
              onChange={handleChange}
              placeholder="Enter your employee ID"
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter your password"
              disabled={isLoading}
            />
          </div>

          <button 
            type="submit" 
            className="auth-btn"
            disabled={isLoading}
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </button>

          <p className="auth-link">
            Don't have an account? <Link to="/register">Create Account</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Login;