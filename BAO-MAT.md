# Bảo mật website Tổ Ấm — những gì đã sửa và bạn cần làm

## A. Việc BẮT BUỘC làm trước khi chạy bản này

1. **Đặt `JWT_SECRET`** (chuỗi ngẫu nhiên ≥ 32 ký tự). Nếu thiếu/yếu/dùng giá trị mẫu, server ở chế độ `production` sẽ **từ chối khởi động** (cố ý, để không chạy với khoá yếu).
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
2. **Đặt `ADMIN_SETUP_KEY`** (chuỗi dài, khó đoán). Nếu để trống thì không tạo được tài khoản admin.
3. **Đặt `NODE_ENV=production` và `TRUST_PROXY=1`** trên Render (xem `.env.example`).
4. **Đổi mật khẩu admin** thành mật khẩu ≥ 10 ký tự (bản cũ chỉ cần 6). Đổi `JWT_SECRET` sẽ làm mọi phiên đăng nhập cũ hết hiệu lực — đó là điều nên có.
5. Nếu trước đây bạn từng để `ADMIN_SETUP_KEY` trống hoặc dùng `JWT_SECRET` mẫu **trên bản đã chạy thật**, hãy xem bảng `users` xem có tài khoản lạ không (tài khoản cũ nhất sẽ được tự đặt làm admin khi chạy bản mới).

### A2. Về phiên đăng nhập bằng cookie (mới)

- **Bắt buộc dùng HTTPS trên production.** Cookie có cờ `Secure` và tiền tố `__Host-`, nếu mở site bằng `http://` trình duyệt sẽ **bỏ cookie → đăng nhập không giữ được**. Render và Cloudflare đều có HTTPS sẵn. Chạy local `http://localhost:3000` vẫn dùng được (khi không đặt `NODE_ENV=production`).
- **Mọi người sẽ phải đăng nhập lại một lần** sau khi cập nhật (token cũ nằm ở `localStorage` không còn được nhận).
- **Nút "Đăng xuất" thu hồi phiên phía máy chủ** — token cũ dù bị sao chép cũng hết hiệu lực. Vì chỉ có 1 admin nên việc này áp dụng cho mọi thiết bị đang đăng nhập bằng tài khoản đó (đăng xuất ở điện thoại sẽ đăng xuất luôn máy tính).
- Trang admin và API phải cùng một domain (đang đúng). Nếu sau này tách giao diện sang domain khác thì cần thiết kế lại cookie.
- Cách hoạt động: cookie `HttpOnly` (script không đọc được) + `SameSite=Strict` + kiểm tra `Origin` mọi request ghi + header `X-Requested-With: toam-admin` (chống CSRF). API **không còn nhận** token qua header `Authorization`.

## B. Các lỗ hổng đã vá

| # | Lỗ hổng | Mức độ | Đã sửa thế nào |
|---|---|---|---|
| 1 | `JWT_SECRET` có giá trị mặc định nằm trong mã nguồn → ai đọc code cũng **tự tạo được token đăng nhập giả** | Nghiêm trọng | Bỏ giá trị mặc định; production bắt buộc có khoá mạnh |
| 2 | Nếu chưa đặt `ADMIN_SETUP_KEY`, **bất kỳ ai cũng tạo được tài khoản** qua `/api/auth/register` | Nghiêm trọng | Không có key = tắt hẳn đăng ký; có key thì chỉ tạo được khi chưa có tài khoản nào |
| 3 | Không phân quyền: **mọi tài khoản đăng nhập đều sửa/xoá được tin tức, dự án, sang nhượng** của người khác | Cao | Thêm cột `role`; mọi thao tác ghi yêu cầu `admin` (`requireAdmin`) |
| 4 | **XSS lưu trữ**: tiêu đề/mô tả/nội dung chèn thẳng vào `innerHTML` không escape → chèn được script đánh cắp token admin | Cao | Thêm `esc()` cho toàn bộ dữ liệu hiển thị (97 vị trí) + CSP |
| 5 | Content-Security-Policy đang **tắt**, CORS mở cho mọi domain | Trung bình | Bật CSP, CORS mặc định tắt (chỉ mở khi khai báo `ALLOWED_ORIGINS`) |
| 6 | Không có `trust proxy` trên Render → giới hạn tốc độ tính theo IP của proxy, có thể **khoá nhầm cả khách thật** hoặc bị lách | Trung bình | Cấu hình `TRUST_PROXY` |
| 7 | Chỉ giới hạn tốc độ ở đăng nhập & liên hệ; bot cào dữ liệu/spam ghi tự do | Trung bình | Giới hạn toàn bộ API, riêng nhóm ghi; chỉ đếm lần đăng nhập **thất bại**; khoá email 15 phút sau 5 lần sai |
| 8 | Upload chỉ tin `Content-Type` do client tự khai → có thể đẩy file HTML/độc hại giả làm ảnh | Trung bình | Kiểm tra "magic bytes" thật của file; dọn file rác khi request bị từ chối; `/uploads` phục vụ với CSP `sandbox` |
| 9 | Lỗi 500 trả nguyên `err.message` (lộ câu SQL, đường dẫn) | Thấp–TB | Trả thông báo chung, chi tiết chỉ ghi log server |
| 10 | Đăng nhập: dò được email nào tồn tại qua thời gian phản hồi; bcrypt đồng bộ chặn server; mật khẩu 6 ký tự | Thấp–TB | Băm giả khi email không có; bcrypt bất đồng bộ cost 12; mật khẩu ≥ 10 ký tự; xác minh `HS256`; kiểm tra tài khoản còn tồn tại mỗi request; token 7 ngày (trước 30) |
| 11 | Không kiểm tra độ dài/kiểu dữ liệu; `?q[]=` hoặc số `NaN` làm lỗi truy vấn; `:id` tuỳ ý | Thấp–TB | `lib/validate.js`: giới hạn độ dài, khoảng số, whitelist đơn vị giá, chuẩn hoá query, `:id` chỉ nhận số |
| 12 | Tin **đang ẩn** vẫn xem được (kèm SĐT) qua `/api/listings/:id` | Thấp | Chỉ chủ tin xem được tin ẩn |
| 13 | Form liên hệ: spam, không kiểm tra SĐT, có thể chèn xuống dòng vào tiêu đề email | Thấp | Ô bẫy bot (honeypot), kiểm tra SĐT/độ dài, loại ký tự xuống dòng, 5 lần/giờ/IP |
| 15 | Token đăng nhập lưu ở `localStorage` → script chạy được trên trang là đọc và mang đi được token | Trung bình | Chuyển sang **cookie HttpOnly** + chống CSRF + thu hồi phiên khi đăng xuất (xem mục A2) |
| 14 | Bot dò `/wp-admin`, `/.env`, `*.php`… đều nhận trang chủ (200) | Thấp | Trả 404 ngay; API sai đường dẫn trả 404 JSON |

## C. Rủi ro còn lại (mình chưa/không thể xử lý hết trong code)

- **Cookie HttpOnly chỉ chặn việc *đánh cắp* phiên, không chặn việc *lợi dụng* phiên.** Nếu vẫn còn một lỗ XSS nào đó sót lại, script độc hại chạy trong trang admin vẫn có thể gọi API thay admin (đăng/xoá tin) trong lúc admin đang đăng nhập — chỉ là không mang được phiên đi nơi khác. Vì vậy việc escape dữ liệu và CSP vẫn quan trọng.
- **CSP còn `'unsafe-inline'`** cho script/style vì trang viết JS trực tiếp trong HTML. Muốn bỏ phải tách JS ra file riêng hoặc dùng nonce. Hiện CSP vẫn chặn script ngoài, gửi dữ liệu ra domain lạ và nhúng iframe.
- **Chưa có xác thực 2 lớp (2FA)** cho admin. Mật khẩu dài + khoá theo IP/email đã giảm nhiều rủi ro dò mật khẩu, nhưng 2FA vẫn tốt hơn.
- **Bot không thể chặn 100% ở tầng ứng dụng.** Bot DDoS/cào dữ liệu lượng lớn nên chặn ở tầng ngoài (mục D).
- **Dữ liệu & ảnh trên Render gói miễn phí sẽ mất khi khởi động lại** (đã ghi trong README). Đây là vấn đề mất dữ liệu, không phải bị hack, nhưng cần có bản sao lưu định kỳ.
- **Cập nhật thư viện:** chạy `npm audit` và `npm update` định kỳ (mình không chạy được `npm audit` trong môi trường này vì không có mạng).
- `ADMIN_SETUP_KEY`, mật khẩu Gmail (SMTP_PASS) chỉ để trong biến môi trường/`.env`, không đưa lên GitHub.

## D. Khuyến nghị: đặt Cloudflare (miễn phí) phía trước

Đây là cách hiệu quả nhất để chặn bot thật sự:
1. Trỏ tên miền về Cloudflare, bật **Proxy (đám mây cam)**, SSL/TLS chế độ **Full (strict)**.
2. Bật **Bot Fight Mode** và **Managed Rules (WAF)**.
3. Tạo **Rate Limiting rule** cho `/api/auth/*` (ví dụ ≤ 10 yêu cầu/phút/IP) và `/api/contact`.
4. Bật **Always Use HTTPS**.
5. Sau khi có Cloudflare, số lớp proxy thay đổi: cần chỉnh `TRUST_PROXY` cho đúng (thường là 2). Hãy ghi log `req.ip` để kiểm tra bạn thấy IP khách thật chứ không phải IP của Cloudflare/Render.

## E. Danh sách file đã thay đổi

Mới: `lib/validate.js`, `lib/cookies.js`, `middleware/upload.js`, `middleware/csrf.js`, `public/js/safe.js`, `.env.example`, `BAO-MAT.md`
Sửa: `server.js`, `db.js`, `middleware/auth.js`, `routes/*.js` (cả 6 file), toàn bộ `public/*.html` (thêm `esc()`), `index.html` (ô bẫy bot), `admin.html` (mật khẩu ≥ 10, noindex, phiên bằng cookie)

## F. Về việc kiểm thử

Đã kiểm tra: cú pháp toàn bộ file JS (kể cả script nhúng trong HTML), logic kiểm tra dữ liệu, hàm `esc()` với payload XSS, nhận diện file thật bằng magic bytes, trình phân tích cookie và bộ chống CSRF (12 kịch bản tấn công/hợp lệ). **Chưa chạy được server đầy đủ** trong môi trường của mình (không cài được thư viện). Hãy chạy thử `npm install && npm start` trên máy bạn và thử: đăng nhập admin, tải lại trang (phải vẫn đăng nhập), đăng xuất rồi tải lại (phải về màn hình đăng nhập), đăng 1 tin có ảnh, sửa/xoá tin, gửi form liên hệ trước khi đưa lên hosting.
