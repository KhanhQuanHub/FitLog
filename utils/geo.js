// ============================================================================
// utils/geo.js
// Các hàm thuần (pure functions) xử lý toạ độ GPS cho lộ trình chạy bộ:
// - Khoảng cách Haversine giữa 2 điểm & tổng quãng đường của lộ trình
// - Đánh giá điểm GPS (lọc accuracy kém, điểm "nhảy" với tốc độ phi thực tế)
// - Rút gọn lộ trình (Ramer–Douglas–Peucker, fallback lấy mẫu đều) để giữ <= N điểm
// - Chuẩn hoá dữ liệu routeCoords đọc từ bộ nhớ (mảng / chuỗi JSON / null) -> mảng an toàn
// Không phụ thuộc React Native -> test độc lập bằng: node utils/geo.test.js
// ============================================================================

import {
  GPS_MAX_ACCURACY_M,
  GPS_MAX_SPEED_MPS,
  ROUTE_COORD_DECIMALS,
} from '../constants/runRoute.js';

const EARTH_RADIUS_M = 6371000;
const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Kiểm tra một toạ độ hợp lệ (số hữu hạn, nằm trong miền vĩ độ/kinh độ).
 *
 * @param {any} point
 * @returns {boolean}
 */
export function isValidCoordinate(point) {
  if (!point || typeof point !== 'object') return false;
  const { latitude, longitude } = point;
  return (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * Khoảng cách Haversine giữa 2 điểm (mét).
 *
 * @param {{latitude:number, longitude:number}} a
 * @param {{latitude:number, longitude:number}} b
 * @returns {number}
 */
export function haversineDistanceM(a, b) {
  if (!isValidCoordinate(a) || !isValidCoordinate(b)) return 0;
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const dLat = lat2 - lat1;
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Tổng quãng đường của lộ trình (mét) = tổng Haversine giữa các điểm liên tiếp.
 *
 * @param {Array<{latitude:number, longitude:number}>} points
 * @returns {number}
 */
export function routeDistanceM(points) {
  if (!Array.isArray(points) || points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += haversineDistanceM(points[i - 1], points[i]);
  }
  return total;
}

/**
 * Đánh giá một điểm GPS mới so với điểm hợp lệ trước đó.
 *
 * @param {{latitude:number, longitude:number, timestamp?:number} | null} prev Điểm hợp lệ trước (hoặc null)
 * @param {{latitude:number, longitude:number, timestamp?:number, accuracy?:number|null}} next Điểm mới
 * @param {{ maxAccuracyM?: number, maxSpeedMps?: number }} [options]
 * @returns {{ ok: boolean, reason: null | 'invalid' | 'accuracy' | 'stale' | 'speed', distanceM: number, speedMps: number }}
 */
export function evaluateGpsPoint(prev, next, options = {}) {
  const maxAccuracyM = options.maxAccuracyM ?? GPS_MAX_ACCURACY_M;
  const maxSpeedMps = options.maxSpeedMps ?? GPS_MAX_SPEED_MPS;

  if (!isValidCoordinate(next)) {
    return { ok: false, reason: 'invalid', distanceM: 0, speedMps: 0 };
  }
  const accuracy = Number(next.accuracy);
  // accuracy null/undefined (một số máy ảo) -> chấp nhận; có giá trị mà > ngưỡng -> loại
  if (next.accuracy !== null && next.accuracy !== undefined && (!Number.isFinite(accuracy) || accuracy > maxAccuracyM)) {
    return { ok: false, reason: 'accuracy', distanceM: 0, speedMps: 0 };
  }
  if (!prev || !isValidCoordinate(prev)) {
    return { ok: true, reason: null, distanceM: 0, speedMps: 0 };
  }

  const distanceM = haversineDistanceM(prev, next);
  const dtSec = (Number(next.timestamp) - Number(prev.timestamp)) / 1000;
  if (!Number.isFinite(dtSec) || dtSec <= 0) {
    // Trùng hoặc lùi thời gian: chỉ chấp nhận nếu gần như không dịch chuyển
    return distanceM < 1
      ? { ok: false, reason: 'stale', distanceM, speedMps: 0 }
      : { ok: false, reason: 'speed', distanceM, speedMps: Infinity };
  }
  const speedMps = distanceM / dtSec;
  if (speedMps > maxSpeedMps) {
    return { ok: false, reason: 'speed', distanceM, speedMps };
  }
  return { ok: true, reason: null, distanceM, speedMps };
}

/**
 * Làm tròn toạ độ & chỉ giữ {latitude, longitude} để lưu trữ gọn.
 *
 * @param {{latitude:number, longitude:number}} point
 * @param {number} [decimals=ROUTE_COORD_DECIMALS]
 * @returns {{latitude:number, longitude:number}}
 */
export function compactCoordinate(point, decimals = ROUTE_COORD_DECIMALS) {
  const f = 10 ** decimals;
  return {
    latitude: Math.round(point.latitude * f) / f,
    longitude: Math.round(point.longitude * f) / f,
  };
}

/**
 * Chuẩn hoá routeCoords đọc từ bộ nhớ/server về mảng {latitude, longitude} hợp lệ.
 * Chấp nhận: mảng object, mảng [lat, lng], chuỗi JSON, null/undefined (-> []).
 * Bản ghi cũ không có routeCoords luôn trả về [] thay vì ném lỗi.
 *
 * @param {any} raw
 * @returns {Array<{latitude:number, longitude:number}>}
 */
export function normalizeRouteCoords(raw) {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];

  const result = [];
  for (let i = 0; i < value.length; i += 1) {
    const item = value[i];
    const point = Array.isArray(item)
      ? { latitude: Number(item[0]), longitude: Number(item[1]) }
      : item && typeof item === 'object'
        ? { latitude: Number(item.latitude), longitude: Number(item.longitude) }
        : null;
    if (point && isValidCoordinate(point)) {
      result.push(point);
    }
  }
  return result;
}

/**
 * Lấy mẫu đều: giữ điểm đầu, điểm cuối và các điểm cách đều ở giữa.
 *
 * @template T
 * @param {T[]} points
 * @param {number} maxPoints
 * @returns {T[]}
 */
export function downsampleUniform(points, maxPoints) {
  if (!Array.isArray(points)) return [];
  if (maxPoints < 2 || points.length <= maxPoints) return points.slice();
  const result = [];
  const step = (points.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i += 1) {
    result.push(points[Math.round(i * step)]);
  }
  return result;
}

// Khoảng cách vuông góc (mét) từ p tới đoạn thẳng a-b trên mặt phẳng chiếu equirectangular cục bộ
function perpendicularDistanceM(p, a, b, cosLat) {
  const ax = toRad(a.longitude) * cosLat * EARTH_RADIUS_M;
  const ay = toRad(a.latitude) * EARTH_RADIUS_M;
  const bx = toRad(b.longitude) * cosLat * EARTH_RADIUS_M;
  const by = toRad(b.latitude) * EARTH_RADIUS_M;
  const px = toRad(p.longitude) * cosLat * EARTH_RADIUS_M;
  const py = toRad(p.latitude) * EARTH_RADIUS_M;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Rút gọn lộ trình bằng Ramer–Douglas–Peucker (dùng ngăn xếp, không đệ quy).
 * Luôn giữ điểm đầu & điểm cuối.
 *
 * @template T
 * @param {T[]} points
 * @param {number} epsilonM Ngưỡng sai lệch cho phép (mét)
 * @returns {T[]}
 */
export function simplifyRouteRdp(points, epsilonM) {
  if (!Array.isArray(points) || points.length <= 2) return Array.isArray(points) ? points.slice() : [];
  const n = points.length;
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const cosLat = Math.cos(toRad(points[0].latitude));
  const stack = [[0, n - 1]];

  while (stack.length > 0) {
    const [start, end] = stack.pop();
    let maxDist = -1;
    let index = -1;
    for (let i = start + 1; i < end; i += 1) {
      const d = perpendicularDistanceM(points[i], points[start], points[end], cosLat);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (index !== -1 && maxDist > epsilonM) {
      keep[index] = 1;
      stack.push([start, index], [index, end]);
    }
  }

  const result = [];
  for (let i = 0; i < n; i += 1) {
    if (keep[i]) result.push(points[i]);
  }
  return result;
}

/**
 * Rút gọn lộ trình về tối đa `maxPoints` điểm, giữ hình dạng tốt nhất có thể:
 * tăng dần epsilon của RDP cho tới khi đủ ít điểm; nếu vẫn chưa đạt thì lấy mẫu đều.
 *
 * @template T
 * @param {T[]} points
 * @param {number} maxPoints
 * @returns {T[]}
 */
export function downsampleRoute(points, maxPoints) {
  if (!Array.isArray(points)) return [];
  if (points.length <= maxPoints) return points.slice();

  let epsilonM = 1;
  let simplified = points;
  for (let attempt = 0; attempt < 25 && simplified.length > maxPoints; attempt += 1) {
    simplified = simplifyRouteRdp(points, epsilonM);
    epsilonM *= 1.6;
  }
  return simplified.length > maxPoints ? downsampleUniform(simplified, maxPoints) : simplified;
}
