const { getSessionToken } = require('../lib/cookies');

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_HEADER = 'x-requested-with';
const CSRF_VALUE = 'toam-admin';

// Chống CSRF (kẻ xấu dụ admin bấm vào trang lạ để gửi lệnh xoá/sửa bằng phiên đăng nhập của admin).
// Lớp 1: cookie SameSite=Strict (trình duyệt không gửi cookie từ trang khác).
// Lớp 2 (ở đây): mọi request ghi phải có Origin/Referer trùng đúng domain của website.
// Lớp 3 (ở đây): request ghi có cookie phiên phải kèm header tuỳ chỉnh — trang web khác không thể tự thêm header này
//                khi gọi sang domain của bạn (trình duyệt sẽ chặn vì CORS đang tắt).
function csrfGuard(req, res, next) {
  if (SAFE.has(req.method)) return next();

  const raw = req.get('origin') || req.get('referer');
  let host = null;
  try { host = raw ? new URL(raw).host : null; } catch (e) { host = null; }

  if (!host || host !== req.get('host')) {
    return res.status(403).json({ error: 'Yêu cầu bị từ chối (nguồn gửi không hợp lệ).' });
  }

  // Form liên hệ công khai không dùng phiên đăng nhập nên không bắt buộc header tuỳ chỉnh
  const isPublicContact = req.originalUrl.split('?')[0] === '/api/contact';
  if (!isPublicContact && getSessionToken(req) && req.get(CSRF_HEADER) !== CSRF_VALUE) {
    return res.status(403).json({ error: 'Yêu cầu bị từ chối (thiếu xác thực chống giả mạo).' });
  }
  next();
}

module.exports = { csrfGuard, CSRF_HEADER, CSRF_VALUE };
