const express = require('express');
const router = express.Router();
const pool = require('./db').promise(); // Make sure to use promise wrapper



// GET /api/customer/:customerId/store/:storeId/orders
router.get('/customer/:customerId/store/:storeId/orders', async (req, res) => {
  const { customerId, storeId } = req.params;

  try {
    const [rows] = await pool.query(
      `
      SELECT 
        o.order_id,
        o.date_ordered,
        o.status,
        p.product_name,
        p.price,
        oi.quantity,
        (p.price * oi.quantity) AS item_total,
        p.image_url
      FROM orders o
      JOIN order_items oi ON o.order_id = oi.order_id
      JOIN products p ON oi.product_id = p.product_id
      WHERE o.customer_id = ? AND oi.store_id = ?
      ORDER BY o.date_ordered DESC
      `,
      [customerId, storeId]
    );

    // Group items by order_id
    const grouped = {};
    rows.forEach((row) => {
      if (!grouped[row.order_id]) {
        grouped[row.order_id] = {
          order_id: row.order_id,
          date_ordered: row.date_ordered,
          status: row.status,
          items: [],
          total_amount: 0,
        };
      }
      grouped[row.order_id].items.push({
        product_name: row.product_name,
        quantity: row.quantity,
        price: row.price,
        item_total: row.item_total,
        image_url: row.image_url,
      });
      grouped[row.order_id].total_amount += parseFloat(row.item_total);
    });

    Object.values(grouped).forEach(order => {
      order.total_amount = parseFloat(order.total_amount.toFixed(2));
    });

    res.json(Object.values(grouped));
  } catch (err) {
    console.error('Full error object:', err);
    console.error('SQL message:', err.sqlMessage);
    return res.status(500).json({
      message: 'Server error while fetching orders',
      detail: err.sqlMessage,
    });
  }
});

module.exports = router;
