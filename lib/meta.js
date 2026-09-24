// Tạo thẻ meta (Open Graph, Twitter Card) để link hiện đẹp khi dán vào Zalo, Facebook, Messenger...
// Các mạng xã hội đọc HTML thô, KHÔNG chạy JavaScript của trang, nên các thẻ này phải được
// chèn sẵn từ phía máy chủ (không thể chỉ set bằng document.title/JS như trang đang làm).

function escAttr(v) {
  return String(v === null || v === undefined ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Bỏ thẻ HTML còn sót lại trong nội dung tin tức, rút gọn về đoạn mô tả ngắn.
function toDescription(text, max = 200) {
  const clean = String(text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + '…' : clean;
}

// Chuyển 1 hoặc nhiều object thành thẻ <script type="application/ld+json">.
// Thay "<" bằng "\\u003c" để phòng trường hợp mô tả tin chứa chữ "</script>" làm đóng thẻ sớm
// (JSON.stringify tự escape dấu ngoặc kép/xuống dòng, nhưng KHÔNG tự escape dấu "<").
function jsonLdScripts(items) {
  return (items || []).filter(Boolean)
    .map(obj => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`)
    .join('\n');
}

// html: nội dung file .html gốc; meta: { title, description, image, url, type, jsonLd? }
// jsonLd: 1 object hoặc mảng object (schema.org) — xem lib/schema.js
function injectMeta(html, meta) {
  const block = `<title>${escAttr(meta.title)}</title>
<meta name="description" content="${escAttr(meta.description)}">
<link rel="canonical" href="${escAttr(meta.url)}">
<meta property="og:type" content="${meta.type || 'website'}">
<meta property="og:site_name" content="${escAttr(meta.siteName || 'BDSCHÍNHCHỦHCM')}">
<meta property="og:locale" content="vi_VN">
<meta property="og:title" content="${escAttr(meta.title)}">
<meta property="og:description" content="${escAttr(meta.description)}">
<meta property="og:image" content="${escAttr(meta.image)}">
${meta.imageType ? `<meta property="og:image:type" content="${escAttr(meta.imageType)}">\n` : ''}<meta property="og:url" content="${escAttr(meta.url)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escAttr(meta.title)}">
<meta name="twitter:description" content="${escAttr(meta.description)}">
<meta name="twitter:image" content="${escAttr(meta.image)}">
${jsonLdScripts(Array.isArray(meta.jsonLd) ? meta.jsonLd : [meta.jsonLd])}`;

  // Xoá <title> có sẵn trong file (nếu có) để không bị trùng, rồi chèn khối thẻ mới
  let out = html.replace(/<title>[\s\S]*?<\/title>\s*/i, '');
  if (/<base\s/i.test(out)) {
    out = out.replace(/(<base\s[^>]*>)/i, `$1\n${block}\n`);
  } else if (/<meta charset="UTF-8">/i.test(out)) {
    out = out.replace(/(<meta charset="UTF-8">)/i, `$1\n${block}\n`);
  } else {
    out = out.replace(/<head[^>]*>/i, (m) => `${m}\n${block}\n`);
  }
  return out;
}

module.exports = { injectMeta, toDescription, escAttr, jsonLdScripts };
