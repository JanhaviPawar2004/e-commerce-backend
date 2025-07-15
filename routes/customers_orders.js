const express = require('express');
const router = express.Router();
const pool = require('./db').promise(); // ✅ Wrap it with .promise()

router.get('/', (req, res) => {
  pool.query('SELECT customer_id, customer_name FROM customers', (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

module.exports = router;
