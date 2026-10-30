// §5.5 Reasoning string. Pure. Never output an empty or generic reason.
import type { ScoreReason } from './types';

/** Top two positive reasons that fired, highest points first. */
export function topReasons(reasons: ScoreReason[]): ScoreReason[] {
  return reasons
    .filter((r) => r.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 2);
}

export function buildReasoning(reasons: ScoreReason[], block: number): string {
  const top = topReasons(reasons);
  if (top.length === 0) {
    return `Nothing's competing with it today — so I set your block to ${block} minutes.`;
  }
  const phrases = top.map((r) => `**${r.text}**`);
  const joined = phrases.length === 2 ? `${phrases[0]}, and ${phrases[1]}` : phrases[0];
  return `Because ${joined} — so I put it first and set your block to ${block} minutes.`;
}
