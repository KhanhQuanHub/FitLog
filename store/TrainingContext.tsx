import { createContext, useContext, type ReactNode } from 'react';
import { useAuthStore } from './authStore';
import { answerSummary, healthLabel, normalizeTrainingSetup, validateSetup, type TrainingSetup } from '../domain/training';
import { getMyProfile, request } from '../services/api';

type TrainingContextValue = {
  setup: TrainingSetup | null;
  saveSetup: (setup: TrainingSetup) => Promise<void>;
};
const TrainingContext = createContext<TrainingContextValue | null>(null);

// Chương 3: Context chia sẻ hồ sơ; Chương 4: await, PATCH/POST và xử lý lỗi.
export function TrainingProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore(state => state.user);
  const setup = normalizeTrainingSetup(user?.trainingSetup);

  async function saveSetup(next: TrainingSetup) {
    const error = validateSetup(next);
    if (error) throw new Error(error);
    const account = useAuthStore.getState().user;
    if (!account) throw new Error('Vui lòng đăng nhập lại trước khi lưu.');
    const profile = await getMyProfile() as { id?: string | number } | null;
    const body = {
      userId: account.id,
      heightCm: next.height, weightKg: next.weight, age: next.age,
      gender: next.gender === 'Nữ' ? 'female' : next.gender === 'Nam' ? 'male' : 'other',
      sessionsPerWeek: next.sessions, healthCondition: healthLabel(next.conditions),
      currentGoal: next.goalAnswers ? answerSummary(next.goalAnswers, 'goals') : 'Tập theo vùng cơ', trainingSetup: next,
    };
    await request(profile?.id ? `/profiles/${profile.id}` : '/profiles', {
      method: profile?.id ? 'PATCH' : 'POST', body: JSON.stringify(body),
    });
    // Không ghi dữ liệu của tài khoản cũ vào phiên đăng nhập mới.
    if (useAuthStore.getState().user?.id !== account.id) throw new Error('Phiên đăng nhập đã thay đổi. Vui lòng thử lại.');
    useAuthStore.setState({ user: {
      ...account, height: next.height, weight: next.weight, gender: next.gender,
      workoutsPerWeek: next.sessions, healthCondition: body.healthCondition,
      currentGoal: body.currentGoal, trainingSetup: next,
    } });
  }

  return <TrainingContext.Provider value={{ setup, saveSetup }}>{children}</TrainingContext.Provider>;
}

export function useTraining() {
  const value = useContext(TrainingContext);
  if (!value) throw new Error('useTraining phải nằm trong TrainingProvider');
  return value;
}
