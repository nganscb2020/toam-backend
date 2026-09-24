const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireAuth, loadUser, extractToken, JWT_SECRET, JWT_EXPIRES } = require('../middleware/auth');
const { setSessionCookie, clearSessionCookie } = require('../lib/cookies');

const router = express.Router();
const BCRYPT_COST = 12;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Băm giả dùng khi email không tồn tại → thời gian phản hồi giống nhau, không dò được email nào có thật.
const DUMMY_HASH = bcrypt.hashSync('khong-phai-mat-khau-that', BCRYPT_COST);

// ---- Khoá tạm theo email khi nhập sai nhiều lần (bổ sung cho giới hạn theo IP) ----
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const fails = new Map(); // email -> { count, until, last }
const MAX_TRACKED = 10000;

function isLocked(email) {
  const f = fails.get(email);
  return !!(f && f.until && f.until > Date.now());
}
function recordFail(email) {
  const f = fails.get(email) || { count: 0, until: 0, last: 0 };
  f.count += 1;
  f.last = Date.now();
  if (f.count >= MAX_FAILS) { f.until = Date.now() + LOCK_MS; f.count = 0; }
  if (!fails.has(email) && fails.size >= MAX_TRACKED) fails.delete(fails.keys().next().value); // chặn phình bộ nhớ
  fails.set(email, f);
}
// Dọn các bản ghi đã cũ (quá 15 phút không có lần sai mới và không còn bị khoá)
setInterval(() => {
  const now = Date.now();
  for (const [k, f] of fails) {
    if (now - f.last > LOCK_MS && (!f.until || f.until < now)) fails.delete(k);
  }
}, 10 * 60 * 1000).unref();

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, v: user.token_version || 0 },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES, algorithm: 'HS256' }
  );
}

// Tạo token và đặt vào cookie HttpOnly. Token KHÔNG được trả về trong nội dung phản hồi
// (JavaScript trên trang không bao giờ nhìn thấy nó).
function startSession(res, user) {
  const token = signToken(user);
  setSessionCookie(res, token, jwt.decode(token).exp);
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role };
}

// Đăng ký — CHỈ để tạo tài khoản admin đầu tiên.
// - Bắt buộc phải đặt ADMIN_SETUP_KEY trong .env (không đặt = tắt hẳn chức năng này).
// - Sau khi đã có tài khoản, tự khoá lại (trừ khi bật ALLOW_MORE_ADMINS=true).
router.post('/register', async (req, res) => {
  try {
    const { name, email, phone, password, setupKey } = req.body || {};

    const requiredKey = process.env.ADMIN_SETUP_KEY;
    if (!requiredKey) {
      return res.status(403).json({ error: 'Chức năng tạo tài khoản đang tắt.' });
    }
    if (typeof setupKey !== 'string' || !safeEqual(setupKey, requiredKey)) {
      return res.status(403).json({ error: 'Mã thiết lập không đúng. Chỉ quản trị viên mới được tạo tài khoản.' });
    }

    const existingCount = (await db.get('SELECT COUNT(*) AS c FROM users')).c;
    if (existingCount > 0 && process.env.ALLOW_MORE_ADMINS !== 'true') {
      return res.status(403).json({ error: 'Tài khoản quản trị đã được tạo. Vui lòng đăng nhập.' });
    }

    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string' || !name.trim() || !email.trim() || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập đầy đủ họ tên, email và mật khẩu.' });
    }
    if (name.length > 100 || email.length > 150 || (phone && String(phone).length > 30)) {
      return res.status(400).json({ error: 'Thông tin nhập vào quá dài.' });
    }
    const cleanEmail = email.toLowerCase().trim();
    if (!EMAIL_RE.test(cleanEmail)) {
      return res.status(400).json({ error: 'Email không hợp lệ.' });
    }
    if (password.length < 10 || password.length > 128) {
      return res.status(400).json({ error: 'Mật khẩu cần từ 10 đến 128 ký tự.' });
    }

    const existing = await db.get('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existing) {
      return res.status(409).json({ error: 'Email này đã được đăng ký.' });
    }

    const password_hash = await bcrypt.hash(password, BCRYPT_COST);
    const info = await db.run(
      "INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'admin')",
      [name.trim(), cleanEmail, phone ? String(phone).trim() : null, password_hash]
    );

    const user = await db.get('SELECT * FROM users WHERE id = ?', [info.lastInsertRowid]);
    startSession(res, user);
    res.status(201).json({ user: publicUser(user) });
  } catch (err) {
    console.error('register error:', err);
    res.status(500).json({ error: 'Đã có lỗi xảy ra.' });
  }
});

// Đăng nhập
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return res.status(400).json({ error: 'Vui lòng nhập email và mật khẩu.' });
    }
    if (email.length > 150 || password.length > 128) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    if (isLocked(cleanEmail)) {
      return res.status(429).json({ error: 'Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.' });
    }

    const user = await db.get('SELECT * FROM users WHERE email = ?', [cleanEmail]);
    const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) {
      recordFail(cleanEmail);
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng.' });
    }

    fails.delete(cleanEmail);
    startSession(res, user);
    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'Đã có lỗi xảy ra.' });
  }
});

// Đăng xuất: xoá cookie VÀ thu hồi phía server (tăng token_version) → token cũ dù bị sao chép cũng vô dụng.
// Lưu ý: thu hồi này áp dụng cho mọi thiết bị đang đăng nhập bằng tài khoản đó.
router.post('/logout', async (req, res) => {
  try {
    const token = extractToken(req);
    if (token) {
      try {
        const user = await loadUser(token);
        await db.run('UPDATE users SET token_version = token_version + 1 WHERE id = ?', [user.id]);
      } catch (e) { /* token đã hết hạn/không hợp lệ: chỉ cần xoá cookie */ }
    }
  } catch (err) {
    console.error('logout error:', err);
  }
  clearSessionCookie(res);
  res.json({ ok: true });
});

// Lấy thông tin tài khoản đang đăng nhập
router.get('/me', requireAuth, async (req, res) => {
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
  res.json({ user: publicUser(user) });
});

module.exports = router;
