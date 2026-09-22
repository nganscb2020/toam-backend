# Dựng sẵn nội dung phía máy chủ (Server-Side Rendering)

## Vấn đề đã sửa

Trước đây, khi mở một trang chi tiết (`/bat-dong-san/...`, `/sang-nhuong/...`, `/du-an/...`, `/tin-tuc/...`), máy chủ chỉ gửi về một trang HTML gần như trống — chữ "Đang tải thông tin...". Nội dung thật (tiêu đề, giá, ảnh, mô tả) chỉ xuất hiện SAU KHI trình duyệt tải xong và chạy JavaScript để gọi API lấy dữ liệu.

Với người dùng thường, việc này chỉ chậm một chút (vài trăm mili-giây). Nhưng với Google: lần đọc đầu tiên (đọc HTML thô) chỉ thấy "Đang tải...", còn nội dung thật phải chờ một đợt xử lý JavaScript riêng, chậm hơn và bị giới hạn ngân sách xử lý — bất lợi rõ rệt cho một trang mới, chưa có nhiều uy tín.

## Đã làm gì

Máy chủ giờ tự dựng sẵn toàn bộ nội dung chính (ảnh, tiêu đề, giá, diện tích, địa chỉ, mô tả, breadcrumb) ngay trong file HTML gửi về — y hệt những gì JavaScript từng tự dựng, chỉ khác là làm trước, ở phía máy chủ. Khi trình duyệt (hay Google) mở trang, nội dung đã có sẵn ngay từ đầu, không cần chờ gì cả.

JavaScript phía trình duyệt vẫn chạy như cũ để xử lý phần tương tác (đổi ảnh trong dải ảnh nhỏ, tải "tin tương tự"/"dự án khác"...), nhưng nó nhận ra nội dung đã có sẵn (qua dấu `data-ssr="1"`) nên **không tải và ghi đè lại lần nữa** — vừa nhanh hơn, vừa không bị "giật" nội dung.

## Áp dụng cho

- Tin mua bán/cho thuê (`listing.html`)
- Tin sang nhượng (`sang-nhuong-chi-tiet.html`)
- Dự án (`du-an-chi-tiet.html`)
- Tin tức (`tin-tuc-chi-tiet.html`)

Trang danh sách (trang chủ, danh sách bán/thuê/sang nhượng) **chưa** làm phần này — chúng dùng cách cuộn tải thêm, phức tạp hơn để dựng sẵn, và ít quan trọng hơn cho SEO vì nội dung ở đó chỉ là bản rút gọn của các trang chi tiết (Google chủ yếu xếp hạng dựa vào trang chi tiết).

## Nếu trang không đúng cấu trúc mong đợi

Nếu sau này ai đó sửa trực tiếp cấu trúc HTML của 4 file trên (đổi tên `id`, thêm bớt thẻ) mà không khớp với những gì máy chủ mong đợi, máy chủ sẽ **tự động bỏ qua bước dựng sẵn** và gửi trang gốc như trước đây (JavaScript vẫn chạy bình thường, trang vẫn hoạt động) — thà thiếu phần tối ưu SEO còn hơn gửi ra một trang bị lỗi.

## Cách kiểm tra sau khi đưa lên Render

1. Mở một trang chi tiết bất kỳ. Xem nguồn trang bằng chuột phải → "Xem nguồn trang" (View Page Source) — **không phải** F12/Inspect (F12 hiện nội dung sau khi JS đã chạy, không cho biết máy chủ gửi gì). Trong nguồn trang phải thấy ngay tiêu đề, giá, mô tả thật — không còn chữ "Đang tải...".
2. Dùng công cụ https://search.google.com/test/rich-results — công cụ này cũng cho xem "HTML đã tải về" (rất giống cách Google thấy trang), nên là cách kiểm tra đáng tin nhất.
3. Trang vẫn phải hoạt động bình thường: đổi ảnh trong dải ảnh nhỏ, xem "tin tương tự"/"dự án khác" ở cuối trang.
