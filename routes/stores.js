const express = require('express');
const router = express.Router();
const pool = require('./db').promise(); // Promise-based pool
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ✅ Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage });

// ✅ GET /api/adminstore?storeId=xxx — Public store fetch by ID
router.get('/', async (req, res) => {
  const storeId = req.query.storeId;

  if (!storeId) return res.status(400).json({ error: 'Missing storeId' });

  try {
    const [rows] = await pool.query(`SELECT * FROM stores WHERE store_id = ?`, [storeId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Store not found' });
    res.json({ store: rows[0] });
  } catch (err) {
    console.error('❌ Error fetching store:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ✅ PUT /api/adminstore?storeId=xxx — Public store update by ID
router.put('/', upload.fields([
  { name: 'landing_image', maxCount: 1 },
  { name: 'store_photo', maxCount: 1 },
]), async (req, res) => {
  const storeId = req.query.storeId;

  if (!storeId) return res.status(400).json({ error: 'Missing storeId' });

  const {
    store_name,
    store_tagline,
    store_address,
    instagram_link,
    facebook_link,
    store_email,
    store_desc
  } = req.body;

  const landingImage = req.files?.landing_image?.[0]?.filename
    ? `uploads/${req.files.landing_image[0].filename}`
    : null;
  const storePhoto = req.files?.store_photo?.[0]?.filename
    ? `uploads/${req.files.store_photo[0].filename}`
    : null;

  const fields = [];
  const values = [];

  const fieldMap = {
    store_name,
    store_tagline,
    store_address,
    instagram_link,
    facebook_link,
    store_email,
    store_desc
  };

  Object.entries(fieldMap).forEach(([key, val]) => {
    if (val) {
      fields.push(`${key} = ?`);
      values.push(val);
    }
  });

  if (landingImage) {
    fields.push('landing_image = ?');
    values.push(landingImage);
  }
  if (storePhoto) {
    fields.push('store_photo = ?');
    values.push(storePhoto);
  }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'No fields provided to update' });
  }

  fields.push('updated_at = NOW()');
  values.push(storeId);

  const sql = `UPDATE stores SET ${fields.join(', ')} WHERE store_id = ?`;

  try {
    const [result] = await pool.query(sql, values);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Store not found or no changes applied' });
    }
    res.json({ message: '✅ Store updated successfully' });
  } catch (err) {
    console.error('❌ Error updating store:', err);
    res.status(500).json({ error: 'Failed to update store' });
  }
});

module.exports = router;
