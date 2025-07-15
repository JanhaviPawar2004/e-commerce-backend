const express = require('express');
const router = express.Router();
const pool = require('./db').promise(); // Make sure to use promise wrapper



// 🛒 GET /api/store/:storeId/products
router.get('/store/:storeId/products', async (req, res) => {
  const { storeId } = req.params;

  const query = `
    SELECT * FROM products 
    WHERE store_id = ?
  `;

  try {
    const [results] = await pool.query(query, [storeId]);

    // Extract unique categories
    const categories = [...new Set(results.map(p => p.product_category))];

    res.json({
      categories,
      products: results
    });
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// 🛒 GET /api/store/:storeId/bestsellers
router.get('/store/:storeId/bestsellers', async (req, res) => {
  const { storeId } = req.params;

  const query = `
    SELECT 
      p.*, 
      IFNULL(SUM(oi.quantity), 0) AS total_sold
    FROM 
      products p
    LEFT JOIN 
      order_items oi 
      ON p.product_id = oi.product_id AND oi.store_id = ?
    WHERE 
      p.store_id = ?
    GROUP BY 
      p.product_id
    ORDER BY 
      total_sold DESC
    LIMIT 5
  `;

  try {
    const [results] = await pool.query(query, [storeId, storeId]);
    res.json({ bestsellers: results });
  } catch (err) {
    console.error('Error fetching bestsellers:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
