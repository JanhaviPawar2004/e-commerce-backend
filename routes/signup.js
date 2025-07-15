const express = require('express');
const router = express.Router();
const pool = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// POST /api/signup
router.post('/', async (req, res) => {
  const { storeName, email, password } = req.body;

  if (!storeName || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  // Check if email already exists
  pool.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
    if (err) return res.status(500).json({ message: 'Database error' });

    if (results.length > 0) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Step 1: Insert store
    pool.query('INSERT INTO stores (store_name) VALUES (?)', [storeName], (storeErr, storeResult) => {
      if (storeErr) return res.status(500).json({ message: 'Error creating store' });

      const newStoreId = storeResult.insertId;

      // Step 2: Insert user
      pool.query(
        'INSERT INTO users (email, password, user_type, store_id) VALUES (?, ?, ?, ?)',
        [email, hashedPassword, 'shop_owner', newStoreId],
        (userErr, userResult) => {
          if (userErr) return res.status(500).json({ message: 'Failed to create user' });

          const token = jwt.sign({ id: userResult.insertId, email }, 'my_secret_key', {
            expiresIn: '1h',
          });

          res.status(201).json({ token });
        }
      );
    });
  });
});

module.exports = router;
