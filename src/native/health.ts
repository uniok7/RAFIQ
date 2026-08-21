import { Platform } from 'react-native';

import { sleepWindow, unionMinutes, type TimeInterval } from '@/src/native/sleep-math';

export type SleepReadResult =
  | { ok: true; minutes: number; source: 'healthkit' | 'health_connect' }
  | { ok: false; reason: 'unsupported' | 'unavailable' | 'permission_denied' | 'no_data' | 'read_failed' };

type AppleSleepSample = { startDate: string; endDate: string; value: string };

async function readIosSleep(): Promise<SleepReadResult> {
  const module = await import('react-native-health');
  const health = module.default;
  const permissions = { permissions: { read: [health.Constants.Permissions.SleepAnalysis], write: [] } };
  const initialized = await new Promise<boolean>((resolve) => health.initHealthKit(permissions, (error: string) => resolve(!error)));
  if (!initialized) return { ok: false, reason: 'permission_denied' };
  const { start, end } = sleepWindow();
  const samples = await new Promise<AppleSleepSample[] | null>((resolve) => {
    health.getSleepSamples({ startDate: start.toISOString(), endDate: end.toISOString(), ascending: true }, (error: string, results) => {
      if (error) resolve(null);
      else resolve(results as unknown as AppleSleepSample[]);
    });
  });
  if (!samples) return { ok: false, reason: 'read_failed' };
  const asleep = new Set(['ASLEEP', 'CORE', 'DEEP', 'REM']);
  const intervals = samples.filter((sample) => asleep.has(String(sample.value).toUpperCase())).map((sample) => ({ start: sample.startDate, end: sample.endDate }));
  const minutes = unionMinutes(intervals, start, end);
  return minutes > 0 ? { ok: true, minutes, source: 'healthkit' } : { ok: false, reason: 'no_data' };
}

async function readAndroidSleep(): Promise<SleepReadResult> {
  const health = await import('react-native-health-connect');
  if ((await health.getSdkStatus()) !== health.SdkAvailabilityStatus.SDK_AVAILABLE) return { ok: false, reason: 'unavailable' };
  if (!(await health.initialize())) return { ok: false, reason: 'unavailable' };
  const granted = await health.requestPermission([{ accessType: 'read', recordType: 'SleepSession' }]);
  if (!granted.some((permission) => permission.accessType === 'read' && permission.recordType === 'SleepSession')) return { ok: false, reason: 'permission_denied' };
  const { start, end } = sleepWindow();
  const result = await health.readRecords('SleepSession', { timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() } });
  const sleepStages = new Set<number>([health.SleepStageType.SLEEPING, health.SleepStageType.LIGHT, health.SleepStageType.DEEP, health.SleepStageType.REM]);
  const intervals: TimeInterval[] = [];
  for (const record of result.records) {
    const stages = record.stages?.filter((stage) => sleepStages.has(stage.stage));
    if (stages?.length) intervals.push(...stages.map((stage) => ({ start: stage.startTime, end: stage.endTime })));
    else intervals.push({ start: record.startTime, end: record.endTime });
  }
  const minutes = unionMinutes(intervals, start, end);
  return minutes > 0 ? { ok: true, minutes, source: 'health_connect' } : { ok: false, reason: 'no_data' };
}

export async function readLastNightSleep(): Promise<SleepReadResult> {
  try {
    if (Platform.OS === 'ios') return await readIosSleep();
    if (Platform.OS === 'android') return await readAndroidSleep();
    return { ok: false, reason: 'unsupported' };
  } catch {
    return { ok: false, reason: 'read_failed' };
  }
}
