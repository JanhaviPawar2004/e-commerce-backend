const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

// DB pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'e-commerce-db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// --- Customer Signup ---
router.post('/signup', async (req, res) => {
  const { customer_name, email, password, phone_number, address, store_id } = req.body;

  if (!email || !password || !customer_name || !phone_number || !address || !store_id) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const [existing] = await pool.query(
      'SELECT customer_id FROM customers WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: 'Customer already exists' });
    }

    const [result] = await pool.query(
      'INSERT INTO customers (customer_name, email, password, phone_number, address, store_id, date_joined) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [customer_name, email, password, phone_number, address, store_id]
    );

    res.status(201).json({
      message: 'Customer registered successfully!',
      customerId: result.insertId,
      email
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Server error during signup' });
  }
});

// --- Customer Login ---
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: 'Email and password are required' });

  try {
    const [customers] = await pool.query(
      'SELECT customer_id, email, password, store_id FROM customers WHERE email = ?',
      [email]
    );

    if (customers.length === 0)
      return res.status(401).json({ message: 'Invalid credentials' });

    const customer = customers[0];

    if (password !== customer.password)
      return res.status(401).json({ message: 'Invalid credentials' });

    res.status(200).json({
      message: 'Login successful!',
      user: {
        id: customer.customer_id,
        email: customer.email,
        storeId: customer.store_id
      },
      token: jwt.sign(
        {
          customer_id: customer.customer_id,
          store_id: customer.store_id,
          user_type: 'customer'
        },
        'your-secret-key',
        { expiresIn: '1h' }
      )
    });
    
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

module.exports = router;
