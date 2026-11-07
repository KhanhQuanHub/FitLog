// ============================================================================
// App.tsx
// Điểm khởi đầu ứng dụng FitLog:
// - Đảm bảo tải trước bộ font icon (@expo/vector-icons Ionicons) bằng useFonts
//   trước khi hiển thị giao diện để tránh lỗi mất/cắt chữ icon trên Android.
// - Đồng bộ chủ đề Sáng / Tối với Expo Router và SafeAreaProvider.
// ============================================================================

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';

import { useThemeStore } from './store/themeStore';
import { TrainingProvider } from './store/TrainingContext';

export default function App({ children }: { children: ReactNode }) {
  const isDark = useThemeStore((state) => state.isDark);
  const colors = useThemeStore((state) => state.colors);
  const initTheme = useThemeStore((state) => state.initTheme);

  // Tải trước font Ionicons để đảm bảo mọi biểu tượng hiển thị đầy đủ ngay từ lần render đầu
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
  });

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  // Navigation theme đồng bộ với hệ thống theme FitLog
  const navigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.accent,
    },
  };

  if (!fontsLoaded && !fontError) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider value={navigationTheme}>
        <StatusBar style={isDark ? 'light' : 'dark'} animated />
        <TrainingProvider>
          {children}
        </TrainingProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
