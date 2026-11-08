import type { Mood } from '@/data/types';

// Calendar dot and tag colours. Happy and Grateful tags are from the design; Calm and
// Stressed reuse the vocab and grammar tag pairs.
export const MOODS: Record<Mood, { label: string; color: string; tagBg: string; tagText: string }> = {
  happy: { label: 'Happy', color: '#F5D547', tagBg: '#FFF4B8', tagText: '#5C4A00' },
  grateful: { label: 'Grateful', color: '#7FC8A9', tagBg: '#DDF1E8', tagText: '#1E5A42' },
  calm: { label: 'Calm', color: '#9DB2F2', tagBg: '#E3E8FC', tagText: '#1A33A3' },
  stressed: { label: 'Stressed', color: '#D9644A', tagBg: '#FBE3DE', tagText: '#8A2E21' },
};

export const MOOD_ORDER: Mood[] = ['happy', 'grateful', 'calm', 'stressed'];
