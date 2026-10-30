// §11 Health: read-only, one metric — last night's sleep duration in minutes.
// iOS HealthKit sleepAnalysis (sum 'asleep' 18:00 yesterday → 12:00 today).
// Android Health Connect SleepSessionRecord, same window. Manual entry always available.
import { Platform } from 'react-native';

export type SleepSource = 'healthkit' | 'health_connect' | 'manual';
export interface SleepRead {
  minutes: number;
  source: SleepSource;
}

/** The 18:00-yesterday → 12:00-today window (§11). */
export function sleepWindow(now = new Date()): { start: Date; end: Date } {
  const end = new Date(now);
  end.setHours(12, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - 1);
  start.setHours(18, 0, 0, 0);
  return { start, end };
}

export async function requestSleepPermission(): Promise<boolean> {
  try {
    if (Platform.OS === 'ios') return requestHealthKit();
    if (Platform.OS === 'android') return requestHealthConnect();
    return false;
  } catch {
    return false;
  }
}

/** Returns null when unavailable/denied — caller falls back to manual entry (§11, §17). */
export async function readLastNightSleep(): Promise<SleepRead | null> {
  try {
    if (Platform.OS === 'ios') return readHealthKit();
    if (Platform.OS === 'android') return readHealthConnect();
    return null;
  } catch {
    return null;
  }
}

// ── iOS HealthKit ──
function requestHealthKit(): Promise<boolean> {
  const AppleHealthKit = require('react-native-health').default;
  const perms = { permissions: { read: ['SleepAnalysis'], write: [] } };
  return new Promise((resolve) => {
    AppleHealthKit.initHealthKit(perms, (err: unknown) => resolve(!err));
  });
}

function readHealthKit(): Promise<SleepRead | null> {
  const AppleHealthKit = require('react-native-health').default;
  const { start, end } = sleepWindow();
  return new Promise((resolve) => {
    AppleHealthKit.getSleepSamples(
      { startDate: start.toISOString(), endDate: end.toISOString() },
      (err: unknown, samples: Array<{ value: string; startDate: string; endDate: string }>) => {
        if (err || !samples?.length) return resolve(null);
        // Sum only 'asleep' categories (ASLEEP / ASLEEP_CORE/REM/DEEP), not IN_BED.
        const mins = samples
          .filter((s) => /ASLEEP/i.test(s.value))
          .reduce((sum, s) => sum + (Date.parse(s.endDate) - Date.parse(s.startDate)) / 60000, 0);
        resolve(mins > 0 ? { minutes: Math.round(mins), source: 'healthkit' } : null);
      },
    );
  });
}

// ── Android Health Connect ──
async function requestHealthConnect(): Promise<boolean> {
  const HC = require('react-native-health-connect');
  await HC.initialize();
  const granted = await HC.requestPermission([{ accessType: 'read', recordType: 'SleepSession' }]);
  return granted?.length > 0;
}

async function readHealthConnect(): Promise<SleepRead | null> {
  const HC = require('react-native-health-connect');
  await HC.initialize();
  const { start, end } = sleepWindow();
  const { records } = await HC.readRecords('SleepSession', {
    timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
  });
  if (!records?.length) return null;
  const mins = records.reduce(
    (sum: number, r: { startTime: string; endTime: string }) =>
      sum + (Date.parse(r.endTime) - Date.parse(r.startTime)) / 60000,
    0,
  );
  return mins > 0 ? { minutes: Math.round(mins), source: 'health_connect' } : null;
}
