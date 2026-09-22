require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const multer = require('multer');
const path = require('path');

// Nạp middleware/auth sớm để kiểm tra JWT_SECRET ngay khi khởi động (thiếu/yếu → báo lỗi rõ ràng)
require('./middleware/auth');

const authRoutes = require('./routes/auth');
const listingRoutes = require('./routes/listings');
const newsRoutes = require('./routes/news');
const projectRoutes = require('./routes/projects');
const transferRoutes = require('./routes/transfers');
const contactRoutes = require('./routes/contact');
const { normalizeQuery } = require('./lib/validate');
const { csrfGuard } = require('./middleware/csrf');
const { slugPath } = require('./lib/slug');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// ---- Sau reverse proxy (Render, Cloudflare...) phải "tin proxy" thì mới lấy đúng IP thật của khách ----
// Nếu không, mọi khách đều có cùng 1 IP (IP của proxy): giới hạn tốc độ sẽ khoá nhầm tất cả mọi người cùng lúc.
// TRUST_PROXY = số lớp proxy phía trước (Render: 1; Cloudflare + Render: 2). Chạy máy local: bỏ trống.
const trustProxy = process.env.TRUST_PROXY !== undefined ? Number(process.env.TRUST_PROXY) : (isProd ? 1 : 0);
app.set('trust proxy', Number.isFinite(trustProxy) ? trustProxy : 0);

// Dùng bộ đọc query string đơn giản (không qua thư viện `qs`): site chỉ dùng tham số phẳng dạng ?a=1&b=2,
// nên không cần đọc kiểu lồng nhau ?a[b]=1 — bỏ luôn bề mặt tấn công của qs.
app.set('query parser', 'simple');

// ---- Header bảo mật (helmet) + Content-Security-Policy ----
// Trang hiện dùng script/style viết trực tiếp trong HTML nên tạm cho phép 'unsafe-inline';
// vẫn chặn: script từ nguồn ngoài, gửi dữ liệu ra ngoài (connect-src), nhúng trang vào iframe (clickjacking),
// plugin, đổi <base>, gửi form ra ngoài.
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://images.unsplash.com'],
      mediaSrc: ["'self'", 'blob:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      ...(isProd ? { upgradeInsecureRequests: [] } : {})
    }
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: isProd ? { maxAge: 15552000, includeSubDomains: true } : false
}));

// ---- CORS: giao diện và API cùng 1 domain nên KHÔNG cần mở CORS. ----
// Chỉ bật khi bạn liệt kê rõ domain được phép trong ALLOWED_ORIGINS (ngăn cách bằng dấu phẩy).
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
if (allowedOrigins.length) {
  app.use(cors({ origin: allowedOrigins, methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] }));
}

// ---- Giới hạn tốc độ (chống bot dò mật khẩu, spam, cào dữ liệu) ----
const limiterBase = { standardHeaders: true, legacyHeaders: false };
const apiLimiter = rateLimit({ ...limiterBase, windowMs: 15 * 60 * 1000, max: 600, message: { error: 'Bạn gửi quá nhiều yêu cầu, vui lòng thử lại sau ít phút.' } });
const writeLimiter = rateLimit({ ...limiterBase, windowMs: 15 * 60 * 1000, max: 100, message: { error: 'Bạn thao tác quá nhanh, vui lòng thử lại sau.' } });
// Chỉ đếm các lần đăng nhập/đăng ký THẤT BẠI để admin thật không bị khoá vì dùng nhiều
const authLimiter = rateLimit({ ...limiterBase, windowMs: 15 * 60 * 1000, max: 10, skipSuccessfulRequests: true, message: { error: 'Bạn thử quá nhiều lần, vui lòng thử lại sau 15 phút.' } });
const contactLimiter = rateLimit({ ...limiterBase, windowMs: 60 * 60 * 1000, max: 5, message: { error: 'Bạn đã gửi quá nhiều yêu cầu, vui lòng thử lại sau.' } });

// ---- Chặn sớm các đường dẫn mà bot hay dò (WordPress, phpMyAdmin, .env, .git, file backup...) ----
// Các đường này không tồn tại trên site của bạn; trả 404 ngay thay vì trả về trang chủ.
const SCANNER_RE = /(^\/(wp-|wordpress|xmlrpc|phpmyadmin|pma|cgi-bin|vendor\/|actuator|server-status|config\.|\.git|\.env|\.aws|\.ssh|\.ds_store)|\.(php\d?|asp|aspx|jsp|cgi|sql|bak|old|swp|env|ini|log|yml|yaml)$)/i;
app.use((req, res, next) => {
  if (SCANNER_RE.test(req.path)) return res.status(404).end();
  next();
});

// Giới hạn kích thước body: JSON/form nhỏ (ảnh/video đi qua multer, có giới hạn riêng)
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));

// Trang quản trị: không cho công cụ tìm kiếm lập chỉ mục, không lưu cache
app.use((req, res, next) => {
  if (req.path === '/admin.html') {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
});

// ---- Đường dẫn đẹp cho trang chi tiết: /bat-dong-san/ban-can-ho-quan-4-2 (số cuối là mã tin) ----
// Bảng/cột được cố định trong mã (không lấy từ người dùng) nên câu truy vấn an toàn.
const DETAIL = {
  'bat-dong-san': { file: 'listing.html',              table: 'listings',  col: 'title' },
  'sang-nhuong':  { file: 'sang-nhuong-chi-tiet.html', table: 'transfers', col: 'title' },
  'du-an':        { file: 'du-an-chi-tiet.html',       table: 'projects',  col: 'name'  },
  'tin-tuc':      { file: 'tin-tuc-chi-tiet.html',     table: 'news',      col: 'title' }
};
const OLD_PAGES = Object.fromEntries(Object.entries(DETAIL).map(([section, d]) => ['/' + d.file, { section, ...d }]));

function findTitle(d, id) {
  const row = db.prepare(`SELECT ${d.col} AS t FROM ${d.table} WHERE id = ?`).get(id);
  return row ? row.t : null;
}

// Link cũ kiểu /listing.html?id=2 → chuyển vĩnh viễn (301) sang địa chỉ đẹp, link đã chia sẻ vẫn dùng được
app.use((req, res, next) => {
  const d = OLD_PAGES[req.path];
  const id = req.query.id;
  if (req.method === 'GET' && d && typeof id === 'string' && /^\d{1,12}$/.test(id)) {
    const title = findTitle(d, id);
    if (title !== null) return res.redirect(301, `/${d.section}/${slugPath(title, id)}`);
  }
  next();
});

// Phục vụ file tĩnh (giao diện + ảnh đã tải lên)
app.use(express.static(path.join(__dirname, 'public'), {
  dotfiles: 'ignore',
  index: 'index.html',
  setHeaders: (res, filePath) => {
    // File tải lên chỉ để hiển thị ảnh/video — không bao giờ được chạy như một trang web
    if (filePath.includes(`${path.sep}uploads${path.sep}`)) {
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
  }
}));

// ---- API ----
app.use('/api', apiLimiter, normalizeQuery);
// Phản hồi liên quan đăng nhập không bao giờ được lưu cache (trình duyệt/proxy)
app.use('/api/auth', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
// Chống CSRF cho mọi request ghi (POST/PUT/DELETE) — xem middleware/csrf.js
app.use('/api', csrfGuard);
app.use('/api', (req, res, next) => (req.method === 'GET' || req.method === 'HEAD') ? next() : writeLimiter(req, res, next));

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/contact', contactLimiter, contactRoutes);

// API không tồn tại → 404 dạng JSON (không rơi xuống trang chủ)
app.use('/api', (req, res) => res.status(404).json({ error: 'Không tìm thấy.' }));

// Trang chi tiết với địa chỉ đẹp: cùng một file HTML, trang tự đọc mã tin ở cuối địa chỉ
app.get('/:section(bat-dong-san|sang-nhuong|du-an|tin-tuc)/:slug', (req, res, next) => {
  const d = DETAIL[req.params.section];
  const m = /^(?:.*-)?(\d{1,12})$/.exec(req.params.slug);
  if (!d || !m) return next();

  const id = m[1];
  const title = findTitle(d, id);
  const page = path.join(__dirname, 'public', d.file);
  if (title === null) return res.status(404).sendFile(page); // không có tin này → trang tự báo "không tìm thấy"

  // Tiêu đề đã đổi hoặc gõ sai phần chữ → chuyển về địa chỉ chuẩn (1 địa chỉ duy nhất cho mỗi tin, tốt cho Google)
  const canonical = slugPath(title, id);
  if (req.params.slug !== canonical) return res.redirect(301, `/${req.params.section}/${canonical}`);
  res.sendFile(page);
});

// Mọi đường dẫn khác không phải file (không có đuôi mở rộng) → trang chủ; còn lại 404
app.get('*', (req, res) => {
  if (path.extname(req.path)) return res.status(404).send('Not found');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---- Xử lý lỗi chung: KHÔNG lộ chi tiết nội bộ (đường dẫn, câu SQL, stack trace) ra ngoài ----
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof multer.MulterError) {
    const map = {
      LIMIT_FILE_SIZE: 'File quá lớn.',
      LIMIT_FILE_COUNT: 'Bạn tải lên quá nhiều file.',
      LIMIT_UNEXPECTED_FILE: 'File tải lên không hợp lệ.'
    };
    return res.status(400).json({ error: map[err.code] || 'Tải file không thành công.' });
  }
  if (err.userFacing) return res.status(400).json({ error: err.message });

  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Dữ liệu gửi lên quá lớn.' });
  if (err.status && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: 'Yêu cầu không hợp lệ.' });
  }

  console.error(err);
  res.status(500).json({ error: 'Đã có lỗi xảy ra. Vui lòng thử lại sau.' });
});

app.listen(PORT, () => {
  console.log(`✅ Server đang chạy tại http://localhost:${PORT}`);
});
