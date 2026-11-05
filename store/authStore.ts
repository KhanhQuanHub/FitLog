// ============================================================================
// store/authStore.ts
// Quản lý trạng thái xác thực người dùng thật cho FitLog:
// - Sử dụng normalizeError / getErrorMessage dùng chung cho cả Đăng nhập và Đăng ký.
// - Mọi lời gọi API đều bọc trong try / catch / finally và quản lý trạng thái isLoading.
// - Sau khi đăng ký: tự động đăng nhập + lưu token vào expo-secure-store để vào
//   màn "Hôm nay", hoặc chuyển về màn Đăng nhập kèm thông báo thành công nếu backend
//   không trả token ngay.
// ============================================================================

import { create } from 'zustand';
import { normalizeTrainingSetup, type TrainingSetup } from '../domain/training';
import {
  clearAuthToken,
  getMyProfile,
  login as apiLogin,
  registerAccount,
  subscribeUnauthorized,
  verifyStoredSession,
} from '../services/api';
import { getErrorMessage, normalizeError } from '../utils/errorHandler';

export type UserProfile = {
  id: string;
  fullName: string;
  email: string;
  gender: 'Nam' | 'Nữ' | 'Khác';
  height: number; // cm
  weight: number; // kg
  healthCondition: string;
  workoutsPerWeek: number;
  currentGoal: string;
  trainingSetup?: TrainingSetup;
};

export type AuthErrorState = {
  message: string;
  retryable: boolean;
} | null;

export type RegisterExtraProfile = {
  heightCm?: number;
  weightKg?: number;
};

export type RegisterResult = {
  ok: boolean;
  autoLoggedIn: boolean;
};

export type AuthState = {
  isLoggedIn: boolean;
  isRestoring: boolean;
  isLoading: boolean;
  user: UserProfile | null;
  authError: AuthErrorState;
  registrationSuccessMessage: string | null;
  failedAttempts: number;
  lockoutUntilMs: number;
  clearError: () => void;
  clearRegistrationSuccess: () => void;
  restoreSession: () => Promise<void>;
  login: (email: string, password: string) => Promise<boolean>;
  register: (
    fullName: string,
    email: string,
    password: string,
    extraProfile?: RegisterExtraProfile
  ) => Promise<RegisterResult>;
  logout: () => void;
};

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 1000;

function mapServerUserToProfile(serverUser: any, profileData: any): UserProfile {
  return {
    id: String(serverUser?.id ?? '1'),
    fullName: serverUser?.fullName || 'Người dùng FitLog',
    email: serverUser?.email || '',
    gender: profileData?.gender === 'female' ? 'Nữ' : profileData?.gender === 'other' ? 'Khác' : 'Nam',
    height: Number(profileData?.heightCm) || 170,
    weight: Number(profileData?.weightKg) || 60,
    healthCondition: profileData?.healthCondition || 'Không có',
    workoutsPerWeek: Number(profileData?.sessionsPerWeek) || 4,
    currentGoal: profileData?.currentGoal || 'Nâng cao sức bền',
    trainingSetup: normalizeTrainingSetup(profileData?.trainingSetup) ?? undefined,
  };
}

let unauthorizedSubscriptionAttached = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  isLoggedIn: false,
  isRestoring: true,
  isLoading: false,
  user: null,
  authError: null,
  registrationSuccessMessage: null,
  failedAttempts: 0,
  lockoutUntilMs: 0,

  clearError: () => set({ authError: null }),
  clearRegistrationSuccess: () => set({ registrationSuccessMessage: null }),

  restoreSession: async () => {
    if (!unauthorizedSubscriptionAttached) {
      unauthorizedSubscriptionAttached = true;
      subscribeUnauthorized(() => {
        set({
          isLoggedIn: false,
          user: null,
          authError: {
            message: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
            retryable: false,
          },
        });
      });
    }

    set({ isRestoring: true });
    try {
      const session = await verifyStoredSession();
      if (session && session.user) {
        set({
          isLoggedIn: true,
          user: mapServerUserToProfile(session.user, session.profile),
          authError: null,
        });
        return;
      }
      set({
        isLoggedIn: false,
        user: null,
      });
    } catch {
      set({
        isLoggedIn: false,
        user: null,
      });
    } finally {
      set({ isRestoring: false });
    }
  },

  login: async (email: string, password: string) => {
    if (get().isLoading) {
      return false;
    }

    const now = Date.now();
    const { lockoutUntilMs } = get();
    if (lockoutUntilMs > now) {
      const remainingSec = Math.ceil((lockoutUntilMs - now) / 1000);
      set({
        authError: {
          message: `Tạm khóa đăng nhập do nhập sai nhiều lần. Vui lòng thử lại sau ${remainingSec} giây.`,
          retryable: false,
        },
      });
      return false;
    }

    set({
      isLoading: true,
      authError: null,
      registrationSuccessMessage: null,
    });

    const cleanEmail = email.trim().toLowerCase();

    try {
      const serverUser: any = await apiLogin(cleanEmail, password);
      if (!serverUser) {
        set({
          authError: {
            message: 'Email hoặc mật khẩu không đúng',
            retryable: false,
          },
        });
        return false;
      }

      let profileData: any = null;
      try {
        profileData = await getMyProfile();
      } catch {
        profileData = null;
      }

      set({
        isLoggedIn: true,
        user: mapServerUserToProfile(serverUser, profileData),
        authError: null,
        failedAttempts: 0,
        lockoutUntilMs: 0,
      });
      return true;
    } catch (err: unknown) {
      const normalized = normalizeError(err, 'login');

      if (normalized.status === 401) {
        const nextAttempts = get().failedAttempts + 1;
        if (nextAttempts >= MAX_FAILED_ATTEMPTS) {
          set({
            failedAttempts: 0,
            lockoutUntilMs: Date.now() + LOCKOUT_DURATION_MS,
            authError: {
              message: 'Bạn đã nhập sai 5 lần liên tiếp. Vui lòng đợi 30 giây rồi thử lại.',
              retryable: false,
            },
          });
          return false;
        }
        set({
          failedAttempts: nextAttempts,
          authError: {
            message: 'Email hoặc mật khẩu không đúng',
            retryable: false,
          },
        });
        return false;
      }

      set({
        authError: {
          message: getErrorMessage(err, 'login'),
          retryable: normalized.retryable,
        },
      });
      return false;
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (
    fullName: string,
    email: string,
    password: string,
    extraProfile?: RegisterExtraProfile
  ) => {
    if (get().isLoading) {
      return { ok: false, autoLoggedIn: false };
    }

    set({
      isLoading: true,
      authError: null,
      registrationSuccessMessage: null,
    });

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    try {
      const res: any = await registerAccount(cleanName, cleanEmail, password, extraProfile);

      if (res && res.autoLoggedIn && res.user) {
        set({
          isLoggedIn: true,
          user: mapServerUserToProfile(res.user, extraProfile),
          authError: null,
        });
        return { ok: true, autoLoggedIn: true };
      }

      // Trường hợp backend tạo tài khoản thành công nhưng không trả token tự động
      set({
        registrationSuccessMessage: 'Tạo tài khoản thành công! Vui lòng đăng nhập.',
        authError: null,
      });
      return { ok: true, autoLoggedIn: false };
    } catch (err: unknown) {
      const normalized = normalizeError(err, 'register');
      set({
        authError: {
          message: getErrorMessage(err, 'register'),
          retryable: normalized.retryable,
        },
      });
      return { ok: false, autoLoggedIn: false };
    } finally {
      set({ isLoading: false });
    }
  },

  logout: () => {
    clearAuthToken().catch(() => {});
    set({
      isLoggedIn: false,
      user: null,
      isLoading: false,
      authError: null,
      registrationSuccessMessage: null,
    });
  },
}));
