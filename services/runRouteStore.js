// ============================================================================
// services/runRouteStore.js
// Lưu trữ LỘ TRÌNH GPS của từng buổi chạy trong SQLite (expo-sqlite, đã có sẵn trong
// dependencies + plugin app.json) — hoạt động hoàn toàn offline, không phụ thuộc server.
// - Bảng run_routes (khóa chính client_id = clientId của buổi chạy).
// - routeCoords lưu dạng TEXT: JSON.stringify khi ghi, JSON.parse khi đọc.
// - Migration an toàn bằng PRAGMA user_version + "ALTER TABLE ... ADD COLUMN" cho cột thiếu,
//   KHÔNG xoá/tạo lại bảng nên không mất dữ liệu cũ.
// - Chỉ ghi MỘT lần khi kết thúc buổi chạy (không ghi theo từng điểm GPS để tiết kiệm pin).
// - Mọi lỗi (máy không hỗ trợ SQLite, chạy test Node, web...) đều được nuốt và trả về
//   giá trị fallback (mảng rỗng) để màn hình không bao giờ crash.
// ============================================================================

import { normalizeRouteCoords } from '../utils/geo.js';

const DB_NAME = 'figlog.db';
const SCHEMA_VERSION = 1;

// Định nghĩa cột (dùng cho cả CREATE TABLE và migration bổ sung cột còn thiếu)
const RUN_ROUTE_COLUMNS = [
  { name: 'route_coords', ddl: "route_coords TEXT NOT NULL DEFAULT '[]'" },
  { name: 'gps_distance_m', ddl: 'gps_distance_m REAL' },
  { name: 'point_count', ddl: 'point_count INTEGER NOT NULL DEFAULT 0' },
  { name: 'updated_at', ddl: 'updated_at TEXT' },
];

let dbPromise = null;
let dbOverride = null;

/**
 * Cho phép inject một đối tượng DB giả lập khi kiểm thử.
 *
 * @param {{ db?: object | null }} [overrides]
 */
export function configureRunRouteStore(overrides = {}) {
  if ('db' in overrides) {
    dbOverride = overrides.db;
    dbPromise = null;
  }
}

// Chỉ nạp expo-sqlite trên React Native (Android/iOS). Trên web/Node trả về null.
function loadSqliteModule() {
  const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
  if (!isReactNative) return null;
  // Nạp trễ để các script kiểm thử Node (figlog-server/test-acceptance.js) vẫn import được
  // services/runRepository.js mà không cần module native.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-sqlite');
}

async function migrate(db) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS run_routes (
      client_id TEXT PRIMARY KEY NOT NULL,
      ${RUN_ROUTE_COLUMNS.map((c) => c.ddl).join(',\n      ')}
    );
  `);

  const versionRow = await db.getFirstAsync('PRAGMA user_version');
  const currentVersion = Number(versionRow?.user_version) || 0;
  if (currentVersion >= SCHEMA_VERSION) return;

  // Bảng đã tồn tại từ phiên bản cũ có thể thiếu cột -> chỉ ADD COLUMN, giữ nguyên dữ liệu
  const existing = await db.getAllAsync('PRAGMA table_info(run_routes)');
  const existingNames = new Set(existing.map((col) => col.name));
  for (const column of RUN_ROUTE_COLUMNS) {
    if (!existingNames.has(column.name)) {
      await db.execAsync(`ALTER TABLE run_routes ADD COLUMN ${column.ddl};`);
    }
  }
  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
}

async function getDb() {
  if (dbOverride) return dbOverride;
  if (!dbPromise) {
    dbPromise = (async () => {
      const SQLite = loadSqliteModule();
      if (!SQLite) return null;
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await migrate(db);
      return db;
    })().catch(() => {
      dbPromise = null; // Cho phép thử lại ở lần gọi sau
      return null;
    });
  }
  return dbPromise;
}

/**
 * Lưu (hoặc ghi đè) lộ trình của một buổi chạy.
 *
 * @param {string} clientId
 * @param {Array<{latitude:number, longitude:number}>} routeCoords
 * @param {number} [gpsDistanceM]
 * @returns {Promise<boolean>} true nếu ghi thành công
 */
export async function saveRunRoute(clientId, routeCoords, gpsDistanceM) {
  if (!clientId) return false;
  const coords = normalizeRouteCoords(routeCoords);
  if (coords.length < 2) return false;
  try {
    const db = await getDb();
    if (!db) return false;
    await db.runAsync(
      `INSERT OR REPLACE INTO run_routes (client_id, route_coords, gps_distance_m, point_count, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      [
        String(clientId),
        JSON.stringify(coords),
        Number.isFinite(Number(gpsDistanceM)) ? Number(gpsDistanceM) : null,
        coords.length,
        new Date().toISOString(),
      ]
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Đọc lộ trình theo clientId. Không có dữ liệu / lỗi -> [].
 *
 * @param {string} clientId
 * @returns {Promise<Array<{latitude:number, longitude:number}>>}
 */
export async function getRunRoute(clientId) {
  if (!clientId) return [];
  try {
    const db = await getDb();
    if (!db) return [];
    const row = await db.getFirstAsync(
      'SELECT route_coords FROM run_routes WHERE client_id = ?',
      [String(clientId)]
    );
    return normalizeRouteCoords(row?.route_coords);
  } catch {
    return [];
  }
}

/**
 * Đọc lộ trình của nhiều buổi chạy cùng lúc (1 truy vấn) — dùng cho danh sách lịch sử.
 *
 * @param {string[]} clientIds
 * @returns {Promise<Map<string, Array<{latitude:number, longitude:number}>>>}
 */
export async function getRunRoutesByClientIds(clientIds) {
  const result = new Map();
  const ids = Array.isArray(clientIds) ? clientIds.filter(Boolean).map(String) : [];
  if (ids.length === 0) return result;
  try {
    const db = await getDb();
    if (!db) return result;
    const placeholders = ids.map(() => '?').join(',');
    const rows = await db.getAllAsync(
      `SELECT client_id, route_coords FROM run_routes WHERE client_id IN (${placeholders})`,
      ids
    );
    for (const row of rows) {
      const coords = normalizeRouteCoords(row?.route_coords);
      if (coords.length >= 2) result.set(String(row.client_id), coords);
    }
  } catch {
    // Trả về Map rỗng -> màn hình hiển thị "Không có dữ liệu lộ trình"
  }
  return result;
}
