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


// 🛒 GET /api/store/:storeId/products/filter
router.get('/store/:storeId/products/afilter', async (req, res) => {
  const { storeId } = req.params;
  const {
    minPrice,
    maxPrice,
    minRating,
    maxRating,
    bestsellersOnly,
    category,
    search
  } = req.query;

  try {
    if (bestsellersOnly === 'true') {
      // 🏆 Return Top 5 Bestsellers Only
      const bestsellerQuery = `
        SELECT 
          p.*, 
          IFNULL(SUM(oi.quantity), 0) AS total_sold
        FROM 
          products p
        LEFT JOIN 
          order_items oi ON p.product_id = oi.product_id AND oi.store_id = ?
        WHERE 
          p.store_id = ?
        GROUP BY 
          p.product_id
        ORDER BY 
          total_sold DESC
        LIMIT 5
      `;
      const [results] = await pool.query(bestsellerQuery, [storeId, storeId]);
      return res.json(results);
    }

    // 🧪 Otherwise apply filters
    let query = `
      SELECT 
        p.*, 
        IFNULL(AVG(r.rating), 0) AS avg_rating,
        IFNULL(SUM(oi.quantity), 0) AS total_sold
      FROM 
        products p
      LEFT JOIN 
        order_items oi ON p.product_id = oi.product_id AND oi.store_id = ?
      LEFT JOIN 
        feedback r ON p.product_id = r.product_id
      WHERE 
        p.store_id = ?
    `;
    let params = [storeId, storeId];

    if (minPrice) {
      query += ` AND p.price >= ?`;
      params.push(Number(minPrice));
    }

    if (maxPrice) {
      query += ` AND p.price <= ?`;
      params.push(Number(maxPrice));
    }

    if (category) {
      query += ` AND p.product_category = ?`;
      params.push(category);
    }

    if (search) {
      query += ` AND p.product_name LIKE ?`;
      params.push(`%${search}%`);
    }

    query += ` GROUP BY p.product_id`;

    let having = [];
    if (minRating) {
      having.push(`avg_rating >= ?`);
      params.push(Number(minRating));
    }

    if (maxRating) {
      having.push(`avg_rating <= ?`);
      params.push(Number(maxRating));
    }

    if (having.length > 0) {
      query += ` HAVING ` + having.join(' AND ');
    }

    query += ` ORDER BY p.product_name ASC`;

    const [results] = await pool.query(query, params);
    res.json(results);
  } catch (err) {
    console.error('❌ Error applying filters:', err);
    res.status(500).json({ error: 'Database error' });
  }
});


module.exports = router;
