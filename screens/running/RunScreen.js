// ============================================================================
// screens/RunScreen.js
// Màn hình Chạy bộ tối giản theo phong cách Strava / Nike Run Club / Apple Fitness:
// - Chỉ có 1 hành động chính nổi bật ở đáy ("Bắt đầu chạy bộ").
// - Hiển thị lớn 3 chỉ số chính: Thời gian, Quãng đường (km), Bước chân;
//   gộp 3 chỉ số phụ (Pace, Vận tốc, Calo) vào 1 thẻ ngang gọn gàng.
// - Đưa Hiệu chuẩn sải chân, Kiểm tra cảm biến, Nhập tay vào menu "⋯".
// - Cảnh báo quyền thu gọn thành 1 dải banner nhỏ có 1 nút duy nhất.
// - Bỏ toàn bộ công thức kỹ thuật ("S = bước × ...", "Đếm từ Pedometer") và đoạn mô tả dài.
// - Đồng bộ hoàn toàn chế độ Sáng / Tối với hệ thống màu tối giản; chữ >= 14sp, vùng chạm >= 44px.
// ============================================================================

import React, {
  Suspense,
  lazy,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import {
  fontSize,
  fontWeight,
  layout,
  radius,
  spacing,
} from '../../constants/theme';
import {
  ROUTE_DOWNSAMPLE_TARGET,
  ROUTE_DRAFT_SAVE_INTERVAL_MS,
  ROUTE_MAX_POINTS,
  ROUTE_MIN_POINT_DISTANCE_M,
} from '../../constants/runRoute';
import { useRunTracker } from '../../hooks/useRunTracker';
import { login as apiLogin } from '../../services/api';
import { loadRouteDraft, saveRouteDraft } from '../../services/runRepository';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../store/themeStore';
import { formatDistance, formatDuration, formatInt } from '../../utils/format';
import {
  compactCoordinate,
  downsampleRoute,
  haversineDistanceM,
  routeDistanceM,
} from '../../utils/geo';
import { suggestStrideFromGps } from '../../utils/strideSuggestion';
import RunMapView from '../../components/run/RunMapView';
import RunSummaryScreen from './RunSummaryScreen';

// Lazy-load màn hình lịch sử để tối ưu bộ nhớ cho máy yếu
const LazyRunHistoryScreen = lazy(() => import('./RunHistoryScreen'));

// Ô hiển thị chỉ số phụ bọc React.memo: chỉ render lại khi giá trị thay đổi
const SecondaryStatCell = memo(function SecondaryStatCell({
  label,
  value,
  unit,
  textColor,
  mutedColor,
}) {
  return (
    <View style={staticStyles.secondaryStatCell}>
      <Text style={[staticStyles.secondaryValue, { color: textColor }]}>{value}</Text>
      <Text style={[staticStyles.secondaryLabel, { color: mutedColor }]}>
        {label}
        {unit ? ` (${unit})` : ''}
      </Text>
    </View>
  );
});

export default function RunScreen() {
  const authUser = useAuthStore((state) => state.user);
  const { colors, isDark } = useTheme();

  const userProfile = {
    id: authUser?.id || 1,
    heightCm: authUser?.height || 175,
    weightKg: authUser?.weight || 60,
    gender: authUser?.gender === 'Nữ' ? 'female' : 'male',
  };

  // ==================== LƯU LỘ TRÌNH TRONG useRef (KHÔNG GÂY RE-RENDER) ====================
  // Mảng tọa độ { latitude, longitude } của buổi chạy hiện tại (tối đa ROUTE_MAX_POINTS điểm)
  const routeCoordsRef = useRef([]);
  const lastSavedPointRef = useRef(null);
  const lastDraftSavedMsRef = useRef(0);
  const activeClientIdRef = useRef(null);
  const mapRef = useRef(null);

  // Gợi ý hiệu chuẩn sải chân sau buổi chạy (hiển thị trên RunSummaryScreen)
  const [strideSuggestion, setStrideSuggestion] = useState(null);

  // Callback nhận vị trí GPS hợp lệ từ useRunTracker (KHÔNG gọi setState tại đây)
  const handleLocationUpdate = useCallback((point) => {
    if (!point) return;

    // 1. Luôn cập nhật chấm vị trí người chạy trên bản đồ
    mapRef.current?.setLiveLocation(point);

    // 2. Chỉ thêm điểm vào lộ trình khi là điểm đầu tiên hoặc cách điểm trước >= ROUTE_MIN_POINT_DISTANCE_M (15 m)
    const prev = lastSavedPointRef.current;
    if (prev && haversineDistanceM(prev, point) < ROUTE_MIN_POINT_DISTANCE_M) {
      return;
    }

    const compact = compactCoordinate(point);
    const nextCoords = [...routeCoordsRef.current, compact];
    lastSavedPointRef.current = compact;

    // 3. Giới hạn tối đa ROUTE_MAX_POINTS (200 điểm): vượt ngưỡng thì rút gọn bằng Ramer–Douglas–Peucker
    if (nextCoords.length > ROUTE_MAX_POINTS) {
      const reduced = downsampleRoute(nextCoords, ROUTE_DOWNSAMPLE_TARGET);
      routeCoordsRef.current = reduced;
      mapRef.current?.setRoute(reduced);
    } else {
      routeCoordsRef.current = nextCoords;
      mapRef.current?.appendRoutePoint(compact);
    }

    // 4. Lưu nháp lộ trình định kỳ (~30s/lần, không ghi mỗi điểm) để phòng trường hợp đóng app đột ngột
    const nowMs = Date.now();
    if (
      activeClientIdRef.current &&
      nowMs - lastDraftSavedMsRef.current >= ROUTE_DRAFT_SAVE_INTERVAL_MS
    ) {
      lastDraftSavedMsRef.current = nowMs;
      saveRouteDraft(
        activeClientIdRef.current,
        routeCoordsRef.current,
        routeDistanceM(routeCoordsRef.current)
      ).catch(() => {});
    }
  }, []);

  const {
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
  } = useRunTracker(userProfile, { onLocationUpdate: handleLocationUpdate });

  // Đồng bộ clientId đang chạy vào ref và lưu nháp lộ trình khi ứng dụng chuyển xuống nền
  useEffect(() => {
    activeClientIdRef.current = getActiveClientId();
  }, [getActiveClientId, status]);

  useEffect(() => {
    if (status !== 'running' && status !== 'paused') return undefined;
    const sub = AppState.addEventListener('change', (nextState) => {
      if (
        (nextState === 'background' || nextState === 'inactive') &&
        activeClientIdRef.current &&
        routeCoordsRef.current.length >= 2
      ) {
        saveRouteDraft(
          activeClientIdRef.current,
          routeCoordsRef.current,
          routeDistanceM(routeCoordsRef.current)
        ).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [status]);

  // Điều hướng nội bộ: 'tracker' | 'history' | 'detail'
  const [activeView, setActiveView] = useState('tracker');
  const [selectedHistoryRun, setSelectedHistoryRun] = useState(null);

  // Menu "⋯" chứa các công cụ phụ (Nhập tay, Hiệu chuẩn, Kiểm tra cảm biến)
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);

  // Modal xác nhận dừng buổi chạy
  const [confirmStopVisible, setConfirmStopVisible] = useState(false);
  const [runNote, setRunNote] = useState('');

  // Modal hiệu chuẩn sải chân
  const [calibrateVisible, setCalibrateVisible] = useState(false);
  const [calDistanceInput, setCalDistanceInput] = useState('400');
  const [calStepsInput, setCalStepsInput] = useState('550');
  const [calFeedback, setCalFeedback] = useState('');

  // Modal nhập tay buổi chạy (source = "manual")
  const [manualVisible, setManualVisible] = useState(false);
  const [manualMode, setManualMode] = useState('distance'); // 'distance' | 'steps'
  const [manualDistanceKmInput, setManualDistanceKmInput] = useState('3.0');
  const [manualStepsInput, setManualStepsInput] = useState('4130');
  const [manualMinutesInput, setManualMinutesInput] = useState('25');
  const [manualNoteInput, setManualNoteInput] = useState('');
  const [manualFeedback, setManualFeedback] = useState('');

  // Trạng thái hiển thị bản đồ lộ trình GPS
  const [showMap, setShowMap] = useState(true);
  const [mapInitialCoords, setMapInitialCoords] = useState([]);

  // Modal đăng nhập lại khi gặp lỗi 401
  const [reloginVisible, setReloginVisible] = useState(false);
  const [reloginEmail, setReloginEmail] = useState('quan@figlog.vn');
  const [reloginPassword, setReloginPassword] = useState('123456');
  const [reloginFeedback, setReloginFeedback] = useState('');
  const [reloginLoading, setReloginLoading] = useState(false);

  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleDistanceInputChange = useCallback(
    (text) => {
      setManualDistanceKmInput(text);
      const num = parseFloat(text.replace(',', '.'));
      if (!isNaN(num) && num > 0) {
        const stride = calibratedStrideM || 0.726;
        const s = Math.round((num * 1000) / stride);
        setManualStepsInput(String(s));
      }
    },
    [calibratedStrideM]
  );

  const handleStepsInputChange = useCallback(
    (text) => {
      setManualStepsInput(text);
      const num = parseInt(text, 10);
      if (!isNaN(num) && num > 0) {
        const stride = calibratedStrideM || 0.726;
        const dist = ((num * stride) / 1000).toFixed(2);
        setManualDistanceKmInput(String(dist));
      }
    },
    [calibratedStrideM]
  );

  const clearRecordedRoute = useCallback(() => {
    routeCoordsRef.current = [];
    lastSavedPointRef.current = null;
    lastDraftSavedMsRef.current = 0;
    setMapInitialCoords([]);
    mapRef.current?.resetRoute();
  }, []);

  const handleStartRun = useCallback(async () => {
    clearRecordedRoute();
    setStrideSuggestion(null);
    await startRun();
  }, [clearRecordedRoute, startRun]);

  const handleRestoreCheckpoint = useCallback(async () => {
    const cpClientId = recoverableCheckpoint?.clientId;
    if (cpClientId) {
      const draft = await loadRouteDraft(cpClientId);
      if (draft && draft.routeCoords.length > 0) {
        routeCoordsRef.current = draft.routeCoords;
        lastSavedPointRef.current = draft.routeCoords[draft.routeCoords.length - 1];
        setMapInitialCoords(draft.routeCoords);
        mapRef.current?.setRoute(draft.routeCoords);
      } else {
        clearRecordedRoute();
      }
    }
    await restoreCheckpointSession();
  }, [clearRecordedRoute, recoverableCheckpoint?.clientId, restoreCheckpointSession]);

  const handleConfirmFinish = useCallback(async () => {
    setConfirmStopVisible(false);
    // Đảm bảo số điểm lưu không vượt quá ROUTE_MAX_POINTS (200)
    const finalRouteCoords = downsampleRoute(routeCoordsRef.current, ROUTE_MAX_POINTS);
    const gpsDistanceM = Math.round(routeDistanceM(finalRouteCoords));

    const saveResult = await stopRun(runNote, {
      routeCoords: finalRouteCoords,
      gpsDistanceM,
    });
    setRunNote('');

    const finalSteps = saveResult?.run?.steps ?? metrics.steps;
    const suggestion = suggestStrideFromGps({
      gpsDistanceM,
      steps: finalSteps,
      currentStrideM: metrics.strideM,
    });
    setStrideSuggestion(suggestion.shouldSuggest ? suggestion : null);
  }, [metrics.steps, metrics.strideM, runNote, stopRun]);

  const handleApplySuggestedStride = useCallback(async () => {
    if (!strideSuggestion?.shouldSuggest) return { valid: false };
    const res = await applyCalibration(strideSuggestion.gpsDistanceM, strideSuggestion.steps);
    if (res.valid) {
      setStrideSuggestion(null);
    }
    return res;
  }, [applyCalibration, strideSuggestion]);

  const handleDismissStrideSuggestion = useCallback(() => {
    setStrideSuggestion(null);
  }, []);

  const handleCancelRun = useCallback(async () => {
    clearRecordedRoute();
    setStrideSuggestion(null);
    await cancelRun();
  }, [cancelRun, clearRecordedRoute]);

  const handleResetToIdle = useCallback(() => {
    clearRecordedRoute();
    setStrideSuggestion(null);
    resetToIdle();
  }, [clearRecordedRoute, resetToIdle]);

  const handleApplyCalibration = useCallback(async () => {
    const res = await applyCalibration(Number(calDistanceInput), Number(calStepsInput));
    if (!res.valid) {
      setCalFeedback(res.error || 'Sải chân phải từ 0.4 m đến 1.6 m.');
      return;
    }
    setCalFeedback(`Đã lưu sải chân: ${res.strideM} m`);
    setTimeout(() => {
      setCalibrateVisible(false);
      setCalFeedback('');
    }, 600);
  }, [applyCalibration, calDistanceInput, calStepsInput]);

  const handleResetCalibration = useCallback(async () => {
    await resetCalibrationToFormula();
    setCalFeedback('Đã đặt lại theo chiều cao.');
  }, [resetCalibrationToFormula]);

  const handleSaveManualRun = useCallback(async () => {
    setManualFeedback('');
    let calculatedSteps = Number(manualStepsInput);
    if (manualMode === 'distance') {
      const dist = Number(manualDistanceKmInput.replace(',', '.'));
      if (!Number.isFinite(dist) || dist <= 0) {
        setManualFeedback('Vui lòng nhập quãng đường hợp lệ (lớn hơn 0 km).');
        return;
      }
      const stride = calibratedStrideM || 0.726;
      calculatedSteps = Math.round((dist * 1000) / stride);
    }

    const res = await submitManualRun({
      steps: calculatedSteps,
      durationMin: Number(manualMinutesInput),
      note: manualNoteInput,
    });
    if (!res.ok) {
      setManualFeedback(res.error || 'Dữ liệu không hợp lệ.');
      return;
    }
    setManualVisible(false);
    setManualNoteInput('');
  }, [
    calibratedStrideM,
    manualDistanceKmInput,
    manualMinutesInput,
    manualMode,
    manualNoteInput,
    manualStepsInput,
    submitManualRun,
  ]);

  const handleReloginSubmit = useCallback(async () => {
    setReloginLoading(true);
    setReloginFeedback('');
    try {
      const user = await apiLogin(reloginEmail.trim(), reloginPassword);
      if (user) {
        setAuthExpired(false);
        setReloginVisible(false);
        await triggerManualSync();
      } else {
        setReloginFeedback('Đăng nhập không thành công.');
      }
    } catch (err) {
      setReloginFeedback(err?.message || 'Sai email hoặc mật khẩu.');
    } finally {
      setReloginLoading(false);
    }
  }, [reloginEmail, reloginPassword, setAuthExpired, triggerManualSync]);

  const handleOpenHistory = useCallback(() => {
    setMoreMenuVisible(false);
    setActiveView('history');
  }, []);

  const handleCloseHistory = useCallback(() => {
    setSelectedHistoryRun(null);
    setActiveView('tracker');
  }, []);

  const handleSelectHistoryRun = useCallback((runItem) => {
    setSelectedHistoryRun(runItem);
    setActiveView('detail');
  }, []);

  // ==================== 1. XEM CHI TIẾT BUỔI CHẠY TỪ LỊCH SỬ ====================
  if (activeView === 'detail' && selectedHistoryRun) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <RunSummaryScreen
          run={selectedHistoryRun}
          syncStatus={selectedHistoryRun._queued ? 'queued' : 'saved'}
          onSyncNow={triggerManualSync}
          onDone={() => {
            setSelectedHistoryRun(null);
            setActiveView('history');
          }}
        />
      </SafeAreaView>
    );
  }

  // ==================== 2. MÀN HÌNH LỊCH SỬ (LAZY-LOADED) ====================
  if (activeView === 'history') {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Suspense
          fallback={
            <View style={styles.suspenseBox}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.suspenseText}>Đang tải lịch sử...</Text>
            </View>
          }
        >
          <LazyRunHistoryScreen
            onBack={handleCloseHistory}
            onSelectRun={handleSelectHistoryRun}
          />
        </Suspense>
      </SafeAreaView>
    );
  }

  // ==================== 3. MÀN HÌNH TÓM TẮT SAU KHI DỪNG ====================
  if ((status === 'saved' || status === 'queued') && completedRun) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <RunSummaryScreen
          run={completedRun}
          syncStatus={status}
          statusMessage={statusMessage}
          strideSuggestion={strideSuggestion}
          onApplyStrideSuggestion={handleApplySuggestedStride}
          onDismissStrideSuggestion={handleDismissStrideSuggestion}
          onSyncNow={triggerManualSync}
          onOpenHistory={handleOpenHistory}
          onDone={handleResetToIdle}
        />
      </SafeAreaView>
    );
  }

  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isFinishing = status === 'finishing';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* ================= HEADER TỐI GIẢN: TIÊU ĐỀ + LỊCH SỬ + MENU "⋯" ================= */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Chạy bộ</Text>

        {!isRunning && !isPaused ? (
          <View style={styles.headerActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Lịch sử chạy bộ"
              style={styles.iconBtn}
              onPress={handleOpenHistory}
            >
              <Ionicons name="time-outline" size={22} color={colors.text} />
              {queuedCount > 0 ? (
                <View style={styles.queueDot}>
                  <Text style={styles.queueDotText}>{queuedCount}</Text>
                </View>
              ) : null}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tùy chọn khác"
              style={styles.iconBtn}
              onPress={() => setMoreMenuVisible(true)}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
            </Pressable>
          </View>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ================= DẢI BANNER THU GỌN (1 DÒNG - 1 NÚT DUY NHẤT) ================= */}
        {sensorStatus.errorReason ? (
          <View style={styles.compactWarningBanner}>
            <View style={styles.bannerLeft}>
              <Ionicons name="alert-circle-outline" size={20} color={colors.warning} />
              <Text style={styles.bannerText} numberOfLines={1}>
                {sensorStatus.errorReason === 'unavailable'
                  ? 'Thiết bị không có cảm biến bước'
                  : 'Cần cấp quyền cảm biến bước chân'}
              </Text>
            </View>
            {sensorStatus.errorReason === 'unavailable' ? (
              <Pressable
                style={styles.bannerSingleBtn}
                onPress={() => {
                  setManualFeedback('');
                  setManualVisible(true);
                }}
              >
                <Text style={styles.bannerSingleBtnText}>Nhập tay</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.bannerSingleBtn} onPress={openSystemSettings}>
                <Text style={styles.bannerSingleBtnText}>Cài đặt</Text>
              </Pressable>
            )}
          </View>
        ) : null}

        {/* Banner khôi phục buổi chạy dở dang (1 hàng gọn) */}
        {recoverableCheckpoint && status === 'idle' ? (
          <View style={styles.compactInfoBanner}>
            <View style={styles.bannerLeft}>
              <Ionicons name="refresh-circle-outline" size={20} color={colors.primary} />
              <Text style={styles.bannerText} numberOfLines={1}>
                Buổi chạy dở dang ({formatInt(recoverableCheckpoint.steps || 0)} bước)
              </Text>
            </View>
            <View style={styles.inlineBannerActions}>
              <Pressable style={styles.bannerPrimaryBtn} onPress={handleRestoreCheckpoint}>
                <Text style={styles.bannerPrimaryBtnText}>Tiếp tục</Text>
              </Pressable>
              <Pressable
                style={styles.bannerDismissBtn}
                onPress={discardCheckpointSession}
              >
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Banner đồng bộ hàng đợi khi offline hoặc hết hạn phiên (1 nút duy nhất) */}
        {queuedCount > 0 && !isRunning && !isPaused ? (
          <View style={styles.compactWarningBanner}>
            <View style={styles.bannerLeft}>
              <Ionicons name="cloud-offline-outline" size={20} color={colors.warning} />
              <Text style={styles.bannerText} numberOfLines={1}>
                {authExpired
                  ? `Hết hạn phiên (${queuedCount} buổi chờ)`
                  : `${queuedCount} buổi chạy chờ đồng bộ`}
              </Text>
            </View>
            <Pressable
              style={styles.bannerSingleBtn}
              onPress={
                authExpired
                  ? () => {
                    setReloginFeedback('');
                    setReloginVisible(true);
                  }
                  : triggerManualSync
              }
            >
              <Text style={styles.bannerSingleBtnText}>
                {authExpired ? 'Đăng nhập' : 'Đồng bộ'}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* ================= BẢN ĐỒ LỘ TRÌNH GPS THẬT ================= */}
        {showMap ? (
          <View style={styles.mapSectionWrap}>
            <View style={styles.mapSectionHeader}>
              <View style={styles.mapHeaderLeft}>
                <Ionicons name="map-outline" size={17} color={colors.primary} />
                <Text style={styles.mapSectionTitle}>Bản đồ lộ trình GPS</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Thu gọn bản đồ"
                style={styles.toggleMapMiniBtn}
                onPress={() => setShowMap(false)}
              >
                <Ionicons name="chevron-up-outline" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
            <RunMapView
              ref={mapRef}
              isTracking={isRunning}
              gpsStatus={gpsStatus}
              initialCoordinates={mapInitialCoords}
              height={220}
            />
          </View>
        ) : (
          <View style={styles.collapsedMapBar}>
            <Pressable
              style={styles.showMapBtn}
              onPress={() => {
                setMapInitialCoords([...routeCoordsRef.current]);
                setShowMap(true);
              }}
            >
              <Ionicons name="map-outline" size={18} color={colors.primary} />
              <Text style={styles.showMapBtnText}>Hiện bản đồ lộ trình GPS</Text>
              <Ionicons name="chevron-down-outline" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        )}

        {/* ================= KHỐI TRUNG TÂM: THỜI GIAN, QUÃNG ĐƯỜNG, BƯỚC CHÂN ================= */}
        <View style={styles.heroCard}>
          {/* Nhãn trạng thái ngắn gọn */}
          <View
            style={[
              styles.statusPill,
              isRunning && { backgroundColor: colors.primaryLight },
              isPaused && { backgroundColor: colors.warningLight },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: isRunning
                    ? colors.primary
                    : isPaused
                      ? colors.warning
                      : colors.textMuted,
                },
              ]}
            />
            <Text
              style={[
                styles.statusPillText,
                {
                  color: isRunning
                    ? colors.primary
                    : isPaused
                      ? colors.warning
                      : colors.textSecondary,
                },
              ]}
            >
              {status === 'idle' && 'Sẵn sàng'}
              {status === 'ready' && 'Cảm biến sẵn sàng'}
              {status === 'running' && 'Đang chạy'}
              {status === 'paused' && 'Tạm dừng'}
              {status === 'finishing' && 'Đang lưu...'}
            </Text>
          </View>

          {/* 1. Thời gian hiển thị lớn ở trung tâm */}
          <Text style={styles.heroTimerValue}>{formatDuration(metrics.durationSec)}</Text>
          <Text style={styles.heroTimerLabel}>Thời gian</Text>

          <View style={styles.heroDivider} />

          {/* 2. Quãng đường & Bước chân hiển thị lớn (2 cột chính) */}
          <View style={styles.primaryMetricsRow}>
            <View style={styles.primaryMetricCol}>
              <Text style={[styles.primaryMetricValue, { color: colors.primary }]}>
                {formatDistance(metrics.distanceKm)}
              </Text>
              <Text style={styles.primaryMetricLabel}>Quãng đường (km)</Text>
            </View>

            <View style={styles.verticalDivider} />

            <View style={styles.primaryMetricCol}>
              <Text style={styles.primaryMetricValue}>{formatInt(metrics.steps)}</Text>
              <Text style={styles.primaryMetricLabel}>Bước chân</Text>
            </View>
          </View>
        </View>

        {/* ================= 3 CHỈ SỐ PHỤ GỘP TRONG 1 THẺ NGANG ================= */}
        <View style={styles.secondaryCard}>
          <SecondaryStatCell
            label="Pace"
            value={metrics.paceFormatted}
            unit="/km"
            textColor={colors.text}
            mutedColor={colors.textMuted}
          />
          <View style={styles.secondaryDivider} />
          <SecondaryStatCell
            label="Vận tốc"
            value={metrics.avgSpeedKmh.toFixed(1)}
            unit="km/h"
            textColor={colors.text}
            mutedColor={colors.textMuted}
          />
          <View style={styles.secondaryDivider} />
          <SecondaryStatCell
            label="Calo"
            value={formatInt(metrics.calories)}
            unit="kcal"
            textColor={colors.text}
            mutedColor={colors.textMuted}
          />
        </View>

        {/* Lưu ý ngắn gọn 1 dòng khi đang chạy */}
        {isRunning || isPaused ? (
          <Text style={styles.keepAwakeHint}>
            Màn hình đang được giữ sáng để đếm bước chính xác
          </Text>
        ) : null}
      </ScrollView>

      {/* ================= ĐÁY MÀN HÌNH: 1 HÀNH ĐỘNG CHÍNH NỔI BẬT ================= */}
      <View style={styles.bottomBar}>
        {(status === 'idle' || status === 'ready') && (
          <Pressable
            accessibilityRole="button"
            style={styles.primaryStartBtn}
            onPress={handleStartRun}
          >
            <Ionicons name="play" size={20} color={colors.textOnPrimary} />
            <Text style={styles.primaryStartBtnText}>Bắt đầu chạy bộ</Text>
          </Pressable>
        )}

        {isRunning && (
          <View style={styles.activeControlsRow}>
            <Pressable style={styles.pauseBtn} onPress={pauseRun}>
              <Ionicons name="pause" size={20} color={colors.text} />
              <Text style={styles.pauseBtnText}>Tạm dừng</Text>
            </Pressable>
            <Pressable
              style={styles.stopBtn}
              onPress={() => setConfirmStopVisible(true)}
            >
              <Ionicons name="stop" size={20} color="#FFFFFF" />
              <Text style={styles.stopBtnText}>Kết thúc</Text>
            </Pressable>
          </View>
        )}

        {isPaused && (
          <View style={styles.activeControlsRow}>
            <Pressable style={styles.resumeBtn} onPress={resumeRun}>
              <Ionicons name="play" size={20} color={colors.textOnPrimary} />
              <Text style={styles.resumeBtnText}>Tiếp tục</Text>
            </Pressable>
            <Pressable
              style={styles.stopBtn}
              onPress={() => setConfirmStopVisible(true)}
            >
              <Ionicons name="stop" size={20} color="#FFFFFF" />
              <Text style={styles.stopBtnText}>Kết thúc</Text>
            </Pressable>
          </View>
        )}

        {isFinishing && (
          <View style={styles.finishingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.finishingText}>Đang lưu buổi chạy...</Text>
          </View>
        )}
      </View>

      {/* ================= MENU "⋯" (CÁC TÙY CHỌN PHỤ) ================= */}
      <Modal
        visible={moreMenuVisible}
        transparent
        animationType="none"
        onRequestClose={() => setMoreMenuVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setMoreMenuVisible(false)}
        >
          <View style={styles.menuSheet}>
            <Text style={styles.menuTitle}>Tùy chọn chạy bộ</Text>

            <Pressable
              style={styles.menuRow}
              onPress={() => {
                setMoreMenuVisible(false);
                setManualFeedback('');
                setManualVisible(true);
              }}
            >
              <Ionicons name="create-outline" size={22} color={colors.primary} />
              <Text style={styles.menuRowText}>Nhập quãng đường thủ công</Text>
            </Pressable>

            <View style={styles.menuDivider} />

            <Pressable
              style={styles.menuRow}
              onPress={() => {
                setMoreMenuVisible(false);
                setCalFeedback('');
                setCalibrateVisible(true);
              }}
            >
              <Ionicons name="footsteps-outline" size={22} color={colors.primary} />
              <View style={styles.menuRowCenter}>
                <Text style={styles.menuRowText}>Hiệu chuẩn sải chân</Text>
                <Text style={styles.menuRowSub}>Hiện tại: {metrics.strideM} m</Text>
              </View>
            </Pressable>

            <View style={styles.menuDivider} />

            <Pressable
              style={styles.menuRow}
              onPress={async () => {
                setMoreMenuVisible(false);
                await prepareSensor();
              }}
            >
              <Ionicons name="hardware-chip-outline" size={22} color={colors.primary} />
              <Text style={styles.menuRowText}>Kiểm tra cảm biến</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* ================= MODAL XÁC NHẬN KẾT THÚC BUỔI CHẠY ================= */}
      <Modal
        visible={confirmStopVisible}
        transparent
        animationType="none"
        onRequestClose={() => setConfirmStopVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Lưu buổi chạy?</Text>
            <Text style={styles.modalSummaryText}>
              {formatDistance(metrics.distanceKm)} km • {formatInt(metrics.steps)} bước •{' '}
              {formatDuration(metrics.durationSec)}
            </Text>

            <Text style={styles.inputLabel}>Ghi chú (tùy chọn)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Ví dụ: Chạy máy trong nhà..."
              placeholderTextColor={colors.textMuted}
              value={runNote}
              onChangeText={setRunNote}
            />

            <View style={styles.modalBtnRow}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setConfirmStopVisible(false)}
              >
                <Text style={styles.modalCancelText}>Chạy tiếp</Text>
              </Pressable>
              <Pressable style={styles.modalConfirmBtn} onPress={handleConfirmFinish}>
                <Text style={styles.modalConfirmText}>Lưu buổi chạy</Text>
              </Pressable>
            </View>

            <Pressable
              style={styles.discardLink}
              onPress={() => {
                setConfirmStopVisible(false);
                handleCancelRun();
              }}
            >
              <Text style={styles.discardLinkText}>Hủy buổi chạy (không lưu)</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL HIỆU CHUẨN SẢI CHÂN ================= */}
      <Modal
        visible={calibrateVisible}
        transparent
        animationType="none"
        onRequestClose={() => setCalibrateVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Hiệu chuẩn sải chân</Text>
            <Text style={styles.modalSummaryText}>
              Nhập quãng đường thực tế và số bước đếm được (hợp lệ: 0.4 m – 1.6 m).
            </Text>

            <Text style={styles.inputLabel}>Quãng đường đã biết (mét)</Text>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              value={calDistanceInput}
              onChangeText={setCalDistanceInput}
              placeholder="400"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.inputLabel}>Số bước đếm được</Text>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              value={calStepsInput}
              onChangeText={setCalStepsInput}
              placeholder="550"
              placeholderTextColor={colors.textMuted}
            />

            {calFeedback ? <Text style={styles.feedbackText}>{calFeedback}</Text> : null}

            <View style={styles.modalBtnRow}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setCalibrateVisible(false)}
              >
                <Text style={styles.modalCancelText}>Đóng</Text>
              </Pressable>
              <Pressable style={styles.modalConfirmBtn} onPress={handleApplyCalibration}>
                <Text style={styles.modalConfirmText}>Lưu</Text>
              </Pressable>
            </View>

            {calibratedStrideM !== null ? (
              <Pressable style={styles.discardLink} onPress={handleResetCalibration}>
                <Text style={styles.discardLinkText}>Đặt lại theo chiều cao</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* ================= MODAL NHẬP QUÃNG ĐƯỜNG / BƯỚC CHÂN ================= */}
      <Modal
        visible={manualVisible}
        transparent
        animationType="none"
        onRequestClose={() => setManualVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nhập quãng đường buổi chạy</Text>

            {/* Bộ chọn chế độ: Quãng đường (km) hoặc Số bước */}
            <View style={styles.modeSwitchRow}>
              <Pressable
                style={[
                  styles.modeSwitchBtn,
                  manualMode === 'distance' && styles.modeSwitchBtnActive,
                ]}
                onPress={() => setManualMode('distance')}
              >
                <Text
                  style={[
                    styles.modeSwitchText,
                    manualMode === 'distance' && styles.modeSwitchTextActive,
                  ]}
                >
                  Theo Quãng đường (km)
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modeSwitchBtn,
                  manualMode === 'steps' && styles.modeSwitchBtnActive,
                ]}
                onPress={() => setManualMode('steps')}
              >
                <Text
                  style={[
                    styles.modeSwitchText,
                    manualMode === 'steps' && styles.modeSwitchTextActive,
                  ]}
                >
                  Theo Bước chân
                </Text>
              </Pressable>
            </View>

            {manualMode === 'distance' ? (
              <>
                <Text style={styles.inputLabel}>Quãng đường (km)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="decimal-pad"
                  value={manualDistanceKmInput}
                  onChangeText={handleDistanceInputChange}
                  placeholder="Ví dụ: 3.5"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.manualConversionHint}>
                  Tương đương ~{formatInt(Number(manualStepsInput) || 0)} bước chân (theo sải chân{' '}
                  {(calibratedStrideM || 0.726).toFixed(3)} m)
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.inputLabel}>Số bước chân</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  value={manualStepsInput}
                  onChangeText={handleStepsInputChange}
                  placeholder="Ví dụ: 4000"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={styles.manualConversionHint}>
                  Tương đương ~{manualDistanceKmInput} km (theo sải chân{' '}
                  {(calibratedStrideM || 0.726).toFixed(3)} m)
                </Text>
              </>
            )}

            <Text style={styles.inputLabel}>Thời gian (phút)</Text>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              value={manualMinutesInput}
              onChangeText={setManualMinutesInput}
              placeholder="25"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.inputLabel}>Ghi chú (tùy chọn)</Text>
            <TextInput
              style={styles.textInput}
              value={manualNoteInput}
              onChangeText={setManualNoteInput}
              placeholder="Chạy máy chạy bộ / ngoài trời"
              placeholderTextColor={colors.textMuted}
            />

            {manualFeedback ? <Text style={styles.feedbackText}>{manualFeedback}</Text> : null}

            <View style={styles.modalBtnRow}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setManualVisible(false)}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </Pressable>
              <Pressable style={styles.modalConfirmBtn} onPress={handleSaveManualRun}>
                <Text style={styles.modalConfirmText}>Lưu buổi chạy</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL ĐĂNG NHẬP LẠI KHI HẾT HẠN TOKEN (401) ================= */}
      <Modal
        visible={reloginVisible}
        transparent
        animationType="none"
        onRequestClose={() => setReloginVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Đăng nhập lại</Text>
            <Text style={styles.modalSummaryText}>
              {queuedCount} buổi chạy trong hàng đợi sẽ tự đồng bộ sau khi đăng nhập.
            </Text>

            <Text style={styles.inputLabel}>Email</Text>
            <TextInput
              style={styles.textInput}
              autoCapitalize="none"
              keyboardType="email-address"
              value={reloginEmail}
              onChangeText={setReloginEmail}
              placeholderTextColor={colors.textMuted}
            />

            <Text style={styles.inputLabel}>Mật khẩu</Text>
            <TextInput
              style={styles.textInput}
              secureTextEntry
              value={reloginPassword}
              onChangeText={setReloginPassword}
              placeholderTextColor={colors.textMuted}
            />

            {reloginFeedback ? <Text style={styles.feedbackText}>{reloginFeedback}</Text> : null}

            <View style={styles.modalBtnRow}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setReloginVisible(false)}
              >
                <Text style={styles.modalCancelText}>Đóng</Text>
              </Pressable>
              <Pressable
                style={styles.modalConfirmBtn}
                onPress={handleReloginSubmit}
                disabled={reloginLoading}
              >
                <Text style={styles.modalConfirmText}>
                  {reloginLoading ? 'Đang xử lý...' : 'Đăng nhập'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const staticStyles = StyleSheet.create({
  secondaryStatCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    gap: 4,
  },
  secondaryValue: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  secondaryLabel: {
    fontSize: fontSize.caption,
  },
});

const createStyles = (colors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    suspenseBox: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    suspenseText: {
      marginTop: spacing.sm,
      fontSize: fontSize.body,
      color: colors.textMuted,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: layout.screenPadding,
      paddingVertical: spacing.sm,
    },
    headerTitle: {
      fontSize: fontSize.title,
      fontWeight: fontWeight.bold,
      color: colors.text,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    iconBtn: {
      width: layout.minTouchSize,
      height: layout.minTouchSize,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    queueDot: {
      position: 'absolute',
      top: 4,
      right: 4,
      minWidth: 18,
      height: 18,
      borderRadius: radius.pill,
      backgroundColor: colors.warning,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    queueDotText: {
      fontSize: 11,
      fontWeight: fontWeight.bold,
      color: '#FFFFFF',
    },
    scrollContent: {
      paddingHorizontal: layout.screenPadding,
      paddingTop: spacing.xs,
      paddingBottom: spacing.xl,
      gap: spacing.lg,
    },
    compactWarningBanner: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.warningLight,
      borderWidth: 1,
      borderColor: colors.warning,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      gap: spacing.sm,
    },
    compactInfoBanner: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      gap: spacing.sm,
    },
    bannerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      flex: 1,
    },
    bannerText: {
      flex: 1,
      fontSize: fontSize.caption,
      fontWeight: fontWeight.medium,
      color: colors.text,
    },
    bannerSingleBtn: {
      minHeight: 36,
      paddingHorizontal: spacing.md,
      borderRadius: radius.sm,
      backgroundColor: colors.warning,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bannerSingleBtnText: {
      fontSize: fontSize.caption,
      fontWeight: fontWeight.bold,
      color: '#FFFFFF',
    },
    inlineBannerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    bannerPrimaryBtn: {
      minHeight: 36,
      paddingHorizontal: spacing.md,
      borderRadius: radius.sm,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bannerPrimaryBtnText: {
      fontSize: fontSize.caption,
      fontWeight: fontWeight.bold,
      color: '#FFFFFF',
    },
    bannerDismissBtn: {
      width: 36,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
    },
    statusPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surfaceAlt,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      borderRadius: radius.pill,
      marginBottom: spacing.md,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: radius.pill,
    },
    statusPillText: {
      fontSize: fontSize.caption,
      fontWeight: fontWeight.semibold,
    },
    heroTimerValue: {
      fontSize: fontSize.displayHero,
      fontWeight: fontWeight.heavy,
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    heroTimerLabel: {
      fontSize: fontSize.caption,
      color: colors.textMuted,
      marginTop: 2,
    },
    heroDivider: {
      width: '100%',
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.lg,
    },
    primaryMetricsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
    },
    primaryMetricCol: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
    },
    primaryMetricValue: {
      fontSize: 36,
      fontWeight: fontWeight.heavy,
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },
    primaryMetricLabel: {
      fontSize: fontSize.caption,
      color: colors.textMuted,
    },
    verticalDivider: {
      width: 1,
      height: 44,
      backgroundColor: colors.border,
    },
    secondaryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.sm,
    },
    secondaryDivider: {
      width: 1,
      height: 36,
      backgroundColor: colors.border,
    },
    keepAwakeHint: {
      fontSize: fontSize.caption,
      color: colors.textMuted,
      textAlign: 'center',
    },
    bottomBar: {
      paddingHorizontal: layout.screenPadding,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg, // Giữ khoảng cách 16px (>= 12px) tách biệt rõ với thanh TabBar
      backgroundColor: colors.background,
    },
    primaryStartBtn: {
      minHeight: layout.buttonHeight,
      backgroundColor: colors.primary,
      borderRadius: radius.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    primaryStartBtnText: {
      fontSize: fontSize.body,
      fontWeight: fontWeight.bold,
      color: colors.textOnPrimary,
    },
    activeControlsRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    pauseBtn: {
      flex: 1,
      minHeight: layout.buttonHeight,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    pauseBtnText: {
      fontSize: fontSize.body,
      fontWeight: fontWeight.bold,
      color: colors.text,
    },
    resumeBtn: {
      flex: 1,
      minHeight: layout.buttonHeight,
      backgroundColor: colors.primary,
      borderRadius: radius.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    resumeBtnText: {
      fontSize: fontSize.body,
      fontWeight: fontWeight.bold,
      color: colors.textOnPrimary,
    },
    stopBtn: {
      flex: 1,
      minHeight: layout.buttonHeight,
      backgroundColor: colors.danger,
      borderRadius: radius.lg,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    stopBtnText: {
      fontSize: fontSize.body,
      fontWeight: fontWeight.bold,
      color: '#FFFFFF',
    },
    finishingRow: {
      minHeight: layout.buttonHeight,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    finishingText: {
      fontSize: fontSize.body,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      padding: layout.screenPadding,
    },
    menuSheet: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.sm,
      overflow: 'hidden',
    },
    menuTitle: {
      fontSize: fontSize.caption,
      fontWeight: fontWeight.bold,
      color: colors.textMuted,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    menuRow: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    menuRowCenter: {
      flex: 1,
    },
    menuRowText: {
      fontSize: fontSize.body,
      fontWeight: fontWeight.medium,
      color: colors.text,
    },
    menuRowSub: {
      fontSize: fontSize.caption,
      color: colors.textMuted,
    },
    menuDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginLeft: spacing.lg + 22 + spacing.md,
    },
    modalCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
    },
    modalTitle: {
      fontSize: fontSize.title,
      fontWeight: fontWeight.bold,
      color: colors.text,
      marginBottom: 4,
    },
    modalSummaryText: {
      fontSize: fontSize.caption,
      color: colors.textMuted,
      marginBottom: spacing.md,
    },
    inputLabel: {
      fontSize: fontSize.caption,
      fontWeight: fontWeight.semibold,
      color: colors.textSecondary,
      marginBottom: 6,
      marginTop: spacing.sm,
    },
    textInput: {
      minHeight: layout.minTouchSize,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      fontSize: fontSize.body,
      color: colors.text,
    },
    feedbackText: {
      marginTop: spacing.sm,
      fontSize: fontSize.caption,
      fontWeight: fontWeight.semibold,
      color: colors.warning,
    },
    modalBtnRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.lg,
    },
    modalCancelBtn: {
      flex: 1,
      minHeight: layout.minTouchSize,
      backgroundColor: colors.surfaceAlt,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalCancelText: {
      fontSize: fontSize.body,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
    modalConfirmBtn: {
      flex: 1,
      minHeight: layout.minTouchSize,
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalConfirmText: {
      fontSize: fontSize.body,
      fontWeight: fontWeight.bold,
      color: colors.textOnPrimary,
    },
    discardLink: {
      minHeight: layout.minTouchSize,
      marginTop: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    discardLinkText: {
      fontSize: fontSize.caption,
      fontWeight: fontWeight.semibold,
      color: colors.danger,
    },
    mapSectionWrap: {
      gap: spacing.xs,
    },
    mapSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 2,
      marginBottom: 2,
    },
    mapHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    mapSectionTitle: {
      fontSize: fontSize.caption,
      fontWeight: fontWeight.bold,
      color: colors.text,
    },
    toggleMapMiniBtn: {
      width: 32,
      height: 32,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    collapsedMapBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    showMapBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      flex: 1,
    },
    showMapBtnText: {
      fontSize: fontSize.caption,
      fontWeight: fontWeight.semibold,
      color: colors.primary,
    },
    modeSwitchRow: {
      flexDirection: 'row',
      borderRadius: radius.md,
      backgroundColor: colors.surfaceAlt,
      padding: 3,
      marginBottom: spacing.md,
    },
    modeSwitchBtn: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.sm,
    },
    modeSwitchBtnActive: {
      backgroundColor: colors.surface,
    },
    modeSwitchText: {
      fontSize: fontSize.caption,
      fontWeight: fontWeight.medium,
      color: colors.textMuted,
    },
    modeSwitchTextActive: {
      fontWeight: fontWeight.bold,
      color: colors.primary,
    },
    manualConversionHint: {
      fontSize: fontSize.caption,
      color: colors.textSecondary,
      backgroundColor: colors.surfaceAlt,
      padding: spacing.sm,
      borderRadius: radius.sm,
      marginBottom: spacing.sm,
      lineHeight: 18,
    },
  });
