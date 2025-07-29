const express = require('express');
const router = express.Router();
// const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

const pool = require('./db').promise(); // Make sure to use promise wrapper

const nodemailer = require('nodemailer');

// === Email Transporter ===
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: 'dukaanifyofficialemail@gmail.com',
    pass: 'spti qbaf aqee oldh',
  },
});

// === 1️⃣ Request OTP ===
router.post('/customer/request-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  try {
    const [existing] = await pool.query('SELECT * FROM customers WHERE email = ?', [email]);
    if (existing.length > 0) return res.status(409).json({ message: 'Email already registered' });

    const [recent] = await pool.query(
      'SELECT * FROM signup_otps WHERE email = ? AND created_at >= (NOW() - INTERVAL 3 MINUTE)',
      [email]
    );
    if (recent.length > 0) return res.status(429).json({ message: 'OTP already sent. Try again soon.' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await pool.query('DELETE FROM signup_otps WHERE email = ? AND is_verified = FALSE', [email]);

    await pool.query('INSERT INTO signup_otps (email, otp) VALUES (?, ?)', [email, otp]);

    await transporter.sendMail({
      from: 'Dukaanify Support <dukaanifyofficialemail@gmail.com>',
      to: email,
      subject: 'Your OTP for Signup',
      html: `<p>Your OTP is <strong>${otp}</strong>. It expires in 3 minutes.</p>`,
    });

    res.status(200).json({ message: 'OTP sent successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to send OTP' });
  }
});

// === 2️⃣ Verify OTP ===
router.post('/customer/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ message: 'Email and OTP required' });

  try {
    const [rows] = await pool.query(
      'SELECT * FROM signup_otps WHERE email = ? AND otp = ? AND created_at >= (NOW() - INTERVAL 3 MINUTE)',
      [email, otp]
    );

    if (rows.length === 0) return res.status(400).json({ message: 'Invalid or expired OTP' });

    await pool.query('UPDATE signup_otps SET is_verified = TRUE WHERE email = ?', [email]);
    res.status(200).json({ message: 'OTP verified successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Verification failed' });
  }
});

// === 3️⃣ Final Signup (Only if OTP Verified) ===
router.post('/customer/create-account', async (req, res) => {
  const { customer_name, email, password, phone_number, address, store_id } = req.body;

  if (!email || !password || !customer_name || !phone_number || !address || !store_id)
    return res.status(400).json({ message: 'All fields are required' });

  try {
    const [otpVerified] = await pool.query(
      'SELECT * FROM signup_otps WHERE email = ? AND is_verified = TRUE',
      [email]
    );
    if (otpVerified.length === 0) return res.status(403).json({ message: 'OTP not verified' });

    // No bcrypt: storing plain text password as requested
    const [result] = await pool.query(
      'INSERT INTO customers (customer_name, email, password, phone_number, address, store_id, date_joined) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [customer_name, email, password, phone_number, address, store_id]
    );

    await pool.query('DELETE FROM signup_otps WHERE email = ?', [email]);

    res.status(201).json({
      message: 'Customer registered!',
      customerId: result.insertId,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Signup failed' });
  }
});


// --- Customer Signup ---
//api/cus/signup
/* 
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
}); */

// --- Customer Login ---
router.post('/login', async (req, res) => {
  const { email, password, store_id } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: 'Email and password are required' });

  try {
    const [customers] = await pool.query(
      'SELECT customer_id, email, password, store_id FROM customers WHERE email = ? AND store_id = ?',
      [email, store_id]
    );
    

    if (customers.length === 0)
      return res.status(401).json({ message: 'Customer not registered with this store' });

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
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      )
    });
    
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

module.exports = router;
