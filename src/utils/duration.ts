export function calculateDurationMinutes(start: Date | null, end: Date | null): number {
  if ((start && !Number.isFinite(start.getTime())) || (end && !Number.isFinite(end.getTime()))) {
    throw new Error('Task timestamps must be valid dates.');
  }
  if (end && !start) {
    throw new Error('Enter a start time before setting an end time.');
  }
  if (!start || !end) return 0;
  const milliseconds = end.getTime() - start.getTime();
  if (milliseconds < 0) {
    throw new Error('End time must not be before start time. For overnight work, choose the next date.');
  }
  return Math.round(milliseconds / 60000);
}

export function formatDuration(minutes: number): string {
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
