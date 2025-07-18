const express = require('express');
const router = express.Router();
const pool = require('./db').promise(); // Adjust path as needed
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateShopOwner } = require('./middleware'); // path as needed

// ---- Multer Config ----
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath);
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + ext;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// ---- GET /api/products?storeId=... ----
router.get('/',authenticateShopOwner, async (req, res) => {
  const store_id = req.query.storeId;
  if (!store_id) return res.status(400).json({ error: 'storeId is required' });

  const query = `
   SELECT 
  p.*, 
  AVG(f.rating) AS avg_rating,
  IFNULL(SUM(oi.quantity), 0) AS total_sold
FROM 
  products p
LEFT JOIN feedback f ON p.product_id = f.product_id AND f.store_id = p.store_id
LEFT JOIN order_items oi ON p.product_id = oi.product_id AND oi.store_id = p.store_id
WHERE 
  p.store_id = 201
GROUP BY 
  p.product_id;

  `;

  try {
    const [rows] = await pool.query(query, [store_id, store_id]);
    res.json(rows);
  } catch (err) {
    console.error('❌ Error fetching products:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ---- GET /api/products/categories?storeId=... ----
router.get('/categories',authenticateShopOwner, async (req, res) => {
  const store_id = req.query.storeId;
  if (!store_id) return res.status(400).json({ error: 'storeId is required' });

  const query = `SELECT DISTINCT product_category AS name FROM products WHERE store_id = ?`;

  try {
    const [rows] = await pool.query(query, [store_id]);
    res.json(rows);
  } catch (err) {
    console.error('❌ Error fetching categories:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ---- GET /api/products/category-counts?storeId=... ----
router.get('/category-counts',authenticateShopOwner, async (req, res) => {
  const store_id = req.query.storeId;
  if (!store_id) return res.status(400).json({ error: 'storeId is required' });

  const query = `
    SELECT product_category AS name, COUNT(product_id) AS count
    FROM products
    WHERE store_id = ?
    GROUP BY product_category
  `;

  try {
    const [rows] = await pool.query(query, [store_id]);
    res.json(rows);
  } catch (err) {
    console.error('❌ Error fetching category counts:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ---- POST /api/products/add?storeId=... ----
router.post('/add',authenticateShopOwner, upload.single('image'), async (req, res) => {
  const store_id = req.query.storeId;
  if (!store_id) return res.status(400).json({ error: 'storeId is required' });

  const { product_name, price, product_category, description, stock_quantity } = req.body;
  const image_url = req.file ? `uploads/${req.file.filename}` : null;

  const query = `
    INSERT INTO products
    (product_name, price, product_category, description, stock_quantity, image_url, store_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  try {
    await pool.query(query, [
      product_name,
      price,
      product_category,
      description,
      stock_quantity,
      image_url,
      store_id
    ]);
    res.status(201).json({ message: '✅ Product added successfully' });
  } catch (err) {
    console.error('❌ Error inserting product:', err);
    res.status(500).json({ error: 'Failed to insert product' });
  }
});

// ---- GET /api/products/filter?storeId=... ----
router.get('/filter',authenticateShopOwner, async (req, res) => {
  const store_id = req.query.storeId;
  if (!store_id) return res.status(400).json({ error: 'storeId is required' });

  const { category, minPrice, maxPrice, inStock, search, startDate, endDate, minSold, maxSold } = req.query;

  let query = `
    SELECT 
      p.*, 
      IFNULL(SUM(oi.quantity), 0) AS total_sold
    FROM 
      products p
    LEFT JOIN 
      order_items oi ON p.product_id = oi.product_id AND oi.store_id = ?
    WHERE 
      p.store_id = ?
  `;
  let params = [store_id, store_id];

  if (category && category !== 'All') {
    query += ` AND p.product_category = ?`;
    params.push(category);
  }

  if (minPrice) {
    query += ` AND p.price >= ?`;
    params.push(Number(minPrice));
  }

  if (maxPrice) {
    query += ` AND p.price <= ?`;
    params.push(Number(maxPrice));
  }

  if (inStock === 'true') {
    query += ` AND p.stock_quantity > 0`;
  }

  if (search) {
    query += ` AND p.product_name LIKE ?`;
    params.push(`%${search}%`);
  }

  if (startDate && endDate) {
    query += ` AND DATE(p.data_created) BETWEEN ? AND ?`;
    params.push(startDate, endDate);
  }

  query += ` GROUP BY p.product_id`;

  if (minSold || maxSold) {
    query += ` HAVING 1`;
    if (minSold) {
      query += ` AND total_sold >= ?`;
      params.push(Number(minSold));
    }
    if (maxSold) {
      query += ` AND total_sold <= ?`;
      params.push(Number(maxSold));
    }
  }

  try {
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('❌ Error filtering products:', err);
    res.status(500).json({ error: 'Database error' });
  }
});


// GET /api/products/low-stock/:storeId
router.get('/low-stock',authenticateShopOwner, async (req, res) => {
  const store_id = req.query.storeId;
  try {
    const [results] = await pool.query(
      'SELECT product_id, product_name, stock_quantity FROM products WHERE store_id = ? AND stock_quantity < 10',
      [store_id]
    );
    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch low stock products' });
  }
});

//edit products apiii

router.get('/:productId',authenticateShopOwner, async (req, res) => {
  const { productId } = req.params;

  try {
    const [rows] = await pool.query('SELECT * FROM products WHERE product_id = ?', [productId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('❌ Error fetching product:', err);
    res.status(500).json({ error: 'Database error' });
  }
});


router.put('/:productId',authenticateShopOwner, upload.single('image'), async (req, res) => {
  const { productId } = req.params;
  const { product_name, price, product_category, description, stock_quantity } = req.body;
  const image_url = req.file ? `uploads/${req.file.filename}` : null;

  let query = `
    UPDATE products SET 
      product_name = ?, 
      price = ?, 
      product_category = ?, 
      description = ?, 
      stock_quantity = ?
  `;
  const params = [product_name, price, product_category, description, stock_quantity];

  if (image_url) {
    query += `, image_url = ?`;
    params.push(image_url);
  }

  query += ` WHERE product_id = ?`;
  params.push(productId);

  try {
    const [result] = await pool.query(query, params);
    res.json({ message: '✅ Product updated successfully' });
  } catch (err) {
    console.error('❌ Error updating product:', err);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

module.exports = router;
