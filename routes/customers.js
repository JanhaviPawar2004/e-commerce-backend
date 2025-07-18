const express = require('express');
const router = express.Router();
const pool = require('./db').promise(); // Make sure this is your promise-based db connection
const { authenticateShopOwner } = require('./middleware'); // path as needed

// GET /api/customers?storeId=123
router.get('/',authenticateShopOwner, async (req, res) => {
  const storeId = req.query.storeId;

  if (!storeId) {
    return res.status(400).json({ error: 'storeId is required in query parameters' });
  }

  const sql = `
    SELECT
      c.customer_id,
      c.customer_name,
      c.date_joined,
      c.phone_number,
      COUNT(DISTINCT o.order_id) AS no_of_orders,
      IFNULL(SUM(p.price * oi.quantity), 0) AS amount_spent
    FROM customers c
    LEFT JOIN orders o ON c.customer_id = o.customer_id
    LEFT JOIN order_items oi ON o.order_id = oi.order_id
    LEFT JOIN products p ON oi.product_id = p.product_id
    WHERE c.store_id = ?
    GROUP BY c.customer_id
    ORDER BY c.date_joined DESC
  `;

  try {
    const [results] = await pool.query(sql, [storeId]);
    res.json(results);
  } catch (err) {
    console.error('Error fetching customers:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/customers/add
router.post('/add',authenticateShopOwner, async (req, res) => {
  const storeId = req.query.storeId;

  const { customer_name, email, phone_number, address, password } = req.body;

  if (!storeId || !customer_name || !email || !phone_number || !password) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const sql = `
    INSERT INTO customers (customer_name, email, phone_number, address, password, date_joined, store_id)
    VALUES (?, ?, ?, ?, ?, NOW(), ?)
  `;

  const values = [customer_name, email, phone_number, address, password, storeId];

  try {
    const [result] = await pool.query(sql, values);
    res.status(201).json({ message: 'Customer added successfully' });
  } catch (err) {
    console.error('Error inserting customer:', err.message);
    res.status(500).json({ error: 'Database insert failed' });
  }
});

module.exports = router;
