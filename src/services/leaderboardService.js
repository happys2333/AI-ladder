const GENERATED_LEADERBOARD_PATH = '/data/artificial-analysis-llms.json'
const CODING_PLANS_PATH = '/data/coding-plans.json'
const EXCHANGE_RATES_PATH = '/data/exchange-rates.json'

function validateAndNormalizeData(payload) {
  const normalizedCategories = Array.isArray(payload.categories)
    ? payload.categories.map(category => ({
      key: category.key || 'overall',
      label: category.label || 'Overall',
      ...category
    }))
    : []

  const categoryKeys = normalizedCategories.map(category => category.key)

  // 确保基本结构存在
  const validatedPayload = {
    categories: normalizedCategories,
    regions: Array.isArray(payload.regions) ? payload.regions : [],
    models: Array.isArray(payload.models) ? payload.models : [],
    lastUpdated: payload.lastUpdated || '',
    source: payload.source || null,
    stats: payload.stats || {},
    ...payload
  }

  // 验证和标准化模型数据
  validatedPayload.models = validatedPayload.models.map(model => {
    return {
      id: model.id || model.slug || `model-${Math.random().toString(36).substr(2, 9)}`,
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
      // 保留其他字段
      ...model
    }
  })

  // 验证和标准化区域数据
  validatedPayload.regions = validatedPayload.regions.map(region => ({
    key: region.key || 'global',
    label: region.label || 'Global',
    ...region
  }))

  return validatedPayload
}

function normalizeCodingPlans(payload) {
  const providers = Array.isArray(payload?.providers) ? payload.providers : []
  return providers.map((provider) => ({
    providerSlug: provider.providerSlug || '',
    providerName: provider.providerName || '',
    productName: provider.productName || '',
    summary: provider.summary || '',
    source: provider.source || '',
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
  if (!scores || typeof scores !== 'object') {
    return expectedCategories.reduce((acc, category) => {
      acc[category] = 0
      return acc
    }, {})
  }

  const validatedScores = {}

  expectedCategories.forEach(category => {
    const score = scores[category]
    validatedScores[category] = typeof score === 'number' && !isNaN(score) ? Number(score.toFixed(1)) : 0
  })

  // 保留其他未预期的分数字段
  Object.keys(scores).forEach(key => {
    if (!expectedCategories.includes(key)) {
      const score = scores[key]
      if (typeof score === 'number' && !isNaN(score)) {
        validatedScores[key] = Number(score.toFixed(1))
      }
    }
  })

  return validatedScores
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
    lastUpdated: payload?.lastUpdated || '',
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
