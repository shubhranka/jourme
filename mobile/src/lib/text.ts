export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

// "9,860"
export function formatCount(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

// Nudge under the average-sentence-length metric.
export function sentenceHint(avgWords: number): string {
  if (avgWords < 12) return 'Try one longer sentence';
  if (avgWords > 22) return 'Try splitting a long one';
  return 'Nicely varied';
}

// "21:30" -> "9:30 PM"
export function formatTime12h(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
