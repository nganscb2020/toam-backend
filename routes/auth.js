const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, phone: user.phone };
}

// Đăng ký (chỉ dùng để tạo tài khoản admin đầu tiên — cần đúng mã thiết lập)
router.post('/register', (req, res) => {
  const { name, email, phone, password, setupKey } = req.body;

  const requiredKey = process.env.ADMIN_SETUP_KEY;
  if (requiredKey && setupKey !== requiredKey) {
    return res.status(403).json({ error: 'Mã thiết lập không đúng. Chỉ quản trị viên mới được tạo tài khoản.' });
  }

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ họ tên, email và mật khẩu.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Mật khẩu cần ít nhất 6 ký tự.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (existing) {
    return res.status(409).json({ error: 'Email này đã được đăng ký.' });
  }

  const password_hash = bcrypt.hashSync(password, 10);
  const info = db.prepare(
    'INSERT INTO users (name, email, phone, password_hash) VALUES (?, ?, ?, ?)'
  ).run(name.trim(), email.toLowerCase().trim(), phone || null, password_hash);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  const token = signToken(user);
  res.status(201).json({ token, user: publicUser(user) });
});

// Đăng nhập
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng.' });
  }

  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

// Lấy thông tin tài khoản đang đăng nhập
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
  res.json({ user: publicUser(user) });
});

module.exports = router;
