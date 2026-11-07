// ============================================================================
// utils/strideSuggestion.js
// Gợi ý hiệu chuẩn sải chân từ quãng đường GPS so với số bước Pedometer.
//   sải chân thực tế (m/bước) = quãng đường GPS / số bước Pedometer
// Hàm thuần, CHỈ trả về gợi ý — không tự ghi đè cấu hình người dùng.
// Test độc lập bằng: node utils/geo.test.js
// ============================================================================

import {
  STRIDE_SUGGEST_DEVIATION_RATIO,
  STRIDE_SUGGEST_MIN_GPS_DISTANCE_M,
} from '../constants/runRoute.js';
import { calibrateStride } from './runMath.js';

/**
 * @typedef {object} StrideSuggestion
 * @property {boolean} shouldSuggest  true nếu nên hiện gợi ý cho người dùng
 * @property {number | null} estimatedStrideM  Sải chân ước tính từ GPS (m)
 * @property {number | null} currentStrideM  Sải chân đang cấu hình (m)
 * @property {number | null} deviationRatio  Độ lệch tương đối |ước tính - hiện tại| / hiện tại
 * @property {number} gpsDistanceM
 * @property {number} steps
 * @property {null | 'insufficient_distance' | 'no_steps' | 'no_current_stride' | 'out_of_range' | 'within_tolerance'} reason
 */

/**
 * Tính gợi ý hiệu chuẩn sải chân sau một buổi chạy.
 *
 * @param {object} params
 * @param {number} params.gpsDistanceM Quãng đường GPS (tổng Haversine, mét)
 * @param {number} params.steps Số bước Pedometer
 * @param {number} params.currentStrideM Sải chân đang cấu hình (m)
 * @param {number} [params.minDistanceM=STRIDE_SUGGEST_MIN_GPS_DISTANCE_M]
 * @param {number} [params.deviationThreshold=STRIDE_SUGGEST_DEVIATION_RATIO]
 * @returns {StrideSuggestion}
 */
export function suggestStrideFromGps({
  gpsDistanceM,
  steps,
  currentStrideM,
  minDistanceM = STRIDE_SUGGEST_MIN_GPS_DISTANCE_M,
  deviationThreshold = STRIDE_SUGGEST_DEVIATION_RATIO,
} = {}) {
  const dist = Number(gpsDistanceM) || 0;
  const stepCount = Math.round(Number(steps) || 0);
  const current = Number(currentStrideM);
  const base = {
    shouldSuggest: false,
    estimatedStrideM: null,
    currentStrideM: Number.isFinite(current) && current > 0 ? current : null,
    deviationRatio: null,
    gpsDistanceM: dist,
    steps: stepCount,
  };

  if (dist < minDistanceM) return { ...base, reason: 'insufficient_distance' };
  if (stepCount <= 0) return { ...base, reason: 'no_steps' };
  if (base.currentStrideM === null) return { ...base, reason: 'no_current_stride' };

  // Dùng lại quy tắc hợp lệ 0.4 m – 1.6 m của hiệu chuẩn thủ công
  const check = calibrateStride(dist, stepCount);
  if (!check.valid) return { ...base, reason: 'out_of_range' };

  const deviationRatio = Math.abs(check.strideM - base.currentStrideM) / base.currentStrideM;
  const rounded = Math.round(deviationRatio * 1000) / 1000;
  return {
    ...base,
    estimatedStrideM: check.strideM,
    deviationRatio: rounded,
    shouldSuggest: deviationRatio > deviationThreshold,
    reason: deviationRatio > deviationThreshold ? null : 'within_tolerance',
  };
}
