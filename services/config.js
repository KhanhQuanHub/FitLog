// ============================================================================
// services/config.js
// Tầng quản lý kết nối máy chủ API dựa trên cấu hình tập trung tại `config/api.js`:
// - Toàn bộ URL mặc định & biến môi trường EXPO_PUBLIC_API_URL được định nghĩa duy nhất
//   tại `config/api.js` (KHÔNG hard-code localhost / 127.0.0.1 / 10.0.2.2 rải rác).
// - Ưu tiên kết nối tới BASE_URL từ `config/api.js`. Nếu IP laptop bị bộ phát Wi-Fi
//   cấp mới (DHCP đổi IP), hỗ trợ tự động dò trong cùng dải mạng LAN /24 làm phương án dự phòng.
// ============================================================================

import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  API_TIMEOUT_MS,
  BASE_URL,
  DEFAULT_API_URL,
  DEFAULT_SERVER_PORT,
  getConfiguredApiUrl,
} from '../config/api.js';
import {
  buildPrioritizedSubnetUrls,
  isPrivateIpv4,
  MDNS_SERVER_HOSTNAME,
  probeFitLogServer,
  promoteMdnsToConcreteIp,
  raceServerCandidates,
} from '../utils/lanDiscovery.js';

export { API_TIMEOUT_MS, BASE_URL, DEFAULT_API_URL, DEFAULT_SERVER_PORT, MDNS_SERVER_HOSTNAME };
export const STORAGE_KEY_CUSTOM_SERVER_URL = '@fitlog_custom_server_url';
export const STORAGE_KEY_DISCOVERED_SERVER_URL = '@fitlog_discovered_server_url';

const FAST_RACE_TIMEOUT_MS = 1200;
const SUBNET_BATCH_TIMEOUT_MS = 600;
const SUBNET_BATCH_SIZE = 48;

let cachedDiscoveredUrl = null;
let cachedDeviceIp = '';
let activeDiscoveryPromise = null;

function isReactNativeRuntime() {
  return typeof navigator !== 'undefined' && navigator.product === 'ReactNative';
}

function loadExpoNetworkModule() {
  if (!isReactNativeRuntime()) return null;
  try {
    return require('expo-network');
  } catch {
    return null;
  }
}

async function getCurrentDeviceIp() {
  const Network = loadExpoNetworkModule();
  if (!Network || typeof Network.getIpAddressAsync !== 'function') {
    return '';
  }
  try {
    const ip = await Network.getIpAddressAsync();
    return typeof ip === 'string' && ip !== '0.0.0.0' ? ip.trim() : '';
  } catch {
    return '';
  }
}

/**
 * Trích xuất IP LAN của laptop từ Expo Metro (khi chạy `npx expo start`).
 *
 * @returns {string | null}
 */
export function extractHostFromExpo() {
  try {
    const candidateUris = [
      Constants?.expoConfig?.hostUri,
      Constants?.manifest2?.extra?.expoClient?.hostUri,
      Constants?.platform?.hostUri,
      Constants?.manifest?.debuggerHost,
      Constants?.linkingUri,
      Constants?.experienceUrl,
    ];

    for (const raw of candidateUris) {
      if (typeof raw !== 'string' || raw.trim() === '') continue;
      const sanitized = raw.replace(/^[a-zA-Z]+:\/\//, '').trim();
      const hostPart = sanitized.split(':')[0]?.split('/')[0]?.trim();
      if (!hostPart || !isPrivateIpv4(hostPart)) continue;
      return hostPart;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Trả về BASE_URL đồng bộ (lấy từ cache đã xác thực hoặc từ `config/api.js`).
 *
 * @returns {string}
 */
export function resolveBaseUrl() {
  if (cachedDiscoveredUrl) {
    return cachedDiscoveredUrl;
  }
  return getConfiguredApiUrl();
}

async function persistDiscoveredUrl(url, deviceIp) {
  cachedDiscoveredUrl = url;
  if (deviceIp) {
    cachedDeviceIp = deviceIp;
  }
  try {
    await AsyncStorage.setItem(STORAGE_KEY_DISCOVERED_SERVER_URL, url);
  } catch {
    // Bỏ qua nếu không ghi được cache
  }
}

export function invalidateDiscoveredServerUrl() {
  cachedDiscoveredUrl = null;
}

/**
 * Xác định địa chỉ máy chủ API:
 * 1. Ưu tiên kiểm tra `BASE_URL` cấu hình trong `.env` (`config/api.js`) trước tiên.
 * 2. Nếu router Wi-Fi vừa đổi IP DHCP của laptop làm `BASE_URL` không phản hồi,
 *    tự động quét dải LAN `/24` để tìm lại laptop, nếu vẫn không thấy thì trả về đúng `BASE_URL`
 *    để màn hình hiển thị thông báo lỗi rõ ràng kèm địa chỉ đang gọi.
 *
 * @param {{ forceRefresh?: boolean }} [options]
 * @returns {Promise<string>}
 */
export async function discoverServerUrl(options = {}) {
  const forceRefresh = Boolean(options?.forceRefresh);
  const configuredUrl = getConfiguredApiUrl();

  try {
    const customUrl = await AsyncStorage.getItem(STORAGE_KEY_CUSTOM_SERVER_URL);
    if (customUrl && typeof customUrl === 'string' && customUrl.trim() !== '') {
      const cleanCustom = customUrl.trim().replace(/\/+$/, '');
      cachedDiscoveredUrl = cleanCustom;
      return cleanCustom;
    }
  } catch {
    // Bỏ qua
  }

  if (!isReactNativeRuntime()) {
    return configuredUrl;
  }

  const currentDeviceIp = await getCurrentDeviceIp();
  const networkChanged = Boolean(
    currentDeviceIp && cachedDeviceIp && currentDeviceIp !== cachedDeviceIp
  );

  if (!forceRefresh && !networkChanged && cachedDiscoveredUrl) {
    return cachedDiscoveredUrl;
  }

  if (forceRefresh || networkChanged) {
    cachedDiscoveredUrl = null;
  }

  if (activeDiscoveryPromise) {
    return activeDiscoveryPromise;
  }

  activeDiscoveryPromise = (async () => {
    // Kiểm tra trực tiếp BASE_URL từ .env / config/api.js trước tiên
    const directConfigured = await probeFitLogServer(configuredUrl, FAST_RACE_TIMEOUT_MS);
    if (directConfigured) {
      await persistDiscoveredUrl(directConfigured, currentDeviceIp);
      return directConfigured;
    }

    let savedDiscovered = '';
    try {
      savedDiscovered = (await AsyncStorage.getItem(STORAGE_KEY_DISCOVERED_SERVER_URL)) || '';
    } catch {
      savedDiscovered = '';
    }

    const expoLanHost = extractHostFromExpo();
    const fastCandidates = [
      savedDiscovered,
      expoLanHost ? `http://${expoLanHost}:${DEFAULT_SERVER_PORT}` : '',
      `http://${MDNS_SERVER_HOSTNAME}:${DEFAULT_SERVER_PORT}`,
    ];

    const fastWinner = await raceServerCandidates(fastCandidates, FAST_RACE_TIMEOUT_MS);
    if (fastWinner) {
      const concreteUrl = await promoteMdnsToConcreteIp(fastWinner, DEFAULT_SERVER_PORT);
      await persistDiscoveredUrl(concreteUrl, currentDeviceIp);
      return concreteUrl;
    }

    // Dự phòng khi laptop bị đổi IP DHCP trên cùng mạng Wi-Fi
    const deviceIp = currentDeviceIp || (await getCurrentDeviceIp());
    if (isPrivateIpv4(deviceIp)) {
      const octets = deviceIp.trim().split('.');
      const prefix3 = `${octets[0]}.${octets[1]}.${octets[2]}`;
      const selfLast = Number(octets[3]);
      const scanTargets = buildPrioritizedSubnetUrls(prefix3, selfLast, DEFAULT_SERVER_PORT);

      for (let offset = 0; offset < scanTargets.length; offset += SUBNET_BATCH_SIZE) {
        const batch = scanTargets.slice(offset, offset + SUBNET_BATCH_SIZE);
        const found = await raceServerCandidates(batch, SUBNET_BATCH_TIMEOUT_MS);
        if (found) {
          await persistDiscoveredUrl(found, deviceIp);
          return found;
        }
      }
    }

    // Trả về đúng BASE_URL cấu hình trong .env để thông báo lỗi hiển thị rõ URL không kết nối được
    return configuredUrl;
  })();

  try {
    return await activeDiscoveryPromise;
  } finally {
    activeDiscoveryPromise = null;
  }
}

export async function revalidateServerInBackground() {
  if (!isReactNativeRuntime()) {
    return resolveBaseUrl();
  }
  if (!cachedDiscoveredUrl) {
    return discoverServerUrl({ forceRefresh: false });
  }
  const stillAlive = await probeFitLogServer(cachedDiscoveredUrl, 800);
  if (stillAlive) {
    return stillAlive;
  }
  return discoverServerUrl({ forceRefresh: true });
}

export async function getBaseUrlAsync() {
  return discoverServerUrl({ forceRefresh: false });
}

export function getBaseUrl() {
  return resolveBaseUrl();
}

export async function setCustomServerUrl(url) {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    await AsyncStorage.removeItem(STORAGE_KEY_CUSTOM_SERVER_URL);
    cachedDiscoveredUrl = null;
  } else {
    const clean = url.trim().replace(/\/+$/, '');
    await AsyncStorage.setItem(STORAGE_KEY_CUSTOM_SERVER_URL, clean);
    cachedDiscoveredUrl = clean;
  }
}

export async function clearCustomServerUrl() {
  await AsyncStorage.removeItem(STORAGE_KEY_CUSTOM_SERVER_URL);
  cachedDiscoveredUrl = null;
}
