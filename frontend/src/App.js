import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Register from './Register';
import Login from './Login';
import AttendanceForm from './AttendanceForm';
import AttendanceDashboard from './AttendanceDashboard';
import './App.css';

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [currentView, setCurrentView] = useState('form');
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      setIsAuthenticated(true);
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
    navigate('/login');
  };

  if (isAuthenticated) {
    return (
      <>
        <header className="app-header">
          <div className="header-content">
            <h1>Employee Attendance Tracker</h1>
            <div className="user-info">
              <span>Welcome, {user?.employeeName} ({user?.employeeID})</span>
              <button onClick={handleLogout} className="logout-btn">
                Logout
              </button>
            </div>
          </div>
          <nav>
            <button 
              className={currentView === 'form' ? 'active' : ''}
              onClick={() => setCurrentView('form')}
            >
              Mark Attendance
            </button>
            <button 
              className={currentView === 'dashboard' ? 'active' : ''}
              onClick={() => setCurrentView('dashboard')}
            >
              View My Records
            </button>
          </nav>
        </header>
        
        <main className="main-content">
          {currentView === 'form' ? <AttendanceForm /> : <AttendanceDashboard />}
        </main>
      </>
    );
  }

  return (
    <Routes>
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/dashboard" element={<Navigate to="/login" />} />
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <div className="App">
        <AppContent />
        <footer className="app-footer">
          <div className="footer-content">
            <p>&copy; 2025 Employee Attendance Tracker. </p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;