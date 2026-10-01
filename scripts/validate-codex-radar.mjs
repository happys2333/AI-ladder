import { readFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateRadarSnapshot, rankRadarRows } from '../src/services/codexRadarService.js'

const input = process.argv[2] ?? resolve(dirname(fileURLToPath(import.meta.url)), '../public/data/codex-radar.json')
const snapshot = validateRadarSnapshot(JSON.parse(await readFile(input, 'utf8')))
const rows = snapshot.boards.flatMap(board => rankRadarRows(board.rows))
console.log(JSON.stringify({
  status: snapshot.status,
  capturedAt: snapshot.capturedAt,
  observedThrough: snapshot.observation?.observedThrough ?? null,
  boards: snapshot.boards.length,
  modelLabels: new Set(rows.map(row => row.model)).size,
  configurations: rows.length,
  rankedConfigurations: rows.filter(row => row.rank !== null).length,
  insufficientDataConfigurations: rows.filter(row => row.insufficientData).length,
  offPeakPriceConfigurations: rows.filter(row => row.costBasis === 'deepseek_off_peak').length,
  stale: snapshot.stale,
  automaticSynchronization: false,
}, null, 2))
