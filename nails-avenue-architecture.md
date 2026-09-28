# Nails Avenue — cấu trúc hiện tại (cập nhật 28/09/2026)

Thư mục: D:\Cl_nails

- `index.html` — SPA vanilla (Home, Services, Design Studio, Gallery, Booking, My Account, Contact) + trang quản lý `#admin`. Mọi nội dung đọc từ API `/content`.
- `backend.js` — logic dùng chung cho trình duyệt (chế độ demo, localStorage) và Node (chế độ thật).
- `server.js` — Node không cần thư viện; lưu `data/db.json`; phục vụ `/`, `/backend.js`, `/assets/logo.png`; env: PORT, DATA_DIR, ADMIN_PASSWORD, GOOGLE_PLACES_API_KEY.
- `assets/logo.png` — logo mặc định.
- Đã lệch khỏi quy tắc "single-file" trong doc `nails` vì cần backend thật.

Shop thật: Nails Avenue Victoria Cross Metro — Shop 5/30 Denison St, North Sydney NSW 2060, 0425 289 569 (lấy từ beautihost, cần xác nhận). Múi giờ đặt lịch: Australia/Sydney.

Admin › Website features: bật/tắt Design Studio, Gallery, Google reviews (tắt = khách không thấy trang, link, mục trang chủ, bước đính kèm mẫu; server từ chối tạo mẫu khi cả Studio và Gallery tắt).
Admin › Google reviews: link Maps, nút Write a review, điểm/số review thủ công, review nhập tay, tự import qua Places API (New) — tối đa 5 review, cache 6 giờ, chỉ ở chế độ server.
Admin › Shop info › Logo: upload/thay/xoá (PNG/JPG/WEBP, thu nhỏ 600px). Lưu ở `content.images.logo` (data URL) qua `PUT /admin/content`; backend kiểm tra định dạng, tối đa 3 MB, chỉ nhận key trong `IMAGE_KEYS`; reset-content giữ logo. Ưu tiên hiển thị: logo upload → `assets/logo.png` → SVG + chữ. Thêm ảnh website khác sau này: `IMAGE_KEYS` (backend.js) + `SITE_IMGS` (index.html).

Quy trình đơn: pending → confirmed → completed (+ paid); cancelled / no_show.
Chưa có: email/SMS tự động, thanh toán online, deploy thật.
