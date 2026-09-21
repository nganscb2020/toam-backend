const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { create: createUpload } = require('../middleware/upload');
const { checkFields, checkNumbers, idParam } = require('../lib/validate');

const router = express.Router();

const upload = createUpload({ prefix: 'transfer', maxFileSize: 5 * 1024 * 1024 });

router.param('id', idParam);

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
router.post('/', requireAdmin, upload.single('image'), (req, res) => {
  const { category, title, description, price, priceUnit, address, area } = req.body;
  const bad = checkFields(req.body, { category: [100, 'Loại hình'], title: [200, 'Tiêu đề'], description: [20000, 'Mô tả'], priceUnit: [10, 'Đơn vị giá'], address: [300, 'Địa chỉ'] })
    || checkNumbers(req.body, { price: [0, 1e12, 'Giá'], area: [0, 1e7, 'Diện tích'] });
  if (bad) return res.status(400).json({ error: bad });
  if (priceUnit && !['ty', 'trieu'].includes(priceUnit)) return res.status(400).json({ error: 'Đơn vị giá không hợp lệ.' });
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
router.put('/:id', requireAdmin, upload.single('image'), (req, res) => {
  const existing = db.prepare('SELECT * FROM transfers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Không tìm thấy tin đăng.' });

  const { category, title, description, price, priceUnit, address, area } = req.body;
  const bad = checkFields(req.body, { category: [100, 'Loại hình'], title: [200, 'Tiêu đề'], description: [20000, 'Mô tả'], priceUnit: [10, 'Đơn vị giá'], address: [300, 'Địa chỉ'] })
    || checkNumbers(req.body, { price: [0, 1e12, 'Giá'], area: [0, 1e7, 'Diện tích'] });
  if (bad) return res.status(400).json({ error: bad });
  if (priceUnit && !['ty', 'trieu'].includes(priceUnit)) return res.status(400).json({ error: 'Đơn vị giá không hợp lệ.' });

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
router.delete('/:id', requireAdmin, (req, res) => {
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
