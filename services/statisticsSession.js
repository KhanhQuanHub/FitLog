// Dấu vết chủ sở hữu chỉ trong RAM, không lưu token hoặc thay payload buổi chạy.
let session = Object.freeze({ userId: null, revision: 0 });
const owners = new Map();
const sessionListeners = new Set();
const runListeners = new Set();

function emit(listeners) {
  for (const listener of listeners) {
    try { listener(); } catch { /* Không làm gián đoạn đăng nhập/lưu buổi chạy. */ }
  }
}

/** @param {unknown} userId */
export function setStatisticsIdentity(userId) {
  const normalized = (typeof userId === 'number' && Number.isFinite(userId))
    || (typeof userId === 'string' && userId.trim()) ? String(userId) : null;
  if (normalized === session.userId && normalized !== null) return;
  session = Object.freeze({ userId: normalized, revision: session.revision + 1 });
  owners.clear();
  emit(sessionListeners);
}

export function getStatisticsSession() { return session; }

/** @param {() => void} listener */
export function subscribeStatisticsSession(listener) {
  sessionListeners.add(listener);
  return () => { sessionListeners.delete(listener); };
}

/** @param {() => void} listener */
export function subscribeRunStatistics(listener) {
  runListeners.add(listener);
  return () => { runListeners.delete(listener); };
}

/**
 * Chỉ gọi sau khi đã lưu một buổi MỚI vào queue thành công.
 * @param {string} clientId
 * @param {{userId: string | null, revision: number}} captured
 */
export function rememberQueuedRunOwner(clientId, captured) {
  if (!clientId || !captured.userId || captured.userId !== session.userId || captured.revision !== session.revision) return;
  owners.set(clientId, captured.revision);
  // Queue hiện giới hạn 100 dòng; giới hạn RAM tương ứng.
  while (owners.size > 100) owners.delete(owners.keys().next().value);
}

/** @param {string} clientId @param {{userId: string | null, revision: number}} captured */
export function ownsQueuedRun(clientId, captured) {
  return captured.userId !== null && captured.userId === session.userId
    && captured.revision === session.revision && owners.get(clientId) === session.revision;
}

export function notifyRunStatisticsChanged() { emit(runListeners); }
