import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from './config';

const AttendanceDashboard = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'present', 'absent'
  const [sortBy, setSortBy] = useState('date'); // 'date', 'status'

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
    fetchRecords();
  }, []);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('No authentication token found. Please log in again.');
        setLoading(false);
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/api/attendance`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      setRecords(response.data.data);
      setError('');
    } catch (error) {
      console.error('Error fetching records:', error);
      const errorMsg = error.response?.data?.error || 'Failed to fetch records. Please try again.';
      setError(errorMsg);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this attendance record?')) {
      try {
        const token = localStorage.getItem('token');
       await axios.delete(`${API_BASE_URL}/api/attendance/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        fetchRecords();
      } catch (error) {
        console.error('Error deleting record:', error);
        setError('Failed to delete record');
      }
    }
  };

  // Filter and sort records
  const filteredAndSortedRecords = records
    .filter(record => {
      if (filter === 'all') return true;
      return record.status.toLowerCase() === filter;
    })
    .sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.date) - new Date(a.date);
      } else {
        return a.status.localeCompare(b.status);
      }
    });

  const presentCount = records.filter(r => r.status === 'Present').length;
  const absentCount = records.filter(r => r.status === 'Absent').length;

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="dashboard-header">
          <h2>Attendance Dashboard</h2>
          <div className="loading-spinner">Loading your records...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {/* Header Section */}
      <div className="dashboard-header">
        <div className="header-content">
          <h2>Attendance Dashboard</h2>
          <p>Manage and view your attendance records</p>
        </div>
        <button onClick={fetchRecords} className="refresh-btn">
           Refresh
        </button>
      </div>

      {error && (
        <div className="error-card">
          <div className="error-content">
            <span className="error-icon"></span>
            <div>
              <h4>Unable to Load Records</h4>
              <p>{error}</p>
            </div>
          </div>
          <button onClick={fetchRecords} className="retry-btn">
            Try Again
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card total">
          <div className="stat-icon"></div>
          <div className="stat-info">
            <h3>{records.length}</h3>
            <p>Total Records</p>
          </div>
        </div>
        
        <div className="stat-card present">
          <div className="stat-icon"></div>
          <div className="stat-info">
            <h3>{presentCount}</h3>
            <p>Present Days</p>
          </div>
        </div>
        
        <div className="stat-card absent">
          <div className="stat-icon"></div>
          <div className="stat-info">
            <h3>{absentCount}</h3>
            <p>Absent Days</p>
          </div>
        </div>
        
        <div className="stat-card rate">
          <div className="stat-icon"></div>
          <div className="stat-info">
            <h3>{records.length > 0 ? Math.round((presentCount / records.length) * 100) : 0}%</h3>
            <p>Attendance Rate</p>
          </div>
        </div>
      </div>

      {/* Employee Info Card */}
      {user && (
        <div className="employee-card">
          <div className="employee-header">
            <div className="employee-avatar">
              {user.employeeName.split(' ').map(n => n[0]).join('')}
            </div>
            <div className="employee-info">
              <h3>{user.employeeName}</h3>
              <p>Employee ID: {user.employeeID}</p>
            </div>
          </div>
          <div className="employee-details">
            <div className="detail-item">
              <span className="label">Department:</span>
              <span className="value">{user.department || 'Not specified'}</span>
            </div>
            <div className="detail-item">
              <span className="label">Position:</span>
              <span className="value">{user.position || 'Not specified'}</span>
            </div>
            <div className="detail-item">
              <span className="label">Email:</span>
              <span className="value">{user.email}</span>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Controls */}
      <div className="table-controls">
        <div className="filters">
          <label>Filter by:</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All Records</option>
            <option value="present">Present Only</option>
            <option value="absent">Absent Only</option>
          </select>
          
          <label>Sort by:</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="date">Date (Newest First)</option>
            <option value="status">Status</option>
          </select>
        </div>
        
        <div className="records-count">
          Showing {filteredAndSortedRecords.length} of {records.length} records
        </div>
      </div>

      {/* Smart Table */}
      {filteredAndSortedRecords.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon"></div>
          <h3>No Attendance Records</h3>
          <p>You haven't marked any attendance yet. Start by using the "Mark Attendance" tab.</p>
        </div>
      ) : (
        <div className="smart-table-container">
          <table className="smart-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Day</th>
                <th>Status</th>
                <th>Recorded At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedRecords.map(record => {
                const recordDate = new Date(record.date);
                const dayName = recordDate.toLocaleDateString('en-US', { weekday: 'long' });
                
                return (
                  <tr key={record.id} className="table-row">
                    <td className="date-cell">
                      <div className="date-display">
                        <span className="date-main">{recordDate.toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="day-cell">
                      <span className="day-name">{dayName}</span>
                    </td>
                    <td className="status-cell">
                      <span className={`status-badge ${record.status.toLowerCase()}`}>
                        {record.status === 'Present' ? ' Present' : ' Absent'}
                      </span>
                    </td>
                    <td className="timestamp-cell">
                      {new Date(record.createdAt).toLocaleString()}
                    </td>
                    <td className="actions-cell">
                      <button 
                        className="delete-action"
                        onClick={() => handleDelete(record.id)}
                        title="Delete record"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AttendanceDashboard;