const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');  // Changed from 'bcrypt' to 'bcryptjs'
const jwt = require('jsonwebtoken');
require('dotenv').config();

// ... rest of your server code remains the same

const app = express();
const PORT = process.env.SERVER_PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'employee-attendance-tracker-secret-key-2024-limkokwing';

// Middleware
app.use(cors());
app.use(express.json());

// MySQL Connection Pool with better configuration
// MySQL Connection Pool for Railway
const pool = mysql.createPool({
  host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
  user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
  password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'attendance_tracker',
  port: process.env.MYSQLPORT || process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test database connection
// Test database connection
const testConnection = () => {
  pool.getConnection((err, connection) => {
    if (err) {
      console.error('❌ Database connection failed:', err.message);
      console.log('🔧 Database Configuration:');
      console.log('Host:', process.env.MYSQLHOST || process.env.DB_HOST);
      console.log('Database:', process.env.MYSQLDATABASE || process.env.DB_NAME);
      console.log('User:', process.env.MYSQLUSER || process.env.DB_USER);
      console.log('Port:', process.env.MYSQLPORT || process.env.DB_PORT);
      setTimeout(testConnection, 5000);
    } else {
      console.log('✅ Connected to MySQL database successfully!');
      console.log('📊 Database:', process.env.MYSQLDATABASE || process.env.DB_NAME);
      console.log('👤 Database User:', process.env.MYSQLUSER || process.env.DB_USER);
      connection.release();
    }
  });
};

testConnection();

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please log in.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token. Please log in again.' });
    }
    req.user = user;
    next();
  });
};

// ==================== AUTHENTICATION ROUTES ====================

// User Registration
app.post('/api/auth/register', async (req, res) => {
  const { employeeName, employeeID, email, password, department, position } = req.body;

  // Validation
  if (!employeeName || !employeeID || !email || !password) {
    return res.status(400).json({ error: 'All required fields must be filled' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  try {
    // Check if user already exists
    const checkSql = 'SELECT id FROM Users WHERE employeeID = ? OR email = ?';
    pool.query(checkSql, [employeeID, email], async (checkErr, checkResults) => {
      if (checkErr) {
        console.error('Error checking user:', checkErr);
        return res.status(500).json({ error: 'Database error. Please try again.' });
      }

      if (checkResults.length > 0) {
        return res.status(400).json({ error: 'Employee ID or Email already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert new user
      const insertSql = `
        INSERT INTO Users (employeeName, employeeID, email, password, department, position) 
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      pool.query(insertSql, [employeeName, employeeID, email, hashedPassword, department, position], (insertErr, insertResults) => {
        if (insertErr) {
          console.error('Error creating user:', insertErr);
          return res.status(500).json({ error: 'Failed to create user account. Please try again.' });
        }

        // Generate JWT token
        const token = jwt.sign(
          { userId: insertResults.insertId, employeeID, email },
          JWT_SECRET,
          { expiresIn: '24h' }
        );

        res.status(201).json({
          message: 'User registered successfully! You can now log in.',
          user: {
            id: insertResults.insertId,
            employeeName,
            employeeID,
            email,
            department,
            position
          },
          token
        });
      });
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error. Please try again later.' });
  }
});

// User Login
app.post('/api/auth/login', (req, res) => {
  const { employeeID, password } = req.body;

  if (!employeeID || !password) {
    return res.status(400).json({ error: 'Employee ID and password are required' });
  }

  const sql = 'SELECT * FROM Users WHERE employeeID = ?';
  
  pool.query(sql, [employeeID], async (err, results) => {
    if (err) {
      console.error('Login error:', err);
      return res.status(500).json({ error: 'Database error. Please try again.' });
    }

    if (results.length === 0) {
      return res.status(401).json({ error: 'Invalid Employee ID or password' });
    }

    const user = results[0];

    try {
      const passwordMatch = await bcrypt.compare(password, user.password);
      
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Invalid Employee ID or password' });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, employeeID: user.employeeID, email: user.email },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        message: 'Login successful! Welcome back.',
        user: {
          id: user.id,
          employeeName: user.employeeName,
          employeeID: user.employeeID,
          email: user.email,
          department: user.department,
          position: user.position
        },
        token
      });
    } catch (error) {
      console.error('Password comparison error:', error);
      res.status(500).json({ error: 'Internal server error. Please try again.' });
    }
  });
});

// ==================== PROTECTED ROUTES ====================

// GET user's attendance records
app.get('/api/attendance', authenticateToken, (req, res) => {
  const sql = `
    SELECT a.* 
    FROM Attendance a 
    WHERE a.user_id = ?
    ORDER BY a.date DESC, a.createdAt DESC
  `;
  
  pool.query(sql, [req.user.userId], (err, results) => {
    if (err) {
      console.error('Error fetching attendance:', err);
      return res.status(500).json({ error: 'Failed to fetch attendance records' });
    }
    
    res.json({
      message: 'success',
      data: results,
      count: results.length
    });
  });
});

// POST new attendance record
app.post('/api/attendance', authenticateToken, (req, res) => {
  const { date, status } = req.body;
  const userId = req.user.userId;

  if (!date || !status) {
    return res.status(400).json({ error: 'Date and status are required' });
  }

  if (status !== 'Present' && status !== 'Absent') {
    return res.status(400).json({ error: 'Status must be either "Present" or "Absent"' });
  }

  // First get user details
  const getUserSql = 'SELECT employeeName, employeeID FROM Users WHERE id = ?';
  
  pool.query(getUserSql, [userId], (userErr, userResults) => {
    if (userErr || userResults.length === 0) {
      console.error('Error fetching user:', userErr);
      return res.status(500).json({ error: 'User not found' });
    }

    const user = userResults[0];

    // Check for duplicate entry
    const checkSql = 'SELECT id FROM Attendance WHERE user_id = ? AND date = ?';
    
    pool.query(checkSql, [userId, date], (checkErr, checkResults) => {
      if (checkErr) {
        console.error('Error checking duplicate:', checkErr);
        return res.status(500).json({ error: 'Database error' });
      }

      if (checkResults.length > 0) {
        return res.status(400).json({ error: `Attendance for ${date} already exists` });
      }

      // Insert new record
      const insertSql = `
        INSERT INTO Attendance (user_id, employeeName, employeeID, date, status) 
        VALUES (?, ?, ?, ?, ?)
      `;
      
      pool.query(insertSql, [userId, user.employeeName, user.employeeID, date, status], (insertErr, insertResults) => {
        if (insertErr) {
          console.error('Error inserting attendance:', insertErr);
          return res.status(500).json({ error: 'Failed to save attendance record' });
        }

        res.json({
          message: 'Attendance recorded successfully!',
          data: {
            id: insertResults.insertId,
            userId,
            employeeName: user.employeeName,
            employeeID: user.employeeID,
            date,
            status
          }
        });
      });
    });
  });
});

// DELETE attendance record
app.delete('/api/attendance/:id', authenticateToken, (req, res) => {
  const id = req.params.id;
  const userId = req.user.userId;

  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'Valid ID is required' });
  }

  const sql = 'DELETE FROM Attendance WHERE id = ? AND user_id = ?';
  
  pool.query(sql, [id, userId], (err, results) => {
    if (err) {
      console.error('Error deleting record:', err);
      return res.status(500).json({ error: 'Failed to delete record' });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Record not found or access denied' });
    }

    res.json({ 
      message: 'Attendance record deleted successfully',
      deletedId: id 
    });
  });
});

// Get user profile
app.get('/api/user/profile', authenticateToken, (req, res) => {
  const sql = 'SELECT id, employeeName, employeeID, email, department, position, createdAt FROM Users WHERE id = ?';
  
  pool.query(sql, [req.user.userId], (err, results) => {
    if (err) {
      console.error('Error fetching profile:', err);
      return res.status(500).json({ error: 'Failed to fetch profile' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'success',
      user: results[0]
    });
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  pool.query('SELECT 1 as db_status', (err, results) => {
    if (err) {
      return res.status(500).json({ 
        status: 'error', 
        database: 'disconnected',
        error: err.message,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({ 
      status: 'success', 
      message: 'Employee Attendance Tracker API is running', 
      database: 'connected',
      database_user: process.env.DB_USER,
      timestamp: new Date().toISOString()
    });
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: 'Please try again later'
  });
});

app.listen(PORT, () => {
  console.log('🚀 ========================================');
  console.log('🚀 Employee Attendance Tracker API Started');
  console.log('🚀 ========================================');
  console.log(`📍 Port: ${PORT}`);
  console.log(`📊 Database: ${process.env.DB_NAME}`);
  console.log(`👤 Database User: ${process.env.DB_USER}`);
  console.log(`🔐 Authentication: Enabled`);
  console.log(`🌐 Health Check: http://localhost:${PORT}/api/health`);
  console.log('🚀 ========================================');
});