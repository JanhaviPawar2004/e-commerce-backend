const express = require('express');
const router = express.Router();
const pool = require('./db').promise(); // Use your promise-based DB pool
const {authenticateAdmin} = require('./middleware'); // Adjust path if needed

// ✅ GET: Get summary dashboard counts (total stores, customers, products, sales)
router.get('/summary', authenticateAdmin, async (req, res) => {
  try {
    const [[{ total_stores }]] = await pool.query('SELECT COUNT(*) AS total_stores FROM stores');
    const [[{ total_customers }]] = await pool.query('SELECT COUNT(*) AS total_customers FROM customers');
    const [[{ total_products }]] = await pool.query('SELECT COUNT(*) AS total_products FROM products');
    const [[{ total_sales }]] = await pool.query('SELECT IFNULL(SUM(total_amount), 0) AS total_sales FROM orders');

    res.json({ total_stores, total_customers, total_products, total_sales });
  } catch (err) {
    console.error('Error fetching summary:', err.message);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// ✅ GET: Enhanced list of stores with filters and sorting
router.get('/stores', authenticateAdmin, async (req, res) => {
    const { search = '', status, sort = 'desc' } = req.query;
  
    const filters = [];
    const values = [];
  
    if (search) {
      filters.push(`(s.store_name LIKE ? OR u.email LIKE ?)`);
      values.push(`%${search}%`, `%${search}%`);
    }
  
    if (status && ['enabled', 'disabled'].includes(status)) {
      filters.push(`s.store_status = ?`);
      values.push(status);
    }
  
    const whereClause = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  
    const sql = `
      SELECT s.store_id, s.store_name, s.store_email, s.store_status, u.email AS owner_email
      FROM stores s
      JOIN users u ON s.store_id = u.store_id AND u.user_type = 'shop_owner'
      ${whereClause}
      ORDER BY s.store_id ${sort.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'}
    `;
  
    try {
      const [results] = await pool.query(sql, values);
      res.json(results);
    } catch (err) {
      console.error('Error fetching store list:', err.message);
      res.status(500).json({ error: 'Failed to fetch stores' });
    }
  });
  


// ✅ PUT: Update store status (enable/disable)
router.put('/stores/:storeId/status', authenticateAdmin, async (req, res) => {
  const { storeId } = req.params;
  const { status } = req.body; // Expected to be 'enabled' or 'disabled'

  if (!['enabled', 'disabled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  const sql = `UPDATE stores SET store_status = ? WHERE store_id = ?`;

  try {
    await pool.query(sql, [status, storeId]);
    res.json({ message: `Store ${status} successfully` });
  } catch (err) {
    console.error('Error updating store status:', err.message);
    res.status(500).json({ error: 'Failed to update status' });
  }
});


// ✅ GET: Store detailed summary (total products, orders, sales, reviews, customers)
router.get('/store-summary/:storeId', authenticateAdmin, async (req, res) => {
  const storeId = req.params.storeId;

  const query = `
    SELECT
        s.store_id,
        s.store_name,
        s.store_tagline,
        s.store_email,
        s.created_at,
        s.updated_at,
        s.store_desc,
        s.store_status,
        COUNT(DISTINCT p.product_id) AS total_products,
        COUNT(DISTINCT p.product_category) AS total_product_categories,
        COUNT(DISTINCT o.order_id) AS total_orders,
        (SELECT SUM(DISTINCT total_sale_amount)
         FROM sales sd
         WHERE sd.store_id = s.store_id) AS total_sales,
        AVG(r.rating) AS avg_rating,
        COUNT(DISTINCT c.customer_id) AS total_customers
    FROM
        stores s
    LEFT JOIN
        products p ON s.store_id = p.store_id
    LEFT JOIN
        customers c ON s.store_id = c.store_id
    LEFT JOIN
        orders o ON c.customer_id = o.customer_id
    LEFT JOIN
        store_reviews r ON s.store_id = r.store_id
    WHERE
        s.store_id = ?
    GROUP BY
        s.store_id;
  `;

  try {
    const [rows] = await pool.query(query, [storeId]);

    if (rows.length > 0) {
      res.json(rows[0]); // Send back the summary of the store
    } else {
      res.status(404).json({ error: 'Store not found' });
    }
  } catch (error) {
    console.error('Error fetching store summary:', error);
    res.status(500).json({ error: 'Failed to fetch store summary' });
  }
});

module.exports = router;
