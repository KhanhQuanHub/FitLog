// ============================================================================
// navigation/RootNavigator.tsx
// Điều hướng gốc của FitLog:
// - Khi mở ứng dụng: tự động kiểm tra token trong expo-secure-store (restoreSession).
// - Nếu token còn hợp lệ: điều hướng thẳng vào MainTabs (màn "Hôm nay").
// - Nếu chưa có token hoặc token hết hạn: hiển thị màn Đăng nhập (LoginScreen).
// ============================================================================

import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../store/themeStore';
import { useLocationStore } from '../store/locationStore';

export default function RootNavigator() {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const isRestoring = useAuthStore((state) => state.isRestoring);
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const { colors } = useTheme();

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // Sau khi đăng nhập (hoặc khôi phục phiên) thành công: bật theo dõi vị trí toàn app,
  // khi đăng xuất thì tắt để tiết kiệm pin
  useEffect(() => {
    if (isLoggedIn) {
      useLocationStore.getState().startWatching();
    } else {
      useLocationStore.getState().stopWatching();
    }
  }, [isLoggedIn]);

  if (isRestoring) {
    return (
      <View style={[styles.splashContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    >
      <Stack.Protected guard={!isLoggedIn}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack.Protected>
      <Stack.Protected guard={isLoggedIn}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
