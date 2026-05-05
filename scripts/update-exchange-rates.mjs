import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ECB_DAILY_XML_URL = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml'
const OUTPUT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'public',
  'data',
  'exchange-rates.json',
)

function extractMatch(xml, pattern, label) {
  const match = xml.match(pattern)
  if (!match) {
    throw new Error(`Unable to extract ${label} from ECB XML feed`)
  }

  return match[1]
}

async function fetchEcbRates() {
  const response = await fetch(ECB_DAILY_XML_URL, {
    headers: {
      'user-agent': 'ai-ladder-exchange-rate-updater/1.0',
    },
  })

  if (!response.ok) {
    throw new Error(`ECB exchange rate request failed with status ${response.status}`)
  }

  const xml = await response.text()
  const date = extractMatch(xml, /<Cube time='([^']+)'/i, 'date')
  const usd = Number(extractMatch(xml, /currency='USD' rate='([^']+)'/i, 'USD rate'))
  const cny = Number(extractMatch(xml, /currency='CNY' rate='([^']+)'/i, 'CNY rate'))

  if (!Number.isFinite(usd) || !Number.isFinite(cny)) {
    throw new Error('ECB exchange rates are not numeric')
  }

  return {
    date,
    rates: {
      USD: usd,
      CNY: cny,
    },
    pairs: {
      USD_CNY: Number((cny / usd).toFixed(6)),
      CNY_USD: Number((usd / cny).toFixed(6)),
    },
  }
}

async function main() {
  const snapshot = await fetchEcbRates()
  const payload = {
    sourceName: 'European Central Bank',
    source: ECB_DAILY_XML_URL,
    base: 'EUR',
    ...snapshot,
    generatedAt: new Date().toISOString(),
  }

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true })
  await writeFile(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  console.log(`Saved exchange rates for ${payload.date} to ${OUTPUT_PATH}`)
  console.log(`USD/CNY=${payload.pairs.USD_CNY}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
