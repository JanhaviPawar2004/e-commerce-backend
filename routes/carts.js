const express = require('express');
const router = express.Router();
const pool = require('./db').promise(); // Make sure to use promise wrapper



// ✅ Create or get active cart
router.post('/carts', async (req, res) => {
  const { store_id, customer_id } = req.body;

  try {
    const checkQuery = `
      SELECT cart_id, status FROM carts
      WHERE store_id = ? AND customer_id = ?
    `;
    const [results] = await pool.query(checkQuery, [store_id, customer_id]);

    if (results.length > 0) {
      const cart = results[0];
      if (cart.status === 'completed') {
        // Reactivate the cart
        const updateQuery = `
          UPDATE carts SET status = 'active', updated_at = NOW()
          WHERE cart_id = ?
        `;
        await pool.query(updateQuery, [cart.cart_id]);
        return res.json({ cart_id: cart.cart_id });
      } else {
        // Cart already active
        return res.json({ cart_id: cart.cart_id });
      }
    } else {
      // Create new cart
      const insertQuery = `
        INSERT INTO carts (store_id, customer_id, status, created_at, updated_at)
        VALUES (?, ?, 'active', NOW(), NOW())
      `;
      const [result] = await pool.query(insertQuery, [store_id, customer_id]);
      return res.status(201).json({ cart_id: result.insertId });
    }
  } catch (err) {
    console.error('Error handling cart:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ✅ Add item to cart
router.post('/cart-items', async (req, res) => {
  const { cart_id, product_id, quantity } = req.body;

  try {
    const checkQuery = `
      SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ?
    `;
    const [results] = await pool.query(checkQuery, [cart_id, product_id]);

    if (results.length > 0) {
      // Update quantity
      const updateQuery = `
        UPDATE cart_items SET quantity = quantity + ?
        WHERE cart_id = ? AND product_id = ?
      `;
      await pool.query(updateQuery, [quantity, cart_id, product_id]);
      return res.json({ message: 'Quantity updated' });
    } else {
      // Insert new item
      const insertQuery = `
        INSERT INTO cart_items (cart_id, product_id, quantity)
        VALUES (?, ?, ?)
      `;
      await pool.query(insertQuery, [cart_id, product_id, quantity]);
      return res.status(201).json({ message: 'Item added to cart' });
    }
  } catch (err) {
    console.error('Error handling cart item:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ✅ Get items in cart
router.get('/carts/:storeId/:customerId/items', async (req, res) => {
  const { storeId, customerId } = req.params;

  const query = `
    SELECT ci.item_id, ci.product_id, ci.quantity, p.product_name AS name, p.price, p.image_url
    FROM carts c
    JOIN cart_items ci ON c.cart_id = ci.cart_id
    JOIN products p ON ci.product_id = p.product_id
    WHERE c.store_id = ? AND c.customer_id = ? AND c.status = 'active'
  `;

  try {
    const [results] = await pool.query(query, [storeId, customerId]);
    res.json(results);
  } catch (err) {
    console.error('Error fetching cart items:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ✅ Update cart item quantity
router.put('/cart-items/:item_id', async (req, res) => {
  const { quantity } = req.body;
  const { item_id } = req.params;

  if (quantity < 1) {
    return res.status(400).json({ error: 'Quantity must be at least 1' });
  }

  const updateQuery = `
    UPDATE cart_items SET quantity = ?
    WHERE item_id = ?
  `;

  try {
    await pool.query(updateQuery, [quantity, item_id]);
    res.json({ message: 'Quantity updated successfully' });
  } catch (err) {
    console.error('Error updating quantity:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ✅ Delete cart item
router.delete('/cart-items/:item_id', async (req, res) => {
  const { item_id } = req.params;

  const deleteQuery = `DELETE FROM cart_items WHERE item_id = ?`;

  try {
    await pool.query(deleteQuery, [item_id]);
    res.json({ message: 'Item removed from cart' });
  } catch (err) {
    console.error('Error deleting cart item:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ✅ Place order from cart
router.post('/cart/orders', async (req, res) => {
  const { customer_id, store_id, total_amount, status, items } = req.body;
  const now = new Date();

  try {
    // Insert order
    for (const item of items) {
      const [rows] = await pool.query(
        'SELECT stock_quantity FROM products WHERE product_id = ? AND store_id = ?',
        [item.product_id, store_id]
      );

      if (rows.length === 0 || rows[0].stock_quantity < item.quantity) {
        return res.status(400).json({
          error: `❌ Product ID ${item.product_id} has insufficient stock`
        });
      }
    }
    
    const orderQuery = `
      INSERT INTO orders (date_ordered, total_amount, customer_id, status)
      VALUES (?, ?, ?, ?)
    `;
    const [orderResult] = await pool.query(orderQuery, [now, total_amount, customer_id, status]);
    const orderId = orderResult.insertId;

    // Insert order items
    const orderItems = items.map(item => [orderId, item.product_id, item.quantity, store_id]);
    const orderItemsQuery = `
      INSERT INTO order_items (order_id, product_id, quantity, store_id)
      VALUES ?
    `;
    await pool.query(orderItemsQuery, [orderItems]);


    for (const item of items) {
      await pool.query(
        'UPDATE products SET stock_quantity = stock_quantity - ? WHERE product_id = ? AND store_id = ?',
        [item.quantity, item.product_id, store_id]
      );
    }

    
    // Get active cart
    const cartQuery = `
      SELECT cart_id FROM carts
      WHERE customer_id = ? AND store_id = ? AND status = 'active'
    `;
    const [cartResults] = await pool.query(cartQuery, [customer_id, store_id]);

    if (cartResults.length === 0) {
      return res.status(404).json({ error: 'No active cart found' });
    }

    const cart_id = cartResults[0].cart_id;

    // Delete cart items
    await pool.query('DELETE FROM cart_items WHERE cart_id = ?', [cart_id]);

    // Mark cart completed
    await pool.query(
      'UPDATE carts SET status = "completed", updated_at = NOW() WHERE cart_id = ?',
      [cart_id]
    );

    res.status(201).json({ message: 'Order placed and cart cleared' });
  } catch (err) {
    console.error('Error placing order:', err);
    res.status(500).json({ error: 'Failed to place order' });
  }
});

router.post('/cart/orders/validate', async (req, res) => {
  const { store_id, items } = req.body;

  try {
    for (const item of items) {
      const [rows] = await pool.query(
        'SELECT stock_quantity FROM products WHERE product_id = ? AND store_id = ?',
        [item.product_id, store_id]
      );

      if (rows.length === 0 || rows[0].stock_quantity < item.quantity) {
        return res.status(400).json({
          error: `❌ Product ID ${item.product_id} has insufficient stock.`,
        });
      }
    }

    res.status(200).json({ message: 'Stock validated' });
  } catch (err) {
    console.error('Stock validation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


module.exports = router;
