import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const siteUrl = import.meta.env.VITE_SITE_URL

function createSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null
  try {
    return createClient(supabaseUrl, supabaseAnonKey)
  } catch (error) {
    console.error('Supabase configuration error:', error)
    return null
  }
}

export const supabase = createSupabaseClient()
export const hasSupabase = Boolean(supabase)

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

function clean(value) {
  return String(value || '').trim()
}

function getAuthRedirectUrl() {
  const configuredUrl = clean(siteUrl)
  if (configuredUrl) return configuredUrl.endsWith('/') ? configuredUrl : `${configuredUrl}/`
  if (typeof window !== 'undefined' && window.location?.origin) return `${window.location.origin}/`
  return undefined
}

function profileNameFromUser(user) {
  return clean(user?.user_metadata?.display_name) || clean(user?.email?.split('@')[0]) || 'Friend'
}

function normalizeWatchedWith(value) {
  if (!Array.isArray(value)) return []
  return value.map((entry) => ({
    id: entry?.id || entry?.userId || entry?.user_id || '',
    displayName: clean(entry?.displayName || entry?.display_name || entry?.name) || 'Member',
  })).filter((entry) => entry.id || entry.displayName)
}

function normalizeMediaRow(row, idColumn, doneColumn) {
  return {
    id: String(row[idColumn]),
    groupId: row.group_id || null,
    ownerId: row.owner_id || null,
    title: row.title,
    year: row.year || '',
    released: row.released || null,
    poster: row.poster,
    backdrop: row.backdrop,
    overview: row.overview || '',
    tmdbRating: row.tmdb_rating,
    rawgRating: row.rawg_rating,
    runtime: row.runtime,
    genres: row.genres || [],
    nominated_by: row.nominated_by,
    picks: Number(row.picks || 0),
    score: Number(row.score || 0),
    watchedWith: normalizeWatchedWith(row.watched_with),
    [doneColumn]: Boolean(row[doneColumn]),
    rating: row.my_rating ?? null,
  }
}

function normalizeMovie(row) {
  return normalizeMediaRow(row, 'movie_id', 'watched')
}

function normalizeSeries(row) {
  return {
    ...normalizeMediaRow(row, 'series_id', 'finished'),
    seasons: row.seasons ?? null,
    episodes: row.episodes ?? null,
  }
}

function normalizeGame(row) {
  return {
    ...normalizeMediaRow(row, 'game_id', 'played'),
    platform: row.platform || '',
    platforms: row.platforms || [],
  }
}

function normalizeGroupMember(member = {}) {
  const profile = member.profiles || {}
  return {
    id: member.user_id || member.userId || member.id || profile.id || '',
    displayName: clean(member.display_name || member.displayName || profile.display_name) || 'Member',
    role: member.role || 'member',
    joinedAt: member.joined_at || member.joinedAt || null,
  }
}

function normalizeGroup(row) {
  if (!row) throw new Error('Group response was empty.')
  const members = (row.group_members || []).map(normalizeGroupMember).filter((member) => member.id || member.displayName)

  return {
    id: row.id,
    name: row.name || 'Untitled group',
    inviteCode: row.invite_code,
    createdBy: row.owner_id,
    createdAt: row.created_at,
    isPublic: Boolean(row.is_public),
    isFamily: Boolean(row.is_family),
    familySafe: Boolean(row.family_safe),
    minimumAge: row.minimum_age ?? null,
    members,
    source: 'supabase',
  }
}

function firstRpcRow(data) {
  return Array.isArray(data) ? data[0] : data
}

function mediaPayload(item, idColumn, nominatedBy = 'anonymous', groupId = null, ownerId = null) {
  const payload = {
    [idColumn]: String(item.id),
    title: item.title,
    year: item.year || null,
    released: item.released || null,
    poster: item.poster || null,
    backdrop: item.backdrop || null,
    overview: item.overview || item.description || null,
    tmdb_rating: item.tmdbRating ?? null,
    runtime: item.runtime ?? null,
    genres: item.genres || [],
    nominated_by: nominatedBy || 'anonymous',
  }

  if (groupId) payload.group_id = groupId
  else if (ownerId) payload.owner_id = ownerId

  return payload
}

function feedPayload(item = {}, extra = {}) {
  return {
    poster: item.poster || null,
    backdrop: item.backdrop || null,
    overview: item.overview || item.description || '',
    rating: item.rating ?? item.my_rating ?? null,
    scope: item.groupId || extra.groupId ? 'clique' : 'library',
    ...extra,
  }
}

async function recordFeedEvent({ type, itemType, item, groupId = null, title = '', payload = {} } = {}) {
  if (!supabase || !item?.id) return
  try {
    const user = await getCurrentUser().catch(() => null)
    if (!user?.id) return
    const since = new Date(Date.now() - 120000).toISOString()
    const { data: recent, error: recentError } = await supabase
      .from('activity_events')
      .select('id')
      .eq('actor_id', user.id)
      .eq('type', type)
      .eq('item_type', itemType)
      .eq('item_id', String(item.id))
      .gte('created_at', since)
      .limit(1)
    if (!recentError && recent?.length) return

    const { error } = await supabase.from('activity_events').insert({
      actor_id: user.id,
      group_id: groupId || null,
      type,
      item_type: itemType,
      item_id: String(item.id),
      title: clean(title || item.title) || 'Untitled pick',
      payload: feedPayload(item, { ...payload, groupId: groupId || null }),
    })
    if (error && error.code !== '42P01' && error.code !== 'PGRST204') console.warn('Feed event insert failed:', error.message || error)
  } catch (error) {
    console.warn('Feed event insert failed:', error.message || error)
  }
}

function moviePayload(movie, nominatedBy = 'anonymous', groupId = null, ownerId = null) {
  return mediaPayload(movie, 'movie_id', nominatedBy, groupId, ownerId)
}

function seriesPayload(series, nominatedBy = 'anonymous', groupId = null, ownerId = null) {
  return {
    ...mediaPayload(series, 'series_id', nominatedBy, groupId, ownerId),
    seasons: series.seasons ?? null,
    episodes: series.episodes ?? null,
  }
}

function gamePayload(game, nominatedBy = 'anonymous', groupId = null, ownerId = null) {
  return {
    ...mediaPayload(game, 'game_id', nominatedBy, groupId, ownerId),
    rawg_rating: game.rawgRating ?? null,
    platform: game.platform || null,
    platforms: game.platforms || (game.platform ? [game.platform] : []),
  }
}

async function getScopeUserId(groupId) {
  if (groupId) return null
  const user = await getCurrentUser()
  if (!user) throw new Error('Sign in to use your personal library.')
  return user.id
}

function applyScope(query, groupId, ownerId) {
  if (groupId) return query.eq('group_id', groupId)
  return query.is('group_id', null).eq('owner_id', ownerId)
}

async function upsertScopedMedia({ table, item, payloadFor, conflict, normalize, groupId = null, nominatedBy = 'anonymous', doneColumn = null, rating, itemType = '', extraPayload = {} }) {
  const client = requireSupabase()
  const ownerId = await getScopeUserId(groupId)
  const payload = payloadFor(item, nominatedBy, groupId, ownerId)
  payload.updated_at = new Date().toISOString()
  Object.assign(payload, extraPayload || {})
  if (doneColumn) payload[doneColumn] = true
  if (rating !== undefined) payload.my_rating = rating

  const { data, error } = await client.from(table).upsert(payload, { onConflict: conflict }).select().single()
  if (error) throw error
  const normalized = normalize(data)
  if (itemType) {
    const eventType = rating !== undefined ? 'rating' : doneColumn ? 'completed' : 'library_add'
    recordFeedEvent({ type: eventType, itemType, item: normalized, groupId, payload: { rating: rating ?? normalized.rating ?? null, done: Boolean(doneColumn), watchedWith: extraPayload?.watched_with || null } })
  }
  return normalized
}

export async function getCurrentSession() {
  const client = requireSupabase()
  const { data, error } = await client.auth.getSession()
  if (error) throw error
  return data.session || null
}

export async function getCurrentUser() {
  const client = requireSupabase()
  const { data, error } = await client.auth.getUser()
  if (error) throw error
  return data.user || null
}

export function onAuthStateChanged(callback) {
  if (!supabase) return () => {}
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session || null))
  return () => data.subscription.unsubscribe()
}

export async function signUpWithEmail(email, password, displayName = '') {
  const client = requireSupabase()
  const { data, error } = await client.auth.signUp({ email: clean(email), password, options: { data: { display_name: clean(displayName) }, emailRedirectTo: getAuthRedirectUrl() } })
  if (error) throw error
  if (data.session?.user) saveProfile(displayName || profileNameFromUser(data.session.user)).catch((error) => console.warn('Profile sync failed:', error))
  return data
}

export async function signInWithEmail(email, password) {
  const client = requireSupabase()
  const { data, error } = await client.auth.signInWithPassword({ email: clean(email), password })
  if (error) throw error
  ensureProfile().catch((error) => console.warn('Profile sync failed:', error))
  return data
}

export async function signOut() { const client = requireSupabase(); const { error } = await client.auth.signOut(); if (error) throw error }
export async function getProfile() { const client = requireSupabase(); const user = await getCurrentUser(); if (!user) return null; const { data, error } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle(); if (error) throw error; return data || ensureProfile() }
export async function ensureProfile(displayName = '') { const client = requireSupabase(); const user = await getCurrentUser(); if (!user) return null; const payload = { id: user.id, email: user.email, display_name: clean(displayName) || profileNameFromUser(user), updated_at: new Date().toISOString() }; const { data, error } = await client.from('profiles').upsert(payload, { onConflict: 'id' }).select().single(); if (error) throw error; return data }
export async function saveProfile(displayName) { return ensureProfile(displayName) }
export async function getRemoteGroups() { const client = requireSupabase(); const { data, error } = await client.from('groups').select('id,name,invite_code,owner_id,is_public,is_family,family_safe,minimum_age,created_at,group_members(display_name,user_id,role,joined_at)').order('created_at', { ascending: false }); if (error) throw error; return (data || []).map(normalizeGroup) }
export async function getGroupMembers(groupId) { const client = requireSupabase(); if (!groupId) return []; const { data, error } = await client.from('group_members').select('user_id,display_name,role,joined_at').eq('group_id', groupId).order('joined_at', { ascending: true }); if (error) throw error; return (data || []).map(normalizeGroupMember) }
export async function createRemoteGroup(name, displayName = '') { const client = requireSupabase(); await ensureProfile(displayName); const { data, error } = await client.rpc('create_group_with_member', { group_name_input: clean(name) || 'New clique', display_name_input: clean(displayName) || null }); if (error) throw error; const group = normalizeGroup(firstRpcRow(data)); return { ...group, members: group.members.length ? group.members : [{ id: '', displayName: clean(displayName) || 'You', role: 'owner' }] } }
export async function createFamilyGroup(name = 'Family clique', displayName = '') { const client = requireSupabase(); await ensureProfile(displayName); const { data, error } = await client.rpc('create_family_group', { group_name_input: clean(name) || 'Family clique', display_name_input: clean(displayName) || null }); if (error) throw error; const group = normalizeGroup(firstRpcRow(data)); return { ...group, members: group.members.length ? group.members : [{ id: '', displayName: clean(displayName) || 'You', role: 'owner' }] } }
export async function joinRemoteGroup(inviteCode, displayName = '') { const client = requireSupabase(); await ensureProfile(displayName); const { data, error } = await client.rpc('join_group_by_invite', { invite_code_input: clean(inviteCode), display_name_input: clean(displayName) || null }); if (error) throw error; const group = normalizeGroup(firstRpcRow(data)); return { ...group, members: group.members.length ? group.members : [{ id: '', displayName: clean(displayName) || 'You', role: 'member' }] } }
export async function setGroupPublic(groupId, isPublic) { const client = requireSupabase(); const { data, error } = await client.rpc('set_group_public', { group_id_input: groupId, is_public_input: Boolean(isPublic) }); if (error) throw error; return normalizeGroup(firstRpcRow(data)) }
export async function getMovies(groupId = null) { const client = requireSupabase(); const ownerId = await getScopeUserId(groupId); const { data, error } = await applyScope(client.from('movies').select('*'), groupId, ownerId).order('watched', { ascending: true }).order('score', { ascending: false }).order('picks', { ascending: false }); if (error) throw error; return (data || []).map(normalizeMovie) }
export async function saveMovie(movie, nominatedBy = 'anonymous', groupId = null) { return upsertScopedMedia({ table: 'movies', item: movie, payloadFor: moviePayload, conflict: groupId ? 'group_id,movie_id' : 'owner_id,movie_id', normalize: normalizeMovie, groupId, nominatedBy, itemType: 'movie' }) }
export async function copyMovieToGroup(movie, targetGroupId, nominatedBy = 'anonymous') { return saveMovie(movie, nominatedBy, targetGroupId) }
export async function voteMovie(movie, vote, groupId = null) { const client = requireSupabase(); const delta = vote === 'like' ? 1 : -1; const payload = groupId ? { movie_id_input: String(movie.id), vote_delta_input: delta, group_id_input: groupId } : { movie_id_input: String(movie.id), vote_delta_input: delta }; const { data, error } = await client.rpc('vote_movie', payload); if (error) throw error; recordFeedEvent({ type: 'vote', itemType: 'movie', item: movie, groupId, payload: { vote, score: movie.score ?? null, picks: movie.picks ?? null } }); return data }
export async function markMovieWatched(movie, rating = null, groupId = null, watchedWith = []) { const cleanWatchedWith = normalizeWatchedWith(watchedWith); const scopedMovie = await upsertScopedMedia({ table: 'movies', item: movie, payloadFor: moviePayload, conflict: groupId ? 'group_id,movie_id' : 'owner_id,movie_id', normalize: normalizeMovie, groupId, nominatedBy: movie.nominated_by || 'anonymous', doneColumn: 'watched', rating, itemType: 'movie', extraPayload: groupId ? { watched_with: cleanWatchedWith } : {} }); if (groupId) await upsertScopedMedia({ table: 'movies', item: movie, payloadFor: moviePayload, conflict: 'owner_id,movie_id', normalize: normalizeMovie, groupId: null, nominatedBy: movie.nominated_by || 'anonymous', doneColumn: 'watched', rating, itemType: 'movie', extraPayload: { watched_with: cleanWatchedWith } }); return scopedMovie }
export async function rateMovie(movie, rating, groupId = null) { return markMovieWatched(movie, rating, groupId, movie.watchedWith || []) }
export async function getSeries(groupId = null) { const client = requireSupabase(); const ownerId = await getScopeUserId(groupId); const { data, error } = await applyScope(client.from('series').select('*'), groupId, ownerId).order('finished', { ascending: true }).order('score', { ascending: false }).order('picks', { ascending: false }); if (error) throw error; return (data || []).map(normalizeSeries) }
export async function saveSeries(series, nominatedBy = 'anonymous', groupId = null) { return upsertScopedMedia({ table: 'series', item: series, payloadFor: seriesPayload, conflict: groupId ? 'group_id,series_id' : 'owner_id,series_id', normalize: normalizeSeries, groupId, nominatedBy, itemType: 'series' }) }
export async function voteSeries(series, vote, groupId = null) { const client = requireSupabase(); const delta = vote === 'like' ? 1 : -1; const payload = groupId ? { series_id_input: String(series.id), vote_delta_input: delta, group_id_input: groupId } : { series_id_input: String(series.id), vote_delta_input: delta }; const { data, error } = await client.rpc('vote_series', payload); if (error) throw error; recordFeedEvent({ type: 'vote', itemType: 'series', item: series, groupId, payload: { vote, score: series.score ?? null, picks: series.picks ?? null } }); return data }
export async function markSeriesFinished(series, rating = null, groupId = null) { const scopedSeries = await upsertScopedMedia({ table: 'series', item: series, payloadFor: seriesPayload, conflict: groupId ? 'group_id,series_id' : 'owner_id,series_id', normalize: normalizeSeries, groupId, nominatedBy: series.nominated_by || 'anonymous', doneColumn: 'finished', rating, itemType: 'series' }); if (groupId) await upsertScopedMedia({ table: 'series', item: series, payloadFor: seriesPayload, conflict: 'owner_id,series_id', normalize: normalizeSeries, groupId: null, nominatedBy: series.nominated_by || 'anonymous', doneColumn: 'finished', rating, itemType: 'series' }); return scopedSeries }
export async function rateSeries(series, rating, groupId = null) { return markSeriesFinished(series, rating, groupId) }
export async function getGames(groupId = null) { const client = requireSupabase(); const ownerId = await getScopeUserId(groupId); const { data, error } = await applyScope(client.from('games').select('*'), groupId, ownerId).order('played', { ascending: true }).order('score', { ascending: false }).order('picks', { ascending: false }); if (error) throw error; return (data || []).map(normalizeGame) }
export async function saveGame(game, nominatedBy = 'anonymous', groupId = null) { return upsertScopedMedia({ table: 'games', item: game, payloadFor: gamePayload, conflict: groupId ? 'group_id,game_id' : 'owner_id,game_id', normalize: normalizeGame, groupId, nominatedBy, itemType: 'game' }) }
export async function voteGame(game, vote, groupId = null) { const client = requireSupabase(); const delta = vote === 'like' ? 1 : -1; const payload = groupId ? { game_id_input: String(game.id), vote_delta_input: delta, group_id_input: groupId } : { game_id_input: String(game.id), vote_delta_input: delta }; const { data, error } = await client.rpc('vote_game', payload); if (error) throw error; recordFeedEvent({ type: 'vote', itemType: 'game', item: game, groupId, payload: { vote, score: game.score ?? null, picks: game.picks ?? null } }); return data }
export async function markGamePlayed(game, rating = null, groupId = null) { const scopedGame = await upsertScopedMedia({ table: 'games', item: game, payloadFor: gamePayload, conflict: groupId ? 'group_id,game_id' : 'owner_id,game_id', normalize: normalizeGame, groupId, nominatedBy: game.nominated_by || 'anonymous', doneColumn: 'played', rating, itemType: 'game' }); if (groupId) await upsertScopedMedia({ table: 'games', item: game, payloadFor: gamePayload, conflict: 'owner_id,game_id', normalize: normalizeGame, groupId: null, nominatedBy: game.nominated_by || 'anonymous', doneColumn: 'played', rating, itemType: 'game' }); return scopedGame }
export async function rateGame(game, rating, groupId = null) { return markGamePlayed(game, rating, groupId) }
export async function getCommunityLeaderboard() { const client = requireSupabase(); const { data, error } = await client.rpc('get_community_leaderboard'); if (error) throw error; return data || { groups: [], topContent: [], totals: {} } }
