function mapMovie(movie) {
  return {
    id: String(movie.id),
    type: 'movie',
    title: movie.title || movie.original_title || 'Untitled movie',
    year: movie.release_date ? movie.release_date.split('-')[0] : '',
    released: movie.release_date || null,
    poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
    backdrop: movie.backdrop_path ? `https://image.tmdb.org/t/p/w780${movie.backdrop_path}` : null,
    overview: movie.overview || '',
    tmdbRating: movie.vote_average ?? null,
    runtime: movie.runtime ?? null,
    genres: movie.genres?.map((genre) => genre.name).filter(Boolean) ?? [],
    picks: movie.picks ?? 0,
    score: movie.score ?? 0,
  }
}

function mapSeries(series) {
  return {
    id: String(series.id),
    type: 'series',
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
    picks: series.picks ?? 0,
    score: series.score ?? 0,
  }
}

function mapGame(game) {
  const platforms = game.platforms?.map((entry) => entry.platform?.name).filter(Boolean) || []
  const genres = game.genres?.map((genre) => genre.name).filter(Boolean) || []

  return {
    id: String(game.id),
    type: 'game',
    title: game.name || 'Untitled game',
    year: game.released ? game.released.split('-')[0] : '',
    released: game.released || null,
    poster: game.background_image || null,
    backdrop: game.background_image_additional || game.background_image || null,
    overview: game.description_raw || game.description || '',
    description: game.description_raw || game.description || '',
    rawgRating: game.rating ?? null,
    genres,
    platform: platforms.slice(0, 3).join(', '),
    platforms,
    picks: game.picks ?? 0,
    score: game.score ?? 0,
  }
}

function getId(value) {
  return typeof value === 'object' ? value?.id : value
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

export async function getMovieDetails(movie) {
  const movieId = getId(movie)
  if (!movieId) return null
  const data = await fetchJson(`/api/tmdb/movie?id=${encodeURIComponent(movieId)}`)
  return { ...(typeof movie === 'object' ? movie : {}), ...mapMovie(data) }
}

export async function searchSeries(query) {
  if (!query.trim()) return []
  const data = await fetchJson(`/api/tmdb/search-series?q=${encodeURIComponent(query.trim())}`)
  return (data.results || []).map(mapSeries)
}

export async function getSeriesDetails(series) {
  const seriesId = getId(series)
  if (!seriesId) return null
  const data = await fetchJson(`/api/tmdb/series?id=${encodeURIComponent(seriesId)}`)
  return { ...(typeof series === 'object' ? series : {}), ...mapSeries(data) }
}

export async function searchGames(query) {
  if (!query.trim()) return []
  const data = await fetchJson(`/api/games/search?q=${encodeURIComponent(query.trim())}`)
  return (data.results || []).map(mapGame)
}

export async function getGameDetails(game) {
  const gameId = getId(game)
  if (!gameId) return null
  const data = await fetchJson(`/api/games/game?id=${encodeURIComponent(gameId)}`)
  return { ...(typeof game === 'object' ? game : {}), ...mapGame(data) }
}
