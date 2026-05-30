import { getCurrentUser, supabase } from './supabaseClient.js'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

async function getScopeUserId(groupId) {
  if (groupId) return null
  const user = await getCurrentUser()
  if (!user) throw new Error('Sign in to use your personal library.')
  return user.id
}

function applyDestination(payload, groupId, ownerId) {
  if (groupId) payload.group_id = groupId
  else if (ownerId) payload.owner_id = ownerId
  return payload
}

function gamePayload(game, nominatedBy = 'anonymous', groupId = null, ownerId = null) {
  return applyDestination({
    game_id: String(game.id),
    title: game.title || 'Untitled game',
    year: game.year || null,
    released: game.released || null,
    poster: game.poster || null,
    backdrop: game.backdrop || null,
    overview: game.overview || game.description || null,
    rawg_rating: game.rawgRating ?? null,
    genres: game.genres || [],
    platform: game.platform || null,
    platforms: game.platforms || (game.platform ? [game.platform] : []),
    nominated_by: nominatedBy || 'anonymous',
    updated_at: new Date().toISOString(),
  }, groupId, ownerId)
}

function normalizeGame(row) {
  return {
    id: String(row.game_id),
    groupId: row.group_id || null,
    ownerId: row.owner_id || null,
    title: row.title,
    year: row.year || '',
    released: row.released || null,
    poster: row.poster,
    backdrop: row.backdrop,
    overview: row.overview || '',
    rawgRating: row.rawg_rating,
    genres: row.genres || [],
    platform: row.platform || '',
    platforms: row.platforms || [],
    nominated_by: row.nominated_by,
    picks: Number(row.picks || 0),
    score: Number(row.score || 0),
    played: Boolean(row.played),
    rating: row.my_rating ?? null,
  }
}

async function upsertGame(game, { nominatedBy = 'anonymous', groupId = null, played = false, rating } = {}) {
  const client = requireSupabase()
  const ownerId = await getScopeUserId(groupId)
  const payload = gamePayload(game, nominatedBy, groupId, ownerId)
  if (played) payload.played = true
  if (rating !== undefined) payload.my_rating = rating

  const { data, error } = await client
    .from('games')
    .upsert(payload, { onConflict: groupId ? 'group_id,game_id' : 'owner_id,game_id' })
    .select()
    .single()

  if (error) throw error
  return normalizeGame(data)
}

export async function saveGame(game, nominatedBy = 'anonymous', groupId = null) {
  return upsertGame(game, { nominatedBy, groupId })
}

export async function markGamePlayed(game, rating = null, groupId = null) {
  const scopedGame = await upsertGame(game, {
    nominatedBy: game.nominated_by || 'anonymous',
    groupId,
    played: true,
    rating,
  })

  if (groupId) {
    await upsertGame(game, {
      nominatedBy: game.nominated_by || 'anonymous',
      groupId: null,
      played: true,
      rating,
    })
  }

  return scopedGame
}

export async function rateGame(game, rating, groupId = null) {
  const scopedGame = await upsertGame(game, {
    nominatedBy: game.nominated_by || 'anonymous',
    groupId,
    played: true,
    rating,
  })

  if (groupId) {
    await upsertGame(game, {
      nominatedBy: game.nominated_by || 'anonymous',
      groupId: null,
      played: true,
      rating,
    })
  }

  return scopedGame
}
