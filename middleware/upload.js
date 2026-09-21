const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp'];
const VIDEO_EXT = ['.mp4', '.webm', '.mov'];

function userError(message) {
  const e = new Error(message);
  e.userFacing = true; // lỗi này được phép hiển thị nguyên văn cho người dùng
  return e;
}

// Nhận diện loại file thật sự theo "magic bytes" (không tin tên file / Content-Type do client gửi).
function detectKind(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image'; // JPEG
  if (buf.length >= 8 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image'; // PNG
  if (buf.length >= 12 && buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP') return 'image'; // WEBP
  if (buf.length >= 12 && buf.slice(4, 8).toString('latin1') === 'ftyp') return 'video'; // MP4 / MOV
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'video'; // WEBM
  return null;
}

function readHead(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buf = Buffer.alloc(16);
    const n = fs.readSync(fd, buf, 0, 16, 0);
    return buf.slice(0, n);
  } finally {
    fs.closeSync(fd);
  }
}

function removeFile(f) {
  if (f && f.path) fs.unlink(f.path, () => {});
}

// Chạy SAU multer: kiểm tra nội dung thật của file, xoá file nếu sai.
// Đồng thời tự dọn file đã lưu nếu request cuối cùng bị từ chối (4xx/5xx) — tránh file rác.
function guard(req, res, next) {
  const files = req.files || (req.file ? [req.file] : []);
  if (!files.length) return next();

  res.on('finish', () => {
    if (res.statusCode >= 400) files.forEach(removeFile);
  });

  for (const f of files) {
    let kind = null;
    try { kind = detectKind(readHead(f.path)); } catch (e) { kind = null; }
    const claimed = f.mimetype.startsWith('video/') ? 'video' : 'image';
    if (!kind || kind !== claimed) {
      files.forEach(removeFile);
      return res.status(400).json({ error: 'File tải lên không hợp lệ (nội dung không đúng định dạng ảnh/video).' });
    }
  }
  next();
}

// prefix: tiền tố tên file; allowVideo: có cho phép video không; maxFileSize: byte
function create({ prefix, allowVideo = false, maxFileSize = 5 * 1024 * 1024 }) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const isVideo = file.mimetype.startsWith('video/');
      const safeExt = isVideo
        ? (VIDEO_EXT.includes(ext) ? ext : '.mp4')
        : (IMAGE_EXT.includes(ext) ? ext : '.jpg');
      cb(null, `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
    }
  });

  const upload = multer({
    storage,
    limits: { fileSize: maxFileSize, files: 10, fields: 40, fieldSize: 100 * 1024, parts: 60 },
    fileFilter: (req, file, cb) => {
      const okImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
      const okVideo = allowVideo && ['video/mp4', 'video/webm', 'video/quicktime'].includes(file.mimetype);
      if (okImage || okVideo) return cb(null, true);
      cb(userError(allowVideo
        ? 'Chỉ chấp nhận ảnh JPG/PNG/WEBP hoặc video MP4/WEBM/MOV.'
        : 'Chỉ chấp nhận ảnh JPG, PNG hoặc WEBP.'));
    }
  });

  // Trả về mảng middleware [multer, guard] — Express tự "trải phẳng" khi dùng trong router.
  return {
    single: (field) => [upload.single(field), guard],
    array: (field, max) => [upload.array(field, max), guard]
  };
}

module.exports = { create, userError };
