import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

function normalizeMovie(row) {
  return {
    id: String(row.movie_id),
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

export async function getMovies() {
  const client = requireSupabase()
  const { data, error } = await client
    .from('movies')
    .select('*')
    .order('watched', { ascending: true })
    .order('score', { ascending: false })
    .order('picks', { ascending: false })

  if (error) throw error
  return (data || []).map(normalizeMovie)
}

export async function saveMovie(movie, nominatedBy = 'anonymous') {
  const client = requireSupabase()
  const payload = {
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

  const { data, error } = await client
    .from('movies')
    .upsert(payload, { onConflict: 'movie_id' })
    .select()
    .single()

  if (error) throw error
  return normalizeMovie(data)
}

export async function voteMovie(movie, vote) {
  const client = requireSupabase()
  const delta = vote === 'like' ? 1 : -1
  const { data, error } = await client.rpc('vote_movie', {
    movie_id_input: String(movie.id),
    vote_delta_input: delta,
  })

  if (error) throw error
  return data
}

export async function markMovieWatched(movie, rating = null) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('movies')
    .update({ watched: true, my_rating: rating })
    .eq('movie_id', String(movie.id))
    .select()
    .single()

  if (error) throw error
  return normalizeMovie(data)
}

export async function rateMovie(movie, rating) {
  const client = requireSupabase()
  const { data, error } = await client
    .from('movies')
    .update({ my_rating: rating })
    .eq('movie_id', String(movie.id))
    .select()
    .single()

  if (error) throw error
  return normalizeMovie(data)
}
