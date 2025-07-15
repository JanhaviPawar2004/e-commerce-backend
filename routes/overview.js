const express = require('express');
const router = express.Router();
const pool = require('./db').promise(); // ✅ Wrap it with .promise()


// GET /api/overview/:storeId
router.get('/:storeId', async (req, res) => {
  const { storeId } = req.params;

  try {
    const [[orders]] = await pool.query(`
      SELECT COUNT(*) AS orders
      FROM orders o
      JOIN customers c ON o.customer_id = c.customer_id
      WHERE c.store_id = ?
    `, [storeId]);

    const [[sold]] = await pool.query(`
      SELECT SUM(quantity) AS productsSold
      FROM order_items
      WHERE store_id = ?
    `, [storeId]);

    const [[customers]] = await pool.query(`
      SELECT COUNT(*) AS customers
      FROM customers
      WHERE store_id = ?
    `, [storeId]);

    const [[revenue]] = await pool.query(`
      SELECT SUM(total_sale_amount) AS revenue
      FROM sales
      WHERE store_id = ?
    `, [storeId]);

    const [topProducts] = await pool.query(`
      SELECT p.product_name, SUM(oi.quantity) AS sold
      FROM order_items oi
      JOIN products p ON oi.product_id = p.product_id
      WHERE oi.store_id = ?
      GROUP BY oi.product_id
      ORDER BY sold DESC
      LIMIT 5
    `, [storeId]);

    const [pendingOrders] = await pool.query(`
      SELECT o.order_id, o.total_amount, o.status, c.customer_name
      FROM orders o
      JOIN customers c ON o.customer_id = c.customer_id
      WHERE c.store_id = ? AND o.status = 'Processing'
    `, [storeId]);

    const [orderStatusData] = await pool.query(`
      SELECT o.status, COUNT(*) AS count
      FROM orders o
      JOIN customers c ON o.customer_id = c.customer_id
      WHERE c.store_id = ?
      GROUP BY o.status
    `, [storeId]);

    const [dailyRevenue] = await pool.query(`
      SELECT DATE(o.date_ordered) AS date, SUM(o.total_amount) AS revenue
      FROM orders o
      JOIN customers c ON o.customer_id = c.customer_id
      WHERE c.store_id = ?
      GROUP BY DATE(o.date_ordered)
      ORDER BY DATE(o.date_ordered)
    `, [storeId]);

    res.json({
      orders: orders.orders || 0,
      productsSold: sold.productsSold || 0,
      customers: customers.customers || 0,
      revenue: revenue.revenue || 0,
      topProducts,
      pendingOrders,
      orderStatusData,
      dailyRevenue
    });

  } catch (err) {
    console.error("Overview route error:", err);
    res.status(500).json({ error: 'Could not fetch overview' });
  }
});

module.exports = router;
