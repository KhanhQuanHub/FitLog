// ============================================================================
// Module: services/statisticsSession.js
// Chức năng: Lưu thông tin phiên đăng nhập hiện tại (`userId` và số thứ tự
// phiên `revision`) trong bộ nhớ RAM để phục vụ chức năng thống kê:
// - Giúp màn hình thống kê biết ai đang đăng nhập mà không cần đọc token mật.
// - Ghi nhớ những buổi chạy vừa được tạo offline trong phiên hiện tại
//   (`rememberQueuedRunOwner`) để thống kê tính luôn cả khi chưa có mạng.
// - Khi người dùng đăng xuất hoặc đổi tài khoản, xóa ngay dấu vết phiên cũ.
// ============================================================================

/** Trạng thái phiên hiện tại trong RAM: gồm mã người dùng và số lần đổi phiên */
let session = Object.freeze({ userId: null, revision: 0 });

/**
 * Bản đồ lưu các buổi chạy offline vừa tạo trong phiên hiện tại:
 * Key: `clientId` của buổi chạy -> Value: `revision` của phiên lúc tạo
 */
const owners = new Map();

/** Danh sách các hàm lắng nghe khi người dùng đăng nhập / đăng xuất */
const sessionListeners = new Set();

/** Danh sách các hàm lắng nghe khi dữ liệu buổi chạy (queue/cache) thay đổi */
const runListeners = new Set();

/**
 * Gọi tất cả các hàm lắng nghe (listeners) trong một tập hợp.
 * Bọc trong `try / catch` để nếu một màn hình bị lỗi giao diện thì không làm
 * ảnh hưởng tới quá trình đăng nhập hay lưu buổi chạy.
 *
 * @param {Set<() => void>} listeners Tập hợp các hàm callback cần thông báo
 * @returns {void}
 */
function emit(listeners) {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // Không làm gián đoạn luồng đăng nhập hoặc lưu buổi chạy
    }
  }
}

/**
 * Cập nhật mã người dùng (`userId`) cho phiên thống kê khi đăng nhập, khôi phục
 * phiên hoặc đăng xuất. Mỗi lần đổi người dùng sẽ tăng `revision` thêm 1 và
 * xóa danh sách buổi chạy tạm của phiên trước.
 *
 * @param {unknown} userId Mã người dùng mới (số, chuỗi, hoặc `null` khi đăng xuất)
 * @returns {void}
 */
export function setStatisticsIdentity(userId) {
  const isValidNumber = typeof userId === 'number' && Number.isFinite(userId);
  const isValidString = typeof userId === 'string' && userId.trim().length > 0;
  const normalized = isValidNumber || isValidString ? String(userId) : null;

  // Nếu vẫn là cùng một người dùng đang đăng nhập thì không cần tạo phiên mới
  if (normalized === session.userId && normalized !== null) {
    return;
  }

  session = Object.freeze({
    userId: normalized,
    revision: session.revision + 1,
  });
  owners.clear();
  emit(sessionListeners);
}

/**
 * Lấy thông tin phiên thống kê hiện tại.
 *
 * @returns {{ userId: string | null, revision: number }} Đối tượng phiên hiện tại
 */
export function getStatisticsSession() {
  return session;
}

/**
 * Đăng ký hàm lắng nghe khi phiên đăng nhập thay đổi.
 *
 * @param {() => void} listener Hàm callback sẽ được gọi khi đổi tài khoản/đăng xuất
 * @returns {() => void} Hàm hủy đăng ký (unsubscribe)
 */
export function subscribeStatisticsSession(listener) {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

/**
 * Đăng ký hàm lắng nghe khi danh sách buổi chạy (hàng đợi/bộ nhớ đệm) thay đổi.
 *
 * @param {() => void} listener Hàm callback sẽ được gọi khi có buổi chạy mới hoặc đồng bộ xong
 * @returns {() => void} Hàm hủy đăng ký (unsubscribe)
 */
export function subscribeRunStatistics(listener) {
  runListeners.add(listener);
  return () => {
    runListeners.delete(listener);
  };
}

/**
 * Ghi nhớ rằng buổi chạy có mã `clientId` vừa được tạo bởi người dùng của phiên `captured`.
 * Chỉ gọi sau khi đã lưu một buổi chạy MỚI vào hàng đợi (`AsyncStorage`) thành công.
 *
 * @param {string} clientId Mã định danh phía client của buổi chạy
 * @param {{ userId: string | null, revision: number }} captured Phiên chụp tại thời điểm bắt đầu lưu
 * @returns {void}
 */
export function rememberQueuedRunOwner(clientId, captured) {
  if (
    !clientId ||
    !captured.userId ||
    captured.userId !== session.userId ||
    captured.revision !== session.revision
  ) {
    return;
  }

  owners.set(clientId, captured.revision);

  // Hàng đợi offline giới hạn tối đa 100 bản ghi nên bộ nhớ RAM cũng chỉ giữ 100 mã gần nhất
  while (owners.size > 100) {
    const oldestKey = owners.keys().next().value;
    owners.delete(oldestKey);
  }
}

/**
 * Kiểm tra xem buổi chạy chờ đồng bộ (`clientId`) có đúng là của người dùng
 * trong phiên hiện tại (`captured`) tạo ra hay không.
 *
 * @param {string} clientId Mã định danh phía client của buổi chạy
 * @param {{ userId: string | null, revision: number }} captured Phiên đang kiểm tra
 * @returns {boolean} `true` nếu buổi chạy thuộc về phiên hiện tại
 */
export function ownsQueuedRun(clientId, captured) {
  return (
    captured.userId !== null &&
    captured.userId === session.userId &&
    captured.revision === session.revision &&
    owners.get(clientId) === session.revision
  );
}

/**
 * Phát thông báo cho các màn hình thống kê biết dữ liệu chạy bộ vừa thay đổi
 * để tự động làm mới số liệu.
 *
 * @returns {void}
 */
export function notifyRunStatisticsChanged() {
  emit(runListeners);
}
