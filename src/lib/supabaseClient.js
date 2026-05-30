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

function normalizeGroup(row) {
  if (!row) throw new Error('Group response was empty.')
  const members = (row.group_members || [])
    .map((member) => clean(member.display_name) || clean(member.profiles?.display_name) || 'Member')
    .filter(Boolean)

  return {
    id: row.id,
    name: row.name || 'Untitled group',
    inviteCode: row.invite_code,
    createdBy: row.owner_id,
    createdAt: row.created_at,
    isPublic: Boolean(row.is_public),
    members: Array.from(new Set(members)),
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
  const { data, error } = await client.auth.signUp({
    email: clean(email),
    password,
    options: {
      data: { display_name: clean(displayName) },
      emailRedirectTo: getAuthRedirectUrl(),
    },
  })
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

export async function signOut() {
  const client = requireSupabase()
  const { error } = await client.auth.signOut()
  if (error) throw error
}

export async function getProfile() {
  const client = requireSupabase()
  const user = await getCurrentUser()
  if (!user) return null
  const { data, error } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle()
  if (error) throw error
  return data || ensureProfile()
}

export async function ensureProfile(displayName = '') {
  const client = requireSupabase()
  const user = await getCurrentUser()
  if (!user) return null
  const payload = {
    id: user.id,
    email: user.email,
    display_name: clean(displayName) || profileNameFromUser(user),
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await client.from('profiles').upsert(payload, { onConflict: 'id' }).select().single()
  if (error) throw error
  return data
}

export async function saveProfile(displayName) {
  return ensureProfile(displayName)
}

export async function getRemoteGroups() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('groups')
    .select('id,name,invite_code,owner_id,is_public,created_at,group_members(display_name,user_id,role,joined_at)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []).map(normalizeGroup)
}

export async function createRemoteGroup(name, displayName = '') {
  const client = requireSupabase()
  await ensureProfile(displayName)
  const { data, error } = await client.rpc('create_group_with_member', {
    group_name_input: clean(name) || 'New clique',
    display_name_input: clean(displayName) || null,
  })
  if (error) throw error
  const group = normalizeGroup(firstRpcRow(data))
  return { ...group, members: group.members.length ? group.members : [clean(displayName) || 'You'] }
}

export async function joinRemoteGroup(inviteCode, displayName = '') {
  const client = requireSupabase()
  await ensureProfile(displayName)
  const { data, error } = await client.rpc('join_group_by_invite', {
    invite_code_input: clean(inviteCode),
    display_name_input: clean(displayName) || null,
  })
  if (error) throw error
  const group = normalizeGroup(firstRpcRow(data))
  return { ...group, members: group.members.length ? group.members : [clean(displayName) || 'You'] }
}

export async function setGroupPublic(groupId, isPublic) {
  const client = requireSupabase()
  const { data, error } = await client.rpc('set_group_public', {
    group_id_input: groupId,
    is_public_input: Boolean(isPublic),
  })
  if (error) throw error
  return normalizeGroup(firstRpcRow(data))
}

export async function getMovies(groupId = null) {
  const client = requireSupabase()
  const ownerId = await getScopeUserId(groupId)
  let query = applyScope(client.from('movies').select('*'), groupId, ownerId)
  const { data, error } = await query
    .order('watched', { ascending: true })
    .order('score', { ascending: false })
    .order('picks', { ascending: false })
  if (error) throw error
  return (data || []).map(normalizeMovie)
}

export async function saveMovie(movie, nominatedBy = 'anonymous', groupId = null) {
  const client = requireSupabase()
  const ownerId = await getScopeUserId(groupId)
  const payload = moviePayload(movie, nominatedBy, groupId, ownerId)
  const options = groupId ? { onConflict: 'group_id,movie_id' } : { onConflict: 'owner_id,movie_id' }
  const { data, error } = await client.from('movies').upsert(payload, options).select().single()
  if (error) throw error
  return normalizeMovie(data)
}

export async function copyMovieToGroup(movie, targetGroupId, nominatedBy = 'anonymous') {
  return saveMovie(movie, nominatedBy, targetGroupId)
}

export async function voteMovie(movie, vote, groupId = null) {
  const client = requireSupabase()
  const delta = vote === 'like' ? 1 : -1
  const payload = groupId
    ? { movie_id_input: String(movie.id), vote_delta_input: delta, group_id_input: groupId }
    : { movie_id_input: String(movie.id), vote_delta_input: delta }
  const { data, error } = await client.rpc('vote_movie', payload)
  if (error) throw error
  return data
}

export async function markMovieWatched(movie, rating = null, groupId = null) {
  const client = requireSupabase()
  const ownerId = await getScopeUserId(groupId)
  let query = applyScope(client.from('movies').update({ watched: true, my_rating: rating, updated_at: new Date().toISOString() }), groupId, ownerId)
  const { data, error } = await query.eq('movie_id', String(movie.id)).select().single()
  if (error) throw error
  return normalizeMovie(data)
}

export async function rateMovie(movie, rating, groupId = null) {
  const client = requireSupabase()
  const ownerId = await getScopeUserId(groupId)
  let query = applyScope(client.from('movies').update({ my_rating: rating, updated_at: new Date().toISOString() }), groupId, ownerId)
  const { data, error } = await query.eq('movie_id', String(movie.id)).select().single()
  if (error) throw error
  return normalizeMovie(data)
}

export async function getSeries(groupId = null) {
  const client = requireSupabase()
  const ownerId = await getScopeUserId(groupId)
  let query = applyScope(client.from('series').select('*'), groupId, ownerId)
  const { data, error } = await query
    .order('finished', { ascending: true })
    .order('score', { ascending: false })
    .order('picks', { ascending: false })
  if (error) throw error
  return (data || []).map(normalizeSeries)
}

export async function saveSeries(series, nominatedBy = 'anonymous', groupId = null) {
  const client = requireSupabase()
  const ownerId = await getScopeUserId(groupId)
  const payload = seriesPayload(series, nominatedBy, groupId, ownerId)
  const options = groupId ? { onConflict: 'group_id,series_id' } : { onConflict: 'owner_id,series_id' }
  const { data, error } = await client.from('series').upsert(payload, options).select().single()
  if (error) throw error
  return normalizeSeries(data)
}

export async function voteSeries(series, vote, groupId = null) {
  const client = requireSupabase()
  const delta = vote === 'like' ? 1 : -1
  const payload = groupId
    ? { series_id_input: String(series.id), vote_delta_input: delta, group_id_input: groupId }
    : { series_id_input: String(series.id), vote_delta_input: delta }
  const { data, error } = await client.rpc('vote_series', payload)
  if (error) throw error
  return data
}

export async function markSeriesFinished(series, rating = null, groupId = null) {
  const client = requireSupabase()
  const ownerId = await getScopeUserId(groupId)
  let query = applyScope(client.from('series').update({ finished: true, my_rating: rating, updated_at: new Date().toISOString() }), groupId, ownerId)
  const { data, error } = await query.eq('series_id', String(series.id)).select().single()
  if (error) throw error
  return normalizeSeries(data)
}

export async function rateSeries(series, rating, groupId = null) {
  const client = requireSupabase()
  const ownerId = await getScopeUserId(groupId)
  let query = applyScope(client.from('series').update({ my_rating: rating, updated_at: new Date().toISOString() }), groupId, ownerId)
  const { data, error } = await query.eq('series_id', String(series.id)).select().single()
  if (error) throw error
  return normalizeSeries(data)
}

export async function getGames(groupId = null) {
  const client = requireSupabase()
  const ownerId = await getScopeUserId(groupId)
  let query = applyScope(client.from('games').select('*'), groupId, ownerId)
  const { data, error } = await query
    .order('played', { ascending: true })
    .order('score', { ascending: false })
    .order('picks', { ascending: false })
  if (error) throw error
  return (data || []).map(normalizeGame)
}

export async function saveGame(game, nominatedBy = 'anonymous', groupId = null) {
  const client = requireSupabase()
  const ownerId = await getScopeUserId(groupId)
  const payload = gamePayload(game, nominatedBy, groupId, ownerId)
  const options = groupId ? { onConflict: 'group_id,game_id' } : { onConflict: 'owner_id,game_id' }
  const { data, error } = await client.from('games').upsert(payload, options).select().single()
  if (error) throw error
  return normalizeGame(data)
}

export async function voteGame(game, vote, groupId = null) {
  const client = requireSupabase()
  const delta = vote === 'like' ? 1 : -1
  const payload = groupId
    ? { game_id_input: String(game.id), vote_delta_input: delta, group_id_input: groupId }
    : { game_id_input: String(game.id), vote_delta_input: delta }
  const { data, error } = await client.rpc('vote_game', payload)
  if (error) throw error
  return data
}

export async function markGamePlayed(game, rating = null, groupId = null) {
  const client = requireSupabase()
  const ownerId = await getScopeUserId(groupId)
  let query = applyScope(client.from('games').update({ played: true, my_rating: rating, updated_at: new Date().toISOString() }), groupId, ownerId)
  const { data, error } = await query.eq('game_id', String(game.id)).select().single()
  if (error) throw error
  return normalizeGame(data)
}

export async function rateGame(game, rating, groupId = null) {
  const client = requireSupabase()
  const ownerId = await getScopeUserId(groupId)
  let query = applyScope(client.from('games').update({ my_rating: rating, updated_at: new Date().toISOString() }), groupId, ownerId)
  const { data, error } = await query.eq('game_id', String(game.id)).select().single()
  if (error) throw error
  return normalizeGame(data)
}

export async function getCommunityLeaderboard() {
  const client = requireSupabase()
  const { data, error } = await client.rpc('get_community_leaderboard')
  if (error) throw error
  return data || { groups: [], topContent: [], totals: {} }
}
