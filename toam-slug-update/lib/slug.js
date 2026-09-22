// Tạo "slug" từ tiêu đề tiếng Việt: "Bán căn hộ quận 4" -> "ban-can-ho-quan-4"
// PHẢI khớp với hàm slugify trong public/js/safe.js (phía trình duyệt).
function slugify(text) {
  return String(text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')   // bỏ dấu
    .replace(/đ/g, 'd').replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

// Đường dẫn đẹp: /bat-dong-san/ban-can-ho-quan-4-2  (số cuối là mã tin)
function slugPath(title, id) {
  const s = slugify(title);
  return s ? `${s}-${id}` : String(id);
}

module.exports = { slugify, slugPath };
