// ============================================================================
// components/run/RunMapView.tsx
// Component Bản đồ Chạy bộ GPS với Leaflet trong WebView:
// - Nguồn Tile: Đọc từ getMapTileConfig() (MapTiler raster với API key từ .env,
//   hoặc fallback chuẩn OSM không watermark).
// - Offline Caching: Tự động lưu cache tile vào CacheStorage trong WebView,
//   khi mất mạng tự động đọc từ cache; nếu ô chưa từng xem thì hiện nền xám tối.
// - Hai chế độ hoạt động:
//   1. Trực tiếp (readOnly = false): nhận điểm GPS từ RunScreen qua imperative ref
//      (appendRoutePoint / setLiveLocation / setRoute / resetRoute) để KHÔNG phải
//      setState theo từng điểm GPS.
//   2. Chỉ đọc (readOnly = true): nhận routeCoords, vẽ Polyline + marker Bắt đầu
//      và Kết thúc, không bật theo dõi vị trí, tự fitBounds với padding. Nếu
//      routeCoords rỗng hoặc < 2 điểm thì hiển thị "Không có dữ liệu lộ trình".
// ============================================================================

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

import {
  fontSize,
  fontWeight,
  layout,
  radius,
  shadow,
  spacing,
  ThemeColors,
} from '../../constants/theme';
import { useTheme } from '../../store/themeStore';
import { getMapTileConfig } from '../../services/mapTileProvider';
import { useLocationStore } from '../../store/locationStore';
import { normalizeRouteCoords } from '../../utils/geo';

export type Coordinate = {
  latitude: number;
  longitude: number;
  timestamp?: number;
};

export type RunMapViewHandle = {
  appendRoutePoint: (coord: Coordinate) => void;
  setLiveLocation: (coord: Coordinate) => void;
  setRoute: (coords: Coordinate[]) => void;
  resetRoute: () => void;
  fitToRoute: () => void;
};

type Props = {
  isTracking?: boolean;
  readOnly?: boolean;
  interactive?: boolean;
  routeCoords?: Coordinate[] | string | null;
  initialCoordinates?: Coordinate[];
  gpsStatus?: string;
  height?: number;
  onDistanceChange?: (distanceKm: number) => void;
};

// Vị trí mặc định (IUH - TP. Hồ Chí Minh) khi chưa có GPS thực tế
const DEFAULT_CENTER: Coordinate = {
  latitude: 10.822363,
  longitude: 106.687487,
};

const RunMapView = forwardRef<RunMapViewHandle, Props>(function RunMapView(
  {
    isTracking = false,
    readOnly = false,
    interactive = true,
    routeCoords,
    initialCoordinates = [],
    gpsStatus,
    height = 260,
    onDistanceChange,
  },
  ref
): React.JSX.Element {
  const { colors, isDark } = useTheme();
  const webViewRef = useRef<any>(null);
  const mapReadyRef = useRef(false);

  const tileConfig = useMemo(() => getMapTileConfig(), []);

  // Chuẩn hóa danh sách tọa độ truyền qua prop (hỗ trợ cả mảng, chuỗi JSON hoặc null)
  const normalizedPropRoute = useMemo<Coordinate[]>(() => {
    const fromRoute = normalizeRouteCoords(routeCoords);
    if (fromRoute.length > 0) return fromRoute;
    return normalizeRouteCoords(initialCoordinates);
  }, [initialCoordinates, routeCoords]);

  // Chỉ đọc vị trí thiết bị toàn app khi KHÔNG ở chế độ readOnly
  const deviceCoords = useLocationStore((state) => (readOnly ? null : state.coords));

  // Chốt tâm bản đồ ban đầu 1 lần để HTML WebView không bị nạp lại mỗi khi GPS cập nhật
  const [initialCenter] = useState<Coordinate>(() => {
    if (normalizedPropRoute.length > 0) {
      return normalizedPropRoute[normalizedPropRoute.length - 1];
    }
    if (deviceCoords) {
      return { latitude: deviceCoords.latitude, longitude: deviceCoords.longitude };
    }
    return DEFAULT_CENTER;
  });

  const routeRef = useRef<Coordinate[]>(normalizedPropRoute);
  const currentPosRef = useRef<Coordinate>(initialCenter);

  const [isMapReady, setIsMapReady] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);

  // Gửi toàn bộ mảng tọa độ xuống WebView (dùng khi MAP_READY, khôi phục nháp, downsample hoặc readOnly)
  const pushFullRouteToWebView = useCallback(
    (coords: Coordinate[], fitBounds: boolean) => {
      if (!webViewRef.current || !mapReadyRef.current) return;
      const pairs = coords.map((c) => [c.latitude, c.longitude]);
      const jsCode = `
        if (window.setFullRoute) {
          window.setFullRoute(${JSON.stringify(pairs)}, ${fitBounds ? 'true' : 'false'}, ${readOnly ? 'true' : 'false'});
        }
        true;
      `;
      webViewRef.current.injectJavaScript(jsCode);
    },
    [readOnly]
  );

  // Imperative API để RunScreen cập nhật bản đồ trực tiếp từ useRef mà không re-render React
  useImperativeHandle(
    ref,
    () => ({
      appendRoutePoint(coord: Coordinate) {
        if (!coord || !Number.isFinite(coord.latitude) || !Number.isFinite(coord.longitude)) {
          return;
        }
        routeRef.current = [...routeRef.current, coord];
        currentPosRef.current = coord;
        if (webViewRef.current && mapReadyRef.current) {
          webViewRef.current.injectJavaScript(`
            if (window.addRoutePoint) {
              window.addRoutePoint(${coord.latitude}, ${coord.longitude});
            }
            true;
          `);
        }
      },
      setLiveLocation(coord: Coordinate) {
        if (!coord || !Number.isFinite(coord.latitude) || !Number.isFinite(coord.longitude)) {
          return;
        }
        currentPosRef.current = coord;
        if (webViewRef.current && mapReadyRef.current) {
          webViewRef.current.injectJavaScript(`
            if (window.setCurrentLocation) {
              window.setCurrentLocation(${coord.latitude}, ${coord.longitude});
            }
            true;
          `);
        }
      },
      setRoute(coords: Coordinate[]) {
        const clean = normalizeRouteCoords(coords);
        routeRef.current = clean;
        if (clean.length > 0) {
          currentPosRef.current = clean[clean.length - 1];
        }
        pushFullRouteToWebView(clean, readOnly);
      },
      resetRoute() {
        routeRef.current = [];
        if (webViewRef.current && mapReadyRef.current) {
          webViewRef.current.injectJavaScript(`
            if (window.clearRoute) {
              window.clearRoute();
            }
            true;
          `);
        }
      },
      fitToRoute() {
        if (webViewRef.current && mapReadyRef.current) {
          webViewRef.current.injectJavaScript(`
            if (window.fitRouteBounds) {
              window.fitRouteBounds();
            }
            true;
          `);
        }
      },
    }),
    [pushFullRouteToWebView, readOnly]
  );

  // Đồng bộ khi prop routeCoords thay đổi (ví dụ chuyển giữa các buổi chạy trong lịch sử)
  useEffect(() => {
    if (normalizedPropRoute.length > 0 || readOnly) {
      routeRef.current = normalizedPropRoute;
      if (normalizedPropRoute.length > 0) {
        currentPosRef.current = normalizedPropRoute[normalizedPropRoute.length - 1];
      }
      if (isMapReady) {
        pushFullRouteToWebView(normalizedPropRoute, readOnly || !isTracking);
      }
    }
  }, [isMapReady, isTracking, normalizedPropRoute, pushFullRouteToWebView, readOnly]);

  // Đồng bộ vị trí máy (từ store toàn app) lên bản đồ khi đang ở chế độ theo dõi trực tiếp
  useEffect(() => {
    if (readOnly || !deviceCoords || !isMapReady || !webViewRef.current) return;
    if (routeRef.current.length > 0) return;
    currentPosRef.current = {
      latitude: deviceCoords.latitude,
      longitude: deviceCoords.longitude,
      timestamp: deviceCoords.timestamp,
    };
    webViewRef.current.injectJavaScript(`
      if (window.setCurrentLocation) {
        window.setCurrentLocation(${deviceCoords.latitude}, ${deviceCoords.longitude});
      }
      true;
    `);
  }, [deviceCoords, isMapReady, readOnly]);

  // Khi phóng to/thu nhỏ khung bản đồ, báo cho Leaflet tính lại kích thước và căn chỉnh lại
  useEffect(() => {
    if (!isMapReady || !webViewRef.current) return;
    const timer = setTimeout(() => {
      webViewRef.current?.injectJavaScript(`
        if (window.refreshMapSize) {
          window.refreshMapSize(${readOnly ? 'true' : 'false'});
        }
        true;
      `);
    }, 120);
    return () => clearTimeout(timer);
  }, [isExpanded, isMapReady, readOnly]);

  const handleRecenter = () => {
    if (!webViewRef.current) return;
    if (readOnly) {
      webViewRef.current.injectJavaScript(`
        if (window.fitRouteBounds) {
          window.fitRouteBounds();
        }
        true;
      `);
      return;
    }
    const target = currentPosRef.current;
    webViewRef.current.injectJavaScript(`
      if (window.recenterMap) {
        window.recenterMap(${target.latitude}, ${target.longitude});
      }
      true;
    `);
  };

  const allowInteraction = readOnly ? interactive : true;

  // Trang HTML Leaflet nhúng trong WebView với bộ đệm Offline Cache
  const leafletHtml = useMemo(
    () => `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body, #map { width: 100%; height: 100%; background: #0F172A; }
          .leaflet-container { background: #0F172A !important; }
          .runner-pulse {
            width: 18px;
            height: 18px;
            background: #16A34A;
            border: 3px solid #FFFFFF;
            border-radius: 50%;
            box-shadow: 0 0 10px rgba(22, 163, 74, 0.9);
            position: relative;
          }
          .runner-pulse::after {
            content: '';
            position: absolute;
            top: -7px;
            left: -7px;
            right: -7px;
            bottom: -7px;
            border-radius: 50%;
            background: rgba(22, 163, 74, 0.4);
            animation: pulse 1.8s infinite;
          }
          .start-pin {
            width: 16px;
            height: 16px;
            background: #0EA5E9;
            border: 2.5px solid #FFFFFF;
            border-radius: 50%;
            box-shadow: 0 2px 5px rgba(0,0,0,0.35);
          }
          .end-pin {
            width: 18px;
            height: 18px;
            background: #EF4444;
            border: 2.5px solid #FFFFFF;
            border-radius: 50%;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          }
          .leaflet-control-attribution {
            display: none !important;
          }
          @keyframes pulse {
            0% { transform: scale(0.8); opacity: 1; }
            100% { transform: scale(2.2); opacity: 0; }
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var CACHE_NAME = 'fitlog-tiles-v1';
          var IS_READ_ONLY = ${readOnly ? 'true' : 'false'};
          var ALLOW_INTERACTION = ${allowInteraction ? 'true' : 'false'};

          function getFallbackTileSvg() {
            var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">' +
              '<rect width="256" height="256" fill="#131C2E"/>' +
              '<path d="M0 0 L256 256 M256 0 L0 256" stroke="#1E293B" stroke-width="1" stroke-dasharray="6,6"/>' +
              '<text x="128" y="132" fill="#334155" font-size="12" font-family="sans-serif" text-anchor="middle">FitLog Offline</text>' +
              '</svg>';
            return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
          }

          L.TileLayer.FitLogLayer = L.TileLayer.extend({
            createTile: function(coords, done) {
              var tile = document.createElement('img');
              var url = this.getTileUrl(coords);

              L.DomEvent.on(tile, 'load', L.Util.bind(this._tileOnLoad, this, done, tile));

              L.DomEvent.on(tile, 'error', function() {
                if (window.caches) {
                  caches.open(CACHE_NAME).then(function(cache) {
                    return cache.match(url);
                  }).then(function(cachedResp) {
                    if (cachedResp) {
                      return cachedResp.blob().then(function(blob) {
                        tile.src = URL.createObjectURL(blob);
                        done(null, tile);
                      });
                    }
                    tile.src = getFallbackTileSvg();
                    done(null, tile);
                  }).catch(function() {
                    tile.src = getFallbackTileSvg();
                    done(null, tile);
                  });
                } else {
                  tile.src = getFallbackTileSvg();
                  done(null, tile);
                }
              });

              tile.alt = '';
              tile.setAttribute('role', 'presentation');
              tile.src = url;

              if (window.caches && navigator.onLine) {
                caches.open(CACHE_NAME).then(function(cache) {
                  cache.add(url).catch(function() {});
                }).catch(function() {});
              }

              return tile;
            }
          });

          L.tileLayer.fitLogLayer = function(url, options) {
            return new L.TileLayer.FitLogLayer(url, options);
          };

          var map = L.map('map', {
            zoomControl: false,
            attributionControl: false,
            dragging: ALLOW_INTERACTION,
            touchZoom: ALLOW_INTERACTION,
            scrollWheelZoom: ALLOW_INTERACTION,
            doubleClickZoom: ALLOW_INTERACTION,
            boxZoom: false,
            keyboard: false
          }).setView([${initialCenter.latitude}, ${initialCenter.longitude}], 16);

          L.tileLayer.fitLogLayer('${tileConfig.urlTemplate}', {
            maxZoom: ${tileConfig.maxZoom},
            minZoom: ${tileConfig.minZoom},
            subdomains: ${JSON.stringify(
              tileConfig.subdomains && tileConfig.subdomains.length
                ? tileConfig.subdomains
                : ['a', 'b', 'c']
            )}
          }).addTo(map);

          var autoFollow = !IS_READ_ONLY;
          map.on('dragstart', function() {
            autoFollow = false;
          });

          var routePoints = [];
          var polyline = L.polyline([], {
            color: '#16A34A',
            weight: 5,
            opacity: 0.95,
            lineJoin: 'round',
            lineCap: 'round'
          }).addTo(map);

          var startIcon = L.divIcon({
            className: 'start-marker',
            html: '<div class="start-pin"></div>',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          });

          var endIcon = L.divIcon({
            className: 'end-marker',
            html: '<div class="end-pin"></div>',
            iconSize: [18, 18],
            iconAnchor: [9, 9]
          });

          var runnerIcon = L.divIcon({
            className: 'runner-marker',
            html: '<div class="runner-pulse"></div>',
            iconSize: [18, 18],
            iconAnchor: [9, 9]
          });

          var startMarker = null;
          var endMarker = null;
          var currentMarker = null;

          if (!IS_READ_ONLY) {
            currentMarker = L.marker([${initialCenter.latitude}, ${initialCenter.longitude}], {
              icon: runnerIcon
            }).addTo(map);
          }

          function ensureStartMarker(pt) {
            if (!startMarker) {
              startMarker = L.marker(pt, { icon: startIcon }).addTo(map);
            } else {
              startMarker.setLatLng(pt);
            }
          }

          function ensureEndMarker(pt) {
            if (!endMarker) {
              endMarker = L.marker(pt, { icon: endIcon }).addTo(map);
            } else {
              endMarker.setLatLng(pt);
            }
          }

          window.fitRouteBounds = function() {
            if (routePoints.length >= 2) {
              var bounds = polyline.getBounds();
              if (bounds && bounds.isValid()) {
                map.fitBounds(bounds, { padding: [28, 28], maxZoom: 17, animate: true });
              }
            } else if (routePoints.length === 1) {
              map.setView(routePoints[0], 16, { animate: true });
            }
          };

          window.addRoutePoint = function(lat, lng) {
            var pt = [lat, lng];
            routePoints.push(pt);
            polyline.setLatLngs(routePoints);
            if (currentMarker) {
              currentMarker.setLatLng(pt);
            }
            if (routePoints.length === 1) {
              ensureStartMarker(pt);
            }
            if (autoFollow && !IS_READ_ONLY) {
              map.panTo(pt, { animate: true, duration: 0.8 });
            }
          };

          window.setFullRoute = function(pointsArray, shouldFit, isReadOnlyMode) {
            routePoints = Array.isArray(pointsArray) ? pointsArray : [];
            polyline.setLatLngs(routePoints);

            if (routePoints.length >= 1) {
              ensureStartMarker(routePoints[0]);
              var lastPt = routePoints[routePoints.length - 1];
              if (isReadOnlyMode && routePoints.length >= 2) {
                ensureEndMarker(lastPt);
              } else if (currentMarker) {
                currentMarker.setLatLng(lastPt);
              }
            } else {
              if (startMarker) { map.removeLayer(startMarker); startMarker = null; }
              if (endMarker) { map.removeLayer(endMarker); endMarker = null; }
            }

            if (shouldFit) {
              window.fitRouteBounds();
            }
          };

          window.clearRoute = function() {
            routePoints = [];
            polyline.setLatLngs([]);
            if (startMarker) { map.removeLayer(startMarker); startMarker = null; }
            if (endMarker) { map.removeLayer(endMarker); endMarker = null; }
          };

          window.setCurrentLocation = function(lat, lng) {
            if (currentMarker) {
              currentMarker.setLatLng([lat, lng]);
            }
            if (autoFollow && !IS_READ_ONLY && routePoints.length === 0) {
              map.setView([lat, lng], map.getZoom(), { animate: true });
            }
          };

          window.recenterMap = function(lat, lng) {
            autoFollow = true;
            map.setView([lat, lng], 17, { animate: true });
          };

          window.refreshMapSize = function(fitAfter) {
            map.invalidateSize();
            if (fitAfter) {
              window.fitRouteBounds();
            }
          };

          function notifyNetworkState() {
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'NETWORK',
                online: navigator.onLine
              }));
            }
          }

          window.addEventListener('online', notifyNetworkState);
          window.addEventListener('offline', notifyNetworkState);

          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
            notifyNetworkState();
          }
        </script>
      </body>
    </html>
  `,
    [allowInteraction, initialCenter.latitude, initialCenter.longitude, readOnly, tileConfig]
  );

  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'MAP_READY') {
        mapReadyRef.current = true;
        setIsMapReady(true);
        if (routeRef.current.length > 0) {
          pushFullRouteToWebView(routeRef.current, readOnly || !isTracking);
        }
      } else if (data.type === 'NETWORK') {
        setIsOffline(!data.online);
      }
    } catch {
      if (event.nativeEvent.data === 'MAP_READY') {
        mapReadyRef.current = true;
        setIsMapReady(true);
      }
    }
  };

  // Nhãn trạng thái GPS hiển thị ở góc trên trái bản đồ
  const statusLabel = useMemo(() => {
    if (isOffline) return 'Đang offline (Dùng bản đồ lưu)';
    if (readOnly) return `Lộ trình GPS (${normalizedPropRoute.length} điểm)`;
    if (gpsStatus === 'denied') return 'Chưa cấp quyền vị trí GPS';
    if (gpsStatus === 'disabled') return 'Định vị GPS đang tắt';
    if (gpsStatus === 'lost') return 'Mất tín hiệu GPS — vẫn đếm bước';
    if (gpsStatus === 'searching') return 'Đang dò tín hiệu GPS...';
    if (gpsStatus === 'simulated') return 'GPS giả lập (Dev)';
    if (isTracking) return 'Đang ghi lộ trình GPS';
    return 'Sẵn sàng theo dõi';
  }, [gpsStatus, isOffline, isTracking, normalizedPropRoute.length, readOnly]);

  const isWarningBadge =
    isOffline || gpsStatus === 'denied' || gpsStatus === 'disabled' || gpsStatus === 'lost';

  // Chế độ chỉ đọc mà không đủ >= 2 điểm: hiển thị trạng thái "Không có dữ liệu lộ trình"
  if (readOnly && normalizedPropRoute.length < 2) {
    return (
      <View style={[styles.emptyRouteBox, { minHeight: Math.min(height, 148) }]}>
        <Ionicons name="map-outline" size={26} color={colors.textMuted} />
        <Text style={styles.emptyRouteTitle}>Không có dữ liệu lộ trình</Text>
        <Text style={styles.emptyRouteSub}>
          Buổi chạy này chưa ghi nhận đủ điểm GPS để vẽ lại bản đồ
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height: isExpanded ? 420 : height }]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: leafletHtml, baseUrl: 'https://fitlog.vn' }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled
        mixedContentMode="always"
        scrollEnabled={false}
        onMessage={handleWebViewMessage}
      />

      {!isMapReady && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Đang tải bản đồ...</Text>
        </View>
      )}

      {/* Badge trạng thái: Offline / GPS / Lộ trình đã lưu */}
      <View style={[styles.statusBadge, isWarningBadge && styles.statusBadgeOffline]}>
        <View
          style={[
            styles.statusDot,
            {
              backgroundColor: isWarningBadge
                ? colors.warning
                : readOnly || isTracking
                  ? colors.primary
                  : colors.textMuted,
            },
          ]}
        />
        <Text style={[styles.statusText, isWarningBadge && { color: colors.warning }]}>
          {statusLabel}
        </Text>
      </View>

      {/* Các nút điều khiển bản đồ */}
      <View style={styles.controlsWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isExpanded ? 'Thu nhỏ bản đồ' : 'Phóng to bản đồ'}
          style={styles.iconButton}
          onPress={() => setIsExpanded((prev) => !prev)}
        >
          <Ionicons
            name={isExpanded ? 'contract-outline' : 'expand-outline'}
            size={18}
            color={colors.text}
          />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={readOnly ? 'Căn vừa toàn lộ trình' : 'Định vị lại vị trí của bạn'}
          style={styles.iconButton}
          onPress={handleRecenter}
        >
          <Ionicons
            name={readOnly ? 'scan-outline' : 'locate'}
            size={18}
            color={colors.primary}
          />
        </Pressable>
      </View>
    </View>
  );
});

export default RunMapView;

const createStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    container: {
      borderRadius: radius.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: '#0F172A',
      position: 'relative',
      ...shadow.card,
    },
    webview: {
      flex: 1,
      backgroundColor: '#0F172A',
    },
    emptyRouteBox: {
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
    },
    emptyRouteTitle: {
      fontSize: fontSize.body,
      fontWeight: fontWeight.bold,
      color: colors.text,
      textAlign: 'center',
    },
    emptyRouteSub: {
      fontSize: fontSize.caption,
      color: colors.textMuted,
      textAlign: 'center',
    },
    loadingOverlay: {
      ...StyleSheet.absoluteFill,
      backgroundColor: '#0F172A',
      justifyContent: 'center',
      alignItems: 'center',
      gap: spacing.xs,
    },
    loadingText: {
      fontSize: fontSize.caption,
      color: colors.textMuted,
      fontWeight: fontWeight.medium,
    },
    statusBadge: {
      position: 'absolute',
      top: spacing.sm,
      left: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.92)',
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.pill,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadow.card,
    },
    statusBadgeOffline: {
      backgroundColor: isDark ? 'rgba(69, 26, 3, 0.92)' : 'rgba(254, 243, 199, 0.95)',
      borderColor: colors.warning,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: radius.pill,
    },
    statusText: {
      fontSize: fontSize.caption - 1,
      fontWeight: fontWeight.semibold,
      color: colors.text,
    },
    controlsWrap: {
      position: 'absolute',
      bottom: spacing.sm,
      right: spacing.sm,
      flexDirection: 'column',
      gap: spacing.xs,
    },
    iconButton: {
      width: layout.minTouchSize - 6,
      height: layout.minTouchSize - 6,
      borderRadius: radius.pill,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow.card,
    },
  });
