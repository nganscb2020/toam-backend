const express = require('express');
const nodemailer = require('nodemailer');

const router = express.Router();

const CONTACT_EMAIL = 'nganscb2020@gmail.com';

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
router.post('/', async (req, res) => {
  const { formType, purpose, street, price, requirements, name, phone } = req.body;

  if (!purpose || !name || !phone) {
    return res.status(400).json({ error: 'Vui lòng nhập đầy đủ mục đích sử dụng, họ tên và số điện thoại.' });
  }

  const transporter = buildTransporter();
  if (!transporter) {
    console.error('Chưa cấu hình SMTP trong file .env — không thể gửi email liên hệ.');
    return res.status(500).json({ error: 'Hệ thống gửi email chưa được cấu hình. Vui lòng liên hệ quản trị viên.' });
  }

  const typeLabel = formType === 'ky-gui' ? 'Ký gửi' : 'Cần thuê/mua';

  const textBody = `
Có một yêu cầu mới từ website Tổ Ấm (${typeLabel}):

Mục đích sử dụng: ${purpose}
Tên phố quan tâm: ${street || '(không nhập)'}
Giá tối đa / mong muốn: ${price || '(không nhập)'}
Yêu cầu khác: ${requirements || '(không nhập)'}

Họ tên khách hàng: ${name}
Số điện thoại: ${phone}
  `.trim();

  try {
    await transporter.sendMail({
      from: `"Website Tổ Ấm" <${process.env.SMTP_USER}>`,
      to: CONTACT_EMAIL,
      replyTo: undefined,
      subject: `[Tổ Ấm] Yêu cầu mới — ${typeLabel} — ${name}`,
      text: textBody
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('Gửi email liên hệ thất bại:', err.message);
    res.status(500).json({ error: 'Không gửi được yêu cầu. Vui lòng thử lại sau hoặc gọi hotline.' });
  }
});

module.exports = router;
