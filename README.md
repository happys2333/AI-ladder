# AI Ladder

[中文说明](./README.zh-CN.md)

AI model leaderboard and coding-plan explorer built with `Vue 3 + Vite`.

The project currently ships two views:

- `Leaderboard`: browse and compare model benchmark data merged from Artificial Analysis and LLM Stats
- `Coding Plans`: browse manually curated official coding subscriptions from major providers

## Features

- Multi-category leaderboard sorting
- Search by model, vendor, and tag
- Compare up to 3 models
- Model detail drawer with benchmark and pricing metadata
- Official coding-plan browser with bilingual fields
- USD/CNY reference exchange rate display

## Tech Stack

- Vue 3
- Vite
- Plain CSS
- Python scripts for leaderboard ingestion
- Node script for exchange-rate updates

## Getting Started

Install dependencies:

```bash
npm install
```

Start dev server:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

## Data Updates

Refresh Artificial Analysis data:

```bash
ARTIFICIAL_ANALYSIS_API_KEY=your_aa_key LLM_STATS_KEY=your_llm_stats_key npm run update:artificial-analysis
```

Refresh exchange rates:

```bash
npm run update:exchange-rates
```

Manual coding-plan data lives in:

```text
public/data/coding-plans.json
```

## Project Structure

```text
.
├── api/                         # Python ingestion scripts
├── public/data/                 # Runtime JSON payloads
├── scripts/                     # Local data update scripts
├── src/
│   ├── components/              # Shared UI components
│   ├── composables/             # View state and i18n
│   ├── layout/                  # App shell
│   ├── pages/                   # Route-level pages
│   ├── sections/                # Page sections
│   └── services/                # Data loading / normalization
├── .github/workflows/           # Scheduled data refresh workflows
├── package.json
└── vite.config.js
```

## Data Sources

- Leaderboard: `public/data/artificial-analysis-llms.json`
  - ranking, price, latency: Artificial Analysis
  - release date, open-weight, catalog metadata: LLM Stats `/v1/models`
  - benchmark score matrix: LLM Stats `/v1/scores`
- Coding plans: `public/data/coding-plans.json`
- FX rates: `public/data/exchange-rates.json`

`src/services/leaderboardService.js` is the main normalization layer. It loads the JSON payloads, validates core fields, and attaches provider-level coding plans to matching models.

The leaderboard ingestion script expects two API keys:

- `ARTIFICIAL_ANALYSIS_API_KEY`
- `LLM_STATS_KEY`

In GitHub Actions, configure these as repository secrets:

- `ARTIFICIAL_ANALYSIS_API_KEY`
- `LLM_STATS_KEY`

The generated leaderboard payload keeps benchmark details under each model at:

```text
meta.benchmarks.llmStats
```

Each benchmark entry stores the raw score, normalized score, verification flag, and scoring timestamp. If you want to ingest only verified benchmark records, run the updater with:

```bash
LLM_STATS_VERIFIED_ONLY=true npm run update:artificial-analysis
```

## Localization

UI copy supports:

- `zh-CN`
- `en-US`

User-facing fields in `coding-plans.json` can be either plain strings or localized objects:

```json
{
  "zh-CN": "¥49 / 月",
  "en-US": "¥49 / month"
}
```

## Maintenance Notes

- `Coding Plans` should only include officially verifiable subscription or seat-based plans.
- Prefer short user-facing quota copy over long provenance notes.
- Keep pricing, limits, and notes bilingual when they are shown in the UI.
- After editing data files, validate with:

```bash
jq . public/data/coding-plans.json >/dev/null
npm run build
```

## Artificial Analysis V2 migration

The updater defaults to `/api/v2/language/models/free`, which accepts existing Free,
Pro, and Commercial keys. The retired `/api/v2/data/*` route is no longer used.
It fetches every page before applying the local model limit, validates pagination,
and atomically replaces the snapshot only after successful ingestion. Invalid,
empty, partial, or unmeasured responses fail without replacing the last good file.

Free responses do not contain GPQA or blended prices. Missing measurements stay
`null` and appear as `N/A`; unavailable ranking categories are omitted rather than
calculated from unrelated fields. Input/output prices remain available in details.
No blended price is inferred. Existing legacy-shaped model fixtures remain readable.
New nested performance fields, `gpqa_diamond`, release dates, and creator-name
aliases are normalized into the existing frontend schema.

To explicitly use a Pro/Commercial subscription's full model endpoint, configure:

```bash
ARTIFICIAL_ANALYSIS_API_URL=https://artificialanalysis.ai/api/v2/language/models
ARTIFICIAL_ANALYSIS_PROMPT_TYPE=long
```

These can also be GitHub repository variables. `ARTIFICIAL_ANALYSIS_PROMPT_LENGTH`
and `ARTIFICIAL_ANALYSIS_PARALLEL_QUERIES` have been replaced by `PROMPT_TYPE`.
Supported presets: `medium`, `long`, `100k`, `vision_single_image`, `medium_coding`,
`medium_parallel`. Free requests send only `page`; no performance preset is claimed
for Free snapshots. Source tier and Intelligence Index version are retained in stats.
Authentication/permission errors are not retried; transient failures use bounded
backoff. A daily-quota Retry-After longer than 120 seconds fails safely for the next
scheduled refresh instead of tying up CI.

Run offline fixture tests (Python requires `requests` from `api/requirements.txt`):

```bash
npm test
npm run build
```

Reference: [Artificial Analysis API documentation](https://artificialanalysis.ai/data-api/docs).

## Manual Codex Radar refresh

The independent `#/codex-radar` view uses a dated, source-backed public-page snapshot.
To refresh: capture and review source evidence, run `npm run import:codex-radar -- snapshot.json`,
then `npm run validate:codex-radar`, tests and build. Submit the data change on a new branch
and draft PR; **AI Ladder CI** validates without fetching upstream data or deploying.
See [the manual refresh guide](docs/codex-radar.md#manual-refresh-source-observation--reviewed-data-pr)
for schema, provenance, GitHub UI steps and the default-branch limitation of Run workflow.
