const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const VALID_CATEGORIES = ['tin-tuc', 'tu-van-luat', 'thiet-ke-kien-truc'];

const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
    cb(null, `news-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
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

function toPublicNews(row) {
  return {
    id: row.id,
    title: row.title,
    excerpt: row.excerpt,
    content: row.content,
    imagePath: row.image_path,
    category: row.category,
    authorName: row.owner_name,
    createdAt: row.created_at
  };
}

// ---- Danh sách (có lọc theo category + phân trang) ----
// GET /api/news?category=tin-tuc|tu-van-luat|thiet-ke-kien-truc&limit=&offset=
router.get('/', (req, res) => {
  const { category, limit, offset } = req.query;
  const lim = Math.min(Number(limit) || 10, 50);
  const off = Number(offset) || 0;

  let sql = `
    SELECT news.*, users.name AS owner_name FROM news
    JOIN users ON users.id = news.user_id
  `;
  let countSql = 'SELECT COUNT(*) AS total FROM news';
  const params = [];
  const countParams = [];

  if (category && VALID_CATEGORIES.includes(category)) {
    sql += ' WHERE news.category = ?';
    countSql += ' WHERE category = ?';
    params.push(category);
    countParams.push(category);
  }

  sql += ' ORDER BY news.created_at DESC LIMIT ? OFFSET ?';
  params.push(lim, off);

  const rows = db.prepare(sql).all(...params);
  const total = db.prepare(countSql).get(...countParams).total;

  res.json({ news: rows.map(toPublicNews), total, limit: lim, offset: off });
});

// ---- Chi tiết 1 bài ----
router.get('/:id', (req, res) => {
  const row = db.prepare(`
    SELECT news.*, users.name AS owner_name FROM news
    JOIN users ON users.id = news.user_id
    WHERE news.id = ?
  `).get(req.params.id);

  if (!row) return res.status(404).json({ error: 'Không tìm thấy bài viết.' });
  res.json({ news: toPublicNews(row) });
});

// ---- Đăng bài mới ----
router.post('/', requireAuth, upload.single('image'), (req, res) => {
  const { title, excerpt, content, category } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'Vui lòng nhập tiêu đề và nội dung bài viết.' });
  }
  const finalCategory = VALID_CATEGORIES.includes(category) ? category : 'tin-tuc';

  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

  const info = db.prepare(`
    INSERT INTO news (user_id, title, excerpt, content, image_path, category)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.user.id, title.trim(), excerpt ? excerpt.trim() : null, content.trim(), imagePath, finalCategory);

  const row = db.prepare(`
    SELECT news.*, users.name AS owner_name FROM news
    JOIN users ON users.id = news.user_id WHERE news.id = ?
  `).get(info.lastInsertRowid);

  res.status(201).json({ news: toPublicNews(row) });
});

// ---- Sửa bài ----
router.put('/:id', requireAuth, upload.single('image'), (req, res) => {
  const existing = db.prepare('SELECT * FROM news WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Không tìm thấy bài viết.' });

  const { title, excerpt, content, category } = req.body;

  let imagePath = existing.image_path;
  if (req.file) {
    imagePath = `/uploads/${req.file.filename}`;
    if (existing.image_path) {
      const oldFile = path.join(__dirname, '..', 'public', existing.image_path);
      fs.unlink(oldFile, () => {});
    }
  }

  db.prepare(`
    UPDATE news SET title = ?, excerpt = ?, content = ?, image_path = ?, category = ? WHERE id = ?
  `).run(
    title ? title.trim() : existing.title,
    excerpt !== undefined ? excerpt.trim() : existing.excerpt,
    content ? content.trim() : existing.content,
    imagePath,
    VALID_CATEGORIES.includes(category) ? category : existing.category,
    req.params.id
  );

  const row = db.prepare(`
    SELECT news.*, users.name AS owner_name FROM news
    JOIN users ON users.id = news.user_id WHERE news.id = ?
  `).get(req.params.id);

  res.json({ news: toPublicNews(row) });
});

// ---- Xoá bài ----
router.delete('/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT * FROM news WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Không tìm thấy bài viết.' });

  db.prepare('DELETE FROM news WHERE id = ?').run(req.params.id);

  if (existing.image_path) {
    const filePath = path.join(__dirname, '..', 'public', existing.image_path);
    fs.unlink(filePath, () => {});
  }

  res.json({ ok: true });
});

module.exports = router;
