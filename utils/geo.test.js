// ============================================================================
// utils/geo.test.js
// Kiểm thử đơn vị cho utils/geo.js và utils/strideSuggestion.js.
// Chạy trực tiếp bằng lệnh: node --test utils/geo.test.js
// ============================================================================

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  downsampleRoute,
  downsampleUniform,
  evaluateGpsPoint,
  haversineDistanceM,
  normalizeRouteCoords,
  routeDistanceM,
  simplifyRouteRdp,
} from './geo.js';
import { suggestStrideFromGps } from './strideSuggestion.js';
import {
  configureRunRouteStore,
  getRunRoute,
  getRunRoutesByClientIds,
  saveRunRoute,
} from '../services/runRouteStore.js';
import { ROUTE_MAX_POINTS } from '../constants/runRoute.js';

// Sinh lộ trình thẳng hướng Bắc, mỗi điểm cách nhau ~stepM mét
function straightRoute(count, stepM = 15, start = { latitude: 10.8, longitude: 106.6 }) {
  const dLat = stepM / 111195; // ~ mét / độ vĩ
  return Array.from({ length: count }, (_, i) => ({
    latitude: start.latitude + i * dLat,
    longitude: start.longitude,
    timestamp: i * 5000,
  }));
}

test('haversine: 1 độ vĩ ~ 111.2 km, cùng điểm = 0', () => {
  const d = haversineDistanceM({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 });
  assert.ok(Math.abs(d - 111195) < 50, `d=${d}`);
  assert.equal(haversineDistanceM({ latitude: 10, longitude: 106 }, { latitude: 10, longitude: 106 }), 0);
  assert.equal(haversineDistanceM(null, { latitude: 1, longitude: 1 }), 0);
});

test('routeDistanceM cộng dồn đúng và an toàn với dữ liệu thiếu', () => {
  const route = straightRoute(21, 15); // 20 đoạn x 15 m = 300 m
  assert.ok(Math.abs(routeDistanceM(route) - 300) < 0.5);
  assert.equal(routeDistanceM([]), 0);
  assert.equal(routeDistanceM(undefined), 0);
});

test('evaluateGpsPoint lọc accuracy kém, điểm nhảy và điểm trùng thời gian', () => {
  const a = { latitude: 10.8, longitude: 106.6, timestamp: 0, accuracy: 5 };
  assert.equal(evaluateGpsPoint(null, a).ok, true);
  assert.equal(evaluateGpsPoint(null, { ...a, accuracy: 45 }).reason, 'accuracy');
  assert.equal(evaluateGpsPoint(null, { latitude: NaN, longitude: 1 }).reason, 'invalid');
  // 15 m trong 5 s = 3 m/s -> hợp lệ
  const ok = { latitude: 10.8 + 15 / 111195, longitude: 106.6, timestamp: 5000, accuracy: 8 };
  assert.equal(evaluateGpsPoint(a, ok).ok, true);
  // 500 m trong 2 s = 250 m/s -> loại
  const jump = { latitude: 10.8 + 500 / 111195, longitude: 106.6, timestamp: 2000, accuracy: 8 };
  assert.equal(evaluateGpsPoint(a, jump).reason, 'speed');
  assert.equal(evaluateGpsPoint(a, { ...a }).reason, 'stale');
});

test('normalizeRouteCoords: bản ghi cũ / dữ liệu hỏng -> mảng rỗng, không ném lỗi', () => {
  assert.deepEqual(normalizeRouteCoords(undefined), []);
  assert.deepEqual(normalizeRouteCoords(null), []);
  assert.deepEqual(normalizeRouteCoords('không phải json'), []);
  assert.deepEqual(normalizeRouteCoords({}), []);
  const json = JSON.stringify([{ latitude: 10, longitude: 106 }, [10.1, 106.1], { latitude: 'x' }]);
  assert.deepEqual(normalizeRouteCoords(json), [
    { latitude: 10, longitude: 106 },
    { latitude: 10.1, longitude: 106.1 },
  ]);
});

test('downsample giữ điểm đầu/cuối và không vượt giới hạn', () => {
  const longRun = straightRoute(1000, 15);
  // Thêm chút zigzag để RDP có hình dạng để giữ
  longRun.forEach((p, i) => {
    p.longitude += (i % 40 < 20 ? i % 20 : 20 - (i % 20)) * 0.00001;
  });
  const reduced = downsampleRoute(longRun, ROUTE_MAX_POINTS);
  assert.ok(reduced.length <= ROUTE_MAX_POINTS, `len=${reduced.length}`);
  assert.equal(reduced[0], longRun[0]);
  assert.equal(reduced[reduced.length - 1], longRun[longRun.length - 1]);

  const uniform = downsampleUniform(longRun, 150);
  assert.equal(uniform.length, 150);
  assert.equal(uniform[0], longRun[0]);
  assert.equal(uniform[149], longRun[999]);

  // Đường thẳng tuyệt đối -> RDP chỉ cần 2 điểm
  assert.equal(simplifyRouteRdp(straightRoute(50), 1).length, 2);
  // Ít điểm hơn giới hạn -> giữ nguyên
  assert.equal(downsampleRoute(straightRoute(10), 200).length, 10);
});

test('suggestStrideFromGps: chỉ gợi ý khi đủ dữ liệu và lệch > 10%', () => {
  // 1000 m / 1250 bước = 0.8 m; đang dùng 0.7 m -> lệch 14.3% -> gợi ý
  const s1 = suggestStrideFromGps({ gpsDistanceM: 1000, steps: 1250, currentStrideM: 0.7 });
  assert.equal(s1.shouldSuggest, true);
  assert.equal(s1.estimatedStrideM, 0.8);

  // Lệch 5% -> không gợi ý
  const s2 = suggestStrideFromGps({ gpsDistanceM: 1000, steps: 1350, currentStrideM: 0.7 });
  assert.equal(s2.shouldSuggest, false);
  assert.equal(s2.reason, 'within_tolerance');

  assert.equal(suggestStrideFromGps({ gpsDistanceM: 250, steps: 300, currentStrideM: 0.7 }).reason, 'insufficient_distance');
  assert.equal(suggestStrideFromGps({ gpsDistanceM: 800, steps: 0, currentStrideM: 0.7 }).reason, 'no_steps');
  // 800 m / 100 bước = 8 m/bước -> ngoài 0.4–1.6 m -> không gợi ý
  assert.equal(suggestStrideFromGps({ gpsDistanceM: 800, steps: 100, currentStrideM: 0.7 }).reason, 'out_of_range');
  assert.equal(suggestStrideFromGps({}).shouldSuggest, false);
});

test('runRouteStore: JSON.stringify khi ghi, JSON.parse khi đọc và fallback rỗng cho bản ghi cũ', async () => {
  const rows = new Map();
  let lastRawJson = null;
  const mockDb = {
    async execAsync() {},
    async getFirstAsync(sql, params) {
      if (sql.includes('WHERE client_id')) {
        return rows.get(params[0]) || null;
      }
      return { user_version: 1 };
    },
    async getAllAsync(sql, params) {
      if (sql.includes('WHERE client_id IN')) {
        return params.map((id) => rows.get(id)).filter(Boolean);
      }
      return [];
    },
    async runAsync(_sql, params) {
      const [client_id, route_coords, gps_distance_m, point_count, updated_at] = params;
      lastRawJson = route_coords;
      rows.set(client_id, { client_id, route_coords, gps_distance_m, point_count, updated_at });
    },
  };

  configureRunRouteStore({ db: mockDb });
  const sampleRoute = [
    { latitude: 10.822363, longitude: 106.687487 },
    { latitude: 10.82251, longitude: 106.68762 },
  ];

  const saved = await saveRunRoute('r_1001_abcd', sampleRoute, 22);
  assert.equal(saved, true);
  assert.equal(typeof lastRawJson, 'string');
  assert.deepEqual(JSON.parse(lastRawJson), sampleRoute);

  const loaded = await getRunRoute('r_1001_abcd');
  assert.deepEqual(loaded, sampleRoute);

  // Bản ghi cũ không có trong bảng run_routes -> trả về [] thay vì crash
  const oldRunRoute = await getRunRoute('r_old_legacy');
  assert.deepEqual(oldRunRoute, []);

  const batch = await getRunRoutesByClientIds(['r_1001_abcd', 'r_old_legacy']);
  assert.equal(batch.size, 1);
  assert.deepEqual(batch.get('r_1001_abcd'), sampleRoute);

  configureRunRouteStore({ db: null });
});
