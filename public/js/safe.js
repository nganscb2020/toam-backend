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
