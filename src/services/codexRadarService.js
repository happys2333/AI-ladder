import { CODEX_RADAR_SNAPSHOT_PATH, CODEX_RADAR_STALE_AFTER_MS } from '../config/codexRadar.js'

const fail = (message) => { throw new Error(`Invalid Codex Radar snapshot: ${message}`) }
const text = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} is required`)
  return value
}
const sourceUrl = (value) => {
  let url
  try { url = new URL(value) } catch { fail('sourceUrl must be an HTTPS source link') }
  if (url.protocol !== 'https:' || url.hostname !== 'deng.codexradar.com' || url.username || url.password) fail('sourceUrl must point to deng.codexradar.com')
  return value
}
const nullableNumber = (value, label, max = Infinity, integer = false) => {
  if (value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max || (integer && !Number.isInteger(value))) fail(`${label} is invalid; use null for missing values`)
  return value
}
const timestamp = (value, label, now) => {
  if (typeof value !== 'string' || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value)) || Date.parse(value) > now) fail(`${label} must be a non-future timestamp with timezone`)
  return value
}

/** AI Ladder's import contract, NOT the undocumented production /table response. */
export function validateRadarSnapshot(input, now = Date.now()) {
  if (!input || ![1, 2].includes(input.schemaVersion) || !['unavailable', 'ready'].includes(input.status)) fail('unsupported schema or status')
  const checkedAt = timestamp(input.checkedAt, 'checkedAt', now)
  const source = sourceUrl(input.sourceUrl)
  if (!Array.isArray(input.boards)) fail('boards must be an array')
  if (input.status === 'unavailable') {
    if (input.boards.length || input.capturedAt !== null) fail('unavailable snapshots cannot contain results')
    return { schemaVersion: 1, status: 'unavailable', checkedAt, capturedAt: null, sourceUrl: source, reason: text(input.reason, 'reason'), boards: [], stale: false }
  }
  const capturedAt = timestamp(input.capturedAt, 'capturedAt', now)
  if (Date.parse(capturedAt) > Date.parse(checkedAt)) fail('capturedAt cannot follow checkedAt')
  let observation = null
  if (input.schemaVersion === 2) {
    const detail = input.observation
    if (!detail || detail.method !== 'public_browser_manual' || detail.partialCoverage !== true) fail('browser observation provenance is required')
    const observedThrough = timestamp(detail.observedThrough, 'observedThrough', now)
    if (Date.parse(observedThrough) < Date.parse(capturedAt) || Date.parse(observedThrough) > Date.parse(checkedAt)) fail('observation window is invalid')
    observation = { method: detail.method, partialCoverage: true, observedThrough, scope: text(detail.scope, 'observation.scope'), exclusions: text(detail.exclusions, 'observation.exclusions') }
  }
  const boardIds = new Set()
  const boards = input.boards.map((board) => {
    if (!board || typeof board !== 'object') fail('board must be an object')
    const id = text(board.id, 'board.id')
    if (boardIds.has(id)) fail('duplicate board identity')
    boardIds.add(id)
    const fields = Object.fromEntries(['benchmark', 'datasetVersion', 'harness', 'methodology', 'aggregation'].map((key) => [key, text(board[key], `board.${key}`)]))
    if (!['pass_rate', 'macro_f1'].includes(board.metric)) fail('unsupported metric')
    if (!Array.isArray(board.rows)) fail('board.rows must be an array')
    const identities = new Set()
    const rows = board.rows.map((row) => {
      if (!row || typeof row !== 'object') fail('row must be an object')
      const upstreamId = input.schemaVersion === 2 && row.upstreamId === null ? null : text(row.upstreamId, 'row.upstreamId')
      const model = text(row.model, 'row.model')
      const effort = row.effort === null ? null : text(row.effort, 'row.effort')
      const key = JSON.stringify([upstreamId, model, effort])
      if (identities.has(key)) fail('duplicate model configuration')
      identities.add(key)
      const score = nullableNumber(row.score, 'row.score', 1)
      const iq = nullableNumber(row.iq, 'row.iq', 150)
      if (score !== null && iq !== null && Math.abs(iq - score * 150) > 0.11) fail('IQ must match the documented metric × 150')
      let evidence = {}
      if (input.schemaVersion === 2) {
        if (!['standard_api_equivalent', 'deepseek_off_peak'].includes(row.costBasis)) fail('costBasis is required for observed costs')
        if (typeof row.insufficientData !== 'boolean') fail('insufficientData must be boolean')
        const observedAt = timestamp(row.observedAt, 'row.observedAt', now)
        if (Date.parse(observedAt) < Date.parse(capturedAt) || Date.parse(observedAt) > Date.parse(observation.observedThrough)) fail('row observation falls outside snapshot window')
        let taskCoverage = null
        if (row.taskCoverage !== null) {
          if (!row.taskCoverage || typeof row.taskCoverage !== 'object') fail('taskCoverage must be an object or null')
          const covered = nullableNumber(row.taskCoverage.covered, 'taskCoverage.covered', Infinity, true)
          const total = nullableNumber(row.taskCoverage.total, 'taskCoverage.total', Infinity, true)
          const percent = nullableNumber(row.taskCoverage.percent, 'taskCoverage.percent', 100)
          if (covered === null || total === null || percent === null || total === 0 || covered > total || Math.abs(covered / total * 100 - percent) > 0.11) fail('task coverage is inconsistent')
          taskCoverage = { covered, total, percent }
        }
        evidence = { observedAt, sourceText: text(row.sourceText, 'row.sourceText'), displayCount: text(row.displayCount, 'row.displayCount'), costBasis: row.costBasis, insufficientData: row.insufficientData, taskCoverage }
      }
      return { ...evidence, upstreamId, model, effort, score, iq, sampleSize: nullableNumber(row.sampleSize, 'row.sampleSize', Infinity, true), costUsd: nullableNumber(row.costUsd, 'row.costUsd'), durationMinutes: nullableNumber(row.durationMinutes, 'row.durationMinutes'), sourceUrl: sourceUrl(row.sourceUrl) }
    })
    return { id, ...fields, metric: board.metric, sourceUrl: sourceUrl(board.sourceUrl), rows }
  })
  return { schemaVersion: input.schemaVersion, observation, status: 'ready', checkedAt, capturedAt, sourceUrl: source, boards, stale: now - Date.parse(capturedAt) > CODEX_RADAR_STALE_AFTER_MS }
}

// Rank only inside a single explicitly scoped benchmark board. Missing scores stay unranked.
export function rankRadarRows(rows) {
  const sorted = [...rows].sort((a, b) => Number(Boolean(a.insufficientData)) - Number(Boolean(b.insufficientData)) || (b.iq ?? -Infinity) - (a.iq ?? -Infinity) || a.model.localeCompare(b.model) || (a.effort ?? '').localeCompare(b.effort ?? ''))
  let rank = null
  return sorted.map((row, index) => {
    if (!row.insufficientData && row.iq !== null && (index === 0 || row.iq !== sorted[index - 1].iq)) rank = index + 1
    return { ...row, rank: row.iq === null || row.insufficientData ? null : rank }
  })
}

export async function fetchRadarSnapshot({ fetcher = globalThis.fetch, baseUrl = import.meta.env?.BASE_URL ?? '/', now = Date.now(), signal } = {}) {
  const response = await fetcher(`${baseUrl.replace(/\/?$/, '/')}${CODEX_RADAR_SNAPSHOT_PATH}`, { signal })
  if (!response.ok) throw new Error(`Radar snapshot unavailable (${response.status})`)
  return validateRadarSnapshot(await response.json(), now)
}
