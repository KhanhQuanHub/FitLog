// ============================================================================
// services/api.js
// Tầng giao tiếp mạng & quản lý Token xác thực cho FitLog:
// - Lưu trữ token độc quyền bằng expo-secure-store (KHÔNG dùng AsyncStorage cho token).
// - Tuyệt đối KHÔNG log mật khẩu hoặc token ra console.
// - Chuẩn hóa thông báo lỗi xác thực ("Email hoặc mật khẩu không đúng") để không
//   tiết lộ email có tồn tại hay không.
// - Phân loại rõ lỗi Mất mạng (status 0), Hết thời gian chờ (408), Quá số lần thử (429)
//   và Lỗi máy chủ (5xx) để giao diện hiển thị nút "Thử lại".
// - Hỗ trợ tự động kiểm tra & khôi phục phiên đăng nhập khi mở ứng dụng.
// ============================================================================

import * as SecureStore from 'expo-secure-store';
import { API_TIMEOUT_MS, BASE_URL, getBaseUrl, getBaseUrlAsync } from './config';
import { setStatisticsIdentity } from './statisticsSession';

export { BASE_URL, getBaseUrl, getBaseUrlAsync };

const TOKEN_STORAGE_KEY = 'figlog_auth_token';

// Bộ nhớ đệm token trong RAM phục vụ truy xuất nhanh trong phiên
let memoryToken = null;
const unauthorizedListeners = new Set();

export class ApiError extends Error {
  /**
   * @param {string} message Thông báo tiếng Việt hiển thị cho người dùng
   * @param {number} [status=0] Mã HTTP (0 = lỗi mạng, 408 = timeout)
   * @param {any} [data=null] Dữ liệu phản hồi kèm theo
   * @param {'AUTH' | 'RATE_LIMIT' | 'NETWORK' | 'TIMEOUT' | 'SERVER' | 'VALIDATION'} [kind='SERVER']
   */
  constructor(message, status = 0, data = null, kind = 'SERVER') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.kind = kind;
    this.retryable = kind === 'NETWORK' || kind === 'TIMEOUT' || kind === 'SERVER';
  }
}

/**
 * Đăng ký lắng nghe sự kiện token hết hạn (HTTP 401).
 *
 * @param {() => void} listener
 * @returns {() => void} Hàm hủy đăng ký
 */
export function subscribeUnauthorized(listener) {
  if (typeof listener === 'function') {
    unauthorizedListeners.add(listener);
  }
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

function notifyUnauthorized() {
  unauthorizedListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Không làm gián đoạn luồng chính
    }
  });
}

/**
 * Giải mã phần payload của token (định dạng <base64url>.<signature> hoặc JWT)
 * để kiểm tra hạn sử dụng (exp) và mã người dùng (id).
 *
 * @param {string | null} token
 * @returns {{ id?: number | string, role?: string, exp?: number } | null}
 */
export function decodeTokenPayload(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    const parts = token.split('.');
    const base64UrlBody = parts.length === 3 ? parts[1] : parts[0];
    if (!base64UrlBody) return null;

    const base64 = base64UrlBody.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (base64.length % 4)) % 4;
    const padded = base64 + '='.repeat(padLen);

    let jsonStr = '';
    if (typeof globalThis.atob === 'function') {
      jsonStr = globalThis.atob(padded);
    } else if (typeof Buffer !== 'undefined') {
      jsonStr = Buffer.from(padded, 'base64').toString('utf8');
    } else {
      return null;
    }

    const parsed = JSON.parse(jsonStr);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Đọc token từ expo-secure-store.
 *
 * @returns {Promise<string | null>}
 */
export async function getAuthToken() {
  if (memoryToken) {
    return memoryToken;
  }
  try {
    const available = await SecureStore.isAvailableAsync();
    if (available) {
      const stored = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
      memoryToken = stored || null;
      setStatisticsIdentity(decodeTokenPayload(memoryToken)?.id ?? null);
      return memoryToken;
    }
  } catch {
    // Fallback dùng biến trong RAM nếu môi trường không có native keychain
  }
  return memoryToken;
}

/**
 * Lưu token vào expo-secure-store (tuyệt đối không dùng AsyncStorage).
 *
 * @param {string | null} token
 * @returns {Promise<void>}
 */
export async function setAuthToken(token) {
  memoryToken = token || null;
  setStatisticsIdentity(decodeTokenPayload(memoryToken)?.id ?? null);
  try {
    const available = await SecureStore.isAvailableAsync();
    if (!available) return;
    if (token) {
      await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, token);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Giữ trong memoryToken nếu thiết bị không hỗ trợ
  }
}

/**
 * Xóa token khỏi expo-secure-store khi đăng xuất hoặc khi token hết hạn.
 *
 * @returns {Promise<void>}
 */
export async function clearAuthToken() {
  await setAuthToken(null);
}

/**
 * Hàm gọi mạng trung tâm dùng fetch + AbortController (timeout 10 giây).
 *
 * @param {string} path Đường dẫn API (ví dụ '/login', '/runs')
 * @param {object} [options={}] Tùy chọn fetch
 * @returns {Promise<any>}
 */
export async function request(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, options.timeoutMs || API_TIMEOUT_MS);

  try {
    const isPublicAuthRequest =
      options.skipAuth === true ||
      path === '/login' ||
      (path === '/users' && options.method === 'POST');

    const token = isPublicAuthRequest ? null : await getAuthToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };

    const currentBaseUrl = await getBaseUrlAsync();
    const response = await fetch(`${currentBaseUrl}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    let payload = null;
    const text = await response.text();
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = null;
      }
    }

    // Xử lý 401 (Sai thông tin đăng nhập hoặc Token hết hạn)
    if (response.status === 401) {
      if (path === '/login') {
        // Dùng chung một thông báo, không tiết lộ email có tồn tại hay không
        throw new ApiError('Email hoặc mật khẩu không đúng', 401, payload, 'AUTH');
      }
      await clearAuthToken();
      notifyUnauthorized();
      throw new ApiError(
        'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
        401,
        payload,
        'AUTH'
      );
    }

    // Xử lý 429 (Quá số lần thử đăng nhập sai liên tiếp)
    if (response.status === 429) {
      throw new ApiError(
        payload?.error || 'Bạn đã thử sai quá nhiều lần. Vui lòng đợi một lát rồi thử lại.',
        429,
        payload,
        'RATE_LIMIT'
      );
    }

    // Xử lý lỗi máy chủ 5xx
    if (response.status >= 500) {
      throw new ApiError(
        'Máy chủ đang gặp sự cố tạm thời. Vui lòng thử lại.',
        response.status,
        payload,
        'SERVER'
      );
    }

    if (!response.ok) {
      const serverMsg = payload?.error || `Yêu cầu không hợp lệ (${response.status})`;
      throw new ApiError(serverMsg, response.status, payload, 'VALIDATION');
    }

    return payload;
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    if (err && err.name === 'AbortError') {
      throw new ApiError(
        'Hết thời gian chờ phản hồi từ máy chủ (quá 10 giây).',
        408,
        null,
        'TIMEOUT'
      );
    }
    throw new ApiError(
      'Không thể kết nối máy chủ. Vui lòng kiểm tra mạng Wi-Fi/4G và thử lại.',
      0,
      null,
      'NETWORK'
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Đăng nhập thật qua POST /login:
 * - Gửi: { email: string (đã cắt khoảng trắng & chữ thường), password: string }
 * - Nhận: { token: string, user: { id, email, fullName, role } }
 * - Lưu token vào expo-secure-store.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<object | null>}
 */
export async function login(email, password) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const result = await request('/login', {
    method: 'POST',
    body: JSON.stringify({ email: cleanEmail, password }),
  });

  if (result && result.token) {
    await setAuthToken(result.token);
    return result.user ? { ...result.user } : result;
  }
  return null;
}

/**
 * Đăng ký tài khoản mới qua POST /users rồi tự động đăng nhập để nhận token.
 * Hỗ trợ cả 2 trường hợp:
 * - Backend trả token ngay hoặc cho phép POST /login tự động -> lưu token vào expo-secure-store
 * - Backend chỉ tạo tài khoản mà chưa cấp token -> trả { user, autoLoggedIn: false }
 *
 * @param {string} fullName
 * @param {string} email
 * @param {string} password
 * @param {{ heightCm?: number, weightKg?: number }} [extraProfile]
 * @returns {Promise<{ user: object | null, autoLoggedIn: boolean }>}
 */
export async function registerAccount(fullName, email, password, extraProfile = {}) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(fullName || '').trim();

  // Xóa mọi token cũ còn sót lại trong bộ nhớ/SecureStore trước khi đăng ký tài khoản mới
  await clearAuthToken();

  const created = await request('/users', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({
      fullName: cleanName,
      email: cleanEmail,
      password,
    }),
  });

  // Nếu API đăng ký trả kèm luôn token
  if (created && created.token) {
    await setAuthToken(created.token);
    const userObj = created.user ? { ...created.user } : created;
    return { user: userObj, autoLoggedIn: true };
  }

  // Tự động gọi POST /login để lấy token và lưu vào expo-secure-store
  try {
    const loggedInUser = await login(cleanEmail, password);
    if (loggedInUser) {
      // Nếu người dùng có nhập chiều cao / cân nặng ở bước 2 thì lưu vào bảng profiles
      if (extraProfile?.heightCm || extraProfile?.weightKg) {
        try {
          await request('/profiles', {
            method: 'POST',
            body: JSON.stringify({
              gender: 'male',
              heightCm: Number(extraProfile.heightCm) || 170,
              weightKg: Number(extraProfile.weightKg) || 60,
              sessionsPerWeek: 4,
              calibratedStrideM: null,
            }),
          });
        } catch {
          // Bỏ qua nếu bảng profiles đã tồn tại hoặc không bắt buộc
        }
      }
      return { user: loggedInUser, autoLoggedIn: true };
    }
  } catch {
    // Nếu backend yêu cầu người dùng tự đăng nhập thủ công sau khi đăng ký
  }

  return {
    user: created || null,
    autoLoggedIn: false,
  };
}

/**
 * Kiểm tra token đã lưu khi mở ứng dụng:
 * - Nếu không có token hoặc token đã quá hạn exp -> xóa token và trả về null.
 * - Nếu còn hạn -> gọi GET /users/:id và GET /profiles để lấy thông tin thật.
 *
 * @returns {Promise<{ user: object, profile: object | null } | null>}
 */
export async function verifyStoredSession() {
  const token = await getAuthToken();
  if (!token) return null;

  const decoded = decodeTokenPayload(token);
  if (!decoded || (decoded.exp && decoded.exp <= Date.now())) {
    await clearAuthToken();
    return null;
  }

  try {
    const userId = decoded.id;
    const [userRecord, profileRecord] = await Promise.all([
      userId ? request(`/users/${userId}`) : Promise.resolve(null),
      getMyProfile().catch(() => null),
    ]);

    if (!userRecord) {
      await clearAuthToken();
      return null;
    }

    return {
      user: userRecord,
      profile: profileRecord,
    };
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      await clearAuthToken();
      return null;
    }
    throw err;
  }
}

/**
 * Đăng xuất: xóa token khỏi expo-secure-store.
 */
export async function logoutApi() {
  await clearAuthToken();
}

// Cây quyết định: lọc bài tập theo bệnh nền (giữ nguyên API hiện có)
export function getSafeExercises(healthCondition) {
  if (healthCondition === 'joint') return request('/exercises?impact=low');
  if (healthCondition === 'cardio') return request('/exercises?met_lte=5');
  return request('/exercises');
}

// Lấy lịch tập theo khoảng ngày (giữ nguyên API hiện có)
export const getWorkouts = (userId, from, to) =>
  request(
    `/workouts?userId=${userId}&date_gte=${from}&date_lte=${to}&_expand=exercise&_sort=date,time`
  );

// Lưu buổi chạy mới lên server (giữ nguyên tên hàm saveRun hiện có)
export const saveRun = (run) =>
  request('/runs', {
    method: 'POST',
    body: JSON.stringify(run),
  });

/**
 * Lấy danh sách lịch sử buổi chạy có phân trang, sắp xếp mới nhất trước.
 *
 * @param {number} [page=1]
 * @param {number} [limit=20]
 * @returns {Promise<Array<object>>}
 */
export function getRunsPage(page = 1, limit = 20) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 20));
  return request(`/runs?_sort=startedAt&_order=desc&_page=${safePage}&_limit=${safeLimit}`);
}

/**
 * Lấy hồ sơ sức khỏe của người dùng đang đăng nhập.
 *
 * @returns {Promise<object | null>}
 */
export async function getMyProfile() {
  const list = await request('/profiles');
  return Array.isArray(list) && list.length > 0 ? list[0] : null;
}

/**
 * Cập nhật sải chân hiệu chuẩn lên bảng profiles của server.
 *
 * @param {number|string} profileId
 * @param {number|null} calibratedStrideM
 * @returns {Promise<object>}
 */
export function updateProfileCalibratedStride(profileId, calibratedStrideM) {
  return request(`/profiles/${profileId}`, {
    method: 'PATCH',
    body: JSON.stringify({ calibratedStrideM }),
  });
}

/**
 * Lấy toàn bộ danh sách các buổi tập theo lịch kèm thông tin bài tập (`_expand=exercise`),
 * sắp xếp từ ngày mới nhất đến cũ nhất để phục vụ tính toán thống kê.
 *
 * @returns {Promise<Array<object>>} Danh sách buổi tập từ bảng `workouts`
 */
export function getAllWorkouts() {
  return request('/workouts?_expand=exercise&_sort=date&_order=desc');
}

/**
 * Lấy toàn bộ danh sách các buổi chạy bộ từ bảng `runs`, sắp xếp từ ngày mới nhất
 * đến cũ nhất để phục vụ tính toán thống kê.
 *
 * @returns {Promise<Array<object>>} Danh sách buổi chạy từ bảng `runs`
 */
export function getAllRuns() {
  return request('/runs?_sort=date&_order=desc');
}

/**
 * Lấy danh sách mục tiêu cá nhân kèm chi tiết tên mục tiêu (`_expand=goal`)
 * từ bảng `userGoals` để đối chiếu tiến độ tuần.
 *
 * @returns {Promise<Array<object>>} Danh sách mục tiêu từ bảng `userGoals`
 */
export function getUserGoals() {
  return request('/userGoals?_expand=goal');
}

/**
 * Lấy toàn bộ lịch sử cân nặng từ bảng `weightHistory`, sắp xếp tăng dần theo ngày
 * để vẽ biểu đồ diễn biến cân nặng và tính BMI.
 *
 * @returns {Promise<Array<object>>} Danh sách các lần cân từ bảng `weightHistory`
 */
export function getWeightHistory() {
  return request('/weightHistory?_sort=date&_order=asc');
}
