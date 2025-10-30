import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from './config';

const AttendanceForm = () => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    status: 'Present'
  });
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

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

    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setMessage('No authentication token found. Please log in again.');
        setIsError(true);
        return;
      }

      console.log('Submitting attendance...');
      const response = await axios.post(`${API_BASE_URL}/api/attendance`, formData, { headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('Attendance submitted:', response.data);
      setMessage(response.data.message);
      setIsError(false);
      
      // Reset form but keep current date
      setFormData(prev => ({
        date: new Date().toISOString().split('T')[0],
        status: 'Present'
      }));
    } catch (error) {
      console.error('Error submitting attendance:', error);
      const errorMsg = error.response?.data?.error || 'Failed to submit attendance. Please try again.';
      setMessage(errorMsg);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="form-container">
      <h2>Mark Your Attendance</h2>
      
      {user && (
        <div className="welcome-message">
          Hello <strong>{user.employeeName}</strong>! Ready to mark your attendance for today?
        </div>
      )}
      
      {message && (
        <div className={`message ${isError ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="date">Date:</label>
          <input
            type="date"
            id="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            max={new Date().toISOString().split('T')[0]}
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="status">Status:</label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleChange}
            disabled={isLoading}
          >
            <option value="Present">Present</option>
            <option value="Absent">Absent</option>
          </select>
        </div>

        <button type="submit" className="submit-btn" disabled={isLoading}>
          {isLoading ? 'Submitting...' : 'Submit Attendance'}
        </button>
      </form>
    </div>
  );
};

export default AttendanceForm;