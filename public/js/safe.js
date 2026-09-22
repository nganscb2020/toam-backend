// Thoát (escape) ký tự HTML đặc biệt trước khi chèn dữ liệu vào innerHTML / template literal.
// Chặn XSS: dù ai đó nhập <script> hay <img onerror=...> vào tiêu đề/mô tả, trình duyệt chỉ hiển thị như chữ thường.
window.esc = function (value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// ---- Đường dẫn đẹp cho trang chi tiết ----
// Phải khớp với lib/slug.js phía máy chủ.
window.slugify = function (text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
};

// kind: 'listing' | 'transfer' | 'project' | 'news'; item: đối tượng có id và title (dự án dùng name)
window.detailUrl = function (kind, item) {
  const prefix = { listing: '/bat-dong-san/', transfer: '/sang-nhuong/', project: '/du-an/', news: '/tin-tuc/' }[kind];
  const s = window.slugify(item.title || item.name);
  return prefix + (s ? s + '-' : '') + Number(item.id);
};

// Lấy mã tin từ địa chỉ: /bat-dong-san/ban-can-ho-quan-4-2  ->  2   (vẫn hiểu kiểu cũ ?id=2)
window.getDetailId = function () {
  const m = /(\d{1,12})\/?$/.exec(window.location.pathname);
  if (m && window.location.pathname.split('/').filter(Boolean).length >= 2) return m[1];
  return new URLSearchParams(window.location.search).get('id');
};
