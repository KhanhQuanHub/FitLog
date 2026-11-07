// ============================================================================
// services/config.js
// Cấu hình gọn nhẹ, tự động nhận IP máy tính cho Expo Go khi test cùng mạng Wi-Fi:
// 1. Khi mở bằng Expo Go (quét QR từ `npx expo start`): tự động lấy IP LAN hiện tại
//    của máy tính từ Metro Bundler (`hostUri`) -> mọi thành viên trong nhóm kéo code về
//    chạy `npm run server` + `npx expo start` đều tự kết nối ngay mà không cần nhập IP.
// 2. Nếu có đặt EXPO_PUBLIC_API_URL (khi chạy độc lập hoặc server riêng): dùng URL đó.
// 3. Dự phòng cho máy ảo Android (`10.0.2.2`) và iOS Simulator / Web (`localhost`).
// ============================================================================

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const DEFAULT_SERVER_PORT = 3000;
export const API_TIMEOUT_MS = 10000;
export const STORAGE_KEY_CUSTOM_SERVER_URL = '@fitlog_custom_server_url';

/**
 * Trích xuất IP LAN của máy tính đang chạy `npx expo start`.
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
      typeof process !== 'undefined' ? process.env?.EXPO_DEV_SERVER_ORIGIN : '',
    ];

    for (const raw of candidateUris) {
      if (typeof raw !== 'string' || raw.trim() === '') {
        continue;
      }

      const sanitized = raw.replace(/^[a-zA-Z]+:\/\//, '').trim();
      const hostPart = sanitized.split(':')[0]?.split('/')[0]?.trim();

      if (!hostPart || hostPart === 'localhost' || hostPart === '127.0.0.1') {
        continue;
      }

      // Bỏ qua các tên miền tunnel chỉ mở cho cổng Metro 8081
      if (
        hostPart.endsWith('.exp.direct') ||
        hostPart.includes('trycloudflare.com') ||
        hostPart.includes('ngrok-free.app') ||
        hostPart.includes('ngrok.io')
      ) {
        continue;
      }

      return hostPart;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Tính toán địa chỉ BASE_URL của json-server (cổng 3000).
 *
 * @returns {string}
 */
export function resolveBaseUrl() {
  // 1. Khi mở bằng Expo Go trên cùng mạng Wi-Fi: ưu tiên lấy thẳng IP LAN từ Metro
  //    để không bao giờ bị kẹt bởi IP cũ còn sót trong file .env
  const lanHost = extractHostFromExpo();
  if (lanHost) {
    return `http://${lanHost}:${DEFAULT_SERVER_PORT}`;
  }

  // 2. Nếu không có hostUri của Expo Go -> dùng EXPO_PUBLIC_API_URL (nếu có)
  const envUrl =
    typeof process !== 'undefined' &&
    process.env &&
    typeof process.env.EXPO_PUBLIC_API_URL === 'string'
      ? process.env.EXPO_PUBLIC_API_URL.trim()
      : '';

  if (envUrl && !envUrl.includes('trycloudflare.com')) {
    return envUrl.replace(/\/+$/, '');
  }

  // 3. Máy ảo Android Emulator
  if (Platform.OS === 'android') {
    return `http://10.0.2.2:${DEFAULT_SERVER_PORT}`;
  }

  // 4. iOS Simulator / Web
  return `http://localhost:${DEFAULT_SERVER_PORT}`;
}

/**
 * Lấy BASE_URL bất đồng bộ.
 *
 * @returns {Promise<string>}
 */
export async function getBaseUrlAsync() {
  try {
    const customUrl = await AsyncStorage.getItem(STORAGE_KEY_CUSTOM_SERVER_URL);
    if (customUrl && typeof customUrl === 'string' && customUrl.trim() !== '') {
      return customUrl.trim().replace(/\/+$/, '');
    }
  } catch {
    // Bỏ qua lỗi đọc AsyncStorage
  }

  return resolveBaseUrl();
}

export function getBaseUrl() {
  return resolveBaseUrl();
}

export async function setCustomServerUrl(url) {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    await AsyncStorage.removeItem(STORAGE_KEY_CUSTOM_SERVER_URL);
  } else {
    await AsyncStorage.setItem(STORAGE_KEY_CUSTOM_SERVER_URL, url.trim().replace(/\/+$/, ''));
  }
}

export async function clearCustomServerUrl() {
  await AsyncStorage.removeItem(STORAGE_KEY_CUSTOM_SERVER_URL);
}

export const BASE_URL = resolveBaseUrl();
