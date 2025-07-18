const express = require('express');
const router = express.Router();
const pool = require('./db').promise(); // Make sure to use promise wrapper
const jwt = require('jsonwebtoken');
const { authenticateShopOwner } = require('./middleware'); // path as needed

// GET /api/feedback?storeId=123 - fetch feedback only for the given storeId
router.get('/',authenticateShopOwner, async (req, res) => {
  const storeId = req.query.storeId;

  if (!storeId) {
    return res.status(400).json({ error: 'storeId is required in query parameters' });
  }

  const sql = `
    SELECT 
      f.feedback_id, 
      f.review_date, 
      f.rating, 
      f.review_description, 
      c.customer_name, 
      p.product_name
    FROM feedback f
    JOIN customers c ON f.customer_id = c.customer_id
    JOIN products p ON f.product_id = p.product_id
    WHERE f.store_id = ?
    ORDER BY f.review_date DESC
  `;

  try {
    const [results] = await pool.query(sql, [storeId]);
    res.json(results);
  } catch (err) {
    console.error('Error fetching feedback:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
