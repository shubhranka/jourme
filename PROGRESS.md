# Jourme: progress

Last updated 2026-11-08. Update this file at the end of each work session.

Jourme is a handwritten journal and AI English tutor: write on paper, scan it, get coaching. The approved build plan is [docs/plan.md](docs/plan.md). The original spec calls the app "InkCoach"; it is now **Jourme** everywhere.

## Status

| Phase | State |
|---|---|
| 0. Setup and OCR test | Done, except running the OCR test. That needs API keys and real notebook photos from the user. |
| 1. Design system and the 6 screens on mock data | **Done.** Checked in the browser only; never run on iOS or Android. |
| 2. Auth, onboarding, profile | **Next** |
| 3–7 | Not started |

Nothing has been committed yet. The first commit covers Phases 0 and 1.

## Decisions already made (don't re-ask)

- **Scope ("core")**: the 6 designed screens: Today, Scan, Coach feedback, Progress, Journal, You & Coach. Hide the Sunday review, Listen / Read it back, Monthly Wrapped and the Today bell icon until they're built.
- **Stack**: React Native + Expo SDK 58 (Expo Router, TypeScript), Supabase, and AI via the **Gemini API or OpenRouter**. AI is only ever called from a Supabase Edge Function, never from the app.
- **AI provider routing**: a model id with a slash (`anthropic/claude-sonnet-5.5`) goes to OpenRouter; anything else (`gemini-3.8-flash`) goes to Gemini. The model will be one `AI_MODEL` secret, picked after the OCR test.
- **Light theme only**, as designed.

## What exists

```
Jourme — App Design.html   the design (6 screens; open in a browser)
docs/plan.md               approved plan: architecture, data model, AI call, phases, verification
scripts/ocr-bakeoff.ts     Phase 0 OCR test: word error rate + "silently fixed the writer's mistake" check
scripts/lib/wer.ts         word-error-rate maths (+ tests)
scripts/fixtures/          README with the photo format; pages/ is git-ignored (private diary)
supabase/config.toml       `supabase init`, project id `jourme`; no migrations yet
supabase/functions/_shared/ai/        provider-neutral generateJson(): core, gemini, openrouter, index (+ tests)
supabase/functions/_shared/transcription.ts   verbatim-transcription rules + JSON schema
mobile/                    Expo app
  src/app/                 routes: (tabs)/index|progress|journal|you, scan (full-screen modal), entry/[id]
  src/theme/               tokens.ts (colours/fonts/radii from the design), moods.ts
  src/components/          Text, Icon, Card, tags, buttons, Screen, TabBar, CorrectedText
  src/data/                types.ts (domain shapes), mock.ts (design copy), personas.ts
  src/lib/                 dates.ts, text.ts
```

## Commands

```sh
# repo root
npm test                 # node:test: WER maths + AI schema adapters (9 tests)
npm run typecheck
npm run bakeoff          # OCR test; needs .env keys + photos (see scripts/fixtures/README.md)

# mobile/
npx expo start           # press w for the browser, or scan the QR code with Expo Go
npm run typecheck        # also checks every route link (typed routes)
npm run lint
npx expo-doctor          # dependency versions vs SDK 58 (20/20 at last check)
npx expo install <pkg>   # always install this way, never npm install
```

## Gotchas (learned the hard way)

- **Expo SDK 58 changed things.** Follow [mobile/AGENTS.md](mobile/AGENTS.md): check the versioned docs, don't go from memory.
  - Routes are in `mobile/src/app/`.
  - The custom tab bar receives `navigateToTab` and `emitter`, not React Navigation's `navigation`. Import `Tabs` and `BottomTabBarProps` from `expo-router/tabs`.
- **Fonts**: each weight is its own family (`fonts.bold`, `fonts.semibold`… in `tokens.ts`). Set `fontFamily`, not `fontWeight`; Android ignores `fontWeight` on custom fonts.
- **Nested text**: inside a `Text`, use react-native's `Text` for inline spans. The app's `Text` wrapper resets the font, which breaks the Caveat handwriting.
- **Accessibility state**: React Native Web ignores `accessibilityState`. Use `aria-checked`, `aria-selected` and `aria-disabled` props instead; they work on every platform.
- **Lint**: `npx expo lint` wrongly rejects ESLint 9, so `npm run lint` runs `eslint src` directly.
- **Correction offsets**: mock corrections are built with the `at()` helper in `mock.ts`, so they can't drift from the transcript text.
- **OpenRouter**:
  - Requests set `data_collection: "deny"` (private diary pages) and `require_parameters: true`.
  - **Never send `temperature`.** Most current models reject it, and with `require_parameters` the request then finds no provider at all.
  - Strict schemas need every property listed in `required`.
- **Gemini models**: current stable ones are `gemini-4-argon` and `gemini-3.8-flash`; the 2.5 series is closed to new users. Use a billing-enabled key, because the free tier may use submitted content for training.
- **No Xcode or Android tooling** is installed on this machine. The screens were checked on Expo's web target with headless Chrome at 390×844. Dotted underlines (word upgrades) render solid on Android.
- **Dev server in CI mode**: `CI=1 npx expo start` doesn't reload on edits; restart it after changing code.

## Phase 1: where the screens differ from the design (on purpose)

- Feedback metrics are computed from the transcript: 32 words and an 8.0-word average for the sample page, where the design's placeholders say 41 and 10.3.
- Scan: Done is disabled until a page is captured; the header reads "Page N" with no "of 2"; the drawn page stands in for the camera until Phase 3.
- Journal: the next-month arrow is disabled on the current month. Search is only a text box until Phase 5.
- You & Coach: persona and toggle changes are local state; the setting rows don't open pickers yet (Phase 2).

## Next steps (Phase 2, see docs/plan.md)

1. Run local Supabase (`npx supabase start`; Docker is installed). No hosted project is needed until deploy.
2. Add `@supabase/supabase-js` with session storage per Supabase's Expo guide, plus email OTP sign-in.
3. Migration: `profiles` table with RLS (`user_id = auth.uid()`).
4. Build the sign-in and onboarding screens (not in the design). Collect name, native language, learning goal, persona and nudge time; capture the timezone with `expo-localization`.
5. Wire **You & Coach** to the profile: the persona radio, pickers for nudge time, language and goal, the Just Listen toggle, and stats.
6. Add a QueryClient and an auth gate in `src/app/_layout.tsx`.

## Waiting on the user

- **OCR test inputs**: `GEMINI_API_KEY` and/or `OPENROUTER_API_KEY` in `.env`, plus 10–15 notebook photos with typed transcripts in `scripts/fixtures/pages/`.
- **Bundle id prefix**: `com.<you>.jourme`.
- **Later**: a hosted Supabase project, an Apple Developer account (iOS device builds and push), and an Expo/EAS account.
- **Design gaps to send the designer**: see "Design gaps" in docs/plan.md, e.g. sign-in/onboarding, processing and error states, empty states.

## Cleanup candidates

Template dependencies the app doesn't use yet: `@expo/ui`, `expo-symbols`, `expo-glass-effect`, `expo-image`, `expo-web-browser`, `expo-device`. Keep `expo-device` (push notifications, Phase 6) and possibly `expo-image` (page thumbnails) and `expo-web-browser` (OAuth); the rest can go.
