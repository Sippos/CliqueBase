function mapMovie(movie) {
  return {
    id: String(movie.id),
    title: movie.title || movie.original_title || 'Untitled movie',
    year: movie.release_date ? movie.release_date.split('-')[0] : '',
    released: movie.release_date || null,
    poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
    backdrop: movie.backdrop_path ? `https://image.tmdb.org/t/p/w780${movie.backdrop_path}` : null,
    overview: movie.overview || '',
    tmdbRating: movie.vote_average ?? null,
    runtime: movie.runtime ?? null,
    genres: movie.genres?.map((genre) => genre.name).filter(Boolean) ?? [],
    picks: 0,
    score: 0,
  }
}

function mapSeries(series) {
  return {
    id: String(series.id),
    title: series.name || series.original_name || 'Untitled series',
    year: series.first_air_date ? series.first_air_date.split('-')[0] : '',
    released: series.first_air_date || null,
    poster: series.poster_path ? `https://image.tmdb.org/t/p/w500${series.poster_path}` : null,
    backdrop: series.backdrop_path ? `https://image.tmdb.org/t/p/w780${series.backdrop_path}` : null,
    overview: series.overview || '',
    tmdbRating: series.vote_average ?? null,
    runtime: series.episode_run_time?.[0] ?? null,
    genres: series.genres?.map((genre) => genre.name).filter(Boolean) ?? [],
    seasons: series.number_of_seasons ?? null,
    episodes: series.number_of_episodes ?? null,
    picks: 0,
    score: 0,
  }
}

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || 'Request failed')
  }
  return res.json()
}

export async function searchMovies(query) {
  if (!query.trim()) return []
  const data = await fetchJson(`/api/tmdb/search?q=${encodeURIComponent(query.trim())}`)
  return (data.results || []).map(mapMovie)
}

export async function getMovieDetails(movieId) {
  if (!movieId) return null
  const data = await fetchJson(`/api/tmdb/movie?id=${encodeURIComponent(movieId)}`)
  return mapMovie(data)
}

export async function searchSeries(query) {
  if (!query.trim()) return []
  const data = await fetchJson(`/api/tmdb/search-series?q=${encodeURIComponent(query.trim())}`)
  return (data.results || []).map(mapSeries)
}

export async function getSeriesDetails(seriesId) {
  if (!seriesId) return null
  const data = await fetchJson(`/api/tmdb/series?id=${encodeURIComponent(seriesId)}`)
  return mapSeries(data)
}
