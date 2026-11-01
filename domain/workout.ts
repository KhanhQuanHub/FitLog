export type WorkoutStatus = 'planned' | 'done' | 'missed';

export type Exercise = {
  id: number;
  name: string;
  muscleGroup: string;
  primaryMuscleGroup: string;
  secondaryMuscleGroups: string[];
  activityType: string;
  equipment: string;
  met: number;
  impact: 'low' | 'high';
  sets: number;
  reps: number;
  durationSec: number;
  youtubeId?: string;
};

export type Workout = {
  id: number;
  userId: number | string;
  exerciseId: number;
  date: string;
  time: string;
  status: WorkoutStatus;
  durationMin: number;
  plannedDurationMin?: number;
  caloriesBurned: number;
  weightKg?: number;
  note: string;
  exercise?: Exercise;
};

export type WorkoutInput = Omit<Workout, 'id' | 'userId' | 'exercise'>;

export const EQUIPMENT_LABELS: Record<string, string> = {
  none: 'Không cần dụng cụ',
  mat: 'Thảm tập',
  rope: 'Dây nhảy',
  machine: 'Máy tập',
  dumbbell: 'Tạ đơn',
};

export const WORKOUT_STATUS_LABELS: Record<WorkoutStatus, string> = {
  planned: 'Chưa hoàn thành',
  done: 'Đã hoàn thành',
  missed: 'Bỏ lỡ',
};

export const MET_REFERENCES = [
  { activity: 'Đi bộ chậm / khởi động', met: '2.5–3.0', level: 'Thấp' },
  { activity: 'Yoga / kéo giãn cơ', met: '3.0–3.5', level: 'Trung bình thấp' },
  { activity: 'Tập kháng lực nhẹ tại nhà', met: '4.0–5.0', level: 'Trung bình' },
  { activity: 'Tập tạ cường độ vừa', met: '5.5–6.5', level: 'Trung bình cao' },
  { activity: 'Chạy bộ 8 km/h', met: '8.0–8.5', level: 'Cao' },
  { activity: 'Nhảy dây / HIIT', met: '9.0–11.0', level: 'Rất cao' },
  { activity: 'Chạy bộ 10–12 km/h', met: '11.5–12.5', level: 'Cực cao' },
] as const;

export function getYouTubeVideoId(value: string | undefined): string | null {
  if (typeof value !== 'string') return null;

  const candidate = value.trim();
  if (/^[\w-]{11}$/.test(candidate)) return candidate;

  try {
    const url = new URL(candidate);
    const host = url.hostname.toLowerCase();
    const isYouTubeHost =
      host === 'youtu.be' ||
      host === 'youtube.com' ||
      host.endsWith('.youtube.com') ||
      host === 'youtube-nocookie.com' ||
      host.endsWith('.youtube-nocookie.com');

    if (!isYouTubeHost) return null;

    const pathMatch = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})(?:\/|$)/);
    const videoId =
      host === 'youtu.be'
        ? url.pathname.split('/').filter(Boolean)[0]
        : url.searchParams.get('v') ?? pathMatch?.[1];

    return videoId && /^[\w-]{11}$/.test(videoId) ? videoId : null;
  } catch {
    return null;
  }
}
