// ============================================================================
// navigation/RootNavigator.tsx
// Điều hướng gốc của FitLog:
// - Khi mở ứng dụng: tự động kiểm tra token trong expo-secure-store (restoreSession).
// - Nếu token còn hợp lệ: hỏi thiết lập lần đầu, hoặc vào Hôm nay khi đã thiết lập.
// - Nếu chưa có token hoặc token hết hạn: hiển thị màn Đăng nhập (LoginScreen).
// ============================================================================

import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import MainTabs from './MainTabs';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../store/themeStore';
import { useLocationStore } from '../store/locationStore';
import TrainingSetupScreen from '../screens/TrainingSetupScreen';
import { useTraining } from '../store/TrainingContext';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  Main: undefined;
  Onboarding: undefined;
  EditTraining: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const isRestoring = useAuthStore((state) => state.isRestoring);
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const { colors } = useTheme();
  const { setup } = useTraining();

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
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    >
      {!isLoggedIn ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        </>
      ) : !setup ? (
        <Stack.Screen name="Onboarding" component={TrainingSetupScreen} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="EditTraining" component={TrainingSetupScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
