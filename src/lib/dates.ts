export function localDay(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function tomorrow(day: string): string {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + 1);
  return localDay(date);
}

export function friendlyDay(day: string | null): string {
  if (!day) return 'No deadline';
  const today = localDay();
  if (day === today) return 'Due today';
  if (day === tomorrow(today)) return 'Due tomorrow';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
    new Date(`${day}T12:00:00`),
  );
}
