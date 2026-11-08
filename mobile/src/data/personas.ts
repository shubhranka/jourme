import type { Persona } from './types';

export const PERSONAS: { id: Persona; name: string; sample: string }[] = [
  { id: 'cheerleader', name: 'The Cheerleader', sample: '“You cooked it yourself? Proper win!”' },
  { id: 'professor', name: 'The Strict Professor', sample: '“Note the tense shift in line one. Revise.”' },
  { id: 'friend', name: 'The Sarcastic Friend', sample: '“‘Very good’ again? Bold choice.”' },
];

export function personaName(id: Persona): string {
  return PERSONAS.find((p) => p.id === id)!.name;
}
