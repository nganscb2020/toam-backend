# BDSCHÍNHCHỦHCM — Backend bất động sản (mô hình môi giới)

Đây là mô hình **website môi giới**: khách truy cập chỉ xem tin, không tự đăng
được. Toàn bộ việc đăng/sửa/xoá tin do **admin** (bạn) thực hiện qua một trang
quản trị riêng, không xuất hiện trên menu công khai.

- `public/index.html` — trang chủ công khai, chỉ hiển thị tin, không có nút
  đăng nhập/đăng tin.
- `public/admin.html` — trang quản trị, dùng để đăng nhập và quản lý tin. Địa
  chỉ truy cập: `http://localhost:3000/admin.html` (khi chạy trên hosting thật
  thì thay `localhost:3000` bằng tên miền của bạn, ví dụ
  `https://toam.vn/admin.html`). **Giữ kín địa chỉ này**, đừng gắn link ở đâu
  công khai.

> 🔒 **Bảo mật:** bản này đã được gia cố. Đọc `BAO-MAT.md` (các việc bắt buộc làm trước khi chạy + những gì đã sửa). Cần đặt `JWT_SECRET` và `ADMIN_SETUP_KEY` trong `.env` — xem `.env.example`. Mật khẩu admin tối thiểu 10 ký tự. Đăng nhập dùng cookie HttpOnly nên production **bắt buộc chạy HTTPS**.

## Công nghệ dùng

- Node.js + Express — máy chủ và API
- MySQL (thư viện `mysql2`) — cơ sở dữ liệu. Cần một database MySQL riêng
  (Hostinger cấp sẵn trong hPanel); ứng dụng tự tạo các bảng khi khởi động
- JWT + bcrypt — xác thực người dùng
- Multer — nhận ảnh tải lên, lưu vào `public/uploads`

## Chạy thử trên máy của bạn

```bash
npm install
cp .env.example .env      # rồi mở .env, điền JWT_SECRET, ADMIN_SETUP_KEY và 5 biến DB_*
npm start
```

Cần Node.js **20 trở lên** và một database MySQL đang chạy (tự cài MySQL/XAMPP trên
máy, hoặc dùng luôn database Hostinger nếu đã bật "Remote MySQL" cho IP của bạn).
Thiếu bất kỳ biến `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` nào, server sẽ
cố ý không khởi động và báo rõ biến nào đang thiếu.

Mở `http://localhost:3000` để xem trang chủ. Mở
`http://localhost:3000/admin.html` để tạo tài khoản admin lần đầu (cần đúng
`ADMIN_SETUP_KEY` bạn vừa đặt trong `.env`) và bắt đầu đăng tin.

Các bảng (`users`, `listings`, `listing_media`, `news`, `projects`, `transfers`)
sẽ tự được tạo trong database MySQL ở lần chạy đầu tiên — bạn chỉ cần tạo sẵn
một database trống, không cần chạy lệnh SQL nào.

### Về việc tạo tài khoản admin

Trang `/admin.html` có cả form đăng nhập lẫn form "Tạo tài khoản lần đầu".
Form tạo tài khoản yêu cầu nhập đúng `ADMIN_SETUP_KEY` đã đặt trong `.env` —
nếu không đúng, hệ thống từ chối. Điều này giúp chặn người lạ tự tạo tài
khoản qua API dù họ có đoán được đường dẫn `/api/auth/register`.

Sau khi đã tạo xong tài khoản admin của mình, bạn không cần dùng lại form
"Tạo tài khoản" nữa — chỉ cần đăng nhập bằng tài khoản đã tạo cho các lần
sau.

### Thiết lập gửi email cho form liên hệ ("Cần thuê/mua" / "Ký gửi")

Form liên hệ trên trang chủ gửi toàn bộ nội dung khách điền tới email
**nganscb2020@gmail.com**. Để việc gửi mail thực sự hoạt động, bạn cần khai
báo một tài khoản Gmail dùng để **gửi đi** (khác với gmail nhận ở trên) trong
file `.env`:

1. Vào tài khoản Gmail bạn muốn dùng để gửi, bật **Xác minh 2 bước**
   (2-Step Verification) nếu chưa bật.
2. Vào https://myaccount.google.com/apppasswords, tạo một **Mật khẩu ứng
   dụng** (App Password) mới — chọn ứng dụng "Mail", thiết bị tuỳ ý.
3. Google sẽ cho ra một chuỗi 16 ký tự (dạng `abcd efgh ijkl mnop`) — copy
   chuỗi đó (bỏ khoảng trắng hoặc giữ nguyên đều được).
4. Mở file `.env`, điền:
   ```
   SMTP_USER=gmail-dung-de-gui@gmail.com
   SMTP_PASS=chuoi-16-ky-tu-vua-tao
   ```
5. Khởi động lại server (`npm start`). Từ giờ mỗi khi khách bấm "Gửi yêu
   cầu" trên form liên hệ, một email sẽ được gửi ngay tới
   nganscb2020@gmail.com với đầy đủ thông tin khách đã điền.

Nếu chưa kịp thiết lập SMTP, form vẫn hoạt động bình thường nhưng sẽ báo lỗi
thân thiện cho khách ("Hệ thống gửi email chưa được cấu hình") thay vì làm
sập trang — không có gì bị lỗi nghiêm trọng, chỉ là mail chưa gửi đi được.

## Đưa lên Hostinger (gói Business)

Dự án cần một host chạy được **Node.js liên tục** và có **MySQL**. Gói Business của
Hostinger có cả hai (ứng dụng Node.js triển khai qua GitHub hoặc tải ZIP; MySQL tạo
trong hPanel). Tên các mục trong hPanel có thể khác đôi chút tuỳ giao diện mới nhất.

1. **Tạo database:** hPanel → Databases → MySQL Databases → tạo database + người dùng +
   mật khẩu. Ghi lại 4 thông tin: tên database, tên người dùng, mật khẩu, host
   (thường là `localhost` khi ứng dụng và database cùng nằm trên Hostinger).
2. **Tạo ứng dụng Node.js:** kết nối repository GitHub, chọn nhánh `main`, chọn
   **Node 20 trở lên**. Hostinger sẽ chạy `npm install` rồi `npm start`.
3. **Điền biến môi trường** của ứng dụng (xem `.env.example`):
   `NODE_ENV=production`, `JWT_SECRET`, `ADMIN_SETUP_KEY`, `DB_HOST`, `DB_PORT`,
   `DB_USER`, `DB_PASSWORD`, `DB_NAME`, và `SMTP_*` nếu dùng form liên hệ.
   Không tải file `.env` lên GitHub.
4. **Bật HTTPS** cho tên miền (bắt buộc — đăng nhập dùng cookie chỉ chạy qua HTTPS).
5. Mở `https://tên-miền/admin.html` → "Tạo tài khoản lần đầu" để tạo admin, rồi đăng tin.

> Cần hỏi bộ phận hỗ trợ Hostinger: thư mục `public/uploads` (ảnh tải lên) có được giữ
> lại vĩnh viễn khi ứng dụng khởi động lại/triển khai lại không. Dữ liệu tin đăng nằm
> trong MySQL nên an toàn, nhưng file ảnh vẫn nằm trên ổ đĩa của ứng dụng.

## Khi cần mở rộng thêm

- **Lưu ảnh trên dịch vụ ngoài**: dùng Cloudinary hoặc AWS S3 thay vì lưu
  ảnh trực tiếp trên ổ đĩa server, để ảnh không bị mất khi service khởi
  động lại.
- **Duyệt tin trước khi hiển thị**: bảng `listings` đã có cột `status`
  (`active` / `hidden`) sẵn cho việc này — chỉ cần thêm vai trò admin và một
  route để đổi status.

## Cấu trúc thư mục

```
toam-backend/
├── server.js              # Điểm khởi động, ghép các route + phục vụ frontend
├── db.js                  # Kết nối MySQL, tự tạo 6 bảng khi khởi động
├── middleware/auth.js      # Kiểm tra JWT
├── routes/                # auth, listings, news, projects, transfers, contact, media
├── public/index.html      # Trang chủ công khai (chỉ xem, không đăng tin được)
├── public/admin.html      # Trang quản trị (đăng nhập + đăng/sửa/xoá tin)
├── public/uploads/        # Ảnh người dùng tải lên (tự tạo khi chạy)
├── lib/                   # Hàm dùng chung: kiểm tra dữ liệu, SEO, dựng sẵn nội dung, bắt lỗi async...
└── .env                   # Biến môi trường (tự tạo từ .env.example, KHÔNG đưa lên GitHub)
```
