import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

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

function profileNameFromUser(user) {
  return clean(user?.user_metadata?.display_name) || clean(user?.email?.split('@')[0]) || 'Friend'
}

function normalizeMediaRow(row, idColumn, doneColumn) {
  return {
    id: String(row[idColumn]),
    groupId: row.group_id || null,
    title: row.title,
    year: row.year || '',
    released: row.released || null,
    poster: row.poster,
    backdrop: row.backdrop,
    overview: row.overview || '',
    tmdbRating: row.tmdb_rating,
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
    members: Array.from(new Set(members)),
    source: 'supabase',
  }
}

function firstRpcRow(data) {
  return Array.isArray(data) ? data[0] : data
}

function mediaPayload(item, idColumn, nominatedBy = 'anonymous', groupId = null) {
  const payload = {
    [idColumn]: String(item.id),
    title: item.title,
    year: item.year || null,
    released: item.released || null,
    poster: item.poster || null,
    backdrop: item.backdrop || null,
    overview: item.overview || null,
    tmdb_rating: item.tmdbRating ?? null,
    runtime: item.runtime ?? null,
    genres: item.genres || [],
    nominated_by: nominatedBy || 'anonymous',
  }
  if (groupId) payload.group_id = groupId
  return payload
}

function moviePayload(movie, nominatedBy = 'anonymous', groupId = null) {
  return mediaPayload(movie, 'movie_id', nominatedBy, groupId)
}

function seriesPayload(series, nominatedBy = 'anonymous', groupId = null) {
  return {
    ...mediaPayload(series, 'series_id', nominatedBy, groupId),
    seasons: series.seasons ?? null,
    episodes: series.episodes ?? null,
  }
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
    options: { data: { display_name: clean(displayName) } },
  })
  if (error) throw error
  if (data.session?.user) await saveProfile(displayName || profileNameFromUser(data.session.user))
  return data
}

export async function signInWithEmail(email, password) {
  const client = requireSupabase()
  const { data, error } = await client.auth.signInWithPassword({ email: clean(email), password })
  if (error) throw error
  await ensureProfile()
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
    .select('id,name,invite_code,owner_id,created_at,group_members(display_name,user_id,role,joined_at)')
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

export async function getMovies(groupId = null) {
  const client = requireSupabase()
  let query = client.from('movies').select('*')
  if (groupId) query = query.eq('group_id', groupId)
  const { data, error } = await query
    .order('watched', { ascending: true })
    .order('score', { ascending: false })
    .order('picks', { ascending: false })
  if (error) throw error
  return (data || []).map(normalizeMovie)
}

export async function saveMovie(movie, nominatedBy = 'anonymous', groupId = null) {
  const client = requireSupabase()
  const payload = moviePayload(movie, nominatedBy, groupId)
  const options = groupId ? { onConflict: 'group_id,movie_id' } : { onConflict: 'movie_id' }
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
  let query = client.from('movies').update({ watched: true, my_rating: rating, updated_at: new Date().toISOString() })
  if (groupId) query = query.eq('group_id', groupId)
  const { data, error } = await query.eq('movie_id', String(movie.id)).select().single()
  if (error) throw error
  return normalizeMovie(data)
}

export async function rateMovie(movie, rating, groupId = null) {
  const client = requireSupabase()
  let query = client.from('movies').update({ my_rating: rating, updated_at: new Date().toISOString() })
  if (groupId) query = query.eq('group_id', groupId)
  const { data, error } = await query.eq('movie_id', String(movie.id)).select().single()
  if (error) throw error
  return normalizeMovie(data)
}

export async function getSeries(groupId = null) {
  const client = requireSupabase()
  let query = client.from('series').select('*')
  if (groupId) query = query.eq('group_id', groupId)
  const { data, error } = await query
    .order('finished', { ascending: true })
    .order('score', { ascending: false })
    .order('picks', { ascending: false })
  if (error) throw error
  return (data || []).map(normalizeSeries)
}

export async function saveSeries(series, nominatedBy = 'anonymous', groupId = null) {
  const client = requireSupabase()
  const payload = seriesPayload(series, nominatedBy, groupId)
  const options = groupId ? { onConflict: 'group_id,series_id' } : { onConflict: 'series_id' }
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
  let query = client.from('series').update({ finished: true, my_rating: rating, updated_at: new Date().toISOString() })
  if (groupId) query = query.eq('group_id', groupId)
  const { data, error } = await query.eq('series_id', String(series.id)).select().single()
  if (error) throw error
  return normalizeSeries(data)
}

export async function rateSeries(series, rating, groupId = null) {
  const client = requireSupabase()
  let query = client.from('series').update({ my_rating: rating, updated_at: new Date().toISOString() })
  if (groupId) query = query.eq('group_id', groupId)
  const { data, error } = await query.eq('series_id', String(series.id)).select().single()
  if (error) throw error
  return normalizeSeries(data)
}
