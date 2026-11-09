// ============================================================================
// fitlog-server/seed-statistics.mjs
// Script tạo thêm dữ liệu mẫu phong phú và chuẩn xác cho chức năng Thống kê:
// - Tự động tính toán các chỉ số chạy bộ (stride, distance, speed, pace, cadence, MET, calories, splits)
//   bằng chính các hàm chuẩn trong utils/runMath.js.
// - Bổ sung các bài tập (workouts), buổi chạy (runs) và lịch sử cân nặng (weightHistory)
//   trải đều từ tháng 08/2026 đến ngày hôm nay (09/11/2026).
// - Đảm bảo dữ liệu logic: không có buổi missed vô lý, chuỗi streak 4 ngày liên tiếp,
//   vòng tròn cam kết tuần và các biểu đồ Ngày/Tuần/Tháng/Năm đều hiển thị đẹp mắt.
// ============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  calculateFormulaStrideM,
  calculateDistanceKm,
  calculateSpeedKmh,
  calculatePaceSecPerKm,
  calculateCadenceSpm,
  interpolateMet,
  calculateCalories,
} from '../utils/runMath.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(__dirname, 'db.json');
const dbJsoncPath = resolve(__dirname, 'db.jsonc');

const db = JSON.parse(readFileSync(dbPath, 'utf8'));

// Cập nhật 2 buổi planned cũ của User 1 sang 'done' để giữ chuỗi streak đẹp cho đầu tháng 11
const w12 = db.workouts.find((w) => w.id === 12);
if (w12) {
  w12.status = 'done';
  w12.durationMin = 35;
  w12.caloriesBurned = 160;
  w12.note = 'Tập Plank & Cardio bổ trợ';
}
const w13 = db.workouts.find((w) => w.id === 13);
if (w13) {
  w13.status = 'done';
  w13.durationMin = 40;
  w13.caloriesBurned = 185;
  w13.note = 'Tập Squat & Core cuối tuần';
}

// ============================================================================
// 1. BỔ SUNG WORKOUTS (LỊCH TẬP)
// ============================================================================
const existingWorkoutIds = new Set(db.workouts.map((w) => w.id));
let nextWorkoutId = Math.max(...existingWorkoutIds, 0) + 1;

const newWorkouts = [
  // --- User 1: Tháng 08/2026 ---
  { userId: 1, exerciseId: 1, date: '2026-08-08', time: '18:00', status: 'done', durationMin: 30, caloriesBurned: 135, note: 'Khởi đầu kế hoạch tập luyện' },
  { userId: 1, exerciseId: 2, date: '2026-08-15', time: '18:00', status: 'done', durationMin: 40, caloriesBurned: 180, note: 'Tập chân tại nhà' },
  { userId: 1, exerciseId: 3, date: '2026-08-22', time: '18:30', status: 'done', durationMin: 35, caloriesBurned: 160, note: 'Cardio đốt mỡ' },
  { userId: 1, exerciseId: 4, date: '2026-08-29', time: '18:00', status: 'done', durationMin: 45, caloriesBurned: 200, note: 'Tăng cường core' },

  // --- User 1: Tháng 09/2026 ---
  { userId: 1, exerciseId: 1, date: '2026-09-05', time: '18:00', status: 'done', durationMin: 35, caloriesBurned: 160, note: 'Tập ngực & tay sau' },
  { userId: 1, exerciseId: 2, date: '2026-09-12', time: '18:30', status: 'done', durationMin: 40, caloriesBurned: 190, note: 'Squat tăng cơ chân' },
  { userId: 1, exerciseId: 3, date: '2026-09-19', time: '18:00', status: 'done', durationMin: 45, caloriesBurned: 210, note: 'HIIT toàn thân' },
  { userId: 1, exerciseId: 4, date: '2026-09-26', time: '19:00', status: 'done', durationMin: 50, caloriesBurned: 230, note: 'Plank tăng sức bền' },

  // --- User 1: Tháng 10/2026 ---
  { userId: 1, exerciseId: 1, date: '2026-10-06', time: '18:00', status: 'done', durationMin: 40, caloriesBurned: 190, note: 'Tập hít đất nâng cao' },
  { userId: 1, exerciseId: 2, date: '2026-10-13', time: '18:00', status: 'done', durationMin: 45, caloriesBurned: 210, note: 'Squat kết hợp bật nhảy' },
  { userId: 1, exerciseId: 4, date: '2026-10-20', time: '18:30', status: 'done', durationMin: 40, caloriesBurned: 190, note: 'Core săn chắc' },

  // --- User 1: Tháng 11/2026 (Tuần trước: 02/11 - 08/11) ---
  { userId: 1, exerciseId: 1, date: '2026-11-02', time: '18:00', status: 'done', durationMin: 45, caloriesBurned: 210, note: 'Cardio đầu tuần' },
  { userId: 1, exerciseId: 2, date: '2026-11-04', time: '18:30', status: 'done', durationMin: 40, caloriesBurned: 195, note: 'Tập chân & mông' },
  { userId: 1, exerciseId: 5, date: '2026-11-08', time: '08:00', status: 'done', durationMin: 30, caloriesBurned: 120, note: 'Yoga kéo giãn ngày Chủ nhật' },

  // --- User 1: Hôm nay (2026-11-09) & Kế hoạch tuần này ---
  { userId: 1, exerciseId: 1, date: '2026-11-09', time: '07:30', status: 'done', durationMin: 40, caloriesBurned: 195, note: 'Khởi động tuần mới đầy năng lượng' },
  { userId: 1, exerciseId: 2, date: '2026-11-11', time: '18:00', status: 'planned', durationMin: 0, plannedDurationMin: 45, caloriesBurned: 0, note: 'Kế hoạch tập Squat' },
  { userId: 1, exerciseId: 4, date: '2026-11-13', time: '18:00', status: 'planned', durationMin: 0, plannedDurationMin: 40, caloriesBurned: 0, note: 'Kế hoạch tập Plank' },
  { userId: 1, exerciseId: 5, date: '2026-11-15', time: '08:30', status: 'planned', durationMin: 0, plannedDurationMin: 30, caloriesBurned: 0, note: 'Kế hoạch Yoga cuối tuần' },

  // --- User 2: Bổ sung một số buổi tập ---
  { userId: 2, exerciseId: 5, date: '2026-10-15', time: '20:00', status: 'done', durationMin: 40, caloriesBurned: 110, note: 'Yoga thư giãn' },
  { userId: 2, exerciseId: 4, date: '2026-10-20', time: '19:00', status: 'missed', durationMin: 0, caloriesBurned: 0, note: 'Bận công việc' },
  { userId: 2, exerciseId: 5, date: '2026-11-03', time: '20:00', status: 'done', durationMin: 45, caloriesBurned: 125, note: 'Yoga tăng dẻo dai' },
  { userId: 2, exerciseId: 4, date: '2026-11-06', time: '19:30', status: 'done', durationMin: 30, caloriesBurned: 95, note: 'Plank nhẹ nhàng' },
  { userId: 2, exerciseId: 5, date: '2026-11-10', time: '20:00', status: 'planned', durationMin: 0, plannedDurationMin: 45, caloriesBurned: 0, note: '' },
];

for (const w of newWorkouts) {
  // Tránh trùng lặp nếu script chạy nhiều lần
  const isDuplicate = db.workouts.some(
    (item) => item.userId === w.userId && item.date === w.date && item.exerciseId === w.exerciseId
  );
  if (!isDuplicate) {
    db.workouts.push({ id: nextWorkoutId++, ...w });
  }
}

// ============================================================================
// 2. BỔ SUNG RUNS (CHẠY BỘ VỚI CÔNG THỨC TOÁN CHUẨN)
// ============================================================================
const existingRunIds = new Set(db.runs.map((r) => r.id));
let nextRunId = Math.max(...existingRunIds, 0) + 1;

/**
 * Hàm hỗ trợ tạo 1 bản ghi chạy bộ chuẩn hóa theo utils/runMath.js
 */
function createRunRecord({
  userId,
  date,
  startTime = '05:30:00',
  distanceKm,
  durationSec,
  heightCm = 175,
  weightKg = 60,
  gender = 'male',
  note = '',
}) {
  const strideM = calculateFormulaStrideM(heightCm, gender);
  const steps = Math.round((distanceKm * 1000) / strideM);
  const actualDistanceKm = calculateDistanceKm(steps, strideM);
  const avgSpeedKmh = calculateSpeedKmh(actualDistanceKm, durationSec);
  const paceSecPerKm = calculatePaceSecPerKm(actualDistanceKm, durationSec);
  const cadenceSpm = calculateCadenceSpm(steps, durationSec);
  const met = interpolateMet(avgSpeedKmh);
  const calories = calculateCalories(met, weightKg, durationSec);

  // Tạo mảng splits cho từng km
  const totalKm = Math.floor(actualDistanceKm);
  const splits = [];
  let remainingSec = durationSec;
  for (let k = 1; k <= totalKm; k++) {
    // Chênh lệch nhẹ giữa các km để thực tế hơn (+/- 5 giây)
    const jitter = ((k % 3) - 1) * 4;
    const kmSec = Math.max(300, Math.min(600, paceSecPerKm + jitter));
    splits.push({ km: k, sec: kmSec });
    remainingSec -= kmSec;
  }
  if (splits.length > 0 && remainingSec > 0) {
    // Phân bổ phần dư vào split cuối
    splits[splits.length - 1].sec += Math.max(0, Math.round(remainingSec / splits.length));
  }

  const startedAt = `${date}T${startTime}.000Z`;
  const endHour = Math.floor(durationSec / 3600);
  const endMin = Math.floor((durationSec % 3600) / 60);
  const endSec = durationSec % 60;
  const [sH, sM, sS] = startTime.split(':').map(Number);
  const totalEndSec = sH * 3600 + sM * 60 + sS + durationSec;
  const finalH = String(Math.floor(totalEndSec / 3600) % 24).padStart(2, '0');
  const finalM = String(Math.floor((totalEndSec % 3600) / 60)).padStart(2, '0');
  const finalS = String(totalEndSec % 60).padStart(2, '0');
  const endedAt = `${date}T${finalH}:${finalM}:${finalS}.000Z`;

  const timestamp = Date.parse(startedAt);

  return {
    id: nextRunId++,
    clientId: `r_${timestamp}_seed${String(nextRunId).padStart(2, '0')}`,
    userId,
    date,
    startedAt,
    endedAt,
    source: 'pedometer',
    steps,
    strideM,
    strideSource: 'formula',
    distanceKm: actualDistanceKm,
    durationSec,
    pausedSec: 0,
    avgSpeedKmh,
    paceSecPerKm,
    cadenceSpm,
    met,
    weightKg,
    calories,
    splits,
    note,
  };
}

const runsToAdd = [
  // User 1: Tháng 08/2026
  { userId: 1, date: '2026-08-12', distanceKm: 3.2, durationSec: 1600, note: 'Khởi động thói quen chạy bộ' },
  { userId: 1, date: '2026-08-25', distanceKm: 4.0, durationSec: 1920, note: 'Chạy công viên chiều mát' },

  // User 1: Tháng 09/2026
  { userId: 1, date: '2026-09-10', distanceKm: 4.5, durationSec: 2070, note: 'Tập duy trì tốc độ đều' },
  { userId: 1, date: '2026-09-24', distanceKm: 5.0, durationSec: 2250, note: 'Chạy bền 5 km' },

  // User 1: Tháng 10/2026
  { userId: 1, date: '2026-10-08', distanceKm: 5.0, durationSec: 2200, note: 'Chạy buổi sáng quanh hồ' },
  { userId: 1, date: '2026-10-15', distanceKm: 6.0, durationSec: 2580, note: 'Tăng cự ly lên 6 km' },

  // User 1: Tháng 11/2026 (Tuần trước: 02/11 - 08/11)
  { userId: 1, date: '2026-11-03', distanceKm: 4.8, durationSec: 2016, note: 'Chạy phục hồi nhẹ nhàng' },
  { userId: 1, date: '2026-11-05', distanceKm: 5.2, durationSec: 2132, note: 'Chạy biến tốc cự ly 5 km' },
  { userId: 1, date: '2026-11-07', distanceKm: 7.5, durationSec: 3000, note: 'Long run cuối tuần cự ly 7.5 km' },
  { userId: 1, date: '2026-11-08', distanceKm: 4.0, durationSec: 1640, note: 'Chạy thả lỏng chiều Chủ nhật' },

  // User 1: Hôm nay (2026-11-09)
  { userId: 1, date: '2026-11-09', distanceKm: 5.0, durationSec: 2000, note: 'Chạy buổi sáng đón tuần mới' },

  // User 2: Bổ sung 2 buổi chạy
  { userId: 2, date: '2026-10-18', distanceKm: 2.8, durationSec: 1750, heightCm: 162, weightKg: 52, gender: 'female', note: 'Chạy nhẹ cuối tuần' },
  { userId: 2, date: '2026-11-04', distanceKm: 3.5, durationSec: 2100, heightCm: 162, weightKg: 52, gender: 'female', note: 'Chạy bộ giữ dáng' },
];

for (const r of runsToAdd) {
  const isDuplicate = db.runs.some((item) => item.userId === r.userId && item.date === r.date);
  if (!isDuplicate) {
    db.runs.push(createRunRecord(r));
  }
}

// ============================================================================
// 3. BỔ SUNG WEIGHT HISTORY (LỊCH SỬ CÂN NẶNG & BMI)
// ============================================================================
const existingWeightIds = new Set(db.weightHistory.map((w) => w.id));
let nextWeightId = Math.max(...existingWeightIds, 0) + 1;

const weightsToAdd = [
  // User 1: Tiến trình tăng cơ từ 57.0 kg lên 61.0 kg
  { userId: 1, weightKg: 57.0, date: '2026-08-01' },
  { userId: 1, weightKg: 57.5, date: '2026-08-20' },
  { userId: 1, weightKg: 60.5, date: '2026-11-01' },
  { userId: 1, weightKg: 60.8, date: '2026-11-05' },
  { userId: 1, weightKg: 61.0, date: '2026-11-09' }, // Cân nặng hôm nay

  // User 2: Tiến trình giữ dáng 53 kg -> 51.5 kg
  { userId: 2, weightKg: 53.0, date: '2026-09-01' },
  { userId: 2, weightKg: 51.5, date: '2026-11-05' },
];

for (const w of weightsToAdd) {
  const isDuplicate = db.weightHistory.some((item) => item.userId === w.userId && item.date === w.date);
  if (!isDuplicate) {
    db.weightHistory.push({ id: nextWeightId++, ...w });
  }
}

// Sắp xếp lại lịch sử cân nặng theo ngày tăng dần
db.weightHistory.sort((a, b) => a.date.localeCompare(b.date));

// Cập nhật profile User 1 và User 2 với cân nặng mới nhất
const p1 = db.profiles.find((p) => p.userId === 1);
if (p1) p1.weightKg = 61;
const p2 = db.profiles.find((p) => p.userId === 2);
if (p2) p2.weightKg = 51.5;

// ============================================================================
// 4. LƯU VÀO DB.JSON VÀ ĐỒNG BỘ
// ============================================================================
writeFileSync(dbPath, `${JSON.stringify(db, null, 2)}\n`, 'utf8');

console.log('--- KẾT QUẢ TẠO DỮ LIỆU MẪU THỐNG KÊ ---');
console.log(`Tổng số Workouts: ${db.workouts.length} (User 1: ${db.workouts.filter((w) => w.userId === 1).length})`);
console.log(`Tổng số Runs: ${db.runs.length} (User 1: ${db.runs.filter((r) => r.userId === 1).length})`);
console.log(`Tổng số Weight records: ${db.weightHistory.length} (User 1: ${db.weightHistory.filter((w) => w.userId === 1).length})`);
