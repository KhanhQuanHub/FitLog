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
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Bộ nhớ đệm token trong RAM phục vụ truy xuất nhanh trong phiên
/** @type {string | null} */
let memoryToken = null;
/** @type {Set<() => void>} */
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
 * Giải mã chuỗi Base64 sang chuỗi UTF-8 an toàn trên mọi môi trường (Hermes, Web, Node).
 *
 * @param {string} paddedBase64
 * @returns {string | null}
 */
function decodeBase64ToUtf8(paddedBase64) {
  if (typeof globalThis.atob === 'function') {
    const binary = globalThis.atob(paddedBase64);
    try {
      const percentEncoded = Array.from(binary)
        .map((ch) => `%${ch.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join('');
      return decodeURIComponent(percentEncoded);
    } catch {
      return binary;
    }
  }

  const globalBuffer = /** @type {any} */ (globalThis).Buffer;
  if (typeof globalBuffer !== 'undefined' && typeof globalBuffer.from === 'function') {
    return globalBuffer.from(paddedBase64, 'base64').toString('utf8');
  }

  // Fallback thuần JS khi môi trường không có sẵn atob hoặc Buffer
  const clean = paddedBase64.replace(/[^A-Za-z0-9+/=]/g, '');
  let bytes = [];
  for (let i = 0; i < clean.length; i += 4) {
    const enc1 = BASE64_CHARS.indexOf(clean.charAt(i));
    const enc2 = BASE64_CHARS.indexOf(clean.charAt(i + 1));
    const enc3 = clean.charAt(i + 2) === '=' ? 64 : BASE64_CHARS.indexOf(clean.charAt(i + 2));
    const enc4 = clean.charAt(i + 3) === '=' ? 64 : BASE64_CHARS.indexOf(clean.charAt(i + 3));

    if (enc1 < 0 || enc2 < 0 || enc3 < 0 || enc4 < 0) return null;

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    bytes.push(chr1);
    if (enc3 !== 64) bytes.push(chr2);
    if (enc4 !== 64) bytes.push(chr3);
  }

  try {
    const percentEncoded = bytes.map((b) => `%${b.toString(16).padStart(2, '0')}`).join('');
    return decodeURIComponent(percentEncoded);
  } catch {
    return String.fromCharCode(...bytes);
  }
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

    const jsonStr = decodeBase64ToUtf8(padded);
    if (!jsonStr) return null;

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
 * @typedef {RequestInit & {
 *   timeoutMs?: number,
 *   skipAuth?: boolean,
 *   headers?: Record<string, string>
 * }} ApiRequestOptions
 */

/**
 * Hàm gọi mạng trung tâm dùng fetch + AbortController (timeout 10 giây).
 *
 * @param {string} path Đường dẫn API (ví dụ '/login', '/runs')
 * @param {ApiRequestOptions} [options={}] Tùy chọn fetch
 * @returns {Promise<any>}
 */
export async function request(path, options = {}) {
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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, options.timeoutMs || API_TIMEOUT_MS);

  try {
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
      if (path === '/change-password') {
        throw new ApiError(payload?.error || 'Mật khẩu hiện tại không đúng', 401, payload, 'AUTH');
      }
      if (isPublicAuthRequest) {
        throw new ApiError(
          payload?.error || `Yêu cầu không hợp lệ (${response.status})`,
          401,
          payload,
          'AUTH'
        );
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
        path === '/password-reset' && typeof payload?.error === 'string'
          ? payload.error
          : 'Máy chủ đang gặp sự cố tạm thời. Vui lòng thử lại.',
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
    const errName =
      err && typeof err === 'object' && 'name' in err ? /** @type {any} */ (err).name : '';
    if (errName === 'AbortError') {
      throw new ApiError(
        `Hết thời gian chờ phản hồi từ máy chủ (${currentBaseUrl}, quá 10 giây). Kiểm tra lại IP laptop hoặc Firewall.`,
        408,
        null,
        'TIMEOUT'
      );
    }
    throw new ApiError(
      `Không thể kết nối máy chủ (${currentBaseUrl}). Hãy kiểm tra hai máy chung Wi-Fi, đã chạy json-server và mở Firewall cổng 3000.`,
      0,
      null,
      'NETWORK'
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Tạo token giả định dạng <base64url>.demo khi chạy json-server thuần (không qua auth.js)
 * để `decodeTokenPayload()` và `verifyStoredSession()` hoạt động đồng nhất.
 *
 * @param {Record<string, any>} user
 * @returns {string}
 */
function buildFallbackDemoToken(user) {
  const payloadJson = JSON.stringify({
    id: user?.id ?? 1,
    role: user?.role || 'user',
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });

  const globalBuffer = /** @type {any} */ (globalThis).Buffer;
  if (typeof globalBuffer !== 'undefined' && typeof globalBuffer.from === 'function') {
    return `${globalBuffer.from(payloadJson, 'utf8').toString('base64url')}.demo`;
  }

  const utf8Bytes = encodeURIComponent(payloadJson).replace(
    /%([0-9A-F]{2})/g,
    (_m, hex) => String.fromCharCode(parseInt(hex, 16))
  );

  if (typeof globalThis.btoa === 'function') {
    const b64 = globalThis.btoa(utf8Bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `${b64}.demo`;
  }

  let out = '';
  for (let i = 0; i < utf8Bytes.length; i += 3) {
    const c1 = utf8Bytes.charCodeAt(i);
    const has2 = i + 1 < utf8Bytes.length;
    const has3 = i + 2 < utf8Bytes.length;
    const c2 = has2 ? utf8Bytes.charCodeAt(i + 1) : 0;
    const c3 = has3 ? utf8Bytes.charCodeAt(i + 2) : 0;

    out += BASE64_CHARS.charAt(c1 >> 2);
    out += BASE64_CHARS.charAt(((c1 & 3) << 4) | (c2 >> 4));
    if (has2) out += BASE64_CHARS.charAt(((c2 & 15) << 2) | (c3 >> 6));
    if (has3) out += BASE64_CHARS.charAt(c3 & 63);
  }
  return `${out.replace(/\+/g, '-').replace(/\//g, '_')}.demo`;
}

/**
 * Đăng nhập qua json-server:
 * - Gọi `GET {BASE_URL}/users?email=...&password=...` (timeout 10s bằng AbortController).
 * - Nếu mảng trả về có phần tử: lấy thông tin user + token (token thật từ auth.js hoặc
 *   token giả định dạng chuẩn khi chạy json-server thuần), lưu vào expo-secure-store.
 * - Nếu mảng rỗng: báo lỗi "Email hoặc mật khẩu không đúng" bằng tiếng Việt.
 *
 * @param {string} email
 * @param {string} password
 * @returns {Promise<Record<string, any> | null>}
 */
export async function login(email, password) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const queryPath = `/users?email=${encodeURIComponent(cleanEmail)}&password=${encodeURIComponent(
    String(password || '')
  )}`;

  const matchedList = await request(queryPath, {
    method: 'GET',
    skipAuth: true,
  });

  if (!Array.isArray(matchedList) || matchedList.length === 0) {
    throw new ApiError('Email hoặc mật khẩu không đúng', 401, null, 'AUTH');
  }

  const rawUser = matchedList[0];
  const token =
    typeof rawUser?.token === 'string' && rawUser.token.trim() !== ''
      ? rawUser.token
      : buildFallbackDemoToken(rawUser);

  await setAuthToken(token);

  const { password: _removedPassword, token: _removedToken, ...safeUser } = rawUser || {};
  return {
    ...safeUser,
    fullName: safeUser.fullName || safeUser.name || 'Người dùng FitLog',
  };
}

export async function requestPasswordReset(email) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  return request('/password-reset', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify({ email: cleanEmail }),
  });
}

export async function changePassword(currentPassword, newPassword, confirmPassword) {
  return request('/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
  });
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
 * @param {{ heightCm?: number, weightKg?: number }} [extraProfile={}]
 * @returns {Promise<{ user: Record<string, any> | null, autoLoggedIn: boolean }>}
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
              userId: loggedInUser.id,
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
 * @returns {Promise<{ user: Record<string, any>, profile: Record<string, any> | null } | null>}
 */
export async function verifyStoredSession() {
  const token = await getAuthToken();
  if (!token) return null;

  const decoded = decodeTokenPayload(token);
  if (!decoded) {
    await clearAuthToken();
    return null;
  }

  if (typeof decoded.exp === 'number') {
    const expMs = decoded.exp < 1e11 ? decoded.exp * 1000 : decoded.exp;
    if (expMs <= Date.now()) {
      await clearAuthToken();
      return null;
    }
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

/**
 * Cây quyết định: lọc bài tập theo bệnh nền (hỗ trợ cả mã 'joint'/'cardio' lẫn nhãn tiếng Việt).
 *
 * @param {string | null} [healthCondition]
 * @returns {Promise<any>}
 */
export function getSafeExercises(healthCondition) {
  if (healthCondition === 'joint') return request('/exercises?impact=low');
  if (healthCondition === 'cardio') return request('/exercises?met_lte=5');

  const normalized = String(healthCondition || '').toLowerCase();
  const hasJoint = normalized.includes('joint') || normalized.includes('xương khớp');
  const hasCardio =
    normalized.includes('cardio') ||
    normalized.includes('tim mạch') ||
    normalized.includes('huyết áp');

  if (hasJoint && hasCardio) return request('/exercises?impact=low&met_lte=5');
  if (hasJoint) return request('/exercises?impact=low');
  if (hasCardio) return request('/exercises?met_lte=5');
  return request('/exercises');
}

/**
 * Lấy lịch tập theo khoảng ngày (giữ nguyên API hiện có).
 *
 * @param {number | string} userId
 * @param {string} from
 * @param {string} to
 * @returns {Promise<any>}
 */
export const getWorkouts = (userId, from, to) =>
  request(
    `/workouts?userId=${userId}&date_gte=${from}&date_lte=${to}&_expand=exercise&_sort=date,time`
  );

/**
 * Tạo buổi tập mới.
 *
 * @param {Record<string, any>} workout
 * @returns {Promise<Record<string, any>>}
 */
export const createWorkout = async (workout) => {
  const payload = { ...(workout || {}) };
  if (payload.userId === undefined || payload.userId === null || payload.userId === '') {
    const identity = decodeTokenPayload(await getAuthToken());
    if (identity?.id !== undefined) {
      payload.userId = identity.id;
    }
  }
  return request('/workouts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

/**
 * Cập nhật buổi tập theo ID.
 *
 * @param {number | string} workoutId
 * @param {Record<string, any>} workout
 * @returns {Promise<Record<string, any>>}
 */
export const updateWorkout = (workoutId, workout) =>
  request(`/workouts/${workoutId}`, {
    method: 'PATCH',
    body: JSON.stringify(workout),
  });

/**
 * Xóa buổi tập theo ID.
 *
 * @param {number | string} workoutId
 * @returns {Promise<any>}
 */
export const deleteWorkout = (workoutId) =>
  request(`/workouts/${workoutId}`, {
    method: 'DELETE',
  });

/**
 * Lưu buổi chạy mới lên server (giữ nguyên tên hàm saveRun hiện có).
 *
 * @param {Record<string, any>} run
 * @returns {Promise<Record<string, any>>}
 */
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
 * @returns {Promise<Array<Record<string, any>>>}
 */
export function getRunsPage(page = 1, limit = 20) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 20));
  return request(`/runs?_sort=startedAt&_order=desc&_page=${safePage}&_limit=${safeLimit}`);
}

/**
 * Lấy hồ sơ sức khỏe của người dùng đang đăng nhập.
 *
 * @returns {Promise<Record<string, any> | null>}
 */
export async function getMyProfile() {
  const identity = decodeTokenPayload(await getAuthToken());
  if (!identity?.id) return null;
  const list = await request(`/profiles?userId=${encodeURIComponent(identity.id)}`);
  return Array.isArray(list) && list.length > 0 ? list[0] : null;
}

/**
 * Lưu hoặc cập nhật hồ sơ sức khỏe của người dùng hiện tại.
 *
 * @param {Record<string, any>} profile
 * @returns {Promise<Record<string, any>>}
 */
export async function saveMyProfile(profile) {
  const existing = await getMyProfile();
  if (existing?.id !== undefined && existing?.id !== null) {
    return request(`/profiles/${existing.id}`, {
      method: 'PATCH',
      body: JSON.stringify(profile),
    });
  }
  const identity = decodeTokenPayload(await getAuthToken());
  const payload =
    identity?.id !== undefined && profile?.userId === undefined
      ? { ...profile, userId: identity.id }
      : profile;
  return request('/profiles', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Cập nhật sải chân hiệu chuẩn lên bảng profiles của server.
 *
 * @param {number|string} profileId
 * @param {number|null} calibratedStrideM
 * @returns {Promise<Record<string, any>>}
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
