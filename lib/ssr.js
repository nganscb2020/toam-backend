// Dựng sẵn phần nội dung chính của trang chi tiết (ảnh, tiêu đề, giá, mô tả...) ngay trong HTML
// gửi về từ máy chủ — thay vì để trống rồi chờ JavaScript tải dữ liệu và điền vào sau.
//
// Lý do: Google (và các công cụ khác) đọc HTML thô trước, JavaScript chạy sau và có thể bị
// trì hoãn hoặc bỏ qua với site chưa có nhiều uy tín. Nội dung nằm sẵn trong HTML gốc được
// đọc chắc chắn và nhanh hơn.
//
// Các hàm ở đây PHẢI dựng ra đúng cấu trúc HTML mà JavaScript phía trình duyệt (trong các file
// public/*.html) vẫn đang tự dựng — cùng class CSS, cùng id — để không có gì thay đổi hay
// "giật" khi JavaScript chạy tiếp sau đó.

const { escAttr } = require('./meta');
const esc = escAttr; // escAttr thực chất là escape HTML nói chung (&<>"'), dùng được cho cả text lẫn attribute

function vnNumber(n) {
  return Number(n).toLocaleString('vi-VN');
}

function dateShort(sqliteDt) {
  if (!sqliteDt) return '';
  const d = new Date(sqliteDt.replace(' ', 'T') + 'Z');
  return isNaN(d) ? '' : d.toLocaleDateString('vi-VN');
}

function dateLong(sqliteDt) {
  if (!sqliteDt) return '';
  const d = new Date(sqliteDt.replace(' ', 'T') + 'Z');
  return isNaN(d) ? '' : d.toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ---- Tin mua bán / cho thuê (bảng listings) ----
const LISTING_FALLBACK_IMG = 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&q=70';

function listingPrice(row) {
  const n = vnNumber(row.price);
  return row.price_unit === 'trieu' ? `${n} triệu/tháng` : `${n} tỷ`;
}

// media: mảng từ bảng listing_media, dạng [{ type: 'image'|'video', path }]
function renderListingBody(row, media) {
  const typeLabel = row.listing_type === 'rent' ? 'Cho thuê' : 'Bán';
  const gallery = (media && media.length) ? media
    : (row.image_path ? [{ type: 'image', path: row.image_path }] : [{ type: 'image', path: LISTING_FALLBACK_IMG }]);

  const factsExtra = [];
  if (row.bedrooms) factsExtra.push(`<div><div class="v">${row.bedrooms}</div><div class="l">Phòng ngủ</div></div>`);
  if (row.bathrooms) factsExtra.push(`<div><div class="v">${row.bathrooms}</div><div class="l">Phòng vệ sinh</div></div>`);
  if (row.area) factsExtra.push(`<div><div class="v">${row.area} m²</div><div class="l">Diện tích</div></div>`);
  factsExtra.push(`<div><div class="v">${esc(row.category)}</div><div class="l">Loại hình</div></div>`);

  const thumbStrip = gallery.length > 1 ? `
    <div class="thumb-strip" id="thumbStrip">
      ${gallery.map((m, i) => `
        <div class="thumb-item${i === 0 ? ' active' : ''}" data-index="${i}">
          ${m.type === 'video'
            ? `<video src="${esc(m.path)}" muted></video><span class="play-badge">▶</span>`
            : `<img src="${esc(m.path)}" alt="">`}
        </div>
      `).join('')}
    </div>` : '';

  return `
    <div class="detail-grid">
      <div class="detail-main">
        <div class="detail-image" id="mainMedia">
          <span class="type-tag ${esc(row.listing_type)}">${typeLabel}</span>
          ${gallery[0].type === 'video'
            ? `<video src="${esc(gallery[0].path)}" controls></video>`
            : `<img src="${esc(gallery[0].path)}" alt="${esc(row.title)}">`}
        </div>
        ${thumbStrip}
        <div class="detail-body">
          <h1>${esc(row.title)}</h1>
          <div class="detail-price-row">
            <div class="detail-price">${listingPrice(row)}</div>
            <div class="detail-addr">📍 ${esc(row.address)}</div>
          </div>
          <div class="detail-facts">${factsExtra.join('')}</div>
          <div class="detail-desc">
            <h3>Mô tả chi tiết</h3>
            <p>${esc(row.description || 'Liên hệ với chúng tôi để biết thêm chi tiết về bất động sản này.')}</p>
          </div>
          <div class="detail-meta-footer">
            <span>📅 Đăng ngày: ${dateShort(row.created_at)}</span>
            <span>Mã tin: #${row.id}</span>
          </div>
        </div>
      </div>
      <aside>
        <div class="contact-box">
          <h3>Liên hệ tư vấn</h3>
          <div class="owner">Môi giới phụ trách: <b>${esc(row.owner_name || 'Tổ Ấm')}</b></div>
          <a href="tel:0902312009" class="btn-call">📞 Gọi hotline: 090 231 2009</a>
          <a href="index.html#lien-he" class="btn-zalo">Gửi yêu cầu tư vấn</a>
        </div>
        <div class="side-note">
          <b>Lưu ý:</b> Thông tin trên do đội ngũ Tổ Ấm khảo sát và cập nhật. Vui lòng liên hệ hotline để xác nhận tình trạng mới nhất trước khi đến xem trực tiếp.
        </div>
      </aside>
    </div>`;
}

function listingBreadcrumbType(row) {
  const typeLabel = row.listing_type === 'rent' ? 'Cho thuê' : 'Bán';
  const anchor = row.listing_type === 'rent' ? 'tin-thue' : 'tin-ban';
  return `<a href="index.html#${anchor}">${typeLabel} ${esc((row.category || '').toLowerCase())}</a>`;
}

// ---- Tin sang nhượng (bảng transfers) ----
const TRANSFER_FALLBACK_IMG = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=70';

function transferPrice(row) {
  if (!row.price) return 'Liên hệ';
  const n = vnNumber(row.price);
  return row.price_unit === 'trieu' ? `${n} triệu` : `${n} tỷ`;
}

function renderTransferBody(row) {
  return `
    <div class="detail-grid">
      <div class="detail-main">
        <div class="detail-image"><img src="${esc(row.image_path || TRANSFER_FALLBACK_IMG)}" alt="${esc(row.title)}"></div>
        <div class="detail-body">
          <h1>${esc(row.title)}</h1>
          <div class="detail-price-row">
            <div class="detail-price">${transferPrice(row)}</div>
            <div class="detail-addr">📍 ${esc(row.address)}</div>
          </div>
          <div class="detail-facts">
            <div><div class="v">${esc(row.category)}</div><div class="l">Loại hình</div></div>
            ${row.area ? `<div><div class="v">${row.area} m²</div><div class="l">Diện tích</div></div>` : ''}
            <div><div class="v">${dateShort(row.created_at)}</div><div class="l">Ngày đăng</div></div>
          </div>
          <div class="detail-desc">
            <h3>Mô tả chi tiết</h3>
            <p>${esc(row.description || 'Liên hệ với chúng tôi để biết thêm chi tiết.')}</p>
          </div>
        </div>
      </div>
      <aside>
        <div class="contact-box">
          <h3>Liên hệ tư vấn</h3>
          <div class="owner">Người đăng: <b>${esc(row.owner_name || 'Tổ Ấm')}</b></div>
          <a href="tel:0902312009" class="btn-call">📞 Gọi hotline: 090 231 2009</a>
        </div>
        <div class="side-box">
          <div class="side-box-head"><span class="dot"></span><h3>Tin khác</h3></div>
          <div id="otherTransfers"></div>
        </div>
      </aside>
    </div>`;
}

// ---- Dự án (bảng projects) ----
const PROJECT_FALLBACK_IMG = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=70';

function renderProjectBody(row) {
  return `
    <div class="article-grid">
      <div class="article-main">
        <div class="article-cover"><img src="${esc(row.image_path || PROJECT_FALLBACK_IMG)}" alt="${esc(row.name)}"></div>
        <div class="article-body">
          <h1>${esc(row.name)}</h1>
          <div class="article-meta">
            ${row.location ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> ${esc(row.location)}` : ''}
            <span>📅 Cập nhật: ${dateLong(row.created_at)}</span>
          </div>
          <div class="article-content">${esc(row.description || 'Liên hệ với chúng tôi để biết thêm chi tiết về dự án này.')}</div>
        </div>
      </div>
      <aside>
        <div class="contact-box" style="margin-bottom:22px;">
          <h3>Quan tâm dự án này?</h3>
          <a href="tel:0902312009" class="btn-call">📞 Gọi hotline: 090 231 2009</a>
        </div>
        <div class="side-box">
          <div class="side-box-head"><span class="dot"></span><h3>Dự án khác</h3></div>
          <div id="otherProjects"></div>
        </div>
      </aside>
    </div>`;
}

// Định dạng đơn giản cho phép gõ trong ô "Nội dung đầy đủ" của bài viết, và nút bấm trên
// trang quản trị tự chèn đúng cú pháp này (người dùng không cần tự nhớ/tự gõ):
//   ![mô tả](/uploads/xxx.jpg)   -> ảnh (CHỈ nhận ảnh do chính hệ thống tải lên, xem lý do bên dưới)
//   **chữ**                     -> in đậm
//   *chữ*                       -> in nghiêng
//   ++chữ++                     -> gạch dưới
// Đây KHÔNG phải trình đọc Markdown đầy đủ — chỉ nhận diện đúng 4 cú pháp trên, không lồng được
// vào nhau (ví dụ không vừa đậm vừa nghiêng cùng lúc), đủ dùng cho một bài viết tin tức thông thường.
// CHỈ ảnh từ "/uploads/..." do chính hệ thống tải lên mới được chèn — không cho nhúng ảnh hay bất cứ
// thứ gì từ nơi khác, để không ai lợi dụng ô nội dung nhét mã độc/link lạ vào.
// PHẢI khớp với hàm cùng tên trong public/js/safe.js (phía trình duyệt) — sửa 1 bên nhớ sửa bên kia.
const CONTENT_TOKEN_RE =
  /!\[([^\]\n]{0,200})\]\((\/uploads\/[a-zA-Z0-9_.-]+\.(?:jpg|jpeg|png|webp))\)|\*\*([^\n]+?)\*\*|\+\+([^\n]+?)\+\+|\*([^\n*]+?)\*/g;

function renderArticleContent(raw) {
  const text = String(raw || '');
  CONTENT_TOKEN_RE.lastIndex = 0;
  let out = '', last = 0, m;
  while ((m = CONTENT_TOKEN_RE.exec(text))) {
    out += esc(text.slice(last, m.index));
    if (m[1] !== undefined) out += `<img src="${esc(m[2])}" alt="${esc(m[1])}" loading="lazy">`;
    else if (m[3] !== undefined) out += `<strong>${esc(m[3])}</strong>`;
    else if (m[4] !== undefined) out += `<u>${esc(m[4])}</u>`;
    else if (m[5] !== undefined) out += `<em>${esc(m[5])}</em>`;
    last = CONTENT_TOKEN_RE.lastIndex;
  }
  out += esc(text.slice(last));
  return out;
}

// ---- Tin tức (bảng news) ----
const NEWS_CATEGORY_LABELS = {
  'tin-tuc': { name: 'Tin tức', anchor: 'index.html#tin-tuc-block' },
  'tu-van-luat': { name: 'Tư vấn luật', anchor: 'index.html#cam-nang' },
  'thiet-ke-kien-truc': { name: 'Thiết kế kiến trúc', anchor: 'index.html#cam-nang' }
};

function renderArticleBody(row) {
  return `
    <div class="article-grid">
      <div class="article-main">
        ${row.image_path ? `<div class="article-cover"><img src="${esc(row.image_path)}" alt="${esc(row.title)}"></div>` : ''}
        <div class="article-body">
          <h1>${esc(row.title)}</h1>
          <div class="article-meta">
            <span>📅 ${dateLong(row.created_at)}</span>
            <span>✍️ ${esc(row.owner_name || 'Tổ Ấm')}</span>
          </div>
          <div class="article-content">${renderArticleContent(row.content)}</div>
        </div>
      </div>
      <aside>
        <div class="contact-box" style="margin-bottom:22px;">
          <h3>Cần tư vấn thêm?</h3>
          <a href="tel:0902312009" class="btn-call">📞 Gọi hotline: 090 231 2009</a>
        </div>
        <div class="side-box">
          <div class="side-box-head"><span class="dot"></span><h3>${esc((NEWS_CATEGORY_LABELS[row.category] || NEWS_CATEGORY_LABELS['tin-tuc']).name)} khác</h3></div>
          <div id="otherNews"></div>
        </div>
      </aside>
    </div>`;
}

function articleBreadcrumbCategory(row) {
  const info = NEWS_CATEGORY_LABELS[row.category] || NEWS_CATEGORY_LABELS['tin-tuc'];
  return `<a href="${info.anchor}">${esc(info.name)}</a>`;
}

// Thay nội dung "Đang tải..." bên trong 1 khung chứa (ví dụ #detailContainer) bằng HTML thật.
// Khớp theo cấu trúc (thẻ mở id, 1 dòng chữ "Đang tải..." không lồng thẻ nào khác, rồi 2 thẻ đóng),
// không phụ thuộc đúng từng chữ của câu "đang tải" — để chắc ăn dù mỗi trang viết câu khác nhau.
function injectBody(html, containerId, bodyHtml) {
  const re = new RegExp(`<div id="${containerId}">\\s*<div class="grid-status">[^<]*</div>\\s*</div>`);
  if (!re.test(html)) return null; // cấu trúc trang không khớp như mong đợi -> không đoán bừa, để nguyên trang gốc
  // data-ssr="1" đánh dấu để JavaScript phía trình duyệt biết nội dung đã có sẵn, khỏi tải và ghi đè lại lần nữa.
  return html.replace(re, `<div id="${containerId}" data-ssr="1">${bodyHtml}</div>`);
}

// Điền chữ vào 1 thẻ <span id="..."></span> (hoặc đang có sẵn chữ "Đang tải...") — dùng cho breadcrumb.
function injectSpan(html, spanId, innerHtml) {
  const re = new RegExp(`<span id="${spanId}">[^<]*</span>`);
  if (!re.test(html)) return html; // không có span này trong trang (trang không cần) -> bỏ qua, không lỗi
  return html.replace(re, `<span id="${spanId}">${innerHtml}</span>`);
}

module.exports = {
  renderArticleContent,
  renderListingBody, listingBreadcrumbType,
  renderTransferBody,
  renderProjectBody,
  renderArticleBody, articleBreadcrumbCategory,
  injectBody, injectSpan,
  esc
};
