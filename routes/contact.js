const express = require('express');
const nodemailer = require('nodemailer');
const { checkFields } = require('../lib/validate');

const router = express.Router();

const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'nganscb2020@gmail.com';

// Tạo transporter dùng SMTP (đọc cấu hình từ file .env). Nếu chưa cấu hình,
// transporter vẫn được tạo nhưng gửi thư sẽ báo lỗi rõ ràng — không làm sập server.
function buildTransporter() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  });
}

// ---- Gửi yêu cầu liên hệ (Cần thuê/mua hoặc Ký gửi) ----
// Bỏ ký tự xuống dòng / điều khiển để không chèn được header email (email header injection)
const oneLine = (v) => String(v || '').replace(/[\r\n\u0000-\u001f]+/g, ' ').trim();
const PHONE_RE = /^[0-9+\-\s().]{8,20}$/;

router.post('/', async (req, res) => {
  const body = req.body || {};

  // Bẫy bot (honeypot): người thật không thấy và không điền ô "website" này; bot tự động thì thường điền.
  // Trả về "thành công" giả để bot không biết mình bị chặn, nhưng KHÔNG gửi email.
  if (body.website) return res.json({ ok: true });

  const bad = checkFields(body, {
    formType: [20, 'Loại yêu cầu'], purpose: [300, 'Mục đích sử dụng'], street: [200, 'Tên phố'],
    price: [100, 'Giá'], requirements: [2000, 'Yêu cầu khác'], name: [100, 'Họ tên'], phone: [20, 'Số điện thoại']
  });
  if (bad) return res.status(400).json({ error: bad });

  const { formType } = body;
  const purpose = oneLine(body.purpose);
  const street = oneLine(body.street);
  const price = oneLine(body.price);
  const name = oneLine(body.name);
  const phone = oneLine(body.phone);
  const requirements = String(body.requirements || '').slice(0, 2000).trim();

  if (!purpose || !name || !phone) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ mục đích sử dụng, họ tên và số điện thoại.' });
  }
  if (!PHONE_RE.test(phone)) {
    return res.status(400).json({ error: 'Số điện thoại không hợp lệ.' });
  }

  const transporter = buildTransporter();
  if (!transporter) {
    console.error('Chưa cấu hình SMTP trong file .env — không thể gửi email liên hệ.');
    return res.status(500).json({ error: 'Hệ thống gửi email chưa được cấu hình. Vui lòng liên hệ quản trị viên.' });
  }

  const typeLabel = formType === 'ky-gui' ? 'Ký gửi' : 'Cần thuê/mua';

  const textBody = `
Có một yêu cầu mới từ website BDSCHÍNHCHỦHCM (${typeLabel}):

Mục đích sử dụng: ${purpose}
Tên phố quan tâm: ${street || '(không nhập)'}
Giá tối đa / mong muốn: ${price || '(không nhập)'}
Yêu cầu khác: ${requirements || '(không nhập)'}

Họ tên khách hàng: ${name}
Số điện thoại: ${phone}
  `.trim();

  try {
    await transporter.sendMail({
      from: `"Website BDSCHÍNHCHỦHCM" <${process.env.SMTP_USER}>`,
      to: CONTACT_EMAIL,
      replyTo: undefined,
      subject: `[BDSCHÍNHCHỦHCM] Yêu cầu mới — ${typeLabel} — ${name}`,
      text: textBody
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Gửi email liên hệ thất bại:', err.message);
    res.status(500).json({ error: 'Không gửi được yêu cầu. Vui lòng thử lại sau hoặc gọi hotline.' });
  }
});

module.exports = router;
