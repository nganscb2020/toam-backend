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
- SQLite (better-sqlite3) — cơ sở dữ liệu, lưu thành 1 file, không cần cài
  đặt server database riêng
- JWT + bcrypt — xác thực người dùng
- Multer — nhận ảnh tải lên, lưu vào `public/uploads`

## Chạy thử trên máy của bạn

```bash
npm install
cp .env.example .env      # rồi mở .env, đổi JWT_SECRET và ADMIN_SETUP_KEY
npm start
```

Mở `http://localhost:3000` để xem trang chủ. Mở
`http://localhost:3000/admin.html` để tạo tài khoản admin lần đầu (cần đúng
`ADMIN_SETUP_KEY` bạn vừa đặt trong `.env`) và bắt đầu đăng tin.

Database sẽ tự tạo tại `data/toam.db` trong lần chạy đầu tiên — không cần
thao tác gì thêm.

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

## Đưa lên hosting (miễn phí, không cần server riêng)

Dự án này có 1 điểm cần lưu ý khi chọn hosting: nó **ghi vào ổ đĩa** (file
database SQLite và ảnh tải lên), nên không dùng được các host chỉ phục vụ
file tĩnh như Netlify/Vercel (dành cho trang không có backend). Bạn cần một
host chạy được Node.js liên tục. Gợi ý: **Render** (có gói miễn phí, dễ dùng
nhất cho người mới).

### Các bước trên Render

1. Đưa toàn bộ thư mục này lên một repository GitHub (không đẩy `node_modules`
   và `.env` lên — đã có `.gitignore` lo việc này).
2. Vào [render.com](https://render.com), tạo tài khoản, chọn **New → Web
   Service**, kết nối với repository vừa tạo.
3. Điền cấu hình:
   - Build Command: `npm install`
   - Start Command: `npm start`
4. Vào mục **Environment**, thêm biến `JWT_SECRET` với một chuỗi bí mật dài,
   ngẫu nhiên (đừng dùng giá trị mẫu trong `.env.example`).
5. Bấm **Create Web Service**. Sau 1–2 phút, Render cấp cho bạn một địa chỉ
   dạng `https://ten-du-an.onrender.com` — trang đã chạy thật, đăng tin được
   ngay.

> Lưu ý về gói miễn phí của Render: ổ đĩa sẽ **không lưu vĩnh viễn** — nếu
> service khởi động lại, file `data/toam.db` và ảnh trong `public/uploads`
> có thể bị mất. Với sản phẩm thật, hãy nâng cấp lên gói có "Persistent Disk"
> (khoảng 7 USD/tháng) hoặc chuyển sang một database ngoài (xem phần dưới).

### Gắn tên miền riêng

Sau khi service chạy ổn định trên Render, vào mục **Settings → Custom
Domain**, thêm tên miền bạn đã mua (ví dụ từ Mắt Bão, PA Vietnam, Namecheap),
rồi làm theo hướng dẫn trỏ bản ghi DNS mà Render đưa ra.

## Khi cần mở rộng thêm

- **Chuyển sang PostgreSQL**: khi lượng tin đăng lớn hoặc cần dữ liệu không
  bị mất khi restart, đổi `better-sqlite3` sang một dịch vụ Postgres có sẵn
  (Render Postgres, Supabase, Railway) và sửa lại `db.js`.
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
├── db.js                  # Khởi tạo SQLite, tạo bảng users & listings
├── middleware/auth.js      # Kiểm tra JWT
├── routes/auth.js         # Đăng ký / đăng nhập / thông tin tài khoản
├── routes/listings.js     # CRUD tin đăng + upload ảnh
├── public/index.html      # Trang chủ công khai (chỉ xem, không đăng tin được)
├── public/admin.html      # Trang quản trị (đăng nhập + đăng/sửa/xoá tin)
├── public/uploads/        # Ảnh người dùng tải lên (tự tạo khi chạy)
└── data/toam.db           # File database (tự tạo khi chạy)
```
