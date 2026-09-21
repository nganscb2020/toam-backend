const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const { getSessionToken } = require('../lib/cookies');

// ---- JWT_SECRET: bắt buộc phải là chuỗi bí mật dài, ngẫu nhiên ----
// Không còn giá trị mặc định trong mã nguồn (ai đọc code trên GitHub cũng biết → giả mạo được đăng nhập).
const KNOWN_WEAK = ['doi-chuoi-bi-mat-nay-truoc-khi-len-production'];
let JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32 || KNOWN_WEAK.includes(JWT_SECRET)) {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ JWT_SECRET chưa đặt, quá ngắn (<32 ký tự) hoặc đang dùng giá trị mẫu. Từ chối khởi động để đảm bảo an toàn.');
    console.error('   Tạo chuỗi mới bằng: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
    process.exit(1);
  }
  JWT_SECRET = crypto.randomBytes(48).toString('hex');
  console.warn('⚠️  JWT_SECRET chưa đặt hợp lệ — dùng khoá ngẫu nhiên tạm thời (đăng nhập sẽ mất khi khởi động lại). Hãy đặt JWT_SECRET trong .env.');
}

const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

// Token chỉ được đọc từ cookie HttpOnly (không còn nhận qua header Authorization / localStorage).
function extractToken(req) {
  return getSessionToken(req);
}

// Xác minh token VÀ kiểm tra tài khoản còn tồn tại, còn đúng phiên bản token (chưa bị thu hồi khi đăng xuất).
function loadUser(token) {
  const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
  const user = db.prepare('SELECT id, name, email, role, token_version FROM users WHERE id = ?').get(payload.id);
  if (!user) throw new Error('user not found');
  if ((payload.v || 0) !== user.token_version) throw new Error('token revoked');
  return user;
}

// Bắt buộc phải đăng nhập mới đi tiếp được
function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Bạn cần đăng nhập để thực hiện thao tác này.' });
  }
  try {
    req.user = loadUser(token);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.' });
  }
}

// Bắt buộc phải là admin (mọi thao tác đăng/sửa/xoá nội dung đều dùng cái này)
function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này.' });
    }
    next();
  });
}

// Không bắt buộc, nhưng nếu có token hợp lệ thì gắn req.user vào
function optionalAuth(req, res, next) {
  const token = extractToken(req);
  if (token) {
    try { req.user = loadUser(token); } catch (err) { /* token hỏng → coi như khách */ }
  }
  next();
}

module.exports = { requireAuth, requireAdmin, optionalAuth, loadUser, extractToken, JWT_SECRET, JWT_EXPIRES };
