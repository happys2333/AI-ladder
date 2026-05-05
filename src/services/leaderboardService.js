const GENERATED_LEADERBOARD_PATH = '/data/artificial-analysis-llms.json'

export async function fetchLeaderboardData(fetcher = window.fetch) {
  const response = await fetcher(GENERATED_LEADERBOARD_PATH)

  if (!response.ok) {
    throw new Error(`Failed to fetch generated leaderboard data: ${response.status}`)
  }

  return response.json()
}

export async function fetchLeaderboardDataFromApi(fetcher = window.fetch) {
  const response = await fetcher('/api/leaderboard')

  if (!response.ok) {
    throw new Error(`Failed to fetch leaderboard data: ${response.status}`)
  }

  return response.json()
}
