import type { Muscle } from '../../domain/training';

// Tên vùng trong dữ liệu SVG -> nhóm tập của FitLog. Các phần khác chỉ làm nền.
export const BODY_REGION_MUSCLES: Record<string, Muscle> = {
  chest: 'chest', abs: 'abs', obliques: 'obliques', deltoids: 'shoulders',
  biceps: 'biceps', triceps: 'triceps', forearm: 'forearms', trapezius: 'traps',
  'upper-back': 'back', 'lower-back': 'lowerBack', neck: 'neck',
  gluteal: 'glutes', quadriceps: 'quads', hamstring: 'hamstrings',
  adductors: 'adductors', calves: 'calves', tibialis: 'tibialis',
};
