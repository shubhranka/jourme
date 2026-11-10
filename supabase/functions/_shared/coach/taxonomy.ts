// Error types the coach can tag a correction with. The same slugs are seeded into
// public.error_types (migration 20261110091428_coach.sql); keep the two lists in step.

export const ERROR_TYPES = [
  ["articles", "Articles (a / the)"],
  ["past_tense", "Past tense"],
  ["present_tense", "Present tense"],
  ["future_forms", "Future forms"],
  ["tense_consistency", "Mixing tenses"],
  ["verb_form", "Verb forms"],
  ["subject_verb_agreement", "Subject–verb agreement"],
  ["prepositions", "Prepositions (in / on / at)"],
  ["possessive", "Possessive ’s"],
  ["plurals", "Plurals"],
  ["countable_uncountable", "Countable and uncountable"],
  ["pronouns", "Pronouns"],
  ["word_order", "Word order"],
  ["questions", "Questions"],
  ["comparatives", "Comparatives"],
  ["conditionals", "Conditionals (if…)"],
  ["modal_verbs", "Modal verbs"],
  ["gerund_infinitive", "-ing or to + verb"],
  ["missing_word", "Missing words"],
  ["extra_word", "Extra words"],
  ["spelling", "Spelling"],
  ["punctuation", "Punctuation"],
  ["sentence_structure", "Sentence structure"],
  ["collocation", "Word partners (collocations)"],
  ["word_choice", "Word choice"],
  ["crutch_word", "Crutch words"],
  ["other", "Other"],
] as const;

export type ErrorType = (typeof ERROR_TYPES)[number][0];

export const ERROR_TYPE_SLUGS: ErrorType[] = ERROR_TYPES.map(([slug]) => slug);

// Vocabulary notes use these; everything else is grammar.
export const VOCAB_TYPES: ErrorType[] = ["word_choice", "crutch_word", "collocation"];

export const MOODS = ["happy", "grateful", "calm", "stressed"] as const;
export type Mood = (typeof MOODS)[number];

export const PERSONAS = ["cheerleader", "professor", "friend"] as const;
export type Persona = (typeof PERSONAS)[number];
