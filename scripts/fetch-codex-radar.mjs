import { mkdir, writeFile, rename, rm } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

export const RADAR_API_URL = 'https://api.codexradar.com/api/v1/table'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_STAGING = resolve(root, '.cache/codex-radar')

class FetchFailure extends Error {
  constructor(code, message) { super(message); this.code = code }
}
async function atomicJson(path, data) {
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
    await rename(temporary, path)
  } finally { await rm(temporary, { force: true }) }
}
async function boundedText(response, maxBytes, signal) {
  if (Number(response.headers.get('content-length')) > maxBytes) {
    await response.body?.cancel()
    throw new FetchFailure('response_too_large', `Response exceeds ${maxBytes} bytes.`)
  }
  if (!response.body) throw new FetchFailure('invalid_response', 'Response body is empty.')
  const reader = response.body.getReader()
  const cancel = () => { void reader.cancel().catch(() => {}) }
  signal?.addEventListener('abort', cancel, { once: true })
  const chunks = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > maxBytes) throw new FetchFailure('response_too_large', `Response exceeds ${maxBytes} bytes.`)
      chunks.push(Buffer.from(value))
    }
    return Buffer.concat(chunks).toString('utf8')
  } finally { signal?.removeEventListener('abort', cancel); await reader.cancel().catch(() => {}); reader.releaseLock() }
}

// Deliberately stages upstream JSON only. No upstream-to-IQ mapping is verified.
// Never writes public/data/codex-radar.json or invokes the reviewed importer.
export async function stageRadarResponse({ fetcher = globalThis.fetch, stagingDir = DEFAULT_STAGING, timeoutMs = 15000, maxBytes = 2 * 1024 * 1024 } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || !Number.isInteger(maxBytes) || maxBytes < 1) throw new Error('Invalid fetch bounds')
  await mkdir(stagingDir, { recursive: true })
  const controller = new AbortController()
  let timer
  let httpStatus = null
  const status = { checkedAt: new Date().toISOString(), endpoint: RADAR_API_URL, published: false }
  try {
    const operation = async () => {
      const response = await fetcher(RADAR_API_URL, { method: 'GET', headers: { Accept: 'application/json' }, credentials: 'omit', redirect: 'error', signal: controller.signal })
      httpStatus = response.status
      if (response.status === 403) {
        // Do not log/store the error body, challenge HTML, or upstream headers.
        let body = ''
        try { body = await boundedText(response, 8192, controller.signal) } catch { /* 403 stays blocked even if its body is oversized. */ }
        throw new FetchFailure('access_blocked', /\b1010\b/.test(body)
          ? 'HTTP 403 / Cloudflare 1010: client access blocked. Stop; do not retry or bypass. Await supported upstream access.'
          : 'HTTP 403: access blocked. Stop; do not retry or bypass. Await supported upstream access.')
      }
      if (!response.ok) {
        await response.body?.cancel()
        throw new FetchFailure('http_error', `HTTP ${response.status}; last staged and published data preserved.`)
      }
      const contentType = response.headers.get('content-type') || ''
      if (!/^application\/(?:[\w.-]+\+)?json(?:\s*;|$)/i.test(contentType)) {
        await response.body?.cancel()
        throw new FetchFailure('invalid_response', 'Expected a JSON content type; last staged data preserved.')
      }
      const text = await boundedText(response, maxBytes, controller.signal)
      let payload
      try { payload = JSON.parse(text) } catch { throw new FetchFailure('invalid_response', 'Malformed JSON; last staged data preserved.') }
      if (payload === null || typeof payload !== 'object' || Object.keys(payload).length === 0) throw new FetchFailure('invalid_response', 'Empty or scalar JSON; last staged data preserved.')
      return payload
    }
    const payload = await Promise.race([
      operation(),
      new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new FetchFailure('timeout', `Request exceeded ${timeoutMs} ms; last staged data preserved.`)) }, timeoutMs) }),
    ])
    clearTimeout(timer)
    await atomicJson(resolve(stagingDir, 'raw-response.json'), { endpoint: RADAR_API_URL, fetchedAt: new Date().toISOString(), validation: 'unverified_upstream_schema', payload })
    Object.assign(status, { state: 'staged_needs_validation', httpStatus, message: 'Raw JSON staged privately. Live model-level sync is not operational: verify upstream schema, scope, units and aggregation before using the separate reviewed importer.' })
  } catch (error) {
    Object.assign(status, { state: error instanceof FetchFailure ? error.code : 'fetch_or_storage_error', httpStatus, message: error instanceof FetchFailure ? error.message : 'Network or staging storage failure; no public data was changed. Check connectivity and local file permissions.' })
  } finally { clearTimeout(timer); controller.abort() }
  await atomicJson(resolve(stagingDir, 'status.json'), status)
  return status
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 2) throw new Error('Usage: node scripts/fetch-codex-radar.mjs (no endpoint or credential overrides)')
  const status = await stageRadarResponse()
  console.log(JSON.stringify(status, null, 2))
  // Staged JSON is not a successful leaderboard refresh.
  process.exitCode = status.state === 'staged_needs_validation' ? 2 : 1
}
