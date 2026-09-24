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

// ---- Định dạng đơn giản trong nội dung bài viết: ảnh, đậm, nghiêng, gạch dưới ----
// Phải khớp với hàm cùng tên trong lib/ssr.js (phía máy chủ) — sửa 1 bên nhớ sửa bên kia.
window.renderArticleContent = function (raw) {
  const text = String(raw || '');
  const re = /!\[([^\]\n]{0,200})\]\((\/uploads\/[a-zA-Z0-9_.-]+\.(?:jpg|jpeg|png|webp))\)|\*\*([^\n]+?)\*\*|\+\+([^\n]+?)\+\+|\*([^\n*]+?)\*/g;
  let out = '', last = 0, m;
  while ((m = re.exec(text))) {
    out += window.esc(text.slice(last, m.index));
    if (m[1] !== undefined) out += `<img src="${window.esc(m[2])}" alt="${window.esc(m[1])}" loading="lazy">`;
    else if (m[3] !== undefined) out += `<strong>${window.esc(m[3])}</strong>`;
    else if (m[4] !== undefined) out += `<u>${window.esc(m[4])}</u>`;
    else if (m[5] !== undefined) out += `<em>${window.esc(m[5])}</em>`;
    last = re.lastIndex;
  }
  out += window.esc(text.slice(last));
  return out;
};
