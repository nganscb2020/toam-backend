const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'doi-chuoi-bi-mat-nay-truoc-khi-len-production';

// Bắt buộc phải đăng nhập mới đi tiếp được
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Bạn cần đăng nhập để thực hiện thao tác này.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, name, email }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.' });
  }
}

// Không bắt buộc, nhưng nếu có token hợp lệ thì gắn req.user vào
function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      // token hỏng thì bỏ qua, coi như khách chưa đăng nhập
    }
  }
  next();
}

module.exports = { requireAuth, optionalAuth, JWT_SECRET };
