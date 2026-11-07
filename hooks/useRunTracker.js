// ============================================================================
// hooks/useRunTracker.js
// Hook quản lý máy trạng thái chạy bộ (State Machine), cảm biến Pedometer,
// bộ đếm thời gian chống lệch (Date.now() - mốc) và tối ưu hóa cho máy yếu:
// - Luồng trạng thái: idle -> ready -> running <-> paused -> finishing -> saved | queued
// - TUYỆT ĐỐI KHÔNG gọi setState trong callback Pedometer.watchStepCount;
//   chỉ cập nhật useRef và dùng DUY NHẤT một setInterval 1000 ms để render UI.
// - Tính cadence theo cửa sổ trượt 30 s trên mảng vòng kích thước cố định (32 phần tử).
// - Tự động lưu checkpoint mỗi 15 s hoặc mỗi 50 bước (< 2 KB).
// - Giữ màn hình sáng bằng expo-keep-awake khi đang chạy và tự tắt khi dừng/tạm dừng.
// - Theo dõi GPS (expo-location) song song khi đang chạy: lọc điểm xấu (accuracy kém,
//   điểm "nhảy") rồi gọi callback options.onLocationUpdate({ latitude, longitude,
//   timestamp, accuracy, isSegmentStart }). KHÔNG setState theo từng điểm GPS; quãng
//   đường/calo vẫn tính theo Pedometer như cũ.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { Pedometer } from 'expo-sensors';
import * as Location from 'expo-location';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import { subscribeUnauthorized } from '../services/api';
import {
  clearCheckpoint,
  finishAndSaveRun,
  generateClientId,
  getQueuedRuns,
  loadCalibratedStrideM,
  loadCheckpoint,
  saveCalibratedStrideM,
  saveCheckpoint,
  syncQueuedRuns,
} from '../services/runRepository';
import {
  CADENCE_RING_SIZE,
  CADENCE_WINDOW_MS,
  calibrateStride,
  calculateSlidingCadenceSpm,
  computeRunMetrics,
  resolveStride,
} from '../utils/runMath';
import { localDateString } from '../utils/dateLocal';
import { compactCoordinate, evaluateGpsPoint, normalizeRouteCoords } from '../utils/geo';
import {
  GPS_DEV_SIMULATION,
  GPS_MAX_CONSECUTIVE_JUMP_REJECTS,
  GPS_SIGNAL_LOST_MS,
  GPS_WATCH_DISTANCE_INTERVAL_M,
  GPS_WATCH_TIME_INTERVAL_MS,
} from '../constants/runRoute';
import { useLocationStore } from '../store/locationStore';

const KEEP_AWAKE_TAG = 'figlog-active-run-keep-awake';
const CHECKPOINT_INTERVAL_MS = 15000; // Lưu checkpoint mỗi 15 giây
const CHECKPOINT_STEP_DELTA = 50;     // Hoặc mỗi khi tăng thêm 50 bước
const MAX_SPLITS_COUNT = 50;          // Giới hạn mảng splits cố định để tránh phình RAM
// Toạ độ mặc định (IUH) cho chế độ giả lập GPS khi chưa có vị trí thật
const SIMULATION_ORIGIN = { latitude: 10.822363, longitude: 106.687487 };

const INITIAL_METRICS = {
  steps: 0,
  strideM: 0.726,
  strideSource: 'formula',
  distanceKm: 0,
  durationSec: 0,
  pausedSec: 0,
  avgSpeedKmh: 0,
  paceSecPerKm: null,
  paceFormatted: '--:--',
  cadenceSpm: 0,
  met: 0,
  weightKg: 60,
  calories: 0,
};

/**
 * Hook quản lý toàn bộ nghiệp vụ chạy bộ bằng Pedometer.
 *
 * @param {object} [userProfile] Thông tin hồ sơ người dùng { heightCm, height, weightKg, weight, gender, calibratedStrideM, id }
 * @param {object} [options]
 * @param {(point: { latitude: number, longitude: number, timestamp: number, accuracy: number | null, isSegmentStart: boolean }) => void} [options.onLocationUpdate]
 *   Gọi mỗi khi có vị trí GPS mới HỢP LỆ trong lúc chạy (đã lọc accuracy & điểm nhảy).
 *   isSegmentStart = true cho điểm đầu tiên sau khi bắt đầu / tiếp tục (không nối quãng đường qua lúc tạm dừng).
 */
export function useRunTracker(userProfile = {}, options = {}) {
  const weightKg = Number(userProfile?.weightKg ?? userProfile?.weight ?? 60) || 60;
  const heightCm = Number(userProfile?.heightCm ?? userProfile?.height ?? 175) || 175;
  const gender = userProfile?.gender || 'male';
  const profileId = userProfile?.profileId ?? userProfile?.id ?? null;

  // Trạng thái máy trạng thái: 'idle' | 'ready' | 'running' | 'paused' | 'finishing' | 'saved' | 'queued'
  const [status, setStatus] = useState('idle');
  const [sensorStatus, setSensorStatus] = useState({
    checked: false,
    available: true,
    permissionGranted: false,
    canAskAgain: true,
    errorReason: null, // 'unavailable' | 'denied' | 'denied_permanent' | null
  });

  const [calibratedStrideM, setCalibratedStrideM] = useState(
    userProfile?.calibratedStrideM ?? null
  );

  // Chỉ số hiển thị trên UI (chỉ cập nhật tối đa 1 lần / giây khi đang chạy)
  const [metrics, setMetrics] = useState(() => {
    const strideInfo = resolveStride({ heightCm, gender, calibratedStrideM });
    return {
      ...INITIAL_METRICS,
      strideM: strideInfo.strideM,
      strideSource: strideInfo.strideSource,
      weightKg,
    };
  });

  // Buổi chạy vừa kết thúc (dùng cho RunSummaryScreen)
  const [completedRun, setCompletedRun] = useState(null);
  // Checkpoint dở dang phát hiện lúc mở app
  const [recoverableCheckpoint, setRecoverableCheckpoint] = useState(null);
  // Số bản ghi đang chờ đồng bộ trong hàng đợi
  const [queuedCount, setQueuedCount] = useState(0);
  // Cờ báo cần đăng nhập lại khi gặp lỗi 401 (hàng đợi vẫn giữ nguyên)
  const [authExpired, setAuthExpired] = useState(false);
  // Thông báo lỗi/trạng thái gần nhất
  const [statusMessage, setStatusMessage] = useState('');
  // Trạng thái GPS (chỉ đổi khi chuyển trạng thái, không theo từng điểm):
  // 'idle' | 'searching' | 'ok' | 'lost' | 'denied' | 'disabled' | 'error' | 'simulated'
  const [gpsStatus, setGpsStatus] = useState('idle');

  // ==================== CÁC REF NỘI BỘ (KHÔNG GÂY RE-RENDER) ====================
  // Khóa đảm bảo chỉ chạy 1 buổi duy nhất cùng lúc
  const activeRunLockRef = useRef(false);
  const pedometerSubRef = useRef(null);
  const intervalIdRef = useRef(null);

  // Định danh & mốc thời gian (dùng Date.now() trừ mốc, không cộng dồn mỗi giây)
  const clientIdRef = useRef(null);
  const startedAtMsRef = useRef(0);
  const segmentStartMsRef = useRef(0);
  const accumulatedActiveMsRef = useRef(0);
  const pauseStartedAtMsRef = useRef(0);
  const totalPausedMsRef = useRef(0);

  // Bộ đếm bước chân trong useRef (cảm biến ghi vào đây, KHÔNG gọi setState)
  const accumulatedStepsRef = useRef(0);
  const currentSubStepsRef = useRef(0);
  const totalStepsRef = useRef(0);

  // Mảng vòng kích thước cố định 32 phần tử để tính cadence cửa sổ trượt 30s
  const cadenceRingRef = useRef(new Array(CADENCE_RING_SIZE).fill(null));
  const cadenceRingCursorRef = useRef(0);

  // Mảng splits theo từng km và mốc thời gian km trước đó
  const splitsRef = useRef([]);
  const lastSplitKmRef = useRef(0);
  const lastSplitDurationSecRef = useRef(0);

  // Theo dõi mốc lưu checkpoint gần nhất (mỗi 15s hoặc mỗi 50 bước)
  const lastCheckpointTimeMsRef = useRef(0);
  const lastCheckpointStepsRef = useRef(0);

  // Bộ đếm phục vụ nghiệm thu mục #7 (chứng minh không setState theo từng bước chân)
  const sensorEventCountRef = useRef(0);
  const uiTickCountRef = useRef(0);

  // ==================== GPS (KHÔNG GÂY RE-RENDER THEO TỪNG ĐIỂM) ====================
  const onLocationUpdateRef = useRef(options?.onLocationUpdate || options?.onPoint);
  const locationSubRef = useRef(null);
  const gpsSimIntervalRef = useRef(null);
  // Tăng mỗi lần gắn/gỡ listener để huỷ các lời gọi async đã lỗi thời (tạm dừng khi đang xin quyền)
  const gpsSessionRef = useRef(0);
  const lastGpsPointRef = useRef(null);
  const gpsJumpRejectStreakRef = useRef(0);
  const gpsSegmentStartRef = useRef(true);
  const lastGpsFixMsRef = useRef(0);
  const gpsStatusRef = useRef('idle');

  useEffect(() => {
    onLocationUpdateRef.current = options?.onLocationUpdate || options?.onPoint;
  }, [options?.onLocationUpdate, options?.onPoint]);

  // Chỉ setState khi trạng thái GPS thực sự thay đổi
  const updateGpsStatus = useCallback((next) => {
    if (gpsStatusRef.current === next) return;
    gpsStatusRef.current = next;
    setGpsStatus(next);
  }, []);

  // Tính sải chân hiện hành
  const currentStrideInfo = resolveStride({
    heightCm,
    gender,
    calibratedStrideM,
  });

  // Đồng bộ sải chân vào state hiển thị khi đang ở trạng thái nghỉ/chuẩn bị
  useEffect(() => {
    if (status === 'idle' || status === 'ready') {
      setMetrics((prev) => ({
        ...prev,
        strideM: currentStrideInfo.strideM,
        strideSource: currentStrideInfo.strideSource,
        weightKg,
      }));
    }
  }, [status, currentStrideInfo.strideM, currentStrideInfo.strideSource, weightKg]);

  // Làm mới số lượng bản ghi trong hàng đợi
  const refreshQueueCount = useCallback(async () => {
    const q = await getQueuedRuns();
    setQueuedCount(q.length);
    return q.length;
  }, []);

  // Khởi tạo khi mở màn hình: nạp sải chân hiệu chuẩn, kiểm tra checkpoint dở dang & đồng bộ hàng đợi
  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const savedCal = await loadCalibratedStrideM();
      if (mounted && savedCal !== null) {
        setCalibratedStrideM(savedCal);
      }

      const cp = await loadCheckpoint();
      if (mounted && cp && cp.clientId) {
        setRecoverableCheckpoint(cp);
      }

      await refreshQueueCount();
      const syncRes = await syncQueuedRuns();
      if (mounted) {
        setQueuedCount(syncRes.remainingCount);
        if (syncRes.authRequired) {
          setAuthExpired(true);
        }
      }
    }

    bootstrap();

    const unsubAuth = subscribeUnauthorized(() => {
      if (mounted) {
        setAuthExpired(true);
        refreshQueueCount();
      }
    });

    return () => {
      mounted = false;
      unsubAuth();
    };
  }, [refreshQueueCount]);

  // Hàm dọn dẹp cảm biến, bộ đếm giây và KeepAwake
  const cleanupHardwareAndTimer = useCallback(() => {
    if (pedometerSubRef.current) {
      try {
        pedometerSubRef.current.remove();
      } catch {
        // Bỏ qua lỗi khi hủy listener
      }
      pedometerSubRef.current = null;
    }
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }
    // Gỡ theo dõi GPS (và vô hiệu các lời gọi watchPositionAsync đang chờ)
    gpsSessionRef.current += 1;
    if (locationSubRef.current) {
      try {
        locationSubRef.current.remove();
      } catch {
        // Bỏ qua lỗi khi hủy listener GPS
      }
      locationSubRef.current = null;
    }
    if (gpsSimIntervalRef.current) {
      clearInterval(gpsSimIntervalRef.current);
      gpsSimIntervalRef.current = null;
    }
    deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
  }, []);

  // Dọn dẹp khi unmount
  useEffect(() => {
    return () => {
      cleanupHardwareAndTimer();
    };
  }, [cleanupHardwareAndTimer]);

  // Ghi mẫu bước vào mảng vòng kích thước cố định (không cấp phát mảng mới)
  const recordCadenceSample = useCallback((nowMs, totalSteps) => {
    const idx = cadenceRingCursorRef.current % CADENCE_RING_SIZE;
    cadenceRingRef.current[idx] = { ts: nowMs, steps: totalSteps };
    cadenceRingCursorRef.current += 1;
  }, []);

  // Lưu checkpoint hiện tại xuống AsyncStorage (không gọi setState)
  const persistCurrentCheckpoint = useCallback(
    async (nowMs = Date.now()) => {
      if (!clientIdRef.current) return;
      const activeMs =
        accumulatedActiveMsRef.current +
        (segmentStartMsRef.current > 0 ? Math.max(0, nowMs - segmentStartMsRef.current) : 0);

      lastCheckpointTimeMsRef.current = nowMs;
      lastCheckpointStepsRef.current = totalStepsRef.current;

      await saveCheckpoint({
        clientId: clientIdRef.current,
        startedAtMs: startedAtMsRef.current,
        accumulatedActiveMs: activeMs,
        totalPausedMs: totalPausedMsRef.current,
        steps: totalStepsRef.current,
        strideM: currentStrideInfo.strideM,
        strideSource: currentStrideInfo.strideSource,
        weightKg,
        source: 'pedometer',
        splits: splitsRef.current,
      });
    },
    [currentStrideInfo.strideM, currentStrideInfo.strideSource, weightKg]
  );

  // Đăng ký lắng nghe Pedometer.watchStepCount (CHỈ ghi vào useRef, KHÔNG setState)
  const attachPedometerListener = useCallback(() => {
    if (pedometerSubRef.current) {
      try {
        pedometerSubRef.current.remove();
      } catch {
        // Bỏ qua
      }
      pedometerSubRef.current = null;
    }

    currentSubStepsRef.current = 0;

    try {
      pedometerSubRef.current = Pedometer.watchStepCount((result) => {
        sensorEventCountRef.current += 1;
        const deltaSteps = Math.max(0, Number(result?.steps) || 0);
        currentSubStepsRef.current = deltaSteps;
        const nextTotalSteps = accumulatedStepsRef.current + deltaSteps;
        totalStepsRef.current = nextTotalSteps;

        const nowMs = Date.now();
        recordCadenceSample(nowMs, nextTotalSteps);

        // Nếu tăng đủ 50 bước kể từ lần checkpoint trước -> ghi bất đồng bộ xuống AsyncStorage
        if (nextTotalSteps - lastCheckpointStepsRef.current >= CHECKPOINT_STEP_DELTA) {
          persistCurrentCheckpoint(nowMs).catch(() => {});
        }
      });
    } catch {
      // Nếu thiết bị báo lỗi khi gắn listener
    }
  }, [persistCurrentCheckpoint, recordCadenceSample]);

  // Xử lý một vị trí GPS thô: lọc điểm xấu rồi gọi callback (CHỈ ghi ref, KHÔNG setState theo điểm)
  const handleRawLocation = useCallback(
    (raw) => {
      const candidate = {
        latitude: Number(raw?.latitude),
        longitude: Number(raw?.longitude),
        timestamp: Number(raw?.timestamp) || Date.now(),
        accuracy:
          raw?.accuracy === null || raw?.accuracy === undefined ? null : Number(raw.accuracy),
      };

      const verdict = evaluateGpsPoint(lastGpsPointRef.current, candidate);
      if (!verdict.ok) {
        if (verdict.reason === 'speed') {
          // Nếu bị loại liên tiếp nhiều lần, rất có thể điểm gốc trước đó mới là điểm sai -> đặt lại mốc
          gpsJumpRejectStreakRef.current += 1;
          if (gpsJumpRejectStreakRef.current < GPS_MAX_CONSECUTIVE_JUMP_REJECTS) return;
        } else {
          return;
        }
      }
      gpsJumpRejectStreakRef.current = 0;
      lastGpsPointRef.current = candidate;
      lastGpsFixMsRef.current = Date.now();
      if (gpsStatusRef.current !== 'simulated') {
        updateGpsStatus('ok');
      }

      const isSegmentStart = gpsSegmentStartRef.current;
      gpsSegmentStartRef.current = false;

      const cb = onLocationUpdateRef.current;
      if (typeof cb === 'function') {
        try {
          cb({ ...candidate, isSegmentStart });
        } catch {
          // Lỗi ở phía màn hình không được làm hỏng buổi chạy
        }
      }
    },
    [updateGpsStatus]
  );

  // Giả lập GPS cho máy ảo (chỉ bật khi GPS_DEV_SIMULATION = true và đang ở __DEV__)
  const startGpsSimulation = useCallback(() => {
    const origin = lastGpsPointRef.current || useLocationStore.getState().coords || SIMULATION_ORIGIN;
    let current = { latitude: origin.latitude, longitude: origin.longitude };
    let step = 0;
    updateGpsStatus('simulated');
    gpsSimIntervalRef.current = setInterval(() => {
      step += 1;
      const angle = (step * 8 * Math.PI) / 180;
      // ~6–7 m mỗi 2 giây (≈ 3 m/s, tốc độ chạy bộ)
      current = {
        latitude: current.latitude + 0.00005 * Math.sin(angle) + 0.00002,
        longitude: current.longitude + 0.00005 * Math.cos(angle) + 0.00001,
      };
      handleRawLocation({ ...current, timestamp: Date.now(), accuracy: 5 });
    }, GPS_WATCH_TIME_INTERVAL_MS);
  }, [handleRawLocation, updateGpsStatus]);

  /**
   * Gắn theo dõi GPS khi bắt đầu/tiếp tục chạy. Không chặn buổi chạy nếu GPS lỗi:
   * quãng đường vẫn tính theo Pedometer, chỉ là không có lộ trình.
   */
  const attachLocationListener = useCallback(async () => {
    const session = gpsSessionRef.current;
    const isStale = () => session !== gpsSessionRef.current;

    if (GPS_DEV_SIMULATION && typeof __DEV__ !== 'undefined' && __DEV__) {
      startGpsSimulation();
      return;
    }

    updateGpsStatus('searching');
    try {
      const servicesOn = await Location.hasServicesEnabledAsync();
      if (isStale()) return;
      if (!servicesOn) {
        updateGpsStatus('disabled');
        return;
      }

      let perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted && perm.canAskAgain !== false) {
        perm = await Location.requestForegroundPermissionsAsync();
      }
      if (isStale()) return;
      if (!perm.granted) {
        updateGpsStatus('denied');
        return;
      }

      const sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: GPS_WATCH_TIME_INTERVAL_MS,
          distanceInterval: GPS_WATCH_DISTANCE_INTERVAL_M,
        },
        (loc) => {
          handleRawLocation({
            latitude: loc?.coords?.latitude,
            longitude: loc?.coords?.longitude,
            accuracy: loc?.coords?.accuracy,
            timestamp: loc?.timestamp,
          });
        },
        () => {
          // Lỗi từ hệ thống định vị (ví dụ tắt GPS giữa chừng) -> báo mất tín hiệu
          updateGpsStatus('lost');
        }
      );

      if (isStale()) {
        // Đã tạm dừng/dừng trong lúc đang đăng ký -> gỡ ngay để không rò rỉ pin
        sub.remove();
        return;
      }
      locationSubRef.current = sub;
      lastGpsFixMsRef.current = Date.now();
    } catch {
      if (!isStale()) updateGpsStatus('error');
    }
  }, [handleRawLocation, startGpsSimulation, updateGpsStatus]);

  // Đặt lại bộ lọc GPS cho một chặng mới (bắt đầu hoặc tiếp tục sau tạm dừng)
  const resetGpsSegment = useCallback((fullReset) => {
    lastGpsPointRef.current = fullReset ? null : lastGpsPointRef.current;
    // Sau tạm dừng, người dùng có thể đã di chuyển xa -> không so tốc độ với điểm cũ
    if (!fullReset) lastGpsPointRef.current = null;
    gpsJumpRejectStreakRef.current = 0;
    gpsSegmentStartRef.current = true;
    lastGpsFixMsRef.current = Date.now();
  }, []);

  // Hàm cập nhật giao diện mỗi 1000 ms duy nhất khi đang chạy
  const startUiTickInterval = useCallback(() => {
    if (intervalIdRef.current) {
      clearInterval(intervalIdRef.current);
      intervalIdRef.current = null;
    }

    intervalIdRef.current = setInterval(() => {
      const nowMs = Date.now();
      const activeMs =
        accumulatedActiveMsRef.current +
        (segmentStartMsRef.current > 0 ? Math.max(0, nowMs - segmentStartMsRef.current) : 0);
      const durationSec = Math.floor(activeMs / 1000);
      const pausedSec = Math.floor(totalPausedMsRef.current / 1000);
      const currentSteps = totalStepsRef.current;

      const computed = computeRunMetrics({
        steps: currentSteps,
        strideM: currentStrideInfo.strideM,
        durationSec,
        weightKg,
      });

      // Tính cadence cửa sổ trượt 30s; nếu chưa đủ mẫu trong 30s đầu thì dùng cadence trung bình
      const windowCadence = calculateSlidingCadenceSpm(
        cadenceRingRef.current,
        nowMs,
        CADENCE_WINDOW_MS
      );
      const displayCadence = windowCadence > 0 ? windowCadence : computed.cadenceSpm;

      // Ghi nhận split mới mỗi khi hoàn thành thêm 1 km chẵn
      const wholeKm = Math.floor(computed.distanceKm);
      if (wholeKm > lastSplitKmRef.current && splitsRef.current.length < MAX_SPLITS_COUNT) {
        for (let km = lastSplitKmRef.current + 1; km <= wholeKm; km += 1) {
          const splitSec = Math.max(1, durationSec - lastSplitDurationSecRef.current);
          splitsRef.current.push({ km, sec: splitSec });
          lastSplitDurationSecRef.current = durationSec;
          lastSplitKmRef.current = km;
        }
      }

      // Lưu checkpoint định kỳ mỗi 15 giây
      if (nowMs - lastCheckpointTimeMsRef.current >= CHECKPOINT_INTERVAL_MS) {
        persistCurrentCheckpoint(nowMs).catch(() => {});
      }

      // Phát hiện mất tín hiệu GPS nếu quá lâu không có điểm hợp lệ mới
      if (
        (gpsStatusRef.current === 'ok' || gpsStatusRef.current === 'searching') &&
        lastGpsFixMsRef.current > 0 &&
        nowMs - lastGpsFixMsRef.current >= GPS_SIGNAL_LOST_MS
      ) {
        updateGpsStatus('lost');
      }

      uiTickCountRef.current += 1;

      setMetrics({
        ...computed,
        strideSource: currentStrideInfo.strideSource,
        pausedSec,
        cadenceSpm: displayCadence,
      });
    }, 1000);
  }, [currentStrideInfo.strideM, currentStrideInfo.strideSource, persistCurrentCheckpoint, updateGpsStatus, weightKg]);

  // ==================== CÁC HÀNH ĐỘNG CỦA MÁY TRẠNG THÁI ====================

  /**
   * Bước 1: Kiểm tra cảm biến Pedometer và xin quyền ACTIVITY_RECOGNITION / Motion.
   * Chuyển từ 'idle' -> 'ready' nếu hợp lệ.
   */
  const prepareSensor = useCallback(async () => {
    try {
      const available = await Pedometer.isAvailableAsync();
      if (!available) {
        setSensorStatus({
          checked: true,
          available: false,
          permissionGranted: false,
          canAskAgain: false,
          errorReason: 'unavailable',
        });
        setStatusMessage(
          'Thiết bị không có cảm biến đếm bước chân phần cứng. Bạn có thể nhập tay buổi chạy.'
        );
        return { ok: false, reason: 'unavailable' };
      }

      let perm = await Pedometer.getPermissionsAsync();
      if (!perm.granted && perm.canAskAgain !== false) {
        perm = await Pedometer.requestPermissionsAsync();
      }

      if (!perm.granted) {
        const reason = perm.canAskAgain === false ? 'denied_permanent' : 'denied';
        setSensorStatus({
          checked: true,
          available: true,
          permissionGranted: false,
          canAskAgain: Boolean(perm.canAskAgain),
          errorReason: reason,
        });
        setStatusMessage(
          'Chưa được cấp quyền Theo dõi vận động. Hãy mở Cài đặt hệ thống hoặc nhập tay buổi chạy.'
        );
        return { ok: false, reason };
      }

      setSensorStatus({
        checked: true,
        available: true,
        permissionGranted: true,
        canAskAgain: true,
        errorReason: null,
      });
      setStatusMessage('');
      setStatus('ready');
      return { ok: true, reason: null };
    } catch {
      setSensorStatus({
        checked: true,
        available: false,
        permissionGranted: false,
        canAskAgain: false,
        errorReason: 'unavailable',
      });
      setStatusMessage(
        'Không thể truy cập cảm biến bước chân trên thiết bị này. Bạn có thể nhập tay buổi chạy.'
      );
      return { ok: false, reason: 'unavailable' };
    }
  }, []);

  /**
   * Bước 2: Bắt đầu buổi chạy mới ('idle' | 'ready' -> 'running').
   * Chỉ cho phép chạy MỘT buổi cùng lúc.
   */
  const startRun = useCallback(async () => {
    if (activeRunLockRef.current) {
      return false;
    }

    // Nếu chưa kiểm tra quyền thì kiểm tra trước
    if (!sensorStatus.permissionGranted || !sensorStatus.available) {
      const check = await prepareSensor();
      if (!check.ok) {
        return false;
      }
    }

    activeRunLockRef.current = true;
    const nowMs = Date.now();

    clientIdRef.current = generateClientId(nowMs);
    startedAtMsRef.current = nowMs;
    segmentStartMsRef.current = nowMs;
    accumulatedActiveMsRef.current = 0;
    pauseStartedAtMsRef.current = 0;
    totalPausedMsRef.current = 0;

    accumulatedStepsRef.current = 0;
    currentSubStepsRef.current = 0;
    totalStepsRef.current = 0;

    cadenceRingRef.current = new Array(CADENCE_RING_SIZE).fill(null);
    cadenceRingCursorRef.current = 0;
    recordCadenceSample(nowMs, 0);

    splitsRef.current = [];
    lastSplitKmRef.current = 0;
    lastSplitDurationSecRef.current = 0;

    lastCheckpointTimeMsRef.current = nowMs;
    lastCheckpointStepsRef.current = 0;
    sensorEventCountRef.current = 0;
    uiTickCountRef.current = 0;

    setCompletedRun(null);
    setStatusMessage('');
    setMetrics({
      ...INITIAL_METRICS,
      strideM: currentStrideInfo.strideM,
      strideSource: currentStrideInfo.strideSource,
      weightKg,
    });

    await activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    resetGpsSegment(true);
    attachPedometerListener();
    attachLocationListener().catch(() => {});
    startUiTickInterval();
    await persistCurrentCheckpoint(nowMs);
    setStatus('running');
    return true;
  }, [
    attachLocationListener,
    attachPedometerListener,
    currentStrideInfo.strideM,
    currentStrideInfo.strideSource,
    persistCurrentCheckpoint,
    prepareSensor,
    recordCadenceSample,
    resetGpsSegment,
    sensorStatus.available,
    sensorStatus.permissionGranted,
    startUiTickInterval,
    weightKg,
  ]);

  /**
   * Bước 3: Tạm dừng buổi chạy ('running' -> 'paused').
   * Ngắt listener cảm biến ngay để bỏ qua mọi bước chân trong lúc tạm dừng,
   * đồng thời chốt thời gian di chuyển thực tế.
   */
  const pauseRun = useCallback(async () => {
    if (status !== 'running') return;
    const nowMs = Date.now();

    // Chốt số bước đã đi được trước khi tạm dừng
    accumulatedStepsRef.current = totalStepsRef.current;
    currentSubStepsRef.current = 0;

    // Chốt thời gian di chuyển của chặng vừa chạy
    if (segmentStartMsRef.current > 0) {
      accumulatedActiveMsRef.current += Math.max(0, nowMs - segmentStartMsRef.current);
      segmentStartMsRef.current = 0;
    }
    pauseStartedAtMsRef.current = nowMs;

    cleanupHardwareAndTimer();
    await persistCurrentCheckpoint(nowMs);
    setStatus('paused');
  }, [cleanupHardwareAndTimer, persistCurrentCheckpoint, status]);

  /**
   * Bước 4: Tiếp tục buổi chạy ('paused' -> 'running').
   */
  const resumeRun = useCallback(async () => {
    if (status !== 'paused') return;
    const nowMs = Date.now();

    if (pauseStartedAtMsRef.current > 0) {
      totalPausedMsRef.current += Math.max(0, nowMs - pauseStartedAtMsRef.current);
      pauseStartedAtMsRef.current = 0;
    }
    segmentStartMsRef.current = nowMs;
    recordCadenceSample(nowMs, totalStepsRef.current);

    await activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    resetGpsSegment(false);
    attachPedometerListener();
    attachLocationListener().catch(() => {});
    startUiTickInterval();
    setStatus('running');
  }, [attachLocationListener, attachPedometerListener, recordCadenceSample, resetGpsSegment, startUiTickInterval, status]);

  /**
   * Bước 5: Dừng hẳn và lưu buổi chạy ('running' | 'paused' -> 'finishing' -> 'saved' | 'queued').
   *
   * @param {string | { note?: string, routeCoords?: Array<{latitude:number, longitude:number}>, gpsDistanceM?: number }} [noteOrOptions='']
   * @param {{ routeCoords?: Array<{latitude:number, longitude:number}>, gpsDistanceM?: number }} [extraOptions]
   */
  const stopRun = useCallback(
    async (noteOrOptions = '', extraOptions = {}) => {
      if (status !== 'running' && status !== 'paused') {
        return null;
      }

      const isObj = noteOrOptions && typeof noteOrOptions === 'object';
      const note = isObj ? noteOrOptions.note || '' : noteOrOptions;
      const routePayload = isObj ? noteOrOptions : extraOptions || {};
      const cleanedRoute = normalizeRouteCoords(routePayload.routeCoords).map((pt) =>
        compactCoordinate(pt)
      );
      const gpsDistanceM = Number.isFinite(Number(routePayload.gpsDistanceM))
        ? Math.round(Number(routePayload.gpsDistanceM))
        : 0;

      const nowMs = Date.now();
      if (status === 'running' && segmentStartMsRef.current > 0) {
        accumulatedActiveMsRef.current += Math.max(0, nowMs - segmentStartMsRef.current);
        segmentStartMsRef.current = 0;
      }
      if (status === 'paused' && pauseStartedAtMsRef.current > 0) {
        totalPausedMsRef.current += Math.max(0, nowMs - pauseStartedAtMsRef.current);
        pauseStartedAtMsRef.current = 0;
      }

      cleanupHardwareAndTimer();
      updateGpsStatus('idle');

      // Server yêu cầu durationSec từ 10 đến 21600 giây
      const rawDurationSec = Math.floor(accumulatedActiveMsRef.current / 1000);
      const finalDurationSec = Math.min(21600, Math.max(10, rawDurationSec));
      const finalPausedSec = Math.floor(totalPausedMsRef.current / 1000);
      const finalSteps = Math.min(100000, Math.max(0, totalStepsRef.current));

      const finalComputed = computeRunMetrics({
        steps: finalSteps,
        strideM: currentStrideInfo.strideM,
        durationSec: finalDurationSec,
        weightKg,
      });

      const startedDateObj = new Date(startedAtMsRef.current || nowMs);
      const runRecord = {
        clientId: clientIdRef.current || generateClientId(nowMs),
        date: localDateString(startedDateObj), // Ngày theo GIỜ ĐỊA PHƯƠNG
        startedAt: startedDateObj.toISOString(),
        endedAt: new Date(nowMs).toISOString(),
        source: 'pedometer',
        steps: finalComputed.steps,
        strideM: finalComputed.strideM,
        strideSource: currentStrideInfo.strideSource,
        distanceKm: finalComputed.distanceKm,
        durationSec: finalComputed.durationSec,
        pausedSec: finalPausedSec,
        avgSpeedKmh: finalComputed.avgSpeedKmh,
        paceSecPerKm: finalComputed.paceSecPerKm,
        cadenceSpm: finalComputed.cadenceSpm,
        met: finalComputed.met,
        weightKg: finalComputed.weightKg,
        calories: finalComputed.calories,
        splits:
          splitsRef.current.length > 0
            ? [...splitsRef.current]
            : finalComputed.paceSecPerKm
              ? [{ km: 1, sec: finalComputed.paceSecPerKm }]
              : [],
        routeCoords: cleanedRoute,
        gpsDistanceM,
        note: typeof note === 'string' ? note.trim() : '',
      };

      setStatus('finishing');
      setStatusMessage('Đang lưu buổi chạy...');

      const saveResult = await finishAndSaveRun(runRecord, {
        onRetry: (retryAttempt, delayMs) => {
          setStatusMessage(
            `Mạng chậm, đang thử gửi lại lần ${retryAttempt} (sau ${delayMs / 1000}s)...`
          );
        },
      });

      activeRunLockRef.current = false;
      await refreshQueueCount();

      if (saveResult.status === 'saved') {
        setCompletedRun(saveResult.run);
        setStatusMessage('Đã lưu buổi chạy lên máy chủ thành công.');
        setStatus('saved');
      } else {
        if (saveResult.reason === 'unauthorized') {
          setAuthExpired(true);
          setStatusMessage(
            'Token hết hạn. Buổi chạy đã được giữ an toàn trong hàng đợi, vui lòng đăng nhập lại để đồng bộ.'
          );
        } else {
          setStatusMessage(
            'Đang ngoại tuyến. Buổi chạy đã lưu vào hàng đợi trên máy và sẽ tự gửi khi có mạng.'
          );
        }
        setCompletedRun({ ...runRecord, _queued: true });
        setStatus('queued');
      }

      return saveResult;
    },
    [
      cleanupHardwareAndTimer,
      currentStrideInfo.strideM,
      currentStrideInfo.strideSource,
      refreshQueueCount,
      status,
      updateGpsStatus,
      weightKg,
    ]
  );

  /**
   * Hủy buổi chạy hiện tại không lưu.
   */
  const cancelRun = useCallback(async () => {
    cleanupHardwareAndTimer();
    updateGpsStatus('idle');
    activeRunLockRef.current = false;
    clientIdRef.current = null;
    await clearCheckpoint();
    setCompletedRun(null);
    setStatusMessage('');
    setStatus('idle');
  }, [cleanupHardwareAndTimer, updateGpsStatus]);

  /**
   * Đặt lại về trạng thái 'idle' sau khi xem xong màn hình tóm tắt.
   */
  const resetToIdle = useCallback(() => {
    activeRunLockRef.current = false;
    updateGpsStatus('idle');
    setCompletedRun(null);
    setStatusMessage('');
    setMetrics({
      ...INITIAL_METRICS,
      strideM: currentStrideInfo.strideM,
      strideSource: currentStrideInfo.strideSource,
      weightKg,
    });
    setStatus('idle');
  }, [currentStrideInfo.strideM, currentStrideInfo.strideSource, updateGpsStatus, weightKg]);

  // ==================== KHÔI PHỤC TỪ CHECKPOINT KHI MỞ LẠI APP ====================

  const restoreCheckpointSession = useCallback(async () => {
    if (!recoverableCheckpoint) return;
    const cp = recoverableCheckpoint;
    const nowMs = Date.now();

    activeRunLockRef.current = true;
    clientIdRef.current = cp.clientId;
    startedAtMsRef.current = cp.startedAtMs || nowMs;
    accumulatedActiveMsRef.current = Number(cp.accumulatedActiveMs) || 0;
    segmentStartMsRef.current = 0;

    // Thời gian từ lúc lưu checkpoint đến lúc mở lại app được tính là thời gian tạm dừng
    const offlineGapMs = cp.savedAtMs ? Math.max(0, nowMs - cp.savedAtMs) : 0;
    totalPausedMsRef.current = (Number(cp.totalPausedMs) || 0) + offlineGapMs;
    pauseStartedAtMsRef.current = nowMs;

    const restoredSteps = Math.max(0, Number(cp.steps) || 0);
    accumulatedStepsRef.current = restoredSteps;
    currentSubStepsRef.current = 0;
    totalStepsRef.current = restoredSteps;

    splitsRef.current = Array.isArray(cp.splits) ? [...cp.splits] : [];
    lastSplitKmRef.current = splitsRef.current.length;

    const durationSec = Math.floor(accumulatedActiveMsRef.current / 1000);
    const restoredMetrics = computeRunMetrics({
      steps: restoredSteps,
      strideM: cp.strideM || currentStrideInfo.strideM,
      durationSec,
      weightKg: cp.weightKg || weightKg,
    });

    setMetrics({
      ...restoredMetrics,
      strideSource: cp.strideSource || currentStrideInfo.strideSource,
      pausedSec: Math.floor(totalPausedMsRef.current / 1000),
    });

    setRecoverableCheckpoint(null);
    setStatusMessage('Đã khôi phục buổi chạy dở dang (đang tạm dừng). Bấm Tiếp tục để chạy tiếp.');
    setStatus('paused');
  }, [currentStrideInfo.strideM, currentStrideInfo.strideSource, recoverableCheckpoint, weightKg]);

  const discardCheckpointSession = useCallback(async () => {
    setRecoverableCheckpoint(null);
    await clearCheckpoint();
  }, []);

  // ==================== NHẬP TAY BUỔI CHẠY (SOURCE = "manual") ====================

  /**
   * Cho phép người dùng nhập tay buổi chạy khi máy không có cảm biến hoặc từ chối quyền.
   *
   * @param {{ steps: number, durationMin: number, note?: string }} manualInput
   */
  const submitManualRun = useCallback(
    async ({ steps, durationMin, note = '' }) => {
      const numericSteps = Math.round(Number(steps));
      const numericDurationSec = Math.round(Number(durationMin) * 60);

      if (!Number.isFinite(numericSteps) || numericSteps <= 0 || numericSteps > 100000) {
        return { ok: false, error: 'Số bước nhập tay phải từ 1 đến 100.000 bước.' };
      }
      if (
        !Number.isFinite(numericDurationSec) ||
        numericDurationSec < 10 ||
        numericDurationSec > 21600
      ) {
        return { ok: false, error: 'Thời gian chạy phải từ 1 phút đến 360 phút (6 giờ).' };
      }

      const computed = computeRunMetrics({
        steps: numericSteps,
        strideM: currentStrideInfo.strideM,
        durationSec: numericDurationSec,
        weightKg,
      });

      if (computed.avgSpeedKmh > 25) {
        return {
          ok: false,
          error: `Vận tốc tính được (${computed.avgSpeedKmh} km/h) vượt quá ngưỡng 25 km/h. Vui lòng kiểm tra lại số bước và thời gian.`,
        };
      }
      if (computed.calories > 3000) {
        return {
          ok: false,
          error: `Lượng calo (${computed.calories} kcal) vượt ngưỡng 3000 kcal.`,
        };
      }

      const nowMs = Date.now();
      const startedDate = new Date(nowMs - numericDurationSec * 1000);
      const manualRecord = {
        clientId: generateClientId(nowMs),
        date: localDateString(startedDate),
        startedAt: startedDate.toISOString(),
        endedAt: new Date(nowMs).toISOString(),
        source: 'manual',
        steps: computed.steps,
        strideM: computed.strideM,
        strideSource: currentStrideInfo.strideSource,
        distanceKm: computed.distanceKm,
        durationSec: computed.durationSec,
        pausedSec: 0,
        avgSpeedKmh: computed.avgSpeedKmh,
        paceSecPerKm: computed.paceSecPerKm,
        cadenceSpm: computed.cadenceSpm,
        met: computed.met,
        weightKg: computed.weightKg,
        calories: computed.calories,
        splits: computed.paceSecPerKm ? [{ km: 1, sec: computed.paceSecPerKm }] : [],
        routeCoords: [],
        gpsDistanceM: 0,
        note: typeof note === 'string' ? note.trim() : 'Nhập tay buổi chạy',
      };

      setStatus('finishing');
      setStatusMessage('Đang lưu buổi chạy nhập tay...');

      const result = await finishAndSaveRun(manualRecord);
      await refreshQueueCount();

      if (result.status === 'saved') {
        setCompletedRun(result.run);
        setStatusMessage('Đã lưu buổi chạy nhập tay thành công.');
        setStatus('saved');
      } else {
        setCompletedRun({ ...manualRecord, _queued: true });
        setStatusMessage('Buổi chạy nhập tay đã được xếp vào hàng đợi chờ đồng bộ.');
        setStatus('queued');
      }

      return { ok: true, result };
    },
    [currentStrideInfo.strideM, currentStrideInfo.strideSource, refreshQueueCount, weightKg]
  );

  // ==================== HIỆU CHUẨN SẢI CHÂN (0.4 m – 1.6 m) ====================

  const applyCalibration = useCallback(
    async (knownDistanceM, countedSteps) => {
      const check = calibrateStride(knownDistanceM, countedSteps);
      if (!check.valid) {
        return check;
      }
      setCalibratedStrideM(check.strideM);
      await saveCalibratedStrideM(check.strideM, profileId);
      return check;
    },
    [profileId]
  );

  const resetCalibrationToFormula = useCallback(async () => {
    setCalibratedStrideM(null);
    await saveCalibratedStrideM(null, profileId);
  }, [profileId]);

  // ==================== ĐỒNG BỘ HÀNG ĐỢI THỦ CÔNG ====================

  const triggerManualSync = useCallback(async () => {
    setStatusMessage('Đang đồng bộ hàng đợi với máy chủ...');
    const res = await syncQueuedRuns();
    setQueuedCount(res.remainingCount);
    if (res.authRequired) {
      setAuthExpired(true);
      setStatusMessage('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại để gửi hàng đợi.');
    } else if (res.remainingCount === 0) {
      setAuthExpired(false);
      setStatusMessage(
        res.syncedCount > 0
          ? `Đã đồng bộ thành công ${res.syncedCount} buổi chạy.`
          : 'Tất cả buổi chạy đã được đồng bộ.'
      );
      if (status === 'queued' && completedRun) {
        setCompletedRun((prev) => (prev ? { ...prev, _queued: false } : prev));
        setStatus('saved');
      }
    } else {
      setStatusMessage(`Còn ${res.remainingCount} buổi chạy trong hàng đợi (chưa có mạng).`);
    }
    return res;
  }, [completedRun, status]);

  const openSystemSettings = useCallback(() => {
    Linking.openSettings().catch(() => {});
  }, []);

  // Trả về các bộ đếm hiệu năng để hiển thị/kiểm chứng trên máy yếu
  const getPerformanceCounters = useCallback(
    () => ({
      sensorEvents: sensorEventCountRef.current,
      uiRenderTicks: uiTickCountRef.current,
    }),
    []
  );

  const getActiveClientId = useCallback(() => clientIdRef.current, []);

  return {
    status,
    sensorStatus,
    gpsStatus,
    metrics,
    completedRun,
    recoverableCheckpoint,
    queuedCount,
    authExpired,
    setAuthExpired,
    statusMessage,
    calibratedStrideM,
    getActiveClientId,
    prepareSensor,
    startRun,
    pauseRun,
    resumeRun,
    stopRun,
    cancelRun,
    resetToIdle,
    restoreCheckpointSession,
    discardCheckpointSession,
    submitManualRun,
    applyCalibration,
    resetCalibrationToFormula,
    triggerManualSync,
    openSystemSettings,
    getPerformanceCounters,
  };
}
