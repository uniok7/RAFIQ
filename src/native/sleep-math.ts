export type TimeInterval = { start: string; end: string };

export function sleepWindow(now = new Date()): { start: Date; end: Date } {
  const end = new Date(now);
  end.setHours(12, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - 1);
  start.setHours(18, 0, 0, 0);
  return { start, end };
}

export function unionMinutes(intervals: TimeInterval[], windowStart: Date, windowEnd: Date): number {
  const startLimit = windowStart.getTime();
  const endLimit = windowEnd.getTime();
  const normalized = intervals
    .map(({ start, end }) => [Math.max(new Date(start).getTime(), startLimit), Math.min(new Date(end).getTime(), endLimit)] as const)
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start)
    .sort(([a], [b]) => a - b);
  if (!normalized.length) return 0;
  let total = 0;
  let [currentStart, currentEnd] = normalized[0];
  for (const [start, end] of normalized.slice(1)) {
    if (start <= currentEnd) currentEnd = Math.max(currentEnd, end);
    else {
      total += currentEnd - currentStart;
      currentStart = start;
      currentEnd = end;
    }
  }
  total += currentEnd - currentStart;
  return Math.round(total / 60_000);
}
