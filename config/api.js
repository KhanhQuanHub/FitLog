// ============================================================================
// config/api.js
// Nơi DUY NHẤT cấu hình địa chỉ máy chủ API (BASE_URL) cho toàn bộ ứng dụng FitLog:
// - Ưu tiên đọc từ biến môi trường EXPO_PUBLIC_API_URL trong file .env
//   (Metro / EAS Build tự động inline biến có tiền tố EXPO_PUBLIC_ lúc đóng gói APK).
// - Giá trị mặc định dự phòng là IP LAN Wi-Fi của laptop (KHÔNG dùng localhost / 10.0.2.2).
// - Khi đổi mạng làm IP laptop thay đổi: chỉ cần sửa EXPO_PUBLIC_API_URL trong .env và build lại
//   (ngoài ra tầng services/config.js vẫn hỗ trợ tự quét dải mạng /24 dự phòng nếu IP cũ không phản hồi).
// ============================================================================

export const DEFAULT_SERVER_PORT = 3000;

// Địa chỉ IP LAN mặc định của laptop (lấy từ lệnh `ipconfig` -> Wireless LAN adapter Wi-Fi -> IPv4 Address)
export const DEFAULT_API_URL = `http://10.88.237.8:${DEFAULT_SERVER_PORT}`;

// Thời gian chờ tối đa cho mỗi yêu cầu mạng (10 giây)
export const API_TIMEOUT_MS = 10000;

// Lưu ý: PHẢI viết trực tiếp `process.env.EXPO_PUBLIC_API_URL` để Babel/Metro của Expo
// nhúng giá trị từ file .env vào gói mã nguồn khi build APK.
const rawEnvApiUrl = process.env.EXPO_PUBLIC_API_URL;

/**
 * Chuẩn hóa URL máy chủ từ EXPO_PUBLIC_API_URL hoặc dùng DEFAULT_API_URL.
 *
 * @returns {string}
 */
export function getConfiguredApiUrl() {
  const dynamicEnvUrl =
    typeof process !== 'undefined' &&
    process.env &&
    typeof process.env.EXPO_PUBLIC_API_URL === 'string'
      ? process.env.EXPO_PUBLIC_API_URL
      : rawEnvApiUrl;

  const candidate =
    typeof dynamicEnvUrl === 'string' && dynamicEnvUrl.trim() !== ''
      ? dynamicEnvUrl.trim()
      : DEFAULT_API_URL;

  return candidate.replace(/\/+$/, '');
}

export const BASE_URL = getConfiguredApiUrl();
