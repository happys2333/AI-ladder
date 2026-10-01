import { isFiniteMetric } from '../utils/metrics.js'

const BASE_URL = import.meta.env?.BASE_URL || '/'

function withBase(path) {
  const normalizedBase = BASE_URL.endsWith('/') ? BASE_URL : `${BASE_URL}/`
  return new URL(path.replace(/^\/+/, ''), `https://placeholder${normalizedBase}`).pathname
}

const GENERATED_LEADERBOARD_PATH = withBase('data/artificial-analysis-llms.json')
const CODING_PLANS_PATH = withBase('data/coding-plans.json')
const EXCHANGE_RATES_PATH = withBase('data/exchange-rates.json')

function sanitizeExternalUrl(value) {
  if (typeof value !== 'string') return ''

  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) ? url.toString() : ''
  } catch {
    return ''
  }
}

function validateAndNormalizeData(rawPayload) {
  const payload = rawPayload && typeof rawPayload === 'object' ? rawPayload : {}
  const normalizedCategories = Array.isArray(payload.categories)
    ? payload.categories.filter(category => category && typeof category === 'object').map(category => ({
      ...category,
      key: category.key || 'overall',
      label: category.label || 'Overall',
    }))
    : []
  const categoryKeys = normalizedCategories.map(category => category.key)

  // Apply normalized values last so malformed input cannot overwrite them.
  return {
    ...payload,
    categories: normalizedCategories,
    regions: Array.isArray(payload.regions)
      ? payload.regions.filter(region => region && typeof region === 'object').map(region => ({
        ...region,
        key: region.key || 'global',
        label: region.label || 'Global',
      }))
      : [],
    models: Array.isArray(payload.models)
      ? payload.models.filter(model => model && typeof model === 'object').map((model, index) => ({
        ...model,
        id: model.id || model.slug || `model-${index}`,
        name: model.name || model.slug || 'Unknown Model',
        region: model.region || 'global',
        vendor: model.vendor || 'Unknown',
        summary: model.summary || '',
        tags: Array.isArray(model.tags) ? model.tags : [],
        pricing: model.pricing || 'N/A',
        latency: model.latency || 'N/A',
        scores: validateScores(model.scores, categoryKeys),
        openness: model.openness || 'other',
        codingPlans: Array.isArray(model.codingPlans) ? model.codingPlans : [],
      }))
      : [],
    lastUpdated: payload.generatedAt || payload.lastUpdated || '',
    source: payload.source || null,
    stats: payload.stats || {},
  }
}

function normalizeCodingPlans(payload) {
  const providers = Array.isArray(payload?.providers) ? payload.providers : []
  return providers.map((provider) => ({
    providerSlug: provider.providerSlug || '',
    providerName: provider.providerName || '',
    productName: provider.productName || '',
    summary: provider.summary || '',
    source: sanitizeExternalUrl(provider.source),
    notes: provider.notes || '',
    plans: Array.isArray(provider.plans)
      ? provider.plans.map((plan) => ({
        name: plan.name || '',
        price: plan.price || '',
        cadence: plan.cadence || '',
        seats: plan.seats || '',
        audience: plan.audience || '',
        limits: plan.limits || '',
        access: plan.access || '',
        notes: plan.notes || '',
      }))
      : [],
  }))
}

function attachCodingPlans(payload, codingPlansPayload) {
  const providers = normalizeCodingPlans(codingPlansPayload)
  if (!providers.length) return payload

  const providerMap = new Map(
    providers
      .filter(provider => provider.providerSlug)
      .map(provider => [provider.providerSlug.toLowerCase(), provider]),
  )

  return {
    ...payload,
    models: payload.models.map((model) => {
      const matches = new Set([
        model.vendor?.toLowerCase?.(),
        model.meta?.creatorSlug?.toLowerCase?.(),
      ].filter(Boolean))

      const codingPlans = Array.from(matches)
        .map(key => providerMap.get(key))
        .filter(Boolean)
        .flatMap(provider => provider.plans.map(plan => ({
          providerName: provider.providerName,
          source: provider.source,
          providerNotes: provider.notes,
          ...plan,
        })))

      return {
        ...model,
        codingPlans,
      }
    }),
  }
}

function validateScores(scores, expectedCategories = ['overall']) {
  const source = scores && typeof scores === 'object' && !Array.isArray(scores) ? scores : {}
  const keys = new Set([...expectedCategories, ...Object.keys(source)])

  // Preserve precision (especially sub-dollar prices); rounding belongs in the UI.
  // Missing measurements are null, while a reported zero is a real measurement.
  return Object.fromEntries([...keys].map(key => [key, isFiniteMetric(source[key]) ? source[key] : null]))
}

export async function fetchLeaderboardData(fetcher = window.fetch) {
  const [leaderboardResponse, codingPlansResponse] = await Promise.all([
    fetcher(GENERATED_LEADERBOARD_PATH),
    fetcher(CODING_PLANS_PATH),
  ])

  if (!leaderboardResponse.ok) {
    throw new Error(`Failed to fetch generated leaderboard data: ${leaderboardResponse.status}`)
  }

  const rawData = await leaderboardResponse.json()
  const validatedPayload = validateAndNormalizeData(rawData)

  if (!codingPlansResponse.ok) {
    return validatedPayload
  }

  const codingPlansPayload = await codingPlansResponse.json()
  return attachCodingPlans(validatedPayload, codingPlansPayload)
}

export async function fetchLeaderboardDataFromApi(fetcher = window.fetch) {
  const [response, codingPlansResponse] = await Promise.all([
    fetcher('/api/leaderboard'),
    fetcher(CODING_PLANS_PATH),
  ])

  if (!response.ok) {
    throw new Error(`Failed to fetch leaderboard data: ${response.status}`)
  }

  const rawData = await response.json()
  const validatedPayload = validateAndNormalizeData(rawData)

  if (!codingPlansResponse.ok) {
    return validatedPayload
  }

  const codingPlansPayload = await codingPlansResponse.json()
  return attachCodingPlans(validatedPayload, codingPlansPayload)
}

export async function fetchCodingPlansData(fetcher = window.fetch) {
  const response = await fetcher(CODING_PLANS_PATH)

  if (!response.ok) {
    throw new Error(`Failed to fetch coding plans data: ${response.status}`)
  }

  const payload = await response.json()

  return {
    lastUpdated: payload?.generatedAt || payload?.lastUpdated || '',
    providers: normalizeCodingPlans(payload),
  }
}

export async function fetchExchangeRatesData(fetcher = window.fetch) {
  const response = await fetcher(EXCHANGE_RATES_PATH)

  if (!response.ok) {
    throw new Error(`Failed to fetch exchange rates data: ${response.status}`)
  }

  const payload = await response.json()

  return {
    source: payload?.source || '',
    sourceName: payload?.sourceName || '',
    base: payload?.base || '',
    date: payload?.date || '',
    generatedAt: payload?.generatedAt || '',
    rates: payload?.rates || {},
    pairs: payload?.pairs || {},
  }
}
