import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { validateRadarSnapshot, rankRadarRows, fetchRadarSnapshot } from '../src/services/codexRadarService.js'
const now = Date.parse('2026-09-30T12:40:00Z')
// Synthetic fixtures only. These are not upstream measurements.
function fixture() { return { schemaVersion: 1, status: 'ready', sourceUrl: 'https://deng.codexradar.com/', checkedAt: '2026-09-30T11:00:00Z', capturedAt: '2026-09-29T11:00:00Z', boards: [{ id: 'fixture-board', benchmark: 'Fixture benchmark', datasetVersion: 'fixture-v1', harness: 'Fixture harness', metric: 'pass_rate', methodology: 'Synthetic pass rate × 150', aggregation: 'Synthetic model-level sample aggregate', sourceUrl: 'https://deng.codexradar.com/', rows: [{ upstreamId: 'fixture-only', model: 'Fixture model', effort: 'high', score: 0.8, iq: 120, sampleSize: null, costUsd: null, durationMinutes: null, sourceUrl: 'https://deng.codexradar.com/' }] }] } }
test('validates scoped snapshot and preserves nullable fields', () => { const data = validateRadarSnapshot(fixture(), now); assert.equal(data.boards[0].rows[0].sampleSize, null); assert.equal(data.stale, false) })
test('stale uses capture time rather than access check time', () => { const data = fixture(); data.capturedAt = '2026-09-01T11:00:00Z'; assert.equal(validateRadarSnapshot(data, now).stale, true) })
test('rejects malformed or future timestamps and unsafe source URLs', () => { for (const date of ['not-date', '2026-09-30T11:00:00', '2099-01-01T00:00:00Z']) { const data = fixture(); data.capturedAt = date; assert.throws(() => validateRadarSnapshot(data, now)) } const data = fixture(); data.boards[0].rows[0].sourceUrl = 'javascript:alert(1)'; assert.throws(() => validateRadarSnapshot(data, now)) })
test('rejects fabricated coercions, invalid scores and inferred sample counts', () => { for (const [key, value] of [['iq', '120'], ['iq', 151], ['score', 1.5], ['sampleSize', 1.5], ['costUsd', -1], ['durationMinutes', Infinity], ['sampleSize', undefined], ['iq', 80]]) { const data = fixture(); data.boards[0].rows[0][key] = value; assert.throws(() => validateRadarSnapshot(data, now), `${key}=${value}`) } })
test('distinct effort configurations survive but duplicate identities fail', () => { const data = fixture(); data.boards[0].rows.push({ ...data.boards[0].rows[0], effort: 'low' }); assert.equal(validateRadarSnapshot(data, now).boards[0].rows.length, 2); data.boards[0].rows.push({ ...data.boards[0].rows[0] }); assert.throws(() => validateRadarSnapshot(data, now)) })
test('rejects raw task-cell payloads instead of treating them as aggregate models', () => { assert.throws(() => validateRadarSnapshot({ cells: { 'task|model|effort': { rate: 1, total_n: 4 } } }, now)) })
test('ranking keeps zero, missing and ties distinct without mutating source', () => { const rows = [{ model: 'Missing', iq: null }, { model: 'Zero', iq: 0 }, { model: 'B', iq: 120 }, { model: 'A', iq: 120 }]; const result = rankRadarRows(rows); assert.deepEqual(result.map(r => [r.model, r.rank]), [['A', 1], ['B', 1], ['Zero', 3], ['Missing', null]]); assert.equal(rows[0].model, 'Missing') })
const observedSnapshot = async () => JSON.parse(await readFile(new URL('./fixtures/codex-radar-observed-2026-09-30.json', import.meta.url), 'utf8'))
test('archived observation fixture preserves real observed scope and raw evidence without inventing counts or rates', async () => {
  const data = validateRadarSnapshot(await observedSnapshot(), now)
  assert.equal(data.status, 'ready'); assert.equal(data.schemaVersion, 2)
  assert.equal(data.observation.method, 'public_browser_manual'); assert.equal(data.observation.partialCoverage, true)
  assert.equal(data.capturedAt, '2026-09-30T12:26:59Z'); assert.equal(data.observation.observedThrough, '2026-09-30T12:28:52Z')
  assert.equal(data.boards.length, 1); const board = data.boards[0]
  assert.equal(board.harness, 'Codex'); assert.equal(board.benchmark, 'DeepSWE')
  assert.equal(board.rows.length, 40); assert.equal(new Set(board.rows.map(row => row.model)).size, 9)
  for (const row of board.rows) { assert.equal(row.score, null); assert.equal(row.sampleSize, null); assert.equal(row.upstreamId, null); assert.ok(row.sourceText); assert.ok(row.observedAt); assert.match(row.displayCount, /^\d+\/\d+$/) }
  assert.equal(board.rows[0].iq, 110); assert.equal(board.rows[0].displayCount, '144/196')
})
test('observed off-peak prices and insufficient coverage remain explicit; flagged rows do not rank', async () => {
  const data = validateRadarSnapshot(await observedSnapshot(), now); const rows = data.boards[0].rows
  assert.equal(rows.filter(row => row.costBasis === 'deepseek_off_peak').length, 4)
  assert.equal(rows.filter(row => row.costBasis === 'standard_api_equivalent').length, 36)
  const flagged = rows.filter(row => row.insufficientData); assert.equal(flagged.length, 2)
  assert.deepEqual(flagged.map(row => row.taskCoverage), [{ covered: 35, total: 112, percent: 31.3 }, { covered: 46, total: 112, percent: 41.1 }])
  const ranked = rankRadarRows(rows); assert.equal(ranked.filter(row => row.rank !== null).length, 38)
  assert.ok(ranked.filter(row => row.insufficientData).every(row => row.rank === null && row.iq > 0))
})
test('observed snapshot rejects missing price basis, false coverage and out-of-window evidence', async () => {
  for (const mutate of [data => { delete data.boards[0].rows[0].costBasis }, data => { data.boards[0].rows[0].observedAt = '2026-09-30T12:29:00Z' }, data => { data.boards[0].rows[0].taskCoverage = { covered: 80, total: 112, percent: 100 } }, data => { data.observation.partialCoverage = false }, data => { data.boards[0].rows[0].insufficientData = 'false' }]) { const data = await observedSnapshot(); mutate(data); assert.throws(() => validateRadarSnapshot(data, now)) }
})
test('unavailable snapshots stay empty and cannot smuggle results', () => {
 const data = { schemaVersion: 1, status: 'unavailable', sourceUrl: 'https://deng.codexradar.com/', checkedAt: '2026-09-30T11:00:00Z', capturedAt: null, reason: 'Access unavailable', boards: [] }
 assert.deepEqual(validateRadarSnapshot(data, now).boards, []); data.boards = fixture().boards; assert.throws(() => validateRadarSnapshot(data, now))
})
test('fetch respects deployed subpath and fails closed', async () => { let path; await fetchRadarSnapshot({ baseUrl: '/AI-ladder/', now, fetcher: async url => { path = url; return { ok: true, json: async () => fixture() } } }); assert.equal(path, '/AI-ladder/data/codex-radar.json'); await assert.rejects(fetchRadarSnapshot({ fetcher: async () => ({ ok: false, status: 404 }) }), /404/); await assert.rejects(fetchRadarSnapshot({ fetcher: async () => ({ ok: true, json: async () => ({}) }) }), /Invalid/) })

test('current public snapshot validates without freezing future refresh counts or dates', async () => { const data = JSON.parse(await readFile(new URL('../public/data/codex-radar.json', import.meta.url), 'utf8')); assert.ok(validateRadarSnapshot(data).status) })
