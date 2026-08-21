import { describe, expect, it } from 'vitest';
import { sleepWindow, unionMinutes } from './sleep-math';

describe('sleep window math', () => {
  it('uses 18:00 yesterday through 12:00 today', () => {
    const { start, end } = sleepWindow(new Date('2026-08-19T16:00:00'));
    expect(start.getHours()).toBe(18);
    expect(start.getDate()).toBe(18);
    expect(end.getHours()).toBe(12);
    expect(end.getDate()).toBe(19);
  });

  it('clips to the window and does not double-count overlapping stages', () => {
    const minutes = unionMinutes([
      { start: '2026-08-18T22:00:00Z', end: '2026-08-19T02:00:00Z' },
      { start: '2026-08-19T01:30:00Z', end: '2026-08-19T04:00:00Z' },
      { start: '2026-08-19T11:30:00Z', end: '2026-08-19T13:00:00Z' },
    ], new Date('2026-08-18T18:00:00Z'), new Date('2026-08-19T12:00:00Z'));
    expect(minutes).toBe(390);
  });
});
