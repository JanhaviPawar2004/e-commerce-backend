const express = require('express');
const router = express.Router();
const pool = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
/* 
// POST /api/login
router.post('/', (req, res) => {
  const { email, password } = req.body;

  pool.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (results.length === 0) return res.status(401).json({ message: 'User not found' });

    const user = results[0];

    // Compare password
    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid password' });

    // ✅ Create JWT including user_id, email, user_type, store_id
    const token = jwt.sign(
      {
        user_id: user.user_id,
        email: user.email,
        user_type: user.user_type,
        store_id: user.store_id
      },
      'my_secret_key', // Consider moving this to .env
      { expiresIn: '1h' }
    );

    // ✅ Send all needed data in response
    res.json({
      message: 'Login successful',
      token,
      user: {
        user_id: user.user_id,
        email: user.email,
        user_type: user.user_type,
        store_id: user.store_id
      }
    });
  });
});
 */


// POST /api/login
router.post('/', (req, res) => {
  const { email, password } = req.body;

  pool.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
    if (err) return res.status(500).json({ message: 'Server error' });
    if (results.length === 0) return res.status(401).json({ message: 'User not found' });

    const user = results[0];

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid password' });

    // ✅ If user is shop_owner, check if their store is enabled
    if (user.user_type === 'shop_owner') {
      const storeCheckQuery = 'SELECT store_status FROM stores WHERE store_id = ?';
      pool.query(storeCheckQuery, [user.store_id], (err, storeResults) => {
        if (err) return res.status(500).json({ message: 'Server error' });

        if (!storeResults.length || storeResults[0].store_status === 'disabled') {
          return res.status(403).json({
            message: 'Your store has been disabled by the admin. Please contact support.',
          });
        }

        // ✅ Store is enabled – continue login
        const token = jwt.sign(
          {
            user_id: user.user_id,
            email: user.email,
            user_type: user.user_type,
            store_id: user.store_id,
          },
          process.env.JWT_SECRET,
          { expiresIn: '1h' }
        );

        res.json({
          message: 'Login successful',
          token,
          user: {
            user_id: user.user_id,
            email: user.email,
            user_type: user.user_type,
            store_id: user.store_id,
          },
        });
      });
    } else {
      // ✅ For admin or other users, proceed as normal
      const token = jwt.sign(
        {
          user_id: user.user_id,
          email: user.email,
          user_type: user.user_type,
          store_id: user.store_id,
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      res.json({
        message: 'Login successful',
        token,
        user: {
          user_id: user.user_id,
          email: user.email,
          user_type: user.user_type,
          store_id: user.store_id,
        },
      });
    }
  });
});

module.exports = router;
