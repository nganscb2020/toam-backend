require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const listingRoutes = require('./routes/listings');
const newsRoutes = require('./routes/news');
const projectRoutes = require('./routes/projects');
const transferRoutes = require('./routes/transfers');
const contactRoutes = require('./routes/contact');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(helmet({ contentSecurityPolicy: false })); const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'Bạn thử quá nhiều lần, vui lòng thử lại sau 15 phút.' } }); const contactLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: { error: 'Bạn đã gửi quá nhiều yêu cầu, vui lòng thử lại sau.' } });
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Phục vụ file tĩnh (giao diện + ảnh đã tải lên)
app.use(express.static(path.join(__dirname, 'public')));

// API
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/contact', contactLimiter, contactRoutes);

// Xử lý lỗi chung (ví dụ lỗi từ multer khi ảnh quá lớn / sai định dạng)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(400).json({ error: err.message || 'Đã có lỗi xảy ra.' });
});

// Mọi route khác trả về trang chủ (để dùng được điều hướng phía client nếu cần)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Server đang chạy tại http://localhost:${PORT}`);
});
