// Tải ảnh dùng để chèn TRỰC TIẾP vào nội dung bài viết (khác với ảnh đại diện/ảnh bìa của
// tin đăng/dự án/bài viết, vốn đã có endpoint riêng ở mỗi route). Chỉ admin mới gọi được.
const express = require('express');
const { requireAdmin } = require('../middleware/auth');
const { create: createUpload } = require('../middleware/upload');

const router = express.Router();
const upload = createUpload({ prefix: 'content', maxFileSize: 5 * 1024 * 1024 });

router.post('/upload', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Vui lòng chọn 1 ảnh.' });
  res.status(201).json({ path: `/uploads/${req.file.filename}` });
});

module.exports = router;
