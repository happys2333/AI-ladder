# AI Ladder

[中文说明](./README.zh-CN.md)

AI model leaderboard and coding-plan explorer built with `Vue 3 + Vite`.

The project currently ships two views:

- `Leaderboard`: browse and compare model benchmark data from Artificial Analysis
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
npm run update:artificial-analysis
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
- Coding plans: `public/data/coding-plans.json`
- FX rates: `public/data/exchange-rates.json`

`src/services/leaderboardService.js` is the main normalization layer. It loads the JSON payloads, validates core fields, and attaches provider-level coding plans to matching models.

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
