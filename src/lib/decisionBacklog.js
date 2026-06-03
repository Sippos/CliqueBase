import { formatStructuredDecisionOption } from './decisionLoop.js'
import { getGames, getMovies, getSeries } from './supabaseClient.js'

function scoreItem(item) {
  return Number(item.score || 0) * 10 + Number(item.picks || 0)
}

export async function getDecisionBacklogOptions(groupId, limit = 6) {
  if (!groupId) return []
  const [movies, series, games] = await Promise.all([
    getMovies(groupId).catch(() => []),
    getSeries(groupId).catch(() => []),
    getGames(groupId).catch(() => []),
  ])

  return [
    ...movies.filter((item) => !item.watched).map((item) => ({ type: 'movie', item })),
    ...series.filter((item) => !item.finished).map((item) => ({ type: 'series', item })),
    ...games.filter((item) => !item.played).map((item) => ({ type: 'game', item })),
  ]
    .sort((a, b) => scoreItem(b.item) - scoreItem(a.item) || String(a.item.title).localeCompare(String(b.item.title)))
    .slice(0, limit)
    .map(({ type, item }) => formatStructuredDecisionOption(type, item.id, item.title))
}
