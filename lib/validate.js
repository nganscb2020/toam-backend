// Kiểm tra dữ liệu đầu vào dùng chung cho các route.

// limits: { tenTruong: [doDaiToiDa, 'Nhãn hiển thị'] }
// Trả về chuỗi lỗi (tiếng Việt) nếu sai, hoặc null nếu hợp lệ.
function checkFields(body, limits) {
  for (const [field, [max, label]] of Object.entries(limits)) {
    const v = body[field];
    if (v === undefined || v === null) continue;
    if (typeof v !== 'string') return `${label} không hợp lệ.`;
    if (v.length > max) return `${label} quá dài (tối đa ${max} ký tự).`;
  }
  return null;
}

// limits: { tenTruong: [min, max, 'Nhãn hiển thị'] } — chỉ kiểm tra khi có giá trị.
function checkNumbers(body, limits) {
  for (const [field, [min, max, label]] of Object.entries(limits)) {
    const v = body[field];
    if (v === undefined || v === null || v === '') continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) return `${label} không hợp lệ.`;
  }
  return null;
}

// Chuẩn hoá query string: mỗi tham số chỉ là 1 chuỗi ngắn.
// Chặn kiểu ?q[]=a&q[x]=b làm lỗi câu truy vấn hoặc bị lợi dụng để quét/gây tải.
function normalizeQuery(req, res, next) {
  for (const key of Object.keys(req.query)) {
    let v = req.query[key];
    if (Array.isArray(v)) v = v[0];
    if (typeof v !== 'string') { delete req.query[key]; continue; }
    req.query[key] = v.slice(0, 100);
  }
  next();
}

// Dùng với router.param('id', idParam): chỉ nhận id là số nguyên dương.
function idParam(req, res, next, value) {
  if (!/^\d{1,12}$/.test(value)) return res.status(404).json({ error: 'Không tìm thấy.' });
  next();
}

module.exports = { checkFields, checkNumbers, normalizeQuery, idParam };
