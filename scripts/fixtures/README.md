# OCR bake-off fixtures

Real journal pages used by `npm run bakeoff`. Everything in `pages/` is git-ignored, because these are private diary entries.

## What to put in `pages/`

For each entry (aim for 10–15, in your normal handwriting, under normal lighting):

| File | Contents |
|---|---|
| `day-01.jpg` | Photo of the page. For a two-page entry, use `day-01.1.jpg` and `day-01.2.jpg`. Accepts jpg, png, webp, heic (convert HEIC to JPEG for OpenRouter models, see below). |
| `day-01.txt` | Exactly what you wrote, typed by hand, **mistakes included**. Skip crossed-out words. Line breaks don't matter. |
| `day-01.mistakes.txt` | Optional, but this is how silent corrections get caught. One phrase per line containing a mistake you made, as you wrote it, e.g. `I eat rajma` or `grandmother food`. The run fails if the model "fixes" any of them. |

Mix in a few hard cases: a rushed page, a slightly skewed photo, a page with crossings-out, a two-page entry.

## Match the app's image size

The app will send photos resized to 2048 px on the long edge as JPEG. To test under the same conditions on macOS (this also converts iPhone HEIC photos, which OpenRouter models may not accept):

```sh
cd scripts/fixtures/pages
for f in *.HEIC *.heic *.jpg; do [ -e "$f" ] && sips -Z 2048 -s format jpeg "$f" --out "${f%.*}.jpg"; done
```

## Run

```sh
cp .env.example .env   # add GEMINI_API_KEY and/or OPENROUTER_API_KEY
npm run bakeoff
npm run bakeoff -- --models gemini-3.8-flash,anthropic/claude-sonnet-5.5 --only day-03
```

Default models depend on which keys are set:

| Keys | Models compared |
|---|---|
| Gemini only | `gemini-4-argon`, `gemini-3.8-flash` |
| OpenRouter only | `google/gemini-4-argon`, `google/gemini-3.8-flash`, `anthropic/claude-sonnet-5.5`, `openai/gpt-6.1-sol` |
| Both | `gemini-4-argon`, `gemini-3.8-flash` (direct), `anthropic/claude-sonnet-5.5`, `openai/gpt-6.1-sol` |

Any id with a slash is sent through OpenRouter; see [openrouter.ai/models](https://openrouter.ai/models) for others (pick one that supports image input and structured outputs).

Raw model outputs go to `scripts/out/<model>/` (git-ignored), so you can diff what each model actually read.
