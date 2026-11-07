// ============================================================================
// services/runRepository.js
// Tầng lưu trữ và đồng bộ dữ liệu chạy bộ (Offline-First Repository):
// - Giao diện trừu tượng rõ ràng (saveCheckpoint, loadCheckpoint, clearCheckpoint,
//   enqueueRun, getQueuedRuns, finishAndSaveRun, syncQueuedRuns, fetchHistoryPage...)
//   để sau này có thể chuyển sang expo-sqlite mà không cần sửa màn hình/hook.
// - Checkpoint mỗi 15 s hoặc 50 bước, giới hạn payload < 2 KB (2048 bytes).
// - Khi dừng: lưu vào hàng đợi cục bộ trước, xóa checkpoint, sau đó gửi lên
//   server MỘT lần kèm cơ chế thử lại backoff (2 s, 5 s, 15 s).
// - Khi gặp lỗi 401 (token hết hạn): giữ nguyên hàng đợi trong AsyncStorage,
//   chờ người dùng đăng nhập lại rồi đồng bộ tiếp.
// ============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getStatisticsSession,
  rememberQueuedRunOwner,
  notifyRunStatisticsChanged,
} from './statisticsSession';
import {
  getMyProfile,
  getRunsPage,
  saveRun,
  updateProfileCalibratedStride,
} from './api';

export const STORAGE_KEYS = {
  CHECKPOINT: '@figlog/run_checkpoint_v1',
  QUEUE: '@figlog/run_queue_v1',
  HISTORY_CACHE: '@figlog/run_history_cache_v1',
  CALIBRATION: '@figlog/run_calibration_v1',
};

export const MAX_CHECKPOINT_BYTES = 2048; // Giới hạn < 2 KB cho mỗi lần ghi checkpoint
export const BACKOFF_DELAYS_MS = [2000, 5000, 15000]; // Thử lại sau 2 s, 5 s, 15 s
const MAX_CACHED_HISTORY_ITEMS = 60; // Không lưu mảng không giới hạn trong bộ nhớ

// Cho phép ghi đè adapter khi chạy kiểm thử tự động trên Node
let storageAdapter = AsyncStorage;
let apiAdapter = {
  saveRun,
  getRunsPage,
  getMyProfile,
  updateProfileCalibratedStride,
};

let activeSyncPromise = null;

/**
 * Cấu hình dependency injection phục vụ kiểm thử đơn vị / tích hợp.
 *
 * @param {{ storage?: object, api?: object }} [overrides]
 */
export function configureRunRepository(overrides = {}) {
  if (overrides.storage) {
    storageAdapter = overrides.storage;
  }
  if (overrides.api) {
    apiAdapter = { ...apiAdapter, ...overrides.api };
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Sinh mã clientId duy nhất cho buổi chạy để chống ghi trùng (idempotent).
 * Định dạng: r_<timestamp>_<4 ký tự ngẫu nhiên>
 *
 * @param {number} [nowMs=Date.now()]
 * @returns {string}
 */
export function generateClientId(nowMs = Date.now()) {
  const rand = Math.random().toString(36).slice(2, 6).padEnd(4, '0');
  return `r_${nowMs}_${rand}`;
}

/**
 * Ước tính kích thước chuỗi JSON theo byte UTF-8.
 *
 * @param {string} str
 * @returns {number}
 */
export function getUtf8ByteLength(str) {
  if (typeof str !== 'string') return 0;
  let bytes = 0;
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdfff) {
      bytes += 4;
      i += 1;
    } else bytes += 3;
  }
  return bytes;
}

// ==================== 1. QUẢN LÝ CHECKPOINT (< 2 KB) ====================

/**
 * Lưu trạng thái buổi chạy dở dang vào AsyncStorage.
 * Đảm bảo kích thước JSON < 2 KB (2048 bytes).
 *
 * @param {object} checkpoint
 * @returns {Promise<boolean>}
 */
export async function saveCheckpoint(checkpoint) {
  if (!checkpoint || typeof checkpoint !== 'object') return false;

  const compact = {
    v: 1,
    clientId: checkpoint.clientId,
    startedAtMs: checkpoint.startedAtMs,
    accumulatedActiveMs: Math.round(checkpoint.accumulatedActiveMs || 0),
    totalPausedMs: Math.round(checkpoint.totalPausedMs || 0),
    steps: Math.round(checkpoint.steps || 0),
    strideM: checkpoint.strideM,
    strideSource: checkpoint.strideSource || 'formula',
    weightKg: checkpoint.weightKg || 60,
    source: checkpoint.source || 'pedometer',
    savedAtMs: Date.now(),
    // Giới hạn tối đa 25 splits gần nhất để luôn < 2 KB
    splits: Array.isArray(checkpoint.splits) ? checkpoint.splits.slice(-25) : [],
  };

  let serialized = JSON.stringify(compact);
  if (getUtf8ByteLength(serialized) >= MAX_CHECKPOINT_BYTES) {
    // Nếu vẫn sát ngưỡng 2 KB thì rút gọn mảng splits
    compact.splits = compact.splits.slice(-5);
    serialized = JSON.stringify(compact);
  }

  await storageAdapter.setItem(STORAGE_KEYS.CHECKPOINT, serialized);
  return true;
}

/**
 * Đọc checkpoint buổi chạy dở dang khi mở lại ứng dụng.
 *
 * @returns {Promise<object | null>}
 */
export async function loadCheckpoint() {
  try {
    const raw = await storageAdapter.getItem(STORAGE_KEYS.CHECKPOINT);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.clientId || !parsed.startedAtMs) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Xóa checkpoint sau khi buổi chạy đã được lưu hoặc hủy bỏ.
 *
 * @returns {Promise<void>}
 */
export async function clearCheckpoint() {
  try {
    await storageAdapter.removeItem(STORAGE_KEYS.CHECKPOINT);
  } catch {
    // Bỏ qua nếu không tồn tại
  }
}

// ==================== 2. HÀNG ĐỢI ĐỒNG BỘ OFFLINE (QUEUE) ====================

/**
 * Lấy danh sách các buổi chạy đang chờ gửi trong AsyncStorage.
 *
 * @returns {Promise<Array<object>>}
 */
export async function getQueuedRuns() {
  try {
    const raw = await storageAdapter.getItem(STORAGE_KEYS.QUEUE);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * Đưa một buổi chạy vào hàng đợi (chống trùng theo clientId).
 *
 * @param {object} runRecord
 * @returns {Promise<Array<object>>} Danh sách hàng đợi sau khi cập nhật
 */
export async function enqueueRun(runRecord) {
  if (!runRecord || !runRecord.clientId) return getQueuedRuns();
  const statisticsSession = getStatisticsSession();
  const currentQueue = await getQueuedRuns();
  const existingIndex = currentQueue.findIndex((item) => item.clientId === runRecord.clientId);

  const cleanRecord = { ...runRecord };
  let nextQueue;
  if (existingIndex >= 0) {
    nextQueue = [...currentQueue];
    nextQueue[existingIndex] = cleanRecord;
  } else {
    nextQueue = [cleanRecord, ...currentQueue];
  }

  // Giới hạn tối đa 100 bản ghi trong hàng đợi để bảo vệ bộ nhớ máy yếu
  if (nextQueue.length > 100) {
    nextQueue = nextQueue.slice(0, 100);
  }

  await storageAdapter.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(nextQueue));
  if (existingIndex < 0) rememberQueuedRunOwner(runRecord.clientId, statisticsSession);
  notifyRunStatisticsChanged();
  return nextQueue;
}

/**
 * Xóa một buổi chạy khỏi hàng đợi sau khi đã gửi thành công lên server.
 *
 * @param {string} clientId
 * @returns {Promise<Array<object>>}
 */
export async function removeQueuedRun(clientId) {
  const currentQueue = await getQueuedRuns();
  const nextQueue = currentQueue.filter((item) => item.clientId !== clientId);
  await storageAdapter.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(nextQueue));
  notifyRunStatisticsChanged();
  return nextQueue;
}

// ==================== 3. BỘ NHỚ ĐỆM LỊCH SỬ CỤC BỘ ====================

async function getCachedHistory() {
  try {
    const raw = await storageAdapter.getItem(STORAGE_KEYS.HISTORY_CACHE);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Lấy khóa duy nhất của bản ghi buổi chạy (ưu tiên clientId, sau đó đến id).
 * @param {object} run
 * @returns {string}
 */
export function getRunUniqueKey(run) {
  if (!run || typeof run !== 'object') return '';
  if (run.clientId) return String(run.clientId);
  if (run.id !== undefined && run.id !== null) return `id_${run.id}`;
  return '';
}

/**
 * Khử trùng lặp danh sách buổi chạy một cách tối ưu O(N).
 * @param {Array<object>} baseList Danh sách ưu tiên cao
 * @param {Array<object>} incomingList Danh sách mới cần gộp
 * @returns {Array<object>}
 */
export function dedupeRuns(baseList = [], incomingList = []) {
  const seen = new Set();
  const result = [];

  for (const item of baseList) {
    if (!item) continue;
    const key = getRunUniqueKey(item);
    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(item);
    } else if (!key) {
      result.push(item);
    }
  }

  for (const item of incomingList) {
    if (!item) continue;
    const key = getRunUniqueKey(item);
    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(item);
    } else if (!key) {
      result.push(item);
    }
  }

  return result;
}

async function prependToHistoryCache(savedRun) {
  if (!savedRun) return;
  try {
    const current = await getCachedHistory();
    const updated = dedupeRuns([savedRun], current).slice(0, MAX_CACHED_HISTORY_ITEMS);
    await storageAdapter.setItem(STORAGE_KEYS.HISTORY_CACHE, JSON.stringify(updated));
    notifyRunStatisticsChanged();
  } catch {
    // Bỏ qua lỗi ghi bộ nhớ đệm
  }
}

// ==================== 4. GỬI SERVER KÈM BACKOFF & ĐỒNG BỘ ====================

/**
 * Lưu buổi chạy khi người dùng bấm Dừng:
 * 1. Ghi ngay vào hàng đợi cục bộ trên máy & xóa checkpoint (an toàn tuyệt đối khi mất mạng/sập nguồn).
 * 2. Gửi lên server 1 lần, nếu lỗi mạng thì thử lại với backoff (2 s, 5 s, 15 s).
 * 3. Nếu gặp lỗi 401 (hết hạn token): dừng thử lại ngay, giữ nguyên trong hàng đợi.
 * 4. Nếu thành công: xóa khỏi hàng đợi và trả về trạng thái 'saved'.
 *
 * @param {object} runRecord Bản ghi buổi chạy đầy đủ
 * @param {{ backoffDelaysMs?: number[], onRetry?: (attempt: number, delayMs: number) => void }} [options]
 * @returns {Promise<{
 *   status: 'saved' | 'queued' | 'invalid',
 *   run: object,
 *   reason?: string,
 *   attempts: number
 * }>}
 */
export async function finishAndSaveRun(runRecord, options = {}) {
  const delays = Array.isArray(options.backoffDelaysMs)
    ? options.backoffDelaysMs
    : BACKOFF_DELAYS_MS;

  // Bước 1: Lưu vào hàng đợi cục bộ trước và xóa checkpoint
  await enqueueRun(runRecord);
  await clearCheckpoint();

  let attempts = 0;

  // Bước 2: Thử gửi lần đầu + tối đa 3 lần retry theo backoff (2s, 5s, 15s)
  for (let i = 0; i <= delays.length; i += 1) {
    attempts += 1;
    try {
      const savedOnServer = await apiAdapter.saveRun(runRecord);
      await removeQueuedRun(runRecord.clientId);
      await prependToHistoryCache(savedOnServer);
      return {
        status: 'saved',
        run: savedOnServer,
        attempts,
      };
    } catch (err) {
      const httpStatus = err?.status || 0;

      // Nếu token hết hạn (401): KHÔNG xóa hàng đợi, dừng retry để người dùng đăng nhập lại
      if (httpStatus === 401) {
        return {
          status: 'queued',
          run: runRecord,
          reason: 'unauthorized',
          attempts,
        };
      }

      // Nếu dữ liệu vi phạm quy tắc 422 của server: báo lỗi ngay, không giữ bản ghi lỗi trong hàng đợi
      if (httpStatus === 422) {
        await removeQueuedRun(runRecord.clientId);
        return {
          status: 'invalid',
          run: runRecord,
          reason: err?.message || 'Dữ liệu buổi chạy không hợp lệ (422)',
          attempts,
        };
      }

      // Nếu còn lượt thử lại trong bảng backoff -> chờ rồi thử tiếp
      if (i < delays.length) {
        const waitMs = delays[i];
        if (typeof options.onRetry === 'function') {
          options.onRetry(i + 1, waitMs);
        }
        await sleep(waitMs);
      }
    }
  }

  // Sau khi thử hết backoff vẫn chưa có mạng -> giữ nguyên trong hàng đợi
  return {
    status: 'queued',
    run: runRecord,
    reason: 'offline',
    attempts,
  };
}

/**
 * Đồng bộ toàn bộ các buổi chạy đang xếp hàng trong AsyncStorage lên server.
 * Chặn gọi chồng chéo (single-flight) để tránh gửi trùng khi mạng chập chờn.
 *
 * @returns {Promise<{
 *   syncedCount: number,
 *   remainingCount: number,
 *   authRequired: boolean
 * }>}
 */
export async function syncQueuedRuns() {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  activeSyncPromise = (async () => {
    const queue = await getQueuedRuns();
    if (queue.length === 0) {
      return { syncedCount: 0, remainingCount: 0, authRequired: false };
    }

    // Đồng bộ theo thứ tự từ cũ đến mới
    const ordered = [...queue].reverse();
    let syncedCount = 0;
    let authRequired = false;

    for (let i = 0; i < ordered.length; i += 1) {
      const item = ordered[i];
      try {
        const saved = await apiAdapter.saveRun(item);
        await removeQueuedRun(item.clientId);
        await prependToHistoryCache(saved);
        syncedCount += 1;
      } catch (err) {
        if (err?.status === 401) {
          // Token hết hạn: dừng đồng bộ nhưng GIỮ NGUYÊN các bản ghi còn lại trong hàng đợi
          authRequired = true;
          break;
        }
        if (err?.status === 422) {
          // Bản ghi không hợp lệ 422 -> loại khỏi hàng đợi để không kẹt vĩnh viễn
          await removeQueuedRun(item.clientId);
        } else {
          // Mất mạng -> dừng vòng lặp, chờ lần đồng bộ tiếp theo
          break;
        }
      }
    }

    const remaining = await getQueuedRuns();
    return {
      syncedCount,
      remainingCount: remaining.length,
      authRequired,
    };
  })();

  try {
    return await activeSyncPromise;
  } finally {
    activeSyncPromise = null;
  }
}

// ==================== 5. TRUY VẤN LỊCH SỬ PHÂN TRANG ====================

/**
 * Tải một trang lịch sử buổi chạy (mặc định 20 bản ghi/trang).
 * Ở trang 1, ghép thêm các buổi chạy đang chờ gửi trong hàng đợi (đánh dấu _queued = true)
 * và không bao giờ tạo bản ghi trùng theo clientId.
 *
 * @param {number} [page=1]
 * @param {number} [limit=20]
 * @returns {Promise<{
 *   items: Array<object>,
 *   hasMore: boolean,
 *   fromCache: boolean,
 *   queuedCount: number
 * }>}
 */
export async function fetchRunHistoryPage(page = 1, limit = 20) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Number(limit) || 20);
  const queue = await getQueuedRuns();

  try {
    const serverItems = await apiAdapter.getRunsPage(safePage, safeLimit);
    const validServerItems = Array.isArray(serverItems) ? serverItems : [];

    if (safePage === 1 && validServerItems.length > 0) {
      await storageAdapter.setItem(
        STORAGE_KEYS.HISTORY_CACHE,
        JSON.stringify(validServerItems.slice(0, MAX_CACHED_HISTORY_ITEMS))
      );
    }

    let merged = validServerItems;
    if (safePage === 1 && queue.length > 0) {
      const pendingItems = queue.map((q) => ({ ...q, _queued: true }));
      merged = dedupeRuns(pendingItems, validServerItems);
    }

    return {
      items: merged,
      hasMore: validServerItems.length === safeLimit,
      fromCache: false,
      queuedCount: queue.length,
    };
  } catch {
    // Fallback offline: chỉ trả dữ liệu bộ nhớ đệm ở trang 1
    if (safePage > 1) {
      return {
        items: [],
        hasMore: false,
        fromCache: true,
        queuedCount: queue.length,
      };
    }

    const cached = await getCachedHistory();
    const pendingItems = queue.map((q) => ({ ...q, _queued: true }));
    const fallbackList = dedupeRuns(pendingItems, cached).slice(0, safeLimit);

    return {
      items: fallbackList,
      hasMore: false,
      fromCache: true,
      queuedCount: queue.length,
    };
  }
}

// ==================== 6. LƯU & ĐỒNG BỘ SẢI CHÂN HIỆU CHUẨN ====================

/**
 * Đọc sải chân đã hiệu chuẩn lưu trên thiết bị.
 *
 * @returns {Promise<number | null>}
 */
export async function loadCalibratedStrideM() {
  try {
    const raw = await storageAdapter.getItem(STORAGE_KEYS.CALIBRATION);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const val = Number(parsed?.calibratedStrideM);
    if (Number.isFinite(val) && val >= 0.4 && val <= 1.6) {
      return val;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Lưu sải chân hiệu chuẩn vào máy và đồng bộ lên bảng "profiles" trên server nếu có mạng.
 *
 * @param {number | null} calibratedStrideM
 * @param {number | string} [profileId]
 * @returns {Promise<{ synced: boolean }>}
 */
export async function saveCalibratedStrideM(calibratedStrideM, profileId) {
  if (calibratedStrideM === null) {
    await storageAdapter.removeItem(STORAGE_KEYS.CALIBRATION);
  } else {
    await storageAdapter.setItem(
      STORAGE_KEYS.CALIBRATION,
      JSON.stringify({
        calibratedStrideM,
        updatedAt: new Date().toISOString(),
      })
    );
  }

  try {
    let targetProfileId = profileId;
    if (!targetProfileId) {
      const profile = await apiAdapter.getMyProfile();
      targetProfileId = profile?.id;
    }
    if (targetProfileId) {
      await apiAdapter.updateProfileCalibratedStride(targetProfileId, calibratedStrideM);
      return { synced: true };
    }
  } catch {
    // Đã lưu cục bộ trên máy, lỗi mạng khi cập nhật profile sẽ không làm mất sải chân
  }
  return { synced: false };
}

export const runRepository = {
  generateClientId,
  saveCheckpoint,
  loadCheckpoint,
  clearCheckpoint,
  getQueuedRuns,
  enqueueRun,
  removeQueuedRun,
  finishAndSaveRun,
  syncQueuedRuns,
  fetchRunHistoryPage,
  loadCalibratedStrideM,
  saveCalibratedStrideM,
};
