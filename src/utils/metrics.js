export function isFiniteMetric(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

export function getCategoryValue(model, category) {
  const value = model?.scores?.[category]
  return isFiniteMetric(value) ? value : null
}

export function formatMetric(value, { digits = 1, prefix = '', suffix = '', preserveSmallValues = false } = {}) {
  if (!isFiniteMetric(value)) return 'N/A'
  const amount = preserveSmallValues && value !== 0 && Math.abs(value) < 10 ** -digits
    ? Number(value.toPrecision(2)).toString()
    : value.toFixed(digits)
  return `${prefix}${amount}${suffix}`
}

export function formatCategoryValue(category, value, { units = false } = {}) {
  if (category === 'price') {
    return formatMetric(value, { digits: 2, prefix: '$', suffix: units ? ' / 1M' : '', preserveSmallValues: true })
  }
  if (category === 'speed' && units) {
    return formatMetric(value, { digits: 2, suffix: ' tok/s' })
  }
  return formatMetric(value)
}

export function metricBarWidth(value) {
  if (!isFiniteMetric(value) || value <= 0) return '0%'
  return `${Math.min(100, Math.max(8, value))}%`
}

// Release dates are optional. Unknown dates and unavailable scores must not
// create a trend point or make an unmeasured model the monthly leader.
export function buildMonthlyLeaders(models, category) {
  const leadersByMonth = new Map()
  const isBetter = (next, current) => category === 'price' ? next < current : next > current

  for (const model of models) {
    const month = model.meta?.releaseYearMonth ?? model.releaseYearMonth
    const score = getCategoryValue(model, category)
    if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || score === null) continue

    const current = leadersByMonth.get(month)
    if (!current || isBetter(score, current.score)) {
      leadersByMonth.set(month, { month, modelId: model.id, modelName: model.name, score })
    }
  }

  const months = [...leadersByMonth.keys()].sort()
  if (!months.length) return []

  const [startYear, startMonth] = months[0].split('-').map(Number)
  const [endYear, endMonth] = months.at(-1).split('-').map(Number)
  const entries = []
  let bestSoFar = null
  for (let index = startYear * 12 + startMonth - 1; index <= endYear * 12 + endMonth - 1; index += 1) {
    const month = `${String(Math.floor(index / 12)).padStart(4, '0')}-${String(index % 12 + 1).padStart(2, '0')}`
    const monthlyLeader = leadersByMonth.get(month)
    if (monthlyLeader && (!bestSoFar || isBetter(monthlyLeader.score, bestSoFar.score))) {
      bestSoFar = monthlyLeader
    }
    entries.push({ ...bestSoFar, month })
  }
  return entries
}
