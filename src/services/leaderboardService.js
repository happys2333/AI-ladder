const GENERATED_LEADERBOARD_PATH = '/public/data/artificial-analysis-llms.json'

function validateAndNormalizeData(payload) {
  // 确保基本结构存在
  const validatedPayload = {
    categories: Array.isArray(payload.categories) ? payload.categories : [],
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
      scores: validateScores(model.scores),
      openness: model.openness || 'other',
      // 保留其他字段
      ...model
    }
  })

  // 验证和标准化分类数据
  validatedPayload.categories = validatedPayload.categories.map(category => ({
    key: category.key || 'overall',
    label: category.label || 'Overall',
    ...category
  }))

  // 验证和标准化区域数据
  validatedPayload.regions = validatedPayload.regions.map(region => ({
    key: region.key || 'global',
    label: region.label || 'Global',
    ...region
  }))

  return validatedPayload
}

function validateScores(scores) {
  if (!scores || typeof scores !== 'object') {
    return { overall: 0 }
  }

  const validatedScores = {}
  const expectedCategories = ['overall', 'coding', 'math', 'reasoning', 'knowledge', 'agentic']

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
  const response = await fetcher(GENERATED_LEADERBOARD_PATH)

  if (!response.ok) {
    throw new Error(`Failed to fetch generated leaderboard data: ${response.status}`)
  }

  const rawData = await response.json()
  return validateAndNormalizeData(rawData)
}

export async function fetchLeaderboardDataFromApi(fetcher = window.fetch) {
  const response = await fetcher('/api/leaderboard')

  if (!response.ok) {
    throw new Error(`Failed to fetch leaderboard data: ${response.status}`)
  }

  const rawData = await response.json()
  return validateAndNormalizeData(rawData)
}
