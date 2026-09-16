const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
    cb(null, `transfer-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /jpeg|jpg|png|webp/.test(file.mimetype);
    cb(ok ? null : new Error('Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP.'), ok);
  }
});

function toPublicTransfer(row) {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    description: row.description,
    price: row.price,
    priceUnit: row.price_unit,
    address: row.address,
    area: row.area,
    imagePath: row.image_path,
    ownerName: row.owner_name,
    createdAt: row.created_at
  };
}

// ---- Danh sách (lọc theo category + phân trang) ----
router.get('/', (req, res) => {
  const { category, limit, offset } = req.query;
  const lim = Math.min(Number(limit) || 10, 50);
  const off = Number(offset) || 0;

  let sql = `
    SELECT transfers.*, users.name AS owner_name FROM transfers
    JOIN users ON users.id = transfers.user_id
  `;
  let countSql = 'SELECT COUNT(*) AS total FROM transfers';
  const params = [];
  const countParams = [];

  if (category) {
    sql += ' WHERE transfers.category = ?';
    countSql += ' WHERE category = ?';
    params.push(category);
    countParams.push(category);
  }

  sql += ' ORDER BY transfers.created_at DESC LIMIT ? OFFSET ?';
  params.push(lim, off);

  const rows = db.prepare(sql).all(...params);
  const total = db.prepare(countSql).get(...countParams).total;

  res.json({ transfers: rows.map(toPublicTransfer), total, limit: lim, offset: off });
});

// ---- Chi tiết 1 tin ----
router.get('/:id', (req, res) => {
  const row = db.prepare(`
    SELECT transfers.*, users.name AS owner_name FROM transfers
    JOIN users ON users.id = transfers.user_id
    WHERE transfers.id = ?
  `).get(req.params.id);

  if (!row) return res.status(404).json({ error: 'Không tìm thấy tin đăng.' });
  res.json({ transfer: toPublicTransfer(row) });
});

// ---- Đăng tin mới ----
router.post('/', requireAuth, upload.single('image'), (req, res) => {
  const { category, title, description, price, priceUnit, address, area } = req.body;
  if (!category || !title || !address) {
    return res.status(400).json({ error: 'Vui lòng nhập loại hình, tiêu đề và địa chỉ.' });
  }

  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

  const info = db.prepare(`
    INSERT INTO transfers (user_id, category, title, description, price, price_unit, address, area, image_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.user.id, category.trim(), title.trim(), description ? description.trim() : null,
    price ? Number(price) : null, priceUnit || 'trieu', address.trim(),
    area ? Number(area) : null, imagePath
  );

  const row = db.prepare(`
    SELECT transfers.*, users.name AS owner_name FROM transfers
    JOIN users ON users.id = transfers.user_id WHERE transfers.id = ?
  `).get(info.lastInsertRowid);

  res.status(201).json({ transfer: toPublicTransfer(row) });
});

// ---- Sửa tin ----
router.put('/:id', requireAuth, upload.single('image'), (req, res) => {
  const existing = db.prepare('SELECT * FROM transfers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Không tìm thấy tin đăng.' });

  const { category, title, description, price, priceUnit, address, area } = req.body;

  let imagePath = existing.image_path;
  if (req.file) {
    imagePath = `/uploads/${req.file.filename}`;
    if (existing.image_path) {
      const oldFile = path.join(__dirname, '..', 'public', existing.image_path);
      fs.unlink(oldFile, () => {});
    }
  }

  db.prepare(`
    UPDATE transfers SET category = ?, title = ?, description = ?, price = ?, price_unit = ?, address = ?, area = ?, image_path = ?
    WHERE id = ?
  `).run(
    category ? category.trim() : existing.category,
    title ? title.trim() : existing.title,
    description !== undefined ? description.trim() : existing.description,
    price ? Number(price) : existing.price,
    priceUnit || existing.price_unit,
    address ? address.trim() : existing.address,
    area ? Number(area) : existing.area,
    imagePath,
    req.params.id
  );

  const row = db.prepare(`
    SELECT transfers.*, users.name AS owner_name FROM transfers
    JOIN users ON users.id = transfers.user_id WHERE transfers.id = ?
  `).get(req.params.id);

  res.json({ transfer: toPublicTransfer(row) });
});

// ---- Xoá tin ----
router.delete('/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM transfers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Không tìm thấy tin đăng.' });

  db.prepare('DELETE FROM transfers WHERE id = ?').run(req.params.id);

  if (existing.image_path) {
    const filePath = path.join(__dirname, '..', 'public', existing.image_path);
    fs.unlink(filePath, () => {});
  }

  res.json({ ok: true });
});

module.exports = router;
