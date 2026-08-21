export function trialState(onboardedAt: string | null | undefined, active: boolean, now = Date.now()) {
  const elapsedDays = onboardedAt ? Math.max(0, (now - new Date(onboardedAt).getTime()) / 86_400_000) : 0;
  const day = Math.floor(elapsedDays) + 1;
  if (active) return { canCreate: true, day, daysLeft: null, expired: false };
  return {
    canCreate: elapsedDays < 7,
    day,
    daysLeft: Math.max(0, 7 - Math.floor(elapsedDays)),
    expired: elapsedDays >= 7,
  };
}
