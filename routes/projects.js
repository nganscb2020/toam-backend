const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { create: createUpload } = require('../middleware/upload');
const { checkFields, checkNumbers, idParam } = require('../lib/validate');

const router = express.Router();

const upload = createUpload({ prefix: 'project', maxFileSize: 5 * 1024 * 1024 });

router.param('id', idParam);

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
router.get('/', async (req, res) => {
  const { limit, offset } = req.query;
  const lim = Math.min(Number(limit) || 10, 50);
  const off = Number(offset) || 0;

  const rows = await db.all(`
    SELECT projects.*, users.name AS owner_name FROM projects
    JOIN users ON users.id = projects.user_id
    ORDER BY projects.created_at DESC
    LIMIT ? OFFSET ?
  `, [lim, off]);

  const total = (await db.get('SELECT COUNT(*) AS total FROM projects')).total;

  res.json({ projects: rows.map(toPublicProject), total, limit: lim, offset: off });
});

// ---- Chi tiết 1 dự án ----
router.get('/:id', async (req, res) => {
  const row = await db.get(`
    SELECT projects.*, users.name AS owner_name FROM projects
    JOIN users ON users.id = projects.user_id
    WHERE projects.id = ?
  `, [req.params.id]);

  if (!row) return res.status(404).json({ error: 'Không tìm thấy dự án.' });
  res.json({ project: toPublicProject(row) });
});

// ---- Đăng dự án mới ----
router.post('/', requireAdmin, upload.single('image'), async (req, res) => {
  const { name, location, description } = req.body;
  const bad = checkFields(req.body, { name: [200, 'Tên dự án'], location: [300, 'Vị trí'], description: [20000, 'Mô tả'] });
  if (bad) return res.status(400).json({ error: bad });
  if (!name) {
    return res.status(400).json({ error: 'Vui lòng nhập tên dự án.' });
  }

  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

  const info = await db.run(`
    INSERT INTO projects (user_id, name, location, description, image_path)
    VALUES (?, ?, ?, ?, ?)
  `, [req.user.id, name.trim(), location ? location.trim() : null, description ? description.trim() : null, imagePath]);

  const row = await db.get(`
    SELECT projects.*, users.name AS owner_name FROM projects
    JOIN users ON users.id = projects.user_id WHERE projects.id = ?
  `, [info.lastInsertRowid]);

  res.status(201).json({ project: toPublicProject(row) });
});

// ---- Sửa dự án ----
router.put('/:id', requireAdmin, upload.single('image'), async (req, res) => {
  const existing = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Không tìm thấy dự án.' });

  const { name, location, description } = req.body;
  const bad = checkFields(req.body, { name: [200, 'Tên dự án'], location: [300, 'Vị trí'], description: [20000, 'Mô tả'] });
  if (bad) return res.status(400).json({ error: bad });

  let imagePath = existing.image_path;
  if (req.file) {
    imagePath = `/uploads/${req.file.filename}`;
    if (existing.image_path) {
      const oldFile = path.join(__dirname, '..', 'public', existing.image_path);
      fs.unlink(oldFile, () => {});
    }
  }

  await db.run(`
    UPDATE projects SET name = ?, location = ?, description = ?, image_path = ? WHERE id = ?
  `, [
    name ? name.trim() : existing.name,
    location !== undefined ? location.trim() : existing.location,
    description !== undefined ? description.trim() : existing.description,
    imagePath,
    req.params.id
  ]);

  const row = await db.get(`
    SELECT projects.*, users.name AS owner_name FROM projects
    JOIN users ON users.id = projects.user_id WHERE projects.id = ?
  `, [req.params.id]);

  res.json({ project: toPublicProject(row) });
});

// ---- Xoá dự án ----
router.delete('/:id', requireAdmin, async (req, res) => {
  const existing = await db.get('SELECT * FROM projects WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Không tìm thấy dự án.' });

  await db.run('DELETE FROM projects WHERE id = ?', [req.params.id]);

  if (existing.image_path) {
    const filePath = path.join(__dirname, '..', 'public', existing.image_path);
    fs.unlink(filePath, () => {});
  }

  res.json({ ok: true });
});

module.exports = router;
