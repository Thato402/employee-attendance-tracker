// server/index.js
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs'); // bcryptjs works consistently
const jwt = require('jsonwebtoken');
require('dotenv').config();

// ==================== CONFIG ====================
const app = express();
const PORT = process.env.SERVER_PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'employee-attendance-tracker-secret-key-2024';

// Middleware
app.use(cors());
app.use(express.json());

// ==================== MYSQL CONNECTION ====================
// Use Railway-provided variables if deployed, fallback to local development
const pool = mysql.createPool({
  host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
  user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
  password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
  database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'attendance_tracker',
  port: process.env.DB_PORT || process.env.MYSQLPORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test database connection
const testConnection = () => {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error('❌ Database connection failed:', err.message);
      console.log('🔧 Railway Environment Variables:', {
        MYSQLHOST: process.env.MYSQLHOST,
        MYSQLDATABASE: process.env.MYSQLDATABASE,
        MYSQLUSER: process.env.MYSQLUSER,
        MYSQLPORT: process.env.MYSQLPORT
      });
      setTimeout(testConnection, 5000); // Retry every 5 seconds
    } else {
      console.log('✅ Connected to MySQL database successfully!');
      connection.release();
    }
  });
};
testConnection();

// ==================== AUTH MIDDLEWARE ====================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required. Please log in.' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
    req.user = user;
    next();
  });
};

// ==================== AUTH ROUTES ====================
// Registration
app.post('/api/auth/register', async (req, res) => {
  const { employeeName, employeeID, email, password, department, position } = req.body;

  if (!employeeName || !employeeID || !email || !password) {
    return res.status(400).json({ error: 'All required fields must be filled' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email address' });

  try {
    const checkSql = 'SELECT id FROM Users WHERE employeeID = ? OR email = ?';
    pool.query(checkSql, [employeeID, email], async (checkErr, checkResults) => {
      if (checkErr) return res.status(500).json({ error: 'Database error' });
      if (checkResults.length > 0) return res.status(400).json({ error: 'Employee ID or Email already exists' });

      const hashedPassword = await bcrypt.hash(password, 10);
      const insertSql = `
        INSERT INTO Users (employeeName, employeeID, email, password, department, position) 
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      pool.query(insertSql, [employeeName, employeeID, email, hashedPassword, department, position], (insertErr, insertResults) => {
        if (insertErr) return res.status(500).json({ error: 'Failed to create user' });

        const token = jwt.sign({ userId: insertResults.insertId, employeeID, email }, JWT_SECRET, { expiresIn: '24h' });

        res.status(201).json({
          message: 'User registered successfully!',
          user: { id: insertResults.insertId, employeeName, employeeID, email, department, position },
          token
        });
      });
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { employeeID, password } = req.body;
  if (!employeeID || !password) return res.status(400).json({ error: 'Employee ID and password required' });

  const sql = 'SELECT * FROM Users WHERE employeeID = ?';
  pool.query(sql, [employeeID], async (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(401).json({ error: 'Invalid Employee ID or password' });

    const user = results[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) return res.status(401).json({ error: 'Invalid Employee ID or password' });

    const token = jwt.sign({ userId: user.id, employeeID: user.employeeID, email: user.email }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      message: 'Login successful!',
      user: { id: user.id, employeeName: user.employeeName, employeeID: user.employeeID, email: user.email, department: user.department, position: user.position },
      token
    });
  });
});

// ==================== ATTENDANCE ROUTES ====================
// GET attendance
app.get('/api/attendance', authenticateToken, (req, res) => {
  const sql = 'SELECT * FROM Attendance WHERE user_id = ? ORDER BY date DESC, createdAt DESC';
  pool.query(sql, [req.user.userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch attendance records' });
    res.json({ message: 'success', data: results, count: results.length });
  });
});

// POST attendance
app.post('/api/attendance', authenticateToken, (req, res) => {
  const { date, status } = req.body;
  const userId = req.user.userId;

  if (!date || !status) return res.status(400).json({ error: 'Date and status required' });
  if (!['Present', 'Absent'].includes(status)) return res.status(400).json({ error: 'Status must be "Present" or "Absent"' });

  const getUserSql = 'SELECT employeeName, employeeID FROM Users WHERE id = ?';
  pool.query(getUserSql, [userId], (userErr, userResults) => {
    if (userErr || userResults.length === 0) return res.status(500).json({ error: 'User not found' });

    const user = userResults[0];
    const checkSql = 'SELECT id FROM Attendance WHERE user_id = ? AND date = ?';
    pool.query(checkSql, [userId, date], (checkErr, checkResults) => {
      if (checkErr) return res.status(500).json({ error: 'Database error' });
      if (checkResults.length > 0) return res.status(400).json({ error: `Attendance for ${date} already exists` });

      const insertSql = 'INSERT INTO Attendance (user_id, employeeName, employeeID, date, status) VALUES (?, ?, ?, ?, ?)';
      pool.query(insertSql, [userId, user.employeeName, user.employeeID, date, status], (insertErr, insertResults) => {
        if (insertErr) return res.status(500).json({ error: 'Failed to save attendance' });

        res.json({
          message: 'Attendance recorded successfully!',
          data: { id: insertResults.insertId, userId, employeeName: user.employeeName, employeeID: user.employeeID, date, status }
        });
      });
    });
  });
});

// DELETE attendance
app.delete('/api/attendance/:id', authenticateToken, (req, res) => {
  const id = req.params.id;
  const userId = req.user.userId;
  if (!id || isNaN(id)) return res.status(400).json({ error: 'Valid ID required' });

  const sql = 'DELETE FROM Attendance WHERE id = ? AND user_id = ?';
  pool.query(sql, [id, userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Failed to delete record' });
    if (results.affectedRows === 0) return res.status(404).json({ error: 'Record not found or access denied' });
    res.json({ message: 'Attendance record deleted successfully', deletedId: id });
  });
});

// ==================== USER PROFILE ====================
app.get('/api/user/profile', authenticateToken, (req, res) => {
  const sql = 'SELECT id, employeeName, employeeID, email, department, position, createdAt FROM Users WHERE id = ?';
  pool.query(sql, [req.user.userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch profile' });
    if (results.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'success', user: results[0] });
  });
});

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
  pool.query('SELECT 1 AS db_status', (err) => {
    if (err) return res.status(500).json({ status: 'error', database: 'disconnected', error: err.message, timestamp: new Date().toISOString() });
    res.json({ status: 'success', message: 'API is running', database: 'connected', timestamp: new Date().toISOString() });
  });
});

// ==================== 404 & ERROR HANDLING ====================
app.use('*', (req, res) => res.status(404).json({ error: 'Endpoint not found' }));
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: 'Please try again later' });
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
  console.log('🚀 ========================================');
  console.log('🚀 Employee Attendance Tracker API Started');
  console.log('📍 Port:', PORT);
  console.log('📊 Database:', process.env.DB_NAME || process.env.MYSQLDATABASE);
  console.log('👤 Database User:', process.env.DB_USER || process.env.MYSQLUSER);
  console.log('🔐 Authentication: Enabled');
  console.log('🌐 Health Check: http://localhost:' + PORT + '/api/health');
  console.log('🚀 ========================================');
});
