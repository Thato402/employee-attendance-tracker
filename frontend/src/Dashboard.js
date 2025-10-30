import React from 'react';
import { Link } from 'react-router-dom';

const Dashboard = ({ user, onLogout }) => {
  return (
    <div className="dashboard-container">
      <h2>Dashboard Overview</h2>
      <p>Welcome back, <strong>{user?.employeeName}</strong>!</p>
      <p>Employee ID: {user?.employeeID}</p>
      <p>Department: {user?.department}</p>
      <p>Position: {user?.position}</p>

      <div className="dashboard-actions">
        <Link to="/mark" className="action-btn">Mark Attendance</Link>
        <Link to="/records" className="action-btn">View My Records</Link>
      </div>
    </div>
  );
};

export default Dashboard;
