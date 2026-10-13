// ============================================================================
// Cấu hình RunableGames — sửa ở đây, không cần đụng code khác.
// ============================================================================
export const CONFIG = {
  // Backend trên Deno Deploy (backend/main.ts): tra mọi game Steam, nối kết quả app, xếp hạng.
  // Để trống: trang vẫn chạy với kho game có sẵn, chỉ thiếu tra trực tiếp Steam + xếp hạng.
  BACKEND_URL: "https://runable-g4market.kasakigaming.deno.net",

  // File app tải về (đặt cùng thư mục với trang)
  APP_URL: "runable_g4market.exe",

  // Link mua linh kiện. {q} = tên linh kiện. Gắn mã affiliate của bạn vào đây.
  SHOP_SEARCH: "https://shopee.vn/search?keyword={q}",

  // Giá thật (VNĐ) để gợi ý "rẻ nhất". Chưa điền thì trang chọn linh kiện yếu nhất vẫn đủ dùng.
  // Khoá: tên card như trong bảng ("rtx 5060", "rx 9060 xt") hoặc tên CPU ("Core i5-12400F").
  PRICES: {
    // "rtx 5060": 8490000,
  },
};

// Thử nghiệm: mở trang với ?api=http://localhost:8000 để trỏ tạm sang backend khác
try {
  const api = new URLSearchParams(location.search).get("api");
  if (api && /^https?:\/\//.test(api)) CONFIG.BACKEND_URL = api;
} catch (e) {}
