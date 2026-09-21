// Xử lý cookie phiên đăng nhập (không cần thư viện ngoài).
const isProd = process.env.NODE_ENV === 'production';

// Trên production dùng tiền tố "__Host-": trình duyệt chỉ chấp nhận cookie này nếu nó có Secure, Path=/
// và KHÔNG có Domain → subdomain khác hoặc kẻ tấn công không ghi đè/giả mạo được cookie phiên.
// Chạy local (http://localhost) thì dùng tên thường vì không có HTTPS.
const COOKIE_NAME = isProd ? '__Host-toam_session' : 'toam_session';

function parseCookies(header) {
  const out = Object.create(null); // không dính prototype (__proto__, constructor...)
  if (!header || typeof header !== 'string') return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const key = part.slice(0, i).trim();
    let val = part.slice(i + 1).trim();
    if (val.length >= 2 && val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    try { val = decodeURIComponent(val); } catch (e) { continue; }
    if (!(key in out)) out[key] = val; // nếu trùng tên, lấy cái đầu tiên
  }
  return out;
}

function getSessionToken(req) {
  return parseCookies(req.headers.cookie)[COOKIE_NAME] || null;
}

const baseOptions = {
  httpOnly: true,          // JavaScript trên trang KHÔNG đọc được cookie → XSS không lấy trộm được phiên
  secure: isProd,          // chỉ gửi qua HTTPS (production)
  sameSite: 'strict',      // trình duyệt không gửi cookie khi request đến từ trang web khác → chặn CSRF
  path: '/'
};

function setSessionCookie(res, token, expSeconds) {
  const maxAge = Math.max(0, expSeconds * 1000 - Date.now());
  res.cookie(COOKIE_NAME, token, { ...baseOptions, maxAge });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, baseOptions);
}

module.exports = { COOKIE_NAME, parseCookies, getSessionToken, setSessionCookie, clearSessionCookie };
