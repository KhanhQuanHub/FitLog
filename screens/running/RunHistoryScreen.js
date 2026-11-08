// ============================================================================
// screens/RunHistoryScreen.js
// Màn hình Lịch sử chạy bộ tối giản, đồng bộ Sáng / Tối:
// - Giữ nguyên phân trang GET /runs?_sort=startedAt&_order=desc&_page=N&_limit=20
// - Tối ưu FlatList cho máy yếu: windowSize={5}, removeClippedSubviews, getItemLayout,
//   React.memo cho từng dòng.
// - Giao diện gọn gàng, bỏ mô tả kỹ thuật dài; chữ >= 14sp, vùng chạm >= 44px.
// ============================================================================

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Polyline } from 'react-native-svg';

import {
  fontSize,
  fontWeight,
  layout,
  radius,
  spacing,
} from '../../constants/theme';
import { dedupeRuns, fetchRunHistoryPage, syncQueuedRuns } from '../../services/runRepository';
import { useTheme } from '../../store/themeStore';
import { formatPaceSec } from '../../utils/runMath';
import { formatDistance, formatDuration, formatInt } from '../../utils/format';
import { normalizeRouteCoords } from '../../utils/geo';
import RunSummaryScreen from './RunSummaryScreen';

const PAGE_LIMIT = 20;
const MAX_STATE_ITEMS = 120;
const ROW_HEIGHT = 104;
const SEPARATOR_HEIGHT = 10;
const TOTAL_ROW_HEIGHT = ROW_HEIGHT + SEPARATOR_HEIGHT;

function keyExtractor(item, index) {
  if (item?.clientId) return String(item.clientId);
  if (item?.id !== undefined && item?.id !== null) return `run_${item.id}`;
  return `idx_${index}`;
}

function getItemLayout(_data, index) {
  return {
    length: ROW_HEIGHT,
    offset: TOTAL_ROW_HEIGHT * index,
    index,
  };
}

const ItemSeparator = memo(function ItemSeparator() {
  return <View style={staticStyles.separator} />;
});

// Thumbnail SVG siêu nhẹ vẽ lộ trình trong danh sách (không tạo WebView trong FlatList)
const RouteMiniThumbnail = memo(function RouteMiniThumbnail({ routeCoords, colors }) {
  const geometry = useMemo(() => {
    const coords = normalizeRouteCoords(routeCoords);
    if (coords.length < 2) return null;

    let minLat = coords[0].latitude;
    let maxLat = coords[0].latitude;
    let minLng = coords[0].longitude;
    let maxLng = coords[0].longitude;
    for (let i = 1; i < coords.length; i += 1) {
      const { latitude, longitude } = coords[i];
      if (latitude < minLat) minLat = latitude;
      if (latitude > maxLat) maxLat = latitude;
      if (longitude < minLng) minLng = longitude;
      if (longitude > maxLng) maxLng = longitude;
    }

    const size = 48;
    const pad = 6;
    const span = Math.max(maxLat - minLat, maxLng - minLng, 1e-5);
    const scale = (size - pad * 2) / span;
    const offsetX = (size - (maxLng - minLng) * scale) / 2;
    const offsetY = (size - (maxLat - minLat) * scale) / 2;

    const project = (pt) => ({
      x: offsetX + (pt.longitude - minLng) * scale,
      y: size - (offsetY + (pt.latitude - minLat) * scale),
    });

    const projected = coords.map(project);
    return {
      pointsAttr: projected.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
      start: projected[0],
      end: projected[projected.length - 1],
    };
  }, [routeCoords]);

  if (!geometry) {
    return (
      <View
        style={[
          staticStyles.thumbBox,
          { borderColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <Ionicons name="map-outline" size={18} color={colors.textMuted} />
      </View>
    );
  }

  return (
    <View
      style={[
        staticStyles.thumbBox,
        { borderColor: colors.border, backgroundColor: '#0F172A' },
      ]}
    >
      <Svg width={48} height={48} viewBox="0 0 48 48">
        <Polyline
          points={geometry.pointsAttr}
          fill="none"
          stroke="#16A34A"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx={geometry.start.x} cy={geometry.start.y} r={2.6} fill="#0EA5E9" />
        <Circle cx={geometry.end.x} cy={geometry.end.y} r={2.8} fill="#EF4444" />
      </Svg>
    </View>
  );
});

// Dòng lịch sử bọc React.memo
const RunHistoryRow = memo(function RunHistoryRow({ item, onPressItem, colors }) {
  const handlePress = useCallback(() => {
    if (typeof onPressItem === 'function') {
      onPressItem(item);
    }
  }, [item, onPressItem]);

  const isQueued = Boolean(item?._queued);

  return (
    <Pressable
      style={[
        staticStyles.rowCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
      onPress={handlePress}
    >
      <View style={staticStyles.rowBody}>
        <View style={staticStyles.rowInfoCol}>
          <View style={staticStyles.rowTop}>
            <Text style={[staticStyles.rowDate, { color: colors.textMuted }]} numberOfLines={1}>
              {item?.date || '--'}
            </Text>
            <View
              style={[
                staticStyles.statusPill,
                {
                  backgroundColor: isQueued ? colors.warningLight : colors.primaryLight,
                },
              ]}
            >
              <Text
                style={[
                  staticStyles.statusText,
                  { color: isQueued ? colors.warning : colors.primary },
                ]}
              >
                {isQueued ? 'Chờ gửi' : 'Đã lưu'}
              </Text>
            </View>
          </View>

          <View style={staticStyles.rowMiddle}>
            <Text style={[staticStyles.rowDistance, { color: colors.primary }]}>
              {formatDistance(Number(item?.distanceKm) || 0)} km
            </Text>
            <Text style={[staticStyles.rowDuration, { color: colors.text }]}>
              {formatDuration(Number(item?.durationSec) || 0)}
            </Text>
          </View>

          <View style={staticStyles.rowBottom}>
            <Text style={[staticStyles.rowMetric, { color: colors.textSecondary }]}>
              {formatInt(Number(item?.steps) || 0)} bước
            </Text>
            <Text style={[staticStyles.rowMetric, { color: colors.textSecondary }]}>
              {formatPaceSec(item?.paceSecPerKm)} /km
            </Text>
            <Text style={[staticStyles.rowMetric, { color: colors.textSecondary }]}>
              {formatInt(Number(item?.calories) || 0)} kcal
            </Text>
          </View>
        </View>

        <RouteMiniThumbnail routeCoords={item?.routeCoords} colors={colors} />
      </View>
    </Pressable>
  );
});

export default function RunHistoryScreen({ onBack, onSelectRun }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [runs, setRuns] = useState([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const [bannerText, setBannerText] = useState('');
  const [internalSelectedRun, setInternalSelectedRun] = useState(null);

  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);

  const loadPage = useCallback(async (pageToLoad, replace = false) => {
    if (pageToLoad === 1) {
      setLoadingInitial(true);
    } else {
      setLoadingMore(true);
      loadingMoreRef.current = true;
    }

    try {
      const result = await fetchRunHistoryPage(pageToLoad, PAGE_LIMIT);
      setQueuedCount(result.queuedCount);
      hasMoreRef.current = result.hasMore && !result.fromCache;
      pageRef.current = pageToLoad;

      setRuns((prev) => {
        if (replace || pageToLoad === 1) {
          return result.items.slice(0, MAX_STATE_ITEMS);
        }
        const combined = dedupeRuns(prev, result.items);
        if (combined.length >= MAX_STATE_ITEMS) {
          hasMoreRef.current = false;
          return combined.slice(0, MAX_STATE_ITEMS);
        }
        return combined;
      });
    } finally {
      setLoadingInitial(false);
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadPage(1, true);
  }, [loadPage]);

  const handleRefresh = useCallback(() => {
    setBannerText('');
    loadPage(1, true);
  }, [loadPage]);

  const handleEndReached = useCallback(() => {
    if (loadingInitial || loadingMoreRef.current || !hasMoreRef.current) {
      return;
    }
    loadPage(pageRef.current + 1, false);
  }, [loadPage, loadingInitial]);

  const handleSyncQueue = useCallback(async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await syncQueuedRuns();
      setQueuedCount(res.remainingCount);
      if (res.authRequired) {
        setBannerText('Phiên đăng nhập hết hạn, hãy đăng nhập lại.');
      } else if (res.remainingCount === 0) {
        setBannerText('Đã đồng bộ hoàn tất.');
      } else {
        setBannerText(`Còn ${res.remainingCount} buổi chạy chờ mạng.`);
      }
      await loadPage(1, true);
    } finally {
      setSyncing(false);
    }
  }, [loadPage, syncing]);

  const handlePressRow = useCallback(
    (item) => {
      if (typeof onSelectRun === 'function') {
        onSelectRun(item);
      } else {
        setInternalSelectedRun(item);
      }
    },
    [onSelectRun]
  );

  const renderItem = useCallback(
    ({ item }) => <RunHistoryRow item={item} onPressItem={handlePressRow} colors={colors} />,
    [colors, handlePressRow]
  );

  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }, [colors.primary, loadingMore, styles.footerLoader]);

  const renderEmpty = useCallback(() => {
    if (loadingInitial) return null;
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyTitle}>Chưa có buổi chạy nào</Text>
      </View>
    );
  }, [loadingInitial, styles.emptyBox, styles.emptyTitle]);

  if (internalSelectedRun) {
    return (
      <RunSummaryScreen
        run={internalSelectedRun}
        syncStatus={internalSelectedRun._queued ? 'queued' : 'saved'}
        onSyncNow={handleSyncQueue}
        onDone={() => setInternalSelectedRun(null)}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Thanh tiêu đề gọn gàng */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          {typeof onBack === 'function' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quay lại"
              style={styles.backBtn}
              onPress={onBack}
            >
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </Pressable>
          ) : null}
          <Text style={styles.titleText}>Lịch sử chạy bộ</Text>
        </View>

        {queuedCount > 0 ? (
          <Pressable style={styles.syncButton} onPress={handleSyncQueue}>
            <Text style={styles.syncButtonText}>
              {syncing ? 'Đang gửi...' : `Đồng bộ (${queuedCount})`}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {bannerText ? (
        <View style={styles.bannerBox}>
          <Text style={styles.bannerText}>{bannerText}</Text>
        </View>
      ) : null}

      {loadingInitial ? (
        <View style={styles.centerLoader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={runs}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          getItemLayout={getItemLayout}
          ItemSeparatorComponent={ItemSeparator}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.4}
          onRefresh={handleRefresh}
          refreshing={loadingInitial}
          windowSize={5}
          maxToRenderPerBatch={8}
          initialNumToRender={8}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews={true}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const staticStyles = StyleSheet.create({
  separator: {
    height: SEPARATOR_HEIGHT,
  },
  rowCard: {
    height: ROW_HEIGHT,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowInfoCol: {
    flex: 1,
    height: '100%',
    justifyContent: 'space-between',
  },
  thumbBox: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowDate: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.medium,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  statusText: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.bold,
  },
  rowMiddle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  rowDistance: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.heavy,
    fontVariant: ['tabular-nums'],
  },
  rowDuration: {
    fontSize: fontSize.subtitle,
    fontWeight: fontWeight.bold,
    fontVariant: ['tabular-nums'],
  },
  rowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowMetric: {
    fontSize: fontSize.caption,
    fontVariant: ['tabular-nums'],
  },
});

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    topHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: layout.screenPadding,
      paddingVertical: spacing.sm,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    backBtn: {
      width: layout.minTouchSize,
      height: layout.minTouchSize,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    titleText: {
      fontSize: fontSize.title,
      fontWeight: fontWeight.bold,
      color: colors.text,
    },
    syncButton: {
      minHeight: 38,
      backgroundColor: colors.warning,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    syncButtonText: {
      color: '#FFFFFF',
      fontSize: fontSize.caption,
      fontWeight: fontWeight.bold,
    },
    bannerBox: {
      backgroundColor: colors.primaryLight,
      paddingHorizontal: layout.screenPadding,
      paddingVertical: spacing.sm,
    },
    bannerText: {
      fontSize: fontSize.caption,
      color: colors.primary,
      fontWeight: fontWeight.semibold,
    },
    centerLoader: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    listContent: {
      padding: layout.screenPadding,
      paddingBottom: spacing.xxl,
    },
    footerLoader: {
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    emptyBox: {
      padding: spacing.xxl,
      alignItems: 'center',
    },
    emptyTitle: {
      fontSize: fontSize.body,
      color: colors.textMuted,
    },
  });
