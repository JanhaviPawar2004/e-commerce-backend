const express = require('express');
const router = express.Router();
const pool = require('./db').promise(); // Make sure to use promise wrapper


const multer = require('multer');
const path = require('path');
const fs = require('fs');


// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath);
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + ext;
    cb(null, uniqueName);
  }
});

const upload = multer({ storage });

// ✅ GET /api/store/:store_id
router.get('/:store_id', async (req, res) => {
  const storeId = req.params.store_id;

  try {
    const [storeRows] = await pool.query(
      `SELECT store_name, store_tagline, landing_image, store_photo, store_address, instagram_link, facebook_link, store_email, store_desc 
       FROM stores 
       WHERE store_id = ?`,
      [storeId]
    );

    if (storeRows.length === 0) {
      return res.status(404).json({ message: 'Store not found' });
    }

    const [reviewRows] = await pool.query(
      `SELECT customer_name, rating, review_text, created_at 
       FROM store_reviews 
       WHERE store_id = ? 
       ORDER BY created_at DESC`,
      [storeId]
    );

    res.json({
      store: storeRows[0],
      reviews: reviewRows
    });
  } catch (err) {
    console.error('Error fetching store details:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ✅ POST /api/reviews → Add a review for a store
router.post('/reviews', async (req, res) => {
  const { customer_id, rating, review_text, store_id } = req.body;

  if (!customer_id || !rating || !review_text || !store_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const [customerRows] = await pool.query(
      `SELECT customer_name FROM customers WHERE customer_id = ?`,
      [customer_id]
    );

    if (customerRows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const customer_name = customerRows[0].customer_name;

    await pool.query(
      `INSERT INTO store_reviews 
       (customer_name, rating, review_text, store_id, created_at) 
       VALUES (?, ?, ?, ?, NOW())`,
      [customer_name, rating, review_text, store_id]
    );

    res.status(201).json({ message: 'Review submitted successfully' });
  } catch (err) {
    console.error('Error submitting review:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
