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

function normalizeMovie(row) {
  return {
    id: String(row.movie_id),
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
    watched: Boolean(row.watched),
    rating: row.my_rating ?? null,
  }
}

function moviePayload(movie, nominatedBy = 'anonymous', groupId) {
  if (!groupId) throw new Error('Choose a group before saving movies.')

  return {
    group_id: groupId,
    movie_id: String(movie.id),
    title: movie.title,
    year: movie.year || null,
    released: movie.released || null,
    poster: movie.poster || null,
    backdrop: movie.backdrop || null,
    overview: movie.overview || null,
    tmdb_rating: movie.tmdbRating ?? null,
    runtime: movie.runtime ?? null,
    genres: movie.genres || [],
    nominated_by: nominatedBy || 'anonymous',
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

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session || null)
  })

  return () => data.subscription.unsubscribe()
}

export async function signUpWithEmail(email, password, displayName = '') {
  const client = requireSupabase()
  const { data, error } = await client.auth.signUp({
    email: clean(email),
    password,
    options: {
      data: { display_name: clean(displayName) },
    },
  })

  if (error) throw error
  if (data.session?.user) await saveProfile(displayName || profileNameFromUser(data.session.user))
  return data
}

export async function signInWithEmail(email, password) {
  const client = requireSupabase()
  const { data, error } = await client.auth.signInWithPassword({
    email: clean(email),
    password,
  })

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

  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()

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

  const { data, error } = await client
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select()
    .single()

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
  return {
    ...group,
    members: group.members.length ? group.members : [clean(displayName) || 'You'],
  }
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
  return {
    ...group,
    members: group.members.length ? group.members : [clean(displayName) || 'You'],
  }
}

export async function getMovies(groupId) {
  const client = requireSupabase()
  if (!groupId) return []

  const { data, error } = await client
    .from('movies')
    .select('*')
    .eq('group_id', groupId)
    .order('watched', { ascending: true })
    .order('score', { ascending: false })
    .order('picks', { ascending: false })

  if (error) throw error
  return (data || []).map(normalizeMovie)
}

export async function saveMovie(movie, nominatedBy = 'anonymous', groupId = null) {
  const client = requireSupabase()
  const payload = moviePayload(movie, nominatedBy, groupId)

  const { data, error } = await client
    .from('movies')
    .upsert(payload, { onConflict: 'group_id,movie_id' })
    .select()
    .single()

  if (error) throw error
  return normalizeMovie(data)
}

export async function copyMovieToGroup(movie, targetGroupId, nominatedBy = 'anonymous') {
  return saveMovie(movie, nominatedBy, targetGroupId)
}

export async function voteMovie(movie, vote, groupId = null) {
  const client = requireSupabase()
  if (!groupId) throw new Error('Choose a group before voting.')

  const delta = vote === 'like' ? 1 : -1
  const { data, error } = await client.rpc('vote_movie', {
    movie_id_input: String(movie.id),
    vote_delta_input: delta,
    group_id_input: groupId,
  })

  if (error) throw error
  return data
}

export async function markMovieWatched(movie, rating = null, groupId = null) {
  const client = requireSupabase()
  if (!groupId) throw new Error('Choose a group before marking a movie watched.')

  const { data, error } = await client
    .from('movies')
    .update({ watched: true, my_rating: rating, updated_at: new Date().toISOString() })
    .eq('group_id', groupId)
    .eq('movie_id', String(movie.id))
    .select()
    .single()

  if (error) throw error
  return normalizeMovie(data)
}

export async function rateMovie(movie, rating, groupId = null) {
  const client = requireSupabase()
  if (!groupId) throw new Error('Choose a group before rating a movie.')

  const { data, error } = await client
    .from('movies')
    .update({ my_rating: rating, updated_at: new Date().toISOString() })
    .eq('group_id', groupId)
    .eq('movie_id', String(movie.id))
    .select()
    .single()

  if (error) throw error
  return normalizeMovie(data)
}
