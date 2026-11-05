// Hàm thuần và if/else: có thể đọc, kiểm thử mà không cần chạy giao diện.
export const MUSCLES = [
  { id: 'chest', label: 'Ngực' }, { id: 'abs', label: 'Bụng' },
  { id: 'obliques', label: 'Bụng bên' },
  { id: 'shoulders', label: 'Vai' }, { id: 'biceps', label: 'Tay trước' },
  { id: 'triceps', label: 'Tay sau' }, { id: 'forearms', label: 'Cẳng tay' },
  { id: 'traps', label: 'Cầu vai' }, { id: 'back', label: 'Xô & lưng trên' },
  { id: 'lowerBack', label: 'Lưng dưới' }, { id: 'neck', label: 'Cổ' },
  { id: 'glutes', label: 'Mông' }, { id: 'quads', label: 'Đùi trước' },
  { id: 'hamstrings', label: 'Đùi sau' }, { id: 'adductors', label: 'Đùi trong' },
  { id: 'calves', label: 'Bắp chân' }, { id: 'tibialis', label: 'Cẳng chân trước' },
] as const;
export type Muscle = typeof MUSCLES[number]['id'];
export const MUSCLE_GROUPS: { label: string; muscles: Muscle[] }[] = [
  { label: 'Ngực & thân giữa', muscles: ['chest', 'abs', 'obliques'] },
  { label: 'Vai & tay', muscles: ['shoulders', 'biceps', 'triceps', 'forearms'] },
  { label: 'Lưng & cổ', muscles: ['traps', 'back', 'lowerBack', 'neck'] },
  { label: 'Chân & mông', muscles: ['glutes', 'quads', 'hamstrings', 'adductors', 'calves', 'tibialis'] },
];
export const CONDITIONS = [
  { id: 'joint', label: 'Xương khớp' },
  { id: 'back', label: 'Đau lưng / cột sống' },
  { id: 'cardio', label: 'Tim mạch' },
  { id: 'hypertension', label: 'Tăng huyết áp' },
  { id: 'respiratory', label: 'Hô hấp' },
  { id: 'other', label: 'Khác' },
] as const;
export type Condition = typeof CONDITIONS[number]['id'];
export const GOALS = [
  { id: 'weightLoss', label: 'Giảm cân', description: 'Bắt đầu vận động đều đặn, phân bổ nhiều nhóm cơ.' },
  { id: 'weightGain', label: 'Tăng cân', description: 'Chú trọng các nhóm cơ lớn và thói quen tập sức mạnh.' },
  { id: 'health', label: 'Sức khỏe', description: 'Giữ cơ thể vận động cân đối, dễ duy trì.' },
  { id: 'muscle', label: 'Tăng cơ', description: 'Tập sức mạnh với các nhóm cơ trên và dưới cơ thể.' },
  { id: 'endurance', label: 'Sức bền', description: 'Ưu tiên khả năng duy trì vận động và các nhóm cơ chân.' },
  { id: 'mobility', label: 'Dẻo dai', description: 'Ưu tiên các động tác nhẹ và khả năng vận động.' },
] as const;
export const FOCUS_OPTIONS = [
  { id: 'balanced', label: 'Toàn thân', description: 'Tôi muốn hệ thống phân bổ các vùng tập.' },
  { id: 'core', label: 'Bụng & lưng', description: 'Ưu tiên phần thân giữa, vẫn tập các vùng hỗ trợ.' },
  { id: 'upper', label: 'Thân trên', description: 'Ưu tiên ngực, vai, lưng và tay.' },
  { id: 'lower', label: 'Chân & mông', description: 'Ưu tiên phần thân dưới, vẫn giữ các nhóm thân trên.' },
] as const;
export type TrainingGoal = typeof GOALS[number]['id'];
export type TrainingFocus = typeof FOCUS_OPTIONS[number]['id'];
export const QUESTION_IDS = ['goals', 'focus', 'activity', 'styles', 'places', 'equipment', 'intensity', 'barriers'] as const;
export type QuestionId = typeof QUESTION_IDS[number];
export type GoalAnswers = { version: 2; selections: Record<QuestionId, string[]> };
type QuestionOption = { id: string; label: string; description?: string };
export type TrainingQuestion = { id: QuestionId; title: string; hint: string; options: readonly QuestionOption[] };
const UNKNOWN = { id: 'unknown', label: 'Không biết', description: 'Tôi chưa xác định hoặc chưa muốn trả lời câu này.' };
export const TRAINING_QUESTIONS: TrainingQuestion[] = [
  { id: 'goals', title: 'Mục tiêu của bạn?', hint: 'Có thể chọn nhiều mục tiêu cùng lúc.', options: [...GOALS, UNKNOWN] },
  { id: 'focus', title: 'Bạn muốn ưu tiên vùng nào?', hint: 'Chọn nhiều vùng nếu muốn; hệ thống vẫn giữ các nhóm hỗ trợ.', options: [...FOCUS_OPTIONS, UNKNOWN] },
  { id: 'activity', title: 'Bạn vận động hằng ngày thế nào?', hint: 'Chọn các mô tả phù hợp với sinh hoạt của bạn.', options: [
    { id: 'sitting', label: 'Ngồi nhiều' }, { id: 'walking', label: 'Đi bộ nhiều' },
    { id: 'physical', label: 'Lao động tay chân' }, { id: 'sports', label: 'Chơi thể thao' }, UNKNOWN,
  ] },
  { id: 'styles', title: 'Bạn thích kiểu tập nào?', hint: 'Chưa từng tập cũng có thể chọn điều bạn muốn thử.', options: [
    { id: 'strength', label: 'Tập sức mạnh' }, { id: 'gentle', label: 'Vận động nhẹ' },
    { id: 'mobility', label: 'Giãn cơ' }, { id: 'walking', label: 'Đi bộ' }, UNKNOWN,
  ] },
  { id: 'places', title: 'Bạn muốn tập ở đâu?', hint: 'Có thể chọn nhiều nơi cho các ngày khác nhau.', options: [
    { id: 'home', label: 'Tại nhà' }, { id: 'outdoors', label: 'Ngoài trời' }, { id: 'gym', label: 'Phòng tập' }, UNKNOWN,
  ] },
  { id: 'equipment', title: 'Bạn có dụng cụ gì?', hint: 'Chỉ chọn thứ bạn có thể sử dụng. Không biết vẫn nhận được bài không cần dụng cụ.', options: [
    { id: 'bodyweight', label: 'Tập không dụng cụ' }, { id: 'chair', label: 'Ghế chắc chắn' },
    { id: 'wall', label: 'Tường trống' }, { id: 'mat', label: 'Thảm tập' }, UNKNOWN,
  ] },
  { id: 'intensity', title: 'Bạn muốn tập ở mức nào?', hint: 'Nếu chọn cả nhẹ và thử thách, hệ thống sẽ ưu tiên bắt đầu nhẹ.', options: [
    { id: 'light', label: 'Nhẹ nhàng' }, { id: 'gradual', label: 'Vừa sức' },
    { id: 'challenge', label: 'Thử thách' }, UNKNOWN,
  ] },
  { id: 'barriers', title: 'Bạn gặp trở ngại gì?', hint: 'Chọn các trở ngại để hệ thống điều chỉnh gợi ý.', options: [
    { id: 'time', label: 'Ít thời gian' }, { id: 'motivation', label: 'Dễ bỏ dở' },
    { id: 'technique', label: 'Chưa rõ kỹ thuật' }, { id: 'space', label: 'Ít không gian' }, UNKNOWN,
  ] },
];

export function createGoalAnswers(unknown = false): GoalAnswers {
  return { version: 2, selections: Object.fromEntries(QUESTION_IDS.map(id => [id, unknown ? ['unknown'] : []])) as Record<QuestionId, string[]> };
}

export function toggleGoalOption(answers: GoalAnswers, question: QuestionId, option: string): GoalAnswers {
  if (!TRAINING_QUESTIONS.find(q => q.id === question)?.options.some(o => o.id === option)) return answers;
  const previous = answers.selections[question];
  const next = option === 'unknown'
    ? previous.includes('unknown') ? [] : ['unknown']
    : previous.includes(option) ? previous.filter(id => id !== option) : [...previous.filter(id => id !== 'unknown'), option];
  return { version: 2, selections: { ...answers.selections, [question]: next } };
}

export function firstIncompleteQuestion(value: GoalAnswers): number {
  return TRAINING_QUESTIONS.findIndex(q => !value.selections[q.id]?.length);
}

export function sameGoalAnswers(first: GoalAnswers | undefined, second: GoalAnswers): boolean {
  return !!first && QUESTION_IDS.every(id => {
    const left = new Set(first.selections[id]);
    const right = new Set(second.selections[id]);
    return left.size === right.size && [...left].every(option => right.has(option));
  });
}

export function answerSummary(answers: GoalAnswers, question: QuestionId): string {
  const selected = answers.selections[question];
  if (selected.includes('unknown')) return question === 'goals' ? 'Khám phá mục tiêu' : question === 'focus' ? 'Theo gợi ý của hệ thống' : 'Không biết / Chưa xác định';
  return TRAINING_QUESTIONS.find(q => q.id === question)!.options.filter(o => selected.includes(o.id)).map(o => o.label).join(' + ');
}

export type TrainingSetup = {
  version: 2;
  age: number;
  height: number;
  weight: number;
  gender: 'Nam' | 'Nữ' | 'Khác';
  conditions: Condition[];
  healthNote: string;
  experience: 'beginner' | 'regular';
  sessions: number;
  minutes: 15 | 25 | 40;
  muscles: Muscle[];
  // Không bắt buộc khi đọc hồ sơ cũ. Luồng mới yêu cầu trả lời đủ trước bước vùng cơ.
  goalAnswers?: GoalAnswers;
};
export const PRESETS: { id: string; label: string; description: string; muscles: Muscle[] }[] = [
  { id: 'balanced', label: 'Toàn thân', description: 'Phân bổ đều các nhóm cơ', muscles: MUSCLES.map(m => m.id) },
  { id: 'upper', label: 'Thân trên', description: 'Ngực, lưng, vai và các nhóm cơ tay', muscles: ['chest', 'back', 'traps', 'shoulders', 'biceps', 'triceps', 'forearms'] },
  { id: 'core', label: 'Bụng & lưng', description: 'Bụng, bụng bên và các vùng lưng', muscles: ['abs', 'obliques', 'back', 'lowerBack'] },
  { id: 'lower', label: 'Chân & mông', description: 'Mông, đùi trước / sau / trong, cẳng chân', muscles: ['glutes', 'quads', 'hamstrings', 'adductors', 'calves', 'tibialis'] },
];
export const muscleLabel = (id: Muscle) => MUSCLES.find(m => m.id === id)?.label ?? id;
export const goalLabel = (id: TrainingGoal) => GOALS.find(g => g.id === id)?.label ?? id;
export const focusLabel = (id: TrainingFocus) => FOCUS_OPTIONS.find(f => f.id === id)?.label ?? id;
export const healthLabel = (ids: Condition[]) => ids.length
  ? CONDITIONS.filter(c => ids.includes(c.id)).map(c => c.label).join(', ')
  : 'Không có';

export function validateGoalAnswers(value: unknown): string | null {
  if (!value || typeof value !== 'object') return 'Hãy chọn ít nhất một ý cho mỗi câu; có thể chọn Không biết.';
  const record = value as Record<string, unknown>;
  if (record.version !== 2 || !record.selections || typeof record.selections !== 'object' || Array.isArray(record.selections)) return 'Câu trả lời không hợp lệ.';
  const selections = record.selections as Record<string, unknown>;
  for (const [index, question] of TRAINING_QUESTIONS.entries()) {
    const values = selections[question.id];
    if (!Array.isArray(values) || !values.length) return `Câu ${index + 1}: chọn ít nhất một ý hoặc Không biết để tiếp tục.`;
    if (values.some(id => typeof id !== 'string' || !question.options.some(o => o.id === id))) return `Câu ${index + 1}: có lựa chọn không hợp lệ.`;
    if (new Set(values).size !== values.length) return `Câu ${index + 1}: lựa chọn bị trùng.`;
    if (values.includes('unknown') && values.length > 1) return `Câu ${index + 1}: Không biết không đi cùng các ý cụ thể.`;
  }
  return null;
}

// Chuyển hai câu radio cũ sang các mảng checkbox; câu mới được ghi là chưa biết.
export function normalizeGoalAnswers(value: unknown): GoalAnswers | null {
  if (validateGoalAnswers(value) === null) return value as GoalAnswers;
  if (!value || typeof value !== 'object') return null;
  const old = value as Record<string, unknown>;
  if (!GOALS.some(g => g.id === old.goal) || !FOCUS_OPTIONS.some(f => f.id === old.focus)) return null;
  const next = createGoalAnswers(true);
  next.selections.goals = [old.goal as string];
  next.selections.focus = [old.focus as string];
  return next;
}

// Luật minh họa: gộp mọi mục tiêu/vùng ưu tiên, luôn giữ nền tảng toàn thân.
export function suggestMuscles(answers: GoalAnswers) {
  const values = (id: QuestionId) => answers.selections[id];
  const goals = values('goals');
  const base: Muscle[] = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'abs', 'obliques', 'lowerBack', 'glutes', 'quads', 'hamstrings', 'calves'];
  const extra: Muscle[] = [];
  if (goals.includes('weightGain') || goals.includes('muscle')) extra.push('traps', 'forearms');
  if (goals.includes('muscle')) extra.push('adductors');
  if (goals.includes('endurance') || values('styles').includes('walking')) extra.push('tibialis');
  if (goals.includes('mobility') || values('styles').includes('mobility')) extra.push('neck', 'adductors');
  const priority: Muscle[] = [];
  if (values('focus').includes('core')) priority.push('abs', 'obliques', 'lowerBack');
  if (values('focus').includes('upper')) priority.push('chest', 'back', 'shoulders', 'biceps', 'triceps');
  if (values('focus').includes('lower')) priority.push('glutes', 'quads', 'hamstrings', 'calves');
  const muscles = MUSCLES.filter(m => [...base, ...extra, ...priority].includes(m.id)).map(m => m.id);
  let reason = goals.includes('unknown')
    ? 'Bạn chưa xác định mục tiêu: hệ thống đề xuất nền tảng toàn thân để bắt đầu.'
    : 'Đề xuất kết hợp các mục tiêu bạn chọn, giữ nhóm cơ lớn ở thân trên, thân giữa và chân.';
  if (goals.includes('weightLoss') && goals.includes('weightGain')) reason += ' Bạn chọn cả giảm và tăng cân; hệ thống giữ nền tảng vận động, chưa gán một mục tiêu thay đổi cân nặng cụ thể.';
  if (priority.length) reason += ` Ưu tiên ${answerSummary(answers, 'focus').toLowerCase()}, đồng thời giữ các nhóm hỗ trợ.`;
  const gentle = values('intensity').includes('unknown') || values('intensity').includes('light') || values('styles').includes('gentle') || values('styles').includes('mobility') || goals.includes('mobility') || values('barriers').includes('technique');
  const notes: string[] = [];
  if (values('activity').includes('sitting')) notes.push('Bạn thường ngồi nhiều: bắt đầu chậm, chú ý vận động đều và tăng dần theo sức.');
  if (values('styles').includes('walking')) notes.push('Bạn thích đi bộ: có thể kết hợp đi bộ với các bài tập cơ trong danh sách.');
  if (!values('places').includes('unknown')) notes.push(`Nơi tập bạn chọn: ${answerSummary(answers, 'places')}.`);
  if (values('equipment').includes('unknown')) notes.push('Chưa rõ dụng cụ sẵn có: ưu tiên bài không cần ghế hoặc tường.');
  if (values('barriers').includes('time')) notes.push('Bạn ít thời gian: số lần mỗi hiệp được giảm để dễ bắt đầu.');
  if (values('barriers').includes('motivation')) notes.push('Bạn dễ bỏ dở: chọn khung giờ dễ duy trì và ghi nhận những buổi đã tập.');
  if (values('barriers').includes('space')) notes.push('Bạn có không gian hạn chế: danh sách ưu tiên các động tác tại chỗ.');
  if (gentle) notes.push('Ưu tiên bắt đầu nhẹ theo mức độ, sở thích hoặc phần bạn chưa xác định.');
  return { muscles, priority: [...new Set(priority)], reason, gentle, notes };
}

export function sameMuscleSelection(first: Muscle[], second: Muscle[]) {
  const left = new Set(first);
  const right = new Set(second);
  return left.size === right.size && [...left].every(m => right.has(m));
}

export function validateSetup(value: TrainingSetup): string | null {
  if (!Number.isInteger(value.age) || value.age < 18 || value.age > 100) return 'Nhập tuổi từ 18 đến 100. Bản demo dành cho người trưởng thành.';
  if (!Number.isFinite(value.height) || value.height < 120 || value.height > 230) return 'Chiều cao cần từ 120 đến 230 cm.';
  if (!Number.isFinite(value.weight) || value.weight < 30 || value.weight > 250) return 'Cân nặng cần từ 30 đến 250 kg.';
  if (!['Nam', 'Nữ', 'Khác'].includes(value.gender)) return 'Vui lòng chọn giới tính.';
  if (!['beginner', 'regular'].includes(value.experience)) return 'Vui lòng chọn kinh nghiệm tập.';
  if (!Number.isInteger(value.sessions) || value.sessions < 2 || value.sessions > 6) return 'Chọn từ 2 đến 6 buổi mỗi tuần.';
  if (![15, 25, 40].includes(value.minutes)) return 'Vui lòng chọn thời gian mỗi buổi.';
  if (!Array.isArray(value.conditions) || value.conditions.some(id => !CONDITIONS.some(c => c.id === id))) return 'Tình trạng sức khỏe không hợp lệ.';
  if (value.conditions.includes('other') && !value.healthNote.trim()) return 'Hãy ghi chú tình trạng khác để bạn dễ xem lại.';
  if (value.goalAnswers !== undefined) {
    const error = validateGoalAnswers(value.goalAnswers);
    if (error) return error;
  }
  if (!Array.isArray(value.muscles) || !value.muscles.length || value.muscles.some(id => !MUSCLES.some(m => m.id === id))) return 'Chọn ít nhất một vùng cơ hoặc một gợi ý có sẵn.';
  return null;
}

export function isTrainingSetup(value: unknown): value is TrainingSetup {
  if (!value || typeof value !== 'object') return false;
  const v = value as TrainingSetup;
  return v.version === 2 && typeof v.healthNote === 'string' && validateSetup(v) === null;
}

// Đọc hồ sơ cũ gồm 8 vùng gộp; chỉ lưu schema mới khi người dùng xác nhận sửa.
export function normalizeTrainingSetup(value: unknown): TrainingSetup | null {
  if (isTrainingSetup(value)) return value;
  if (!value || typeof value !== 'object') return null;
  const old = value as Record<string, unknown>;
  if (![1, 2].includes(old.version as number) || !Array.isArray(old.muscles)) return null;
  const legacy: Record<string, Muscle[]> = {
    chest: ['chest'], abs: ['abs', 'obliques'], back: ['traps', 'back', 'lowerBack'],
    shoulders: ['shoulders'], arms: ['biceps', 'triceps', 'forearms'],
    glutes: ['glutes'], thighs: ['quads', 'hamstrings', 'adductors'], calves: ['calves'],
  };
  if (old.version === 1 && old.muscles.some(id => typeof id !== 'string' || !Object.hasOwn(legacy, id))) return null;
  const muscles = old.version === 1 ? [...new Set(old.muscles.flatMap(id => legacy[id as string]))] : old.muscles;
  const goalAnswers = old.goalAnswers === undefined ? undefined : normalizeGoalAnswers(old.goalAnswers);
  if (goalAnswers === null) return null;
  const migrated = { ...old, version: 2, muscles, ...(goalAnswers ? { goalAnswers } : {}) };
  return isTrainingSetup(migrated) ? migrated : null;
}

// Gom nhóm khi quyết định tên kế hoạch; bài tập vẫn bám từng nhóm cơ chi tiết.
export function choosePlan(muscles: Muscle[]) {
  const has = (id: string) => muscles.some(m => m === id ||
    (id === 'abs' && m === 'obliques') ||
    (id === 'back' && ['traps', 'lowerBack'].includes(m)) ||
    (id === 'arms' && ['biceps', 'triceps', 'forearms'].includes(m)) ||
    (id === 'thighs' && ['quads', 'hamstrings', 'adductors'].includes(m)) ||
    (id === 'calves' && m === 'tibialis'));
  const families = ['chest', 'abs', 'back', 'shoulders', 'arms', 'glutes', 'thighs', 'calves'].filter(has);
  if (families.length >= 5) return { id: 'balanced', title: 'Toàn thân' };
  if (has('chest') && has('abs') && has('back')) return { id: 'trunk', title: 'Ngực, bụng & lưng' };
  if (has('chest') && has('back')) return { id: 'upper', title: 'Ngực & lưng cân bằng' };
  if (has('chest') && has('abs')) return { id: 'front', title: 'Ngực & bụng' };
  if (has('abs') && has('back')) return { id: 'core', title: 'Thân giữa vững vàng' };
  if (has('glutes') || has('thighs') || has('calves')) return { id: 'lower', title: 'Chân & mông linh hoạt' };
  if (has('chest')) return { id: 'chest', title: 'Tập trung cơ ngực' };
  if (has('back')) return { id: 'back', title: 'Tập trung cơ lưng' };
  if (has('abs')) return { id: 'abs', title: 'Tập trung cơ bụng' };
  if (has('shoulders') && has('arms')) return { id: 'shoulder-arm', title: 'Vai & tay' };
  if (has('shoulders')) return { id: 'shoulders', title: 'Vai linh hoạt' };
  if (!has('arms') && has('neck')) return { id: 'neck', title: 'Cổ linh hoạt' };
  return { id: 'arms', title: 'Tập trung cơ tay' };
}

type Exercise = {
  id: string; name: string; muscle: Muscle; instruction: string;
  gentle: boolean; jointLoad?: boolean; backLoad?: boolean; equipment?: 'chair' | 'wall';
};
// Danh mục nhỏ, không dụng cụ chuyên dụng. gentle chỉ là mức phân loại của demo.
export const EXERCISES: Exercise[] = [
  { id: 'wall-push', equipment: 'wall', name: 'Chống đẩy vào tường', muscle: 'chest', instruction: 'Đặt tay lên tường ngang ngực, gập khuỷu rồi đẩy người về. Giữ thân thẳng.', gentle: false, jointLoad: true },
  { id: 'chest-open', name: 'Mở ngực nhẹ', muscle: 'chest', instruction: 'Ngồi hoặc đứng thẳng, mở hai tay sang bên trong tầm thoải mái, rồi khép lại.', gentle: true },
  { id: 'dead-bug', name: 'Dead bug cơ bản', muscle: 'abs', instruction: 'Nằm ngửa, nâng tay và đầu gối, hạ luân phiên tay chân đối diện chậm rãi.', gentle: false, backLoad: true },
  { id: 'belly-brace', name: 'Siết bụng nhẹ', muscle: 'abs', instruction: 'Đứng hoặc ngồi thoải mái, siết nhẹ cơ bụng rồi thả lỏng; giữ nhịp thở đều, không nín thở.', gentle: true },
  { id: 'bird-dog', name: 'Bird dog', muscle: 'back', instruction: 'Chống tay và gối, duỗi tay chân đối diện trong tầm kiểm soát, rồi đổi bên.', gentle: false, jointLoad: true, backLoad: true },
  { id: 'shoulder-blade', name: 'Thu bả vai', muscle: 'back', instruction: 'Đứng hoặc ngồi thẳng, nhẹ nhàng kéo hai bả vai về gần nhau rồi thả lỏng.', gentle: true },
  { id: 'wall-slide', equipment: 'wall', name: 'Trượt tay trên tường', muscle: 'shoulders', instruction: 'Đứng cạnh tường, đưa hai tay lên chậm trong tầm thoải mái rồi hạ xuống.', gentle: false },
  { id: 'shoulder-roll', name: 'Xoay vai nhẹ', muscle: 'shoulders', instruction: 'Thả lỏng hai tay, xoay vai chậm ra sau rồi đổi chiều.', gentle: true },
  { id: 'arm-curl', name: 'Gập tay không tạ', muscle: 'biceps', instruction: 'Giữ khuỷu tay sát thân, gập và duỗi tay chậm. Không cần dùng tạ.', gentle: false },
  { id: 'arm-extend', name: 'Gập khuỷu tay nhẹ', muscle: 'biceps', instruction: 'Đứng hoặc ngồi thoải mái, gập và duỗi luân phiên từng tay, không khóa cứng khuỷu.', gentle: true },
  { id: 'bridge', name: 'Nâng hông', muscle: 'glutes', instruction: 'Nằm ngửa, co gối, nâng hông vừa phải rồi hạ chậm, không ưỡn lưng.', gentle: false, backLoad: true },
  { id: 'glute-squeeze', name: 'Siết cơ mông nhẹ', muscle: 'glutes', instruction: 'Ngồi hoặc nằm thoải mái, siết nhẹ cơ mông rồi thả lỏng, vẫn thở đều.', gentle: true },
  { id: 'chair-squat', equipment: 'chair', name: 'Đứng lên ngồi xuống ghế', muscle: 'quads', instruction: 'Dùng ghế chắc, đứng lên và ngồi xuống chậm trong tầm kiểm soát.', gentle: false, jointLoad: true },
  { id: 'leg-extend', equipment: 'chair', name: 'Duỗi gối khi ngồi', muscle: 'quads', instruction: 'Ngồi trên ghế chắc, duỗi nhẹ một chân trong tầm thoải mái rồi đổi bên.', gentle: true },
  { id: 'calf-raise', equipment: 'chair', name: 'Nhón gót có điểm tựa', muscle: 'calves', instruction: 'Bám ghế chắc, nâng gót rồi hạ chậm, giữ người thăng bằng.', gentle: false, jointLoad: true },
  { id: 'ankle-pump', name: 'Gập duỗi cổ chân', muscle: 'calves', instruction: 'Ngồi hoặc nằm thoải mái, gập duỗi cổ chân bằng cách nhấc nhẹ mũi chân rồi hạ xuống, sau đó nhấc nhẹ gót chân.', gentle: true },
  { id: 'side-brace', name: 'Giữ thân giữa nhẹ', muscle: 'obliques', instruction: 'Đứng hoặc ngồi thẳng, siết nhẹ vùng bụng bên khi thở ra rồi thả lỏng; không xoắn vặn thân.', gentle: true },
  { id: 'triceps-extend', name: 'Duỗi tay ra sau không tạ', muscle: 'triceps', instruction: 'Giữ cánh tay sát thân, duỗi khuỷu tay chậm ra sau trong tầm thoải mái.', gentle: true },
  { id: 'wrist-curl', name: 'Gập duỗi cổ tay', muscle: 'forearms', instruction: 'Tựa cẳng tay lên đùi, gập và duỗi cổ tay nhẹ, đổi bên; không cần dùng tạ.', gentle: true },
  { id: 'shoulder-shrug', name: 'Nâng hạ vai nhẹ', muscle: 'traps', instruction: 'Đứng hoặc ngồi thẳng, nâng nhẹ hai vai rồi hạ xuống, giữ cổ thư giãn và thở đều.', gentle: true },
  { id: 'seated-posture', name: 'Giữ tư thế lưng trung tính', muscle: 'lowerBack', instruction: 'Đứng hoặc ngồi thoải mái, giữ lưng trong tư thế thoải mái vài nhịp thở rồi thả lỏng; không ưỡn hoặc gập sâu.', gentle: true },
  { id: 'neck-turn', name: 'Quay cổ trong tầm thoải mái', muscle: 'neck', instruction: 'Đứng hoặc ngồi thẳng, quay đầu chậm sang mỗi bên trong tầm không đau; không xoay cổ thành vòng.', gentle: true },
  { id: 'heel-drag', equipment: 'chair', name: 'Kéo gót chân khi ngồi', muscle: 'hamstrings', instruction: 'Ngồi trên ghế chắc, đặt gót xuống sàn, kéo gót nhẹ về phía ghế rồi thả lỏng; đổi chân.', gentle: true },
  { id: 'adductor-squeeze', equipment: 'chair', name: 'Khép đùi nhẹ khi ngồi', muscle: 'adductors', instruction: 'Ngồi thoải mái, đưa hai đầu gối nhẹ về phía nhau rồi thả lỏng; không cố ép nếu khó chịu.', gentle: true },
  { id: 'toe-raise', name: 'Nâng mũi chân khi ngồi', muscle: 'tibialis', instruction: 'Ngồi thoải mái trên sàn hoặc ghế, giữ gót chân chạm sàn, nâng mũi chân lên rồi hạ chậm.', gentle: true },
  { id: 'lying-quad', name: 'Siết cơ đùi khi nằm', muscle: 'quads', instruction: 'Nằm thoải mái, duỗi chân trong tầm không đau, siết nhẹ cơ đùi rồi thả lỏng.', gentle: true },
  { id: 'lying-heel', name: 'Ép gót nhẹ khi nằm', muscle: 'hamstrings', instruction: 'Nằm ngửa thoải mái, co nhẹ đầu gối, ép gót xuống mặt phẳng rồi thả lỏng; đổi bên.', gentle: true },
  { id: 'lying-adductor', name: 'Khép chân nhẹ khi nằm', muscle: 'adductors', instruction: 'Nằm thoải mái, đưa hai chân nhẹ về gần nhau rồi thả lỏng, không cố ép nếu khó chịu.', gentle: true },
];

export function recommendTraining(setup: TrainingSetup) {
  const plan = choosePlan(setup.muscles);
  const suggestion = setup.goalAnswers ? suggestMuscles(setup.goalAnswers) : null;
  const customized = !!suggestion && !sameMuscleSelection(setup.muscles, suggestion.muscles);
  const lighter = setup.conditions.length > 0 || setup.age >= 65;
  const gentleRequested = suggestion?.gentle ?? false;
  const sets = lighter || gentleRequested || setup.experience === 'beginner' ? 1 : 2;
  // Lọc trước, sau đó lấy một bài cho mỗi vùng đã chọn: không làm mất vùng cơ.
  const eligible = EXERCISES.filter(exercise => {
    if ((lighter || gentleRequested) && !exercise.gentle) return false;
    if (exercise.equipment && setup.goalAnswers && !setup.goalAnswers.selections.equipment.includes(exercise.equipment)) return false;
    if (setup.conditions.includes('joint') && exercise.jointLoad) return false;
    if (setup.conditions.includes('back') && exercise.backLoad) return false;
    return true;
  });
  const selected = MUSCLES.filter(m => setup.muscles.includes(m.id));
  // Các bài ở vùng ưu tiên lên trước; những vùng hỗ trợ vẫn được giữ.
  selected.sort((a, b) => Number(suggestion?.priority.includes(b.id) ?? false) - Number(suggestion?.priority.includes(a.id) ?? false));
  const exercises = selected.map(m => {
    const exercise = eligible.find(e => e.muscle === m.id)!;
    return { ...exercise, sets, reps: setup.minutes === 15 || lighter || gentleRequested || setup.goalAnswers?.selections.barriers.includes('time') ? 6 : 10 };
  });
  return {
    ...plan, exercises, lighter,
    title: setup.goalAnswers ? `${answerSummary(setup.goalAnswers, 'goals')} · ${customized ? 'Vùng tự chọn' : answerSummary(setup.goalAnswers, 'focus')}` : plan.title,
    priorityMuscles: suggestion?.priority ?? [],
    trainingNotes: suggestion?.notes ?? [],
    selectionReason: suggestion ? `${customized ? 'Bạn đang dùng vùng tự chọn. Đề xuất ban đầu: ' : ''}${suggestion.reason}` : '',
    reason: lighter
      ? 'Bạn có lưu ý sức khỏe hoặc từ 65 tuổi: bản demo chọn các động tác nhẹ và giảm số hiệp.'
      : gentleRequested
        ? 'Hệ thống ưu tiên mức nhẹ để bắt đầu, mỗi vùng cơ một bài và một hiệp.'
      : setup.experience === 'beginner'
        ? 'Bạn mới bắt đầu: mỗi vùng cơ có một bài đơn giản, bắt đầu với một hiệp.'
        : 'Bạn đã tập thường xuyên: mỗi vùng cơ có một bài, gợi ý hai hiệp.',
  };
}
