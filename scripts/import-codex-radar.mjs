import { readFile, writeFile, rename, rm } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateRadarSnapshot } from '../src/services/codexRadarService.js'

const input = process.argv[2]
if (!input) throw new Error('Usage: node scripts/import-codex-radar.mjs <verified-normalized-snapshot.json>')
const snapshot = validateRadarSnapshot(JSON.parse(await readFile(input, 'utf8')))
const { stale, ...payload } = snapshot
const target = resolve(dirname(fileURLToPath(import.meta.url)), '../public/data/codex-radar.json')
const temporary = `${target}.${process.pid}.tmp`
try {
  await writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, { flag: 'wx' })
  await rename(temporary, target)
} finally { await rm(temporary, { force: true }) }
console.log(`Imported ${snapshot.boards.length} scoped boards; status=${snapshot.status}${stale ? ' (stale snapshot)' : ''}`)
