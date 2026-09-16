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
    cb(null, `project-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
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

function toPublicProject(row) {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    description: row.description,
    imagePath: row.image_path,
    authorName: row.owner_name,
    createdAt: row.created_at
  };
}

// ---- Danh sách dự án (phân trang) ----
router.get('/', (req, res) => {
  const { limit, offset } = req.query;
  const lim = Math.min(Number(limit) || 10, 50);
  const off = Number(offset) || 0;

  const rows = db.prepare(`
    SELECT projects.*, users.name AS owner_name FROM projects
    JOIN users ON users.id = projects.user_id
    ORDER BY projects.created_at DESC
    LIMIT ? OFFSET ?
  `).all(lim, off);

  const total = db.prepare('SELECT COUNT(*) AS total FROM projects').get().total;

  res.json({ projects: rows.map(toPublicProject), total, limit: lim, offset: off });
});

// ---- Chi tiết 1 dự án ----
router.get('/:id', (req, res) => {
  const row = db.prepare(`
    SELECT projects.*, users.name AS owner_name FROM projects
    JOIN users ON users.id = projects.user_id
    WHERE projects.id = ?
  `).get(req.params.id);

  if (!row) return res.status(404).json({ error: 'Không tìm thấy dự án.' });
  res.json({ project: toPublicProject(row) });
});

// ---- Đăng dự án mới ----
router.post('/', requireAuth, upload.single('image'), (req, res) => {
  const { name, location, description } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Vui lòng nhập tên dự án.' });
  }

  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

  const info = db.prepare(`
    INSERT INTO projects (user_id, name, location, description, image_path)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.user.id, name.trim(), location ? location.trim() : null, description ? description.trim() : null, imagePath);

  const row = db.prepare(`
    SELECT projects.*, users.name AS owner_name FROM projects
    JOIN users ON users.id = projects.user_id WHERE projects.id = ?
  `).get(info.lastInsertRowid);

  res.status(201).json({ project: toPublicProject(row) });
});

// ---- Sửa dự án ----
router.put('/:id', requireAuth, upload.single('image'), (req, res) => {
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Không tìm thấy dự án.' });

  const { name, location, description } = req.body;

  let imagePath = existing.image_path;
  if (req.file) {
    imagePath = `/uploads/${req.file.filename}`;
    if (existing.image_path) {
      const oldFile = path.join(__dirname, '..', 'public', existing.image_path);
      fs.unlink(oldFile, () => {});
    }
  }

  db.prepare(`
    UPDATE projects SET name = ?, location = ?, description = ?, image_path = ? WHERE id = ?
  `).run(
    name ? name.trim() : existing.name,
    location !== undefined ? location.trim() : existing.location,
    description !== undefined ? description.trim() : existing.description,
    imagePath,
    req.params.id
  );

  const row = db.prepare(`
    SELECT projects.*, users.name AS owner_name FROM projects
    JOIN users ON users.id = projects.user_id WHERE projects.id = ?
  `).get(req.params.id);

  res.json({ project: toPublicProject(row) });
});

// ---- Xoá dự án ----
router.delete('/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Không tìm thấy dự án.' });

  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);

  if (existing.image_path) {
    const filePath = path.join(__dirname, '..', 'public', existing.image_path);
    fs.unlink(filePath, () => {});
  }

  res.json({ ok: true });
});

module.exports = router;
