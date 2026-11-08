import type { LocalDate } from '@/data/types';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3));

// Parsed as a local calendar date, never as UTC midnight, so the day can't shift.
export function parseLocalDate(date: LocalDate): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toLocalDate(date: Date): LocalDate {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// "Tuesday, 27 October"
export function formatLongDate(date: LocalDate): string {
  const d = parseLocalDate(date);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// "27 Oct 2025"
export function formatShortDate(date: LocalDate): string {
  const d = parseLocalDate(date);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

// "October 2026"
export function formatMonth(year: number, month: number): string {
  return `${MONTHS[month]} ${year}`;
}

export function greeting(hour: number): string {
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// "Yesterday", "Today", or the long date.
export function relativeDay(date: LocalDate, today: LocalDate): string {
  const days = Math.round((parseLocalDate(today).getTime() - parseLocalDate(date).getTime()) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return formatLongDate(date);
}

// Monday-first grid for a month: leading nulls, then day numbers 1..n.
export function monthGrid(year: number, month: number): (number | null)[] {
  const leading = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  return [...Array<null>(leading).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
}
