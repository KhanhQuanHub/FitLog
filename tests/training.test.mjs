import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { MUSCLES, MUSCLE_GROUPS, CONDITIONS, EXERCISES, PRESETS, GOALS, FOCUS_OPTIONS, choosePlan, recommendTraining, buildWeeklySchedule, validateSetup, validateGoalAnswers, suggestMuscles, sameMuscleSelection, isTrainingSetup, normalizeTrainingSetup, normalizeGoalAnswers, TRAINING_QUESTIONS, QUESTION_IDS, createGoalAnswers, toggleGoalOption, sameGoalAnswers } from '../domain/training.ts';
import { BODY_REGION_MUSCLES } from '../components/training/bodyRegions.ts';
import { EXERCISE_GUIDES } from '../domain/exerciseGuides.ts';

const base = {
  version: 2, age: 22, height: 170, weight: 60, gender: 'Khác', conditions: [], healthNote: '',
  experience: 'beginner', sessions: 3, minutes: 25, muscles: ['chest'],
};

test('mỗi bài gợi ý có đủ hai tư thế và hướng dẫn kỹ thuật', () => {
  assert.deepEqual(Object.keys(EXERCISE_GUIDES).sort(), EXERCISES.map(exercise => exercise.id).sort());
  for (const guide of Object.values(EXERCISE_GUIDES)) {
    assert.equal(guide.poses.length, 2);
    assert.ok(guide.setup.trim() && guide.cue.trim());
    assert.notDeepEqual(guide.poses[0], guide.poses[1]);
  }
});

test('chia 13 bài vào 3 buổi mà vẫn giữ đủ bài trong tuần', () => {
  const { exercises } = recommendTraining({ ...base, muscles: MUSCLES.slice(0, 13).map(m => m.id) });
  const schedule = buildWeeklySchedule(3, exercises);
  assert.deepEqual(schedule.map(session => session.day), [0, 2, 4]);
  assert.deepEqual(schedule.map(session => session.exercises.length), [5, 4, 4]);
  assert.deepEqual(schedule.flatMap(session => session.exercises.map(e => e.id)).sort(), exercises.map(e => e.id).sort());
});

test('lặp lại bài đã chọn nếu số bài ít hơn số buổi', () => {
  const { exercises } = recommendTraining(base);
  const schedule = buildWeeklySchedule(6, exercises);
  assert.equal(new Set(schedule.map(session => session.day)).size, 6);
  assert.deepEqual(schedule.map(session => session.exercises), Array.from({ length: 6 }, () => exercises));
});

test('chặn chỉ số không hợp lệ và yêu cầu ghi chú tình trạng khác', () => {
  for (const patch of [{ age: 0 }, { age: 17 }, { age: 20.5 }, { height: NaN }, { weight: Infinity }, { weight: 0 }, { muscles: [] }, { muscles: ['invalid'] }, { conditions: ['invalid'] }, { sessions: 7 }, { minutes: 0 }, { conditions: ['other'] }]) {
    assert.ok(validateSetup({ ...base, ...patch }));
  }
  assert.equal(validateSetup({ ...base, height: 230, weight: 250, age: 100, conditions: ['other'], healthNote: 'Cần lưu ý' }), null);
  for (const value of [null, {}, [], { version: 1 }, { ...base, conditions: null }, { ...base, healthNote: null }]) assert.equal(isTrainingSetup(value), false);
  assert.equal(isTrainingSetup(base), true);
});

test('mọi tổ hợp vùng cơ và sức khỏe đều giữ đủ vùng đã chọn', () => {
  const branches = new Set();
  const legacy = ['chest', 'abs', 'back', 'shoulders', 'arms', 'glutes', 'thighs', 'calves'];
  const selections = [...MUSCLES.map(m => [m.id]), ...PRESETS.map(p => p.muscles), ...MUSCLE_GROUPS.map(g => g.muscles)];
  for (let mask = 1; mask < 2 ** legacy.length; mask++) {
    selections.push(normalizeTrainingSetup({ ...base, version: 1, muscles: legacy.filter((_, index) => mask & 2 ** index) }).muscles);
  }
  // Thêm các cặp bất kỳ, để vùng mới không bị lọt khỏi gợi ý khi chọn hỗn hợp.
  for (const first of MUSCLES) for (const second of MUSCLES) selections.push([...new Set([first.id, second.id])]);
  for (const muscles of selections) {
    branches.add(choosePlan(muscles).id);
    for (let healthMask = 0; healthMask < 2 ** CONDITIONS.length; healthMask++) {
      const conditions = CONDITIONS.filter((_, index) => healthMask & 2 ** index).map(c => c.id);
      const plan = recommendTraining({ ...base, muscles, conditions });
      assert.deepEqual(new Set(plan.exercises.map(e => e.muscle)), new Set(muscles));
      assert.equal(new Set(plan.exercises.map(e => e.id)).size, muscles.length);
      if (conditions.length) assert.ok(plan.exercises.every(e => e.gentle && e.sets === 1));
      if (conditions.includes('joint')) assert.ok(plan.exercises.every(e => !e.jointLoad));
      if (conditions.includes('back')) assert.ok(plan.exercises.every(e => !e.backLoad));
    }
  }
  assert.equal(branches.size, 13);
});

test('17 nhóm có đủ đường SVG trước/sau, và mỗi nhóm thuộc đúng một mục chọn', () => {
  const anatomy = JSON.parse(readFileSync(new URL('../assets/body/anatomy.json', import.meta.url), 'utf8'));
  const ids = MUSCLES.map(m => m.id).sort();
  assert.equal(ids.length, 17);
  assert.deepEqual(MUSCLE_GROUPS.flatMap(g => g.muscles).sort(), ids);
  const drawn = [...anatomy.front, ...anatomy.back].filter(part => part.paths.length).map(part => BODY_REGION_MUSCLES[part.slug]).filter(Boolean);
  assert.deepEqual([...new Set(drawn)].sort(), ids);
  for (const side of ['front', 'back']) {
    for (const part of anatomy[side]) for (const d of part.paths) assert.match(d, /^\s*M/i);
  }
  assert.equal(BODY_REGION_MUSCLES.hands, undefined);
  assert.equal(BODY_REGION_MUSCLES.knees, undefined);
});

test('hồ sơ 8 vùng cũ được chuyển đổi, không cần hỏi nhập lại', () => {
  const migrated = normalizeTrainingSetup({ ...base, version: 1, muscles: ['arms', 'thighs', 'back'] });
  assert.equal(migrated.version, 2);
  assert.deepEqual(new Set(migrated.muscles), new Set(['biceps', 'triceps', 'forearms', 'quads', 'hamstrings', 'adductors', 'traps', 'back', 'lowerBack']));
  assert.equal(migrated.weight, base.weight);
  assert.equal(normalizeTrainingSetup({ ...base, version: 1, muscles: ['unknown'] }), null);
  assert.equal(normalizeTrainingSetup({ ...base, version: 7 }), null);
  assert.equal(normalizeTrainingSetup(base), base);
});

test('preset tô sáng đúng vùng và ưu tiên nhánh tổ hợp', () => {
  assert.equal(choosePlan(PRESETS[0].muscles).id, 'balanced');
  assert.equal(choosePlan(['chest', 'abs', 'back']).id, 'trunk');
  assert.equal(choosePlan(['chest', 'abs']).id, 'front');
  assert.equal(choosePlan(['abs', 'back']).id, 'core');
  for (const preset of PRESETS) assert.equal(validateSetup({ ...base, muscles: preset.muscles }), null);
});

test('đổi sức khỏe, tuổi và kinh nghiệm sẽ tính lại bài và số hiệp', () => {
  const regular = recommendTraining({ ...base, experience: 'regular' });
  assert.equal(regular.exercises[0].sets, 2);
  const lighter = recommendTraining({ ...base, experience: 'regular', conditions: ['cardio'] });
  assert.notEqual(regular.exercises[0].id, lighter.exercises[0].id);
  assert.equal(lighter.exercises[0].sets, 1);
  assert.ok(recommendTraining({ ...base, age: 65 }).exercises.every(e => e.gentle));
});


function makeAnswers(changes = {}) {
  const answers = createGoalAnswers(true);
  for (const [id, values] of Object.entries(changes)) answers.selections[id] = values;
  return answers;
}

test('8 câu đều có Không biết, cần ít nhất một ý ở từng câu', () => {
  assert.equal(TRAINING_QUESTIONS.length, 8);
  assert.equal(validateGoalAnswers(makeAnswers()), null);
  assert.ok(validateGoalAnswers(createGoalAnswers()));
  for (const question of TRAINING_QUESTIONS) {
    assert.ok(question.options.some(o => o.id === 'unknown'));
    assert.ok(validateGoalAnswers(makeAnswers({ [question.id]: [] })));
    assert.ok(validateGoalAnswers(makeAnswers({ [question.id]: ['invalid'] })));
    assert.ok(validateGoalAnswers(makeAnswers({ [question.id]: ['unknown', question.options[0].id] })));
    assert.ok(validateGoalAnswers(makeAnswers({ [question.id]: ['unknown', 'unknown'] })));
    assert.equal(validateGoalAnswers(makeAnswers({ [question.id]: question.options.filter(o => o.id !== 'unknown').map(o => o.id) })), null);
  }
  assert.equal(isTrainingSetup(base), true);
  assert.equal(isTrainingSetup({ ...base, goalAnswers: makeAnswers() }), true);
  assert.equal(isTrainingSetup({ ...base, goalAnswers: createGoalAnswers() }), false);
});

test('checkbox giữ nhiều ý; Không biết đứng riêng và có thể bỏ chọn', () => {
  let answers = createGoalAnswers();
  answers = toggleGoalOption(answers, 'goals', 'weightLoss');
  answers = toggleGoalOption(answers, 'goals', 'muscle');
  assert.deepEqual(answers.selections.goals, ['weightLoss', 'muscle']);
  answers = toggleGoalOption(answers, 'goals', 'unknown');
  assert.deepEqual(answers.selections.goals, ['unknown']);
  answers = toggleGoalOption(answers, 'goals', 'health');
  assert.deepEqual(answers.selections.goals, ['health']);
  answers = toggleGoalOption(answers, 'goals', 'health');
  assert.deepEqual(answers.selections.goals, []);
  assert.equal(toggleGoalOption(answers, 'goals', 'invalid'), answers);
});

test('mọi tổ hợp nhiều mục tiêu và vùng ưu tiên vẫn giữ toàn thân', () => {
  const required = ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'abs', 'glutes', 'quads', 'hamstrings', 'calves'];
  const combinations = options => [
    ['unknown'],
    ...Array.from({length:2 ** options.length - 1},(_,index)=>options.filter((_,i)=>(index+1)&2**i).map(o=>o.id)),
  ];
  for (const goals of combinations(GOALS)) for (const focus of combinations(FOCUS_OPTIONS)) {
    const goalAnswers = makeAnswers({goals, focus});
    const suggested = suggestMuscles(goalAnswers);
    assert.ok(required.every(muscle => suggested.muscles.includes(muscle)));
    assert.equal(new Set(suggested.muscles).size, suggested.muscles.length);
    assert.ok(suggested.priority.every(muscle => suggested.muscles.includes(muscle)));
    for (const conditions of [[], ['joint'], ['back'], ['cardio'], CONDITIONS.map(c=>c.id)]) {
      const setup = { ...base, goalAnswers, muscles: suggested.muscles, conditions, healthNote: 'Ghi chú thử' };
      assert.equal(validateSetup(setup), null);
      const plan = recommendTraining(setup);
      assert.equal(plan.exercises.length, setup.muscles.length);
      assert.ok(plan.exercises.every(e=>e.muscle && e.gentle));
      assert.ok(plan.exercises.slice(0, suggested.priority.length).every(e => suggested.priority.includes(e.muscle)));
    }
  }
});

test('Không biết ở tất cả câu vẫn có đề xuất nhẹ và không cần ghế/tường', () => {
  const goalAnswers = makeAnswers();
  const suggested = suggestMuscles(goalAnswers);
  const plan = recommendTraining({...base,goalAnswers,muscles:suggested.muscles,experience:'regular'});
  assert.ok(plan.title.includes('Khám phá mục tiêu'));
  assert.ok(plan.exercises.every(e=>e.gentle && !e.equipment && e.sets === 1));
  assert.ok(suggested.muscles.includes('abs') && suggested.muscles.includes('chest') && suggested.muscles.includes('quads'));
});

test('câu dụng cụ, kiểu tập, mức độ và trở ngại thực sự điều chỉnh gợi ý', () => {
  const answers = makeAnswers({goals:['muscle'],focus:['core','lower'],styles:['strength'],intensity:['gradual'],equipment:['bodyweight']});
  const selected = suggestMuscles(answers).muscles;
  const without = recommendTraining({...base,goalAnswers:answers,muscles:selected,experience:'regular'});
  assert.ok(without.exercises.every(e=>!e.equipment));
  assert.ok(without.exercises.every(e=>e.sets===2 && e.reps===10));
  const withGear = recommendTraining({...base,goalAnswers:makeAnswers({...answers.selections,equipment:['chair','wall']}),muscles:selected});
  assert.ok(withGear.exercises.some(e=>e.equipment==='chair'));
  assert.ok(withGear.exercises.some(e=>e.equipment==='wall'));
  for (const patch of [{intensity:['light','challenge']},{styles:['mobility']},{barriers:['technique']}]) {
    const plan = recommendTraining({...base,goalAnswers:makeAnswers({...answers.selections,...patch}),muscles:selected,experience:'regular'});
    assert.ok(plan.exercises.every(e=>e.gentle && e.sets===1));
  }
  const short = recommendTraining({...base,goalAnswers:makeAnswers({...answers.selections,barriers:['time']}),muscles:selected,experience:'regular'});
  assert.ok(short.exercises.every(e=>e.reps===6));
});

test('hồ sơ radio cũ được đổi sang checkbox, giữ mục tiêu và vùng cơ', () => {
  const old = {...base,goalAnswers:{goal:'health',focus:'core'}};
  const migrated = normalizeTrainingSetup(old);
  assert.deepEqual(migrated.goalAnswers.selections.goals,['health']);
  assert.deepEqual(migrated.goalAnswers.selections.focus,['core']);
  for (const id of QUESTION_IDS.filter(id=>!['goals','focus'].includes(id))) assert.deepEqual(migrated.goalAnswers.selections[id],['unknown']);
  assert.deepEqual(migrated.muscles,base.muscles);
  assert.equal(normalizeGoalAnswers({goal:'invalid',focus:'core'}),null);
  const reordered = makeAnswers({goals:['health','muscle'],focus:['core','lower']});
  const reverse = makeAnswers({goals:['muscle','health'],focus:['lower','core']});
  assert.equal(sameGoalAnswers(reordered,reverse),true);
  assert.equal(sameGoalAnswers(reordered,makeAnswers()),false);
});

test('vùng tự chọn được tôn trọng và nhận biết khác đề xuất', () => {
  const goalAnswers = makeAnswers({goals:['health'],focus:['core']});
  const suggested = suggestMuscles(goalAnswers);
  assert.equal(sameMuscleSelection(suggested.muscles, [...suggested.muscles].reverse()), true);
  const custom = recommendTraining({ ...base, goalAnswers, muscles: ['abs'] });
  assert.deepEqual(custom.exercises.map(e => e.muscle), ['abs']);
  assert.ok(custom.title.includes('Vùng tự chọn'));
  assert.ok(custom.selectionReason.startsWith('Bạn đang dùng vùng tự chọn.'));
  const restored = recommendTraining({ ...base, goalAnswers, muscles: suggested.muscles });
  assert.ok(restored.exercises.some(e => e.muscle === 'quads'));
});
