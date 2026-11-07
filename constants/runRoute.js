// ============================================================================
// constants/runRoute.js
// Hằng số cấu hình cho tính năng LƯU & VẼ LẠI LỘ TRÌNH GPS và GỢI Ý HIỆU CHUẨN SẢI CHÂN.
// Chỉnh sửa tại MỘT chỗ duy nhất; file thuần JS để dùng được cả trong app lẫn test Node.
// ============================================================================

// ---------------------- Thu thập GPS (hooks/useRunTracker.js) ----------------------
// Tần suất yêu cầu vị trí từ expo-location khi đang chạy
export const GPS_WATCH_TIME_INTERVAL_MS = 2000;
export const GPS_WATCH_DISTANCE_INTERVAL_M = 5;
// Bỏ điểm có sai số (accuracy) lớn hơn ngưỡng này (mét)
export const GPS_MAX_ACCURACY_M = 30;
// Bỏ điểm "nhảy" bất thường: tốc độ tức thời > 10 m/s (36 km/h) là phi thực tế với chạy bộ
export const GPS_MAX_SPEED_MPS = 10;
// Sau N điểm liên tiếp bị loại vì "nhảy", coi điểm mới là mốc chuẩn (tránh kẹt vì 1 điểm gốc sai)
export const GPS_MAX_CONSECUTIVE_JUMP_REJECTS = 3;
// Không nhận được điểm hợp lệ trong khoảng này -> báo "mất tín hiệu GPS"
export const GPS_SIGNAL_LOST_MS = 20000;
// Chỉ bật khi test trên máy ảo không có GPS: sinh lộ trình giả (chỉ có tác dụng ở __DEV__)
export const GPS_DEV_SIMULATION = false;

// ---------------------- Lưu lộ trình (hooks/useRouteRecorder.js) ----------------------
// Chỉ thêm điểm mới vào lộ trình khi cách điểm trước tối thiểu (mét)
export const ROUTE_MIN_POINT_DISTANCE_M = 15;
// Số điểm tối đa được giữ trong lộ trình
export const ROUTE_MAX_POINTS = 200;
// Khi vượt ROUTE_MAX_POINTS, rút gọn (Ramer–Douglas–Peucker) về số điểm này
export const ROUTE_DOWNSAMPLE_TARGET = 150;
// Số chữ số thập phân khi lưu toạ độ (6 chữ số ~ 0.11 m)
export const ROUTE_COORD_DECIMALS = 6;
// Chu kỳ ghi nháp lộ trình (AsyncStorage) để không mất khi app bị đóng giữa chừng
export const ROUTE_DRAFT_SAVE_INTERVAL_MS = 30000;

// ---------------------- Gợi ý hiệu chuẩn sải chân ----------------------
// Quãng đường GPS tối thiểu để đủ tin cậy (mét)
export const STRIDE_SUGGEST_MIN_GPS_DISTANCE_M = 300;
// Chỉ gợi ý khi sải chân ước tính lệch hơn 10% so với sải chân đang dùng
export const STRIDE_SUGGEST_DEVIATION_RATIO = 0.1;
