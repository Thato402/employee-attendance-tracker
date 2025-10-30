// ==================== IMPORTS ====================
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config();

// ==================== APP CONFIG ====================
const app = express();
const PORT = process.env.SERVER_PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'employee-attendance-tracker-secret-key-2024';

// Middleware
app.use(cors());
app.use(express.json());

// ==================== MYSQL POOL CONFIG ====================
const pool = mysql.createPool({
  host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
  user: process.env.MYSQLUSER || process.env.DB_USER || 'attendance_user',
  password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '123456',
  database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'attendance_tracker',
  port: process.env.MYSQLPORT || process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test DB connection
pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
  } else {
    console.log('✅ Connected to MySQL database successfully!');
    connection.release();
  }
});

// ==================== JWT AUTH MIDDLEWARE ====================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required.' });

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
    return res.status(400).json({ error: 'All required fields must be filled.' });
  }
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters long.' });

  try {
    pool.query(
      'SELECT id FROM Users WHERE employeeID = ? OR email = ?',
      [employeeID, email],
      async (err, results) => {
        if (err) return res.status(500).json({ error: 'Database error.' });
        if (results.length > 0) return res.status(400).json({ error: 'Employee ID or Email already exists.' });

        const hashedPassword = await bcrypt.hash(password, 10);

        pool.query(
          'INSERT INTO Users (employeeName, employeeID, email, password, department, position) VALUES (?, ?, ?, ?, ?, ?)',
          [employeeName, employeeID, email, hashedPassword, department, position],
          (err, results) => {
            if (err) return res.status(500).json({ error: 'Failed to create user.' });
            const token = jwt.sign({ userId: results.insertId, employeeID, email }, JWT_SECRET, { expiresIn: '24h' });
            res.status(201).json({
              message: 'User registered successfully!',
              user: { id: results.insertId, employeeName, employeeID, email, department, position },
              token
            });
          }
        );
      }
    );
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { employeeID, password } = req.body;
  if (!employeeID || !password) return res.status(400).json({ error: 'Employee ID and password are required.' });

  pool.query('SELECT * FROM Users WHERE employeeID = ?', [employeeID], async (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error.' });
    if (results.length === 0) return res.status(401).json({ error: 'Invalid Employee ID or password.' });

    const user = results[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid Employee ID or password.' });

    const token = jwt.sign({ userId: user.id, employeeID: user.employeeID, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ message: 'Login successful!', user, token });
  });
});

// ==================== ATTENDANCE ROUTES ====================

// Get user's attendance
app.get('/api/attendance', authenticateToken, (req, res) => {
  pool.query(
    'SELECT * FROM Attendance WHERE user_id = ? ORDER BY date DESC, createdAt DESC',
    [req.user.userId],
    (err, results) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch attendance records.' });
      res.json({ message: 'success', data: results, count: results.length });
    }
  );
});

// Post new attendance
app.post('/api/attendance', authenticateToken, (req, res) => {
  const { date, status } = req.body;
  if (!date || !status) return res.status(400).json({ error: 'Date and status are required.' });
  if (!['Present', 'Absent'].includes(status)) return res.status(400).json({ error: 'Status must be Present or Absent.' });

  pool.query('SELECT employeeName, employeeID FROM Users WHERE id = ?', [req.user.userId], (err, userResults) => {
    if (err || userResults.length === 0) return res.status(500).json({ error: 'User not found.' });

    const user = userResults[0];

    pool.query('SELECT id FROM Attendance WHERE user_id = ? AND date = ?', [req.user.userId, date], (err, results) => {
      if (err) return res.status(500).json({ error: 'Database error.' });
      if (results.length > 0) return res.status(400).json({ error: `Attendance for ${date} already exists.` });

      pool.query(
        'INSERT INTO Attendance (user_id, employeeName, employeeID, date, status) VALUES (?, ?, ?, ?, ?)',
        [req.user.userId, user.employeeName, user.employeeID, date, status],
        (err, results) => {
          if (err) return res.status(500).json({ error: 'Failed to save attendance.' });
          res.json({ message: 'Attendance recorded successfully!', data: { id: results.insertId, userId: req.user.userId, employeeName: user.employeeName, employeeID: user.employeeID, date, status } });
        }
      );
    });
  });
});

// Delete attendance
app.delete('/api/attendance/:id', authenticateToken, (req, res) => {
  const id = req.params.id;
  pool.query('DELETE FROM Attendance WHERE id = ? AND user_id = ?', [id, req.user.userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Failed to delete record.' });
    if (results.affectedRows === 0) return res.status(404).json({ error: 'Record not found or access denied.' });
    res.json({ message: 'Attendance record deleted successfully', deletedId: id });
  });
});

// ==================== USER PROFILE ====================
app.get('/api/user/profile', authenticateToken, (req, res) => {
  pool.query('SELECT id, employeeName, employeeID, email, department, position, createdAt FROM Users WHERE id = ?', [req.user.userId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Failed to fetch profile.' });
    if (results.length === 0) return res.status(404).json({ error: 'User not found.' });
    res.json({ message: 'success', user: results[0] });
  });
});

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
  pool.query('SELECT 1 AS db_status', (err) => {
    if (err) return res.status(500).json({ status: 'error', database: 'disconnected', error: err.message });
    res.json({ status: 'success', message: 'Employee Attendance Tracker API is running', database: 'connected' });
  });
});

// ==================== SERVE REACT FRONTEND ====================
app.use(express.static(path.join(__dirname, 'client/build')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

// ==================== ERROR HANDLING ====================
app.use('*', (req, res) => res.status(404).json({ error: 'Endpoint not found.' }));
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', message: 'Please try again later.' });
});

// ==================== START SERVER ====================
app.listen(PORT, () => {
  console.log('🚀 ========================================');
  console.log('🚀 Employee Attendance Tracker API Started');
  console.log('📍 Port:', PORT);
  console.log('📊 Database:', process.env.MYSQLDATABASE || process.env.DB_NAME);
  console.log('👤 Database User:', process.env.MYSQLUSER || process.env.DB_USER);
  console.log('🔐 Authentication: Enabled');
  console.log('🌐 Health Check: http://localhost:' + PORT + '/api/health');
  console.log('🚀 ========================================');
});
