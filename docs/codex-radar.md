# Codex Radar integration boundary

AI Ladder includes an independent, bilingual **Real-world Radar / 实战雷达** page at `#/codex-radar`.

## Current status: real public-page snapshot; no live synchronization

`public/data/codex-radar.json` now contains **9 source model labels / 40 effort configurations**, observed through normal public-browser navigation on **2026-09-30 from 12:26:59 to 12:28:52 UTC**. It covers Codex + DeepSWE cards in the GPT-6, GPT-5.6, GPT-5.5 and DeepSeek family tabs. It does not claim complete-site coverage: other harnesses, mural, the task matrix, contributor rankings and hidden cards are excluded. The family tabs were read sequentially, not at an atomic instant.

These are source-displayed measurements, not test fixtures. Each row retains its source text, source link, observation timestamp, original model label and effort. The displayed 112-task library did not expose a confirmed dataset revision; that is labeled unreported. Machine model IDs, raw pass rates and sample sizes remain null. Source fractions are preserved as opaque display text, not treated as sample counts or equal-task pass rates; rounded IQ is not inverted into a fabricated raw rate.

Of the 40 configurations, 38 receive local IQ ranks. Two DeepSeek V4.1 Flash configurations retain their observed IQ but are explicitly marked insufficient coverage and unranked: max 35/112 (31.3%), high 46/112 (41.1%). Four DeepSeek rows use **off-peak** API-equivalent prices; the other 36 use standard API-equivalent prices. Cost is the source's per-run median, not a subscription charge. Time is the source's mean of the latest three valid runs, rounded to minutes. No cross-price-band value ranking is calculated.

The documented API produced HTTP 403 in the research environment; live synchronization remains unavailable. The normal public-page observations are a distinct, manually captured data source. No API retry or network call was performed to import this supplied observation. An open-source client does not establish the dataset's reuse license; licensing and permitted automated reuse must be reviewed before deploying a sustainable crawler.

The official client documents task-cell data, but the current production response and model-level aggregation contract were not verified. Do not treat a task cell (`task_id|model|effort`, with fields such as `rate`, `total_n`, `st`, `min`, `cost`, `cost_by_band`) as a ranked model-level result. Do not assume per-cell counts are a board sample size.

### Next step

Obtain a supported, authorized model-level export or an upstream-documented accessible feed. Verify the benchmark, dataset/version, evaluation harness, identity, reasoning effort, aggregation and units against the original board. Normalize that export to the local contract below, then run the import command. The manual fetch/staging adapter below prepares for official API ingestion. Publishing model-level results or enabling scheduled synchronization still requires validating the real response; **live synchronization is not operational**. Do not circumvent HTTP 403 or extract undisclosed credentials.

## Manual official-API staging (not a live sync)

```sh
npm run fetch:codex-radar
```

This opt-in command makes one GET to the fixed official endpoint, without credentials,
endpoint overrides, redirects, retries, proxies, or browser-signature spoofing. Do not
run it repeatedly against the known 403; wait for supported upstream access. During
implementation only mocked requests were tested; no additional live request was made.
The 2026-09-30 12:00:05 UTC observation was HTTP 403 / Cloudflare 1010.

- A 15-second fetch/body deadline and 2 MiB response limit bound the request
- Valid nonempty JSON is atomically staged at `.cache/codex-radar/raw-response.json`,
  outside public assets and ignored by git. Its upstream schema remains unverified
- `.cache/codex-radar/status.json` records the latest attempt and an actionable state
- HTTP 403/1010, other HTTP errors, timeouts, malformed/empty JSON and oversized
  responses preserve the last staged response; no path writes the public snapshot
- Unknown JSON shapes, including task cells, are only staged for review. They are
  never interpreted as IQ, aggregated into rows, or passed to the importer
- Exit 2 means staged but still needs validation; exit 1 means fetch/staging failure.
  Neither means a successful public leaderboard refresh

No recurring job or workflow is enabled. Once the upstream contract is verified,
implement and test an explicit source-to-local mapping before considering automatic
publication. The reviewed import command below remains a separate deliberate step.

## Sources and metric separation

- Original board: https://deng.codexradar.com/
- Official API client: https://github.com/codex-radar/dradar/blob/main/src/dradar/api_client.py
- Source project: https://github.com/codex-radar/dradar

Codex Radar IQ is a task metric scaled to 150: DeepSWE uses mean pass rate; mural uses Macro-F1. This is not human IQ or the Artificial Analysis intelligence index. The page never merges Radar results into AA rankings or fuzzy-matches model identities. Rank is computed within one imported benchmark/dataset/harness scope only. Equal IQ values share competition rank; search does not alter ranks. Missing IQ stays unranked; numeric zero is valid.

## Normalized snapshot contract (AI Ladder schema, not upstream API schema)

Root fields:

- `schemaVersion`: `1` for the original normalized contract or `2` for a provenance-rich browser-observation snapshot
- `status`: `ready` or `unavailable`
- `sourceUrl`: HTTPS link on `deng.codexradar.com`
- `checkedAt`: timestamp with timezone, non-future, recording verification
- `capturedAt`: actual capture timestamp with timezone; cannot follow `checkedAt`; `null` for unavailable snapshots
- `boards`: scoped boards, empty when unavailable
- `reason`: required for unavailable snapshots

Each board requires `id`, `benchmark`, `datasetVersion`, `harness`, `methodology`, `aggregation`, `sourceUrl`, `metric` (`pass_rate` or `macro_f1`) and `rows`. Use distinct boards for distinct evaluation scopes. `methodology` and `aggregation` must explain the upstream model-level measurement rather than an invented aggregation.

Each row requires:

- `model`: original source display label, preserved verbatim; `upstreamId`: original machine identity or `null` in schema 2 when not provided (never invent an ID)
- `effort`: original reasoning-effort label, or `null`
- `iq`: original reported IQ, numeric 0–150 or `null`
- `score`: corresponding raw fractional metric, numeric 0–1 or `null`; if both metric and IQ exist, validation checks ×150 with 0.11 rounding tolerance
- `sampleSize`: upstream-reported nonnegative integer or `null`; never infer from task cells
- `costUsd`, `durationMinutes`: source-displayed per-configuration cost in USD and duration in minutes, or `null`; documented aggregation and cost basis must accompany comparisons
- `sourceUrl`: original HTTPS source link

Schema 2 additionally requires root `observation` with `method: "public_browser_manual"`, `partialCoverage: true`, `observedThrough`, `scope` and `exclusions`. `capturedAt` is the start of this observation window; `observedThrough` is its end. Each row requires `observedAt` within that window, `sourceText`, `displayCount`, `costBasis` (`standard_api_equivalent` or `deepseek_off_peak`), boolean `insufficientData`, and `taskCoverage` (null or source-observed `{covered, total, percent}`). No raw metric is derived from these fields. Insufficient-data rows retain their reported IQ but have no local rank.

No numeric strings, negative values, unsupported schemas, duplicate model configurations, unsafe links or future timestamps are accepted. Raw task-cell payloads fail closed. Nullable fields are required explicitly so absence cannot silently become zero. Validation verifies structure and numeric coherence, **not source authenticity**; human/source review is still necessary before import. Board IDs and configuration identity must remain distinct.

Import a reviewed, normalized export atomically:

```sh
node scripts/import-codex-radar.mjs /path/to/verified-normalized-snapshot.json
```

The script validates before replacing the local public file. It performs no network requests, uses no credentials, and has no test/demo data generation mode. The renderer marks captures older than seven days as stale; this is AI Ladder's local display policy, not an upstream freshness guarantee. Rechecking old data does not refresh its capture date.

## Tests and verification

```sh
node --test tests/codex-radar*.test.mjs
npm test
npm run build
```

The test suite uses explicitly synthetic in-memory fixtures for generic adapter checks and separately verifies the real production observation (9 labels, 40 configurations, all source evidence, 4 off-peak costs, 2 insufficient-coverage flags). Synthetic fixtures are never shipped as production results. It also covers missing/zero values, ties, strict validation, duplicate identities, stale captures, source-link safety, rejection of task cells, subpath loading, and unavailable/error responses.

Build and automated checks can run in the cloud workspace. Browser visual QA was blocked by `net::ERR_BLOCKED_BY_CLIENT` when the cloud browser opened the local Vite URL; no verified screenshot was produced. Review mobile/desktop rendering and Back/Forward navigation in an allowed preview before publication.

## Manual refresh: source observation → reviewed data PR

Manual capture/import is the supported refresh mechanism. The default workflow does not call the blocked API, scrape the website, create credentials, or automatically rewrite the dataset.

1. Use ordinary authorized public-page access to observe the intended benchmark, harness, dataset scope and configurations. Record the actual start/end and per-row observation timestamps, source text, pricing basis and coverage flags. Do not infer raw rates/sample sizes from IQ or source count fractions. Use a supported source export if one becomes available and verify its semantics first.
2. Prepare the normalized schema-2 JSON described above. Preserve raw source model labels; use null for unreported machine IDs. Review the source evidence, scope, omissions and reuse permission.
3. Start a fresh branch from current main, then validate and import locally:

   ```sh
   git switch -c codex/radar-refresh-YYYY-MM-DD
   npm ci
   python3 -m pip install -r api/requirements.txt
   npm run validate:codex-radar -- /path/to/reviewed-snapshot.json
   npm run import:codex-radar -- /path/to/reviewed-snapshot.json
   npm run validate:codex-radar
   npm test
   VITE_APP_BASE_PATH=/AI-ladder/ npm run build
   git diff -- public/data/codex-radar.json
   ```

4. Commit the reviewed data change, push the new branch, and open a draft PR. In the PR, state the capture interval, scope, model/configuration counts, insufficient-data rows, pricing bands and source. Do not refresh capture timestamps without a new observation. Keep PR review separate from merging/deploying.
5. The **AI Ladder CI → Validate data, test and build** job validates the committed snapshot, runs JavaScript/Python tests and builds the Pages subpath. It has only `contents: read`, needs no repository secrets, never invokes the API fetch script, never writes a branch, and never deploys. It runs on PRs (including drafts) and `codex/**` branch pushes; no default-branch merge is needed for that PR check.

For GitHub-only editing, use the repository's edit/upload UI to replace `public/data/codex-radar.json`, choose **a new branch and pull request**, and let PR CI validate it. Do not commit straight to main: the existing Pages deployment still triggers on main pushes. A green check verifies schema/tests/build, not that the operator collected the source correctly; reviewers must inspect provenance and the data diff.

The same read-only CI supports **Run workflow** for revalidating a selected committed branch. GitHub exposes `workflow_dispatch` only once the workflow exists on the default branch. Before that merge, use the new-branch/PR-triggered checks; do not claim the manual button was run. Dispatch validates an existing snapshot; it does not collect fresh results or import an uploaded JSON. No automatic merge or new deployment workflow is added.

Regression tests keep the initial 2026-09-30 observation as an archived fixture under `tests/fixtures/`; the current public snapshot has a separate structural validation. Future legitimate refreshes therefore need not retain the initial 9-model/40-configuration counts or old dates merely to pass tests.
