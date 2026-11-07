import { Platform } from 'react-native';
import {
  AndroidImportance,
  IosAuthorizationStatus,
  SchedulableTriggerInputTypes,
  cancelScheduledNotificationAsync,
  getAllScheduledNotificationsAsync,
  getPermissionsAsync,
  requestPermissionsAsync,
  scheduleNotificationAsync,
  setNotificationChannelAsync,
} from 'expo-notifications';
import type { NotificationRequest } from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Workout } from '../domain/workout';

const ANDROID_CHANNEL_ID = 'workout-reminders';
const REMINDER_KIND = 'workout-reminder';
const REMINDER_PREFERENCE_KEY = '@fitlog_workout_reminders';

type WorkoutReminder = Pick<Workout, 'id' | 'userId' | 'date' | 'time' | 'status'> & {
  exercise?: Pick<NonNullable<Workout['exercise']>, 'name'>;
};

type ReminderSyncResult = {
  permissionGranted: boolean;
  scheduledCount: number;
};

function getWorkoutDate(date: string, time: string): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!dateMatch || !timeMatch) return null;

  const [, yearText, monthText, dayText] = dateMatch;
  const [, hourText, minuteText] = timeMatch;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const scheduledAt = new Date(year, month - 1, day, hour, minute);

  if (
    scheduledAt.getFullYear() !== year ||
    scheduledAt.getMonth() !== month - 1 ||
    scheduledAt.getDate() !== day ||
    scheduledAt.getHours() !== hour ||
    scheduledAt.getMinutes() !== minute
  ) return null;

  return scheduledAt;
}

function isWorkoutReminder(notification: NotificationRequest, userId: string | number) {
  const data = notification.content.data;
  return !!data && data.kind === REMINDER_KIND && String(data.userId) === String(userId);
}

function getReminderBody(workout: WorkoutReminder) {
  return `${workout.exercise?.name ?? 'Buổi tập'} bắt đầu lúc ${workout.time}. Đừng quên chuẩn bị nhé!`;
}

function getPreferenceKey(userId: string | number) {
  return `${REMINDER_PREFERENCE_KEY}:${userId}`;
}

export async function getWorkoutRemindersEnabled(userId: string | number) {
  const value = await AsyncStorage.getItem(getPreferenceKey(userId));
  return value !== 'false';
}

export async function setWorkoutRemindersEnabled(userId: string | number, enabled: boolean) {
  await AsyncStorage.setItem(getPreferenceKey(userId), String(enabled));
  if (!enabled) await cancelUserWorkoutReminders(userId);
}

async function ensurePermission(requestPermission: boolean) {
  if (Platform.OS === 'android') {
    await setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Nhắc lịch tập',
      importance: AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#16A34A',
    });
  }

  const current = await getPermissionsAsync();
  if (current.granted || current.ios?.status === IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }
  if (!requestPermission) return false;

  const requested = await requestPermissionsAsync();
  return requested.granted || requested.ios?.status === IosAuthorizationStatus.PROVISIONAL;
}

export async function syncWorkoutReminders(
  userId: string | number,
  workouts: WorkoutReminder[],
  requestPermission = false
): Promise<ReminderSyncResult> {
  if (Platform.OS === 'web') return { permissionGranted: false, scheduledCount: 0 };

  const scheduled = await getAllScheduledNotificationsAsync();
  const userReminders = scheduled.filter(notification => isWorkoutReminder(notification, userId));
  if (!await getWorkoutRemindersEnabled(userId)) {
    await Promise.all(userReminders.map(notification =>
      cancelScheduledNotificationAsync(notification.identifier)
    ));
    return { permissionGranted: true, scheduledCount: 0 };
  }

  const userWorkouts = workouts.filter(workout => String(workout.userId) === String(userId));
  const workoutsById = new Map(userWorkouts.map(workout => [String(workout.id), workout]));
  const reminderDates = new Map<string, Date>();

  userWorkouts.forEach(workout => {
    const date = getWorkoutDate(workout.date, workout.time);
    if (workout.status === 'planned' && date && date.getTime() > Date.now()) {
      reminderDates.set(String(workout.id), date);
    }
  });

  const keptIds = new Set<string>();
  for (const notification of userReminders) {
    const data = notification.content.data;
    if (!data) {
      await cancelScheduledNotificationAsync(notification.identifier);
      continue;
    }
    const workoutId = String(data.workoutId);
    const workout = workoutsById.get(workoutId);
    const date = reminderDates.get(workoutId);
    const shouldKeep = !!workout && !!date &&
      data.scheduledFor === `${workout.date}T${workout.time}` &&
      notification.content.body === getReminderBody(workout) &&
      !keptIds.has(workoutId);

    if (shouldKeep) {
      keptIds.add(workoutId);
    } else {
      await cancelScheduledNotificationAsync(notification.identifier);
    }
  }

  const missingReminders = userWorkouts.filter(workout =>
    reminderDates.has(String(workout.id)) && !keptIds.has(String(workout.id))
  );
  if (!missingReminders.length) return { permissionGranted: true, scheduledCount: 0 };

  const permissionGranted = await ensurePermission(requestPermission);
  if (!permissionGranted) return { permissionGranted: false, scheduledCount: 0 };

  let scheduledCount = 0;
  for (const workout of missingReminders) {
    const date = reminderDates.get(String(workout.id));
    if (!date) continue;

    await scheduleNotificationAsync({
      content: {
        title: 'Đến giờ tập luyện!',
        body: getReminderBody(workout),
        sound: true,
        data: {
          kind: REMINDER_KIND,
          workoutId: workout.id,
          userId,
          scheduledFor: `${workout.date}T${workout.time}`,
        },
      },
      trigger: {
        type: SchedulableTriggerInputTypes.DATE,
        date,
        ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
      },
    });
    scheduledCount += 1;
  }

  return { permissionGranted: true, scheduledCount };
}

export async function cancelWorkoutReminder(userId: string | number, workoutId: string | number) {
  if (Platform.OS === 'web') return;

  const scheduled = await getAllScheduledNotificationsAsync();
  const reminders = scheduled.filter(notification => {
    const data = notification.content.data;
    return !!data && isWorkoutReminder(notification, userId) && String(data.workoutId) === String(workoutId);
  });

  await Promise.all(reminders.map(notification =>
    cancelScheduledNotificationAsync(notification.identifier)
  ));
}

async function cancelUserWorkoutReminders(userId: string | number) {
  if (Platform.OS === 'web') return;

  const scheduled = await getAllScheduledNotificationsAsync();
  const reminders = scheduled.filter(notification => isWorkoutReminder(notification, userId));
  await Promise.all(reminders.map(notification =>
    cancelScheduledNotificationAsync(notification.identifier)
  ));
}
