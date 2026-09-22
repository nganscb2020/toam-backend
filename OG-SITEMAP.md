# Hiện đẹp khi chia sẻ lên Zalo/Facebook + sitemap.xml cho Google

## Chia sẻ link đẹp hơn

Khi dán link một tin đăng vào Zalo, Facebook, Messenger..., ứng dụng đó **không mở trình duyệt thật**, nó chỉ tải phần HTML thô để đọc vài thẻ `<meta>` đặc biệt (Open Graph). Trang trước đây chỉ đặt tiêu đề bằng JavaScript sau khi tải xong, mà JavaScript thì các ứng dụng này không chạy — nên chúng luôn thấy tiêu đề chung "Chi tiết tin đăng — Tổ Ấm" và không có ảnh.

Giờ khi có người bấm vào link `/bat-dong-san/...`, `/sang-nhuong/...`, `/du-an/...`, `/tin-tuc/...`, máy chủ tự lấy đúng tiêu đề, mô tả và ảnh của tin đó rồi chèn vào trước khi gửi trang đi — kể cả khi ứng dụng chia sẻ không chạy JavaScript.

- **Ảnh**: dùng ảnh đại diện của tin. Nếu tin chưa có ảnh, dùng ảnh mặc định cho từng loại tin (giống ảnh mặc định đang hiện trên trang danh sách).
- **Mô tả**: với tin mua bán/thuê/sang nhượng là giá + diện tích + địa chỉ + vài dòng mô tả; với tin tức là đoạn tóm tắt hoặc đầu bài viết.
- **Tin đang ẩn (`status = 'hidden'`)**: trang trả về "không tìm thấy", không tạo thẻ chia sẻ cho tin đó.

**Nếu Zalo không hiện ảnh dù Facebook hiện được:** hai nơi này đọc cùng một loại thẻ nhưng Zalo có vẻ khắt khe hơn với ảnh. Một nguyên nhân mình từng mắc: bản đầu tiên khai cứng kích thước ảnh là 1200×630 cho mọi tin, dù ảnh thật to nhỏ khác nhau — Facebook bỏ qua chỗ sai này, nhưng có thể vài nơi khác thì không. Bản hiện tại đã bỏ chỗ khai sai đó. Nếu vẫn không thấy ảnh:
- Zalo có lưu tạm bản xem trước, nên nếu bạn từng gửi đúng link đó trước khi mình sửa lỗi, hãy thử gửi lại sau vài chục phút, hoặc thử với một tin khác chưa từng gửi qua Zalo.
- Kiểm tra ảnh có mở được trực tiếp không: dán link ảnh (bấm chuột phải vào ảnh trên trang tin, chọn "Sao chép địa chỉ hình ảnh") vào một tab mới, xem có hiện ảnh bình thường không.

**Cách kiểm tra sau khi đưa lên Render:** dùng công cụ xem trước của Facebook tại https://developers.facebook.com/tools/debug/ hoặc Zalo, dán link một tin đăng vào (ví dụ `https://toam-bds.onrender.com/bat-dong-san/...`). Nếu vẫn thấy dữ liệu cũ, đó là do Facebook/Zalo lưu cache link — bấm "Scrape Again"/"Lấy lại thông tin" trong công cụ đó.

## sitemap.xml — giúp Google tìm ra hết các trang

`https://toam-bds.onrender.com/sitemap.xml` liệt kê: các trang tĩnh (trang chủ, danh sách bán/thuê/sang nhượng, giới thiệu) và **mọi tin đang công khai** (tin mua bán/cho thuê đang hiển thị, mọi tin sang nhượng, mọi dự án, mọi tin tức) — mỗi tin một địa chỉ đẹp dạng `/bat-dong-san/ten-tin-2`.

`https://toam-bds.onrender.com/robots.txt` cho phép mọi công cụ tìm kiếm thu thập toàn trang, chặn riêng `/admin.html`, và trỏ tới sitemap ở trên.

**Khai báo với Google (làm một lần, miễn phí):**
1. Vào https://search.google.com/search-console, thêm trang web bằng địa chỉ `https://toam-bds.onrender.com` (hoặc tên miền riêng nếu bạn có).
2. Xác minh quyền sở hữu theo hướng dẫn của Google (thường là thêm 1 dòng vào DNS hoặc tải lên 1 file xác minh).
3. Vào mục **Sitemaps**, nhập `sitemap.xml`, bấm Gửi.

Google không lập chỉ mục ngay, thường mất vài ngày đến vài tuần.

## Lưu ý

- Sitemap và thẻ chia sẻ dùng **địa chỉ trang web thật** (lấy từ chính request gửi tới, dựa vào cấu hình `TRUST_PROXY` đã đặt), nên không cần thêm biến môi trường nào. Nếu sau này bạn đổi từ `toam-bds.onrender.com` sang tên miền riêng, mọi thứ tự cập nhật theo, không cần sửa code.
- Ảnh mặc định hiện đang lấy tạm từ Unsplash (giống ảnh minh hoạ đã dùng sẵn trên trang danh sách). Nếu bạn có ảnh logo/banner riêng của "Tổ Ấm", gửi mình file ảnh, mình đổi sang dùng ảnh đó — sẽ chuyên nghiệp hơn.
- Trên Render gói miễn phí, dữ liệu (tin đăng) mất khi service khởi động lại — sitemap khi đó sẽ tạm thời rỗng phần tin đăng cho tới khi bạn đăng lại.
