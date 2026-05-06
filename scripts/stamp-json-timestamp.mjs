import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const targetPath = process.argv[2]

if (!targetPath) {
  console.error('Usage: node scripts/stamp-json-timestamp.mjs <json-file>')
  process.exit(1)
}

const absolutePath = path.resolve(process.cwd(), targetPath)
const nextTimestamp = new Date().toISOString()

async function main() {
  const raw = await readFile(absolutePath, 'utf8')
  const payload = JSON.parse(raw)

  payload.lastUpdated = nextTimestamp
  payload.generatedAt = nextTimestamp

  await writeFile(absolutePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`Updated timestamps for ${targetPath}: ${nextTimestamp}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
