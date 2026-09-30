import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { stageRadarResponse, RADAR_API_URL } from '../scripts/fetch-codex-radar.mjs'

async function scenario(fn) {
  const stagingDir = await mkdtemp(join(tmpdir(), 'radar-fetch-test-'))
  const publicFile = new URL('../public/data/codex-radar.json', import.meta.url)
  const original = await readFile(publicFile, 'utf8')
  await writeFile(join(stagingDir, 'raw-response.json'), 'last good raw snapshot')
  try { await fn(stagingDir); assert.equal(await readFile(publicFile, 'utf8'), original) }
  finally { await rm(stagingDir, { recursive: true, force: true }) }
}
const json = body => new Response(body, { headers: { 'content-type': 'application/json' } })

test('403 / Cloudflare 1010 is actionable, makes one request, and preserves files', () => scenario(async stagingDir => {
  let calls = 0
  const status = await stageRadarResponse({ stagingDir, fetcher: async (url, options) => {
    calls++; assert.equal(url, RADAR_API_URL); assert.equal(options.redirect, 'error'); assert.equal(options.credentials, 'omit')
    assert.deepEqual(options.headers, { Accept: 'application/json' })
    return new Response('Cloudflare Error 1010: client signature', { status: 403 })
  } })
  assert.equal(calls, 1); assert.equal(status.state, 'access_blocked'); assert.match(status.message, /1010/)
  assert.equal(await readFile(join(stagingDir, 'raw-response.json'), 'utf8'), 'last good raw snapshot')
  assert.deepEqual(JSON.parse(await readFile(join(stagingDir, 'status.json'), 'utf8')), status)
}))
test('unknown task-cell schema stages privately and never publishes invented IQ', () => scenario(async stagingDir => {
  const payload = { cells: { 'task|model|effort': { rate: 1, total_n: 4 } } }
  const status = await stageRadarResponse({ stagingDir, fetcher: async () => json(JSON.stringify(payload)) })
  assert.equal(status.state, 'staged_needs_validation'); assert.equal(status.published, false)
  const raw = JSON.parse(await readFile(join(stagingDir, 'raw-response.json'), 'utf8'))
  assert.deepEqual(raw.payload, payload); assert.equal(raw.validation, 'unverified_upstream_schema')
}))
test('invalid, oversized, HTTP and network failures preserve the last staged data', () => scenario(async stagingDir => {
  for (const fetcher of [
    async () => json('{'), async () => json('{}'), async () => json('null'), async () => json('[]'),
    async () => new Response('<html>challenge</html>'),
    async () => json(JSON.stringify({ oversized: 'x'.repeat(200) })),
    async () => new Response('bad', { status: 503 }),
    async () => { throw new Error('network failed') },
  ]) {
    const status = await stageRadarResponse({ stagingDir, maxBytes: 100, fetcher })
    assert.notEqual(status.state, 'staged_needs_validation')
    assert.equal(await readFile(join(stagingDir, 'raw-response.json'), 'utf8'), 'last good raw snapshot')
  }
}))
test('timeout bounds a stalled request without changing last data', () => scenario(async stagingDir => {
  let signal
  const status = await stageRadarResponse({ stagingDir, timeoutMs: 10, fetcher: async (_url, options) => { signal = options.signal; return new Promise(() => {}) } })
  assert.equal(status.state, 'timeout'); assert.equal(signal.aborted, true)
  assert.equal(await readFile(join(stagingDir, 'raw-response.json'), 'utf8'), 'last good raw snapshot')
}))
test('body-stream timeout and declared content length are bounded', () => scenario(async stagingDir => {
  const stalled = new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{')) } }), { headers: { 'content-type': 'application/json' } })
  const status = await stageRadarResponse({ stagingDir, timeoutMs: 10, fetcher: async () => stalled })
  assert.equal(status.state, 'timeout')
  const oversized = await stageRadarResponse({ stagingDir, maxBytes: 100, fetcher: async () => new Response('{}', { headers: { 'content-type': 'application/json', 'content-length': '101' } }) })
  assert.equal(oversized.state, 'response_too_large')
  assert.equal(await readFile(join(stagingDir, 'raw-response.json'), 'utf8'), 'last good raw snapshot')
}))
