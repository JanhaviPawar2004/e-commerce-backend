const express = require('express');
const router = express.Router();
const pool = require('./db').promise(); // Make sure to use promise wrapper
const { verifyCustomerToken } = require('./middleware');

// GET /api/customer/:customerId/store/:storeId/orders
router.get('/customer/:customerId/store/:storeId/orders',verifyCustomerToken, async (req, res) => {
  const { customerId, storeId } = req.params;

  try {
    const [rows] = await pool.query(
      `
      SELECT 
    o.order_id,
    o.date_ordered,
    o.status,
    p.product_id,            -- add this
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
        product_id: row.product_id,   // add thi
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

router.post('/cusreviews',verifyCustomerToken, async (req, res) => {
  const { customer_id, product_id, store_id, rating, review_description } = req.body;

  // Basic validation
  if (!customer_id || !product_id || !store_id || !rating) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    console.log('Review Payload:', { customer_id, product_id, store_id, rating, review_description });

    // Optional: Check if product_id exists
    const [productCheck] = await pool.query(
      'SELECT product_id FROM products WHERE product_id = ? AND store_id = ?',
      [product_id, store_id]
    );

    if (productCheck.length === 0) {
      return res.status(400).json({ error: 'Invalid product_id or store_id' });
    }

    const sql = `
      INSERT INTO feedback (
        review_date, customer_id, rating, product_id, store_id, review_description
      ) VALUES (NOW(), ?, ?, ?, ?, ?)
    `;

    await pool.query(sql, [
      customer_id,
      rating,
      product_id,
      store_id,
      review_description || ''
    ]);

    res.json({ message: '✅ Feedback submitted successfully' });
  } catch (err) {
    console.error('❌ Error inserting feedback:', err);
    res.status(500).json({ error: 'Server error submitting feedback' });
  }
});


module.exports = router;
