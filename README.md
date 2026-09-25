# Nails Avenue — Website + Trang quản lý

## Các file
| File | Vai trò |
|---|---|
| `index.html` | Toàn bộ website (Home, Services, Design Studio, Gallery, Booking, My Account, Contact) + trang quản lý `#admin` |
| `backend.js` | Logic nghiệp vụ dùng chung: tài khoản, đặt lịch, chống trùng lịch, giá, quyền admin |
| `server.js` | Server Node.js (không cần cài thư viện) — lưu dữ liệu chung cho mọi khách và admin |
| `package.json` | Để deploy lên Railway / Render |
| `data/db.json` | Tự tạo khi chạy server — **toàn bộ dữ liệu** (nhớ sao lưu) |

## Hai chế độ chạy

**1. Chế độ demo** — mở thẳng `index.html` bằng trình duyệt.
Dữ liệu chỉ lưu trong trình duyệt đó. Dùng để xem thử / chỉnh nội dung, nhưng đơn của khách trên máy khác **không** đến được trang Admin.

**2. Chế độ thật** — chạy server:
```
cd D:\Cl_nails
node server.js
```
Mở http://localhost:3000 — mọi khách và admin dùng chung dữ liệu. Cần cài Node.js 18+ (https://nodejs.org).

## Trang quản lý
- Vào `http://<tên-miền>/#admin` (hoặc link "Staff login" ở cuối trang).
- Lần đầu: tạo mật khẩu admin (≥ 8 ký tự). **Hãy làm ngay sau khi deploy**, hoặc đặt biến môi trường `ADMIN_PASSWORD` để server tự tạo.

| Mục | Làm được gì |
|---|---|
| Dashboard | Đơn chờ xác nhận, lịch hôm nay theo từng thợ, doanh thu đã thu trong tháng, tin nhắn chưa đọc |
| Bookings | Xác nhận / từ chối / hoàn thành / no-show, đổi ngày-giờ-thợ-thời lượng (tự kiểm tra trùng lịch), chốt giá mẫu custom, ghi đè giá cuối, đánh dấu đã thanh toán, ghi chú nội bộ, tạo đơn cho khách gọi điện / walk-in, xoá đơn |
| Chi tiết mẫu thiết kế | Xem 10 móng, bảng thông số từng móng, tải ảnh gốc khách upload kèm vị trí / zoom / góc xoay |
| Customers | Danh sách khách (có tài khoản + khách vãng lai), lịch sử và tổng đã trả |
| Messages | Tin nhắn từ form liên hệ, trả lời qua email, đánh dấu đã đọc, xoá |
| Website features | Bật / tắt **Design Studio**, **Gallery**, **Google reviews** — tắt là khách không còn thấy trang, link menu, mục trên trang chủ (và bước đính kèm mẫu khi đặt lịch) |
| Google reviews | Link Google Maps, nút “Write a review”, điểm & số review, tự lấy review từ Google (cần API key), thêm review thủ công |
| Gallery | Thêm / sửa / ẩn / xoá / sắp xếp mẫu; thiết kế mẫu bằng chính Design Studio; quản lý danh mục |
| Services | Thêm / sửa / ẩn / xoá dịch vụ (tên, giá, thời gian, mô tả), quản lý danh mục |
| Artists | Thêm / sửa thợ: ngày làm, giờ làm, màu, ngừng nhận khách |
| Shop info | Tên shop, tiêu đề & đoạn giới thiệu trang chủ, About, địa chỉ, bản đồ, SĐT, email, Instagram, Facebook, giờ mở cửa từng ngày, đơn vị tiền, số ngày cho đặt trước, bước giờ, múi giờ |
| Design pricing | Giá nền nail art, giá tạm ảnh custom, giá từng kiểu (French, Ombré…) và từng add-on |
| Settings | Đổi mật khẩu admin, tải file sao lưu, khôi phục từ file, đưa nội dung về mặc định |

Quy trình đơn: khách gửi → **Pending** → admin **Confirm** → sau buổi hẹn **Completed** + **Paid**. Khách thấy trạng thái trong My Account.

## Google reviews
Website hiển thị điểm đánh giá + review trên trang Home và Contact, kèm nút “See all reviews” / “Write a review”.
- **Tự động (khuyên dùng):** Google Cloud Console → tạo project → bật **Places API (New)** → tạo API key → dán vào Admin › Google reviews (hoặc đặt biến `GOOGLE_PLACES_API_KEY`). Server lấy điểm, tổng số review và tối đa 5 review mới nhất (giới hạn của Google), tự làm mới mỗi 6 giờ. Chỉ hoạt động khi chạy `server.js`. Google tính phí theo lượt gọi nhưng có hạn mức miễn phí hàng tháng; với cache 6 giờ lượng gọi rất nhỏ.
- **Thủ công:** thêm review thật từ trang Google của shop trong Admin › Google reviews, và (tuỳ chọn) nhập điểm trung bình + số review.

## Deploy lên Railway (gợi ý)
1. Đưa thư mục này lên GitHub, tạo service mới trên Railway từ repo.
2. Start command: `node server.js` (Railway tự nhận từ `package.json`).
3. Thêm **Volume** gắn vào `/data` và đặt biến `DATA_DIR=/data` — nếu không có volume, dữ liệu mất mỗi lần deploy lại.
4. Đặt biến `ADMIN_PASSWORD=...` và `GOOGLE_PLACES_API_KEY=...` (tuỳ chọn).
5. Tạo domain → vào `/#admin` để kiểm tra.

## Chưa có
- Gửi email / SMS xác nhận tự động (cần dịch vụ như Resend, Twilio — chỗ gắn nằm trong `createBooking` ở `backend.js`).
- Thanh toán online.
