import { useEffect, useMemo, useState } from 'react'
import PageShell from '../components/PageShell.jsx'
import SwipeDeck from '../components/SwipeDeck.jsx'
import { getSavedHandle } from '../lib/handle.js'
import { demoMovies } from '../lib/demoMovies.js'
import { getMovieDetails, searchMovies } from '../lib/tmdb.js'
import { getMovies, markMovieWatched, rateMovie as saveMovieRating, saveMovie, supabase, voteMovie } from '../lib/supabaseClient.js'

function DetailPill({ children }) {
  if (!children) return null
  return <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-neutral-300">{children}</span>
}

export default function Movies() {
  const [movies, setMovies] = useState(demoMovies)
  const [votes, setVotes] = useState({})
  const [watched, setWatched] = useState(() => demoMovies.filter((movie) => movie.watched).map((movie) => movie.id))
  const [ratings, setRatings] = useState(() => Object.fromEntries(demoMovies.filter((movie) => movie.rating).map((movie) => [movie.id, movie.rating])))
  const [editingRating, setEditingRating] = useState(null)
  const [infoMovie, setInfoMovie] = useState(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const activeHandle = getSavedHandle()
  const hasSupabase = Boolean(supabase)

  const queue = useMemo(() => movies.filter((movie) => !votes[movie.id] && !watched.includes(movie.id)), [movies, votes, watched])
  const ranking = useMemo(() => movies.slice().sort((a, b) => (votes[b.id] === 'like') - (votes[a.id] === 'like') || b.score - a.score || b.picks - a.picks), [movies, votes])
  const watchedMovies = useMemo(() => movies.filter((movie) => watched.includes(movie.id)), [movies, watched])

  useEffect(() => {
    if (!hasSupabase) return
    loadMovies()
  }, [hasSupabase])

  async function loadMovies() {
    try {
      const rows = await getMovies()
      if (rows.length) {
        setMovies(rows)
        setWatched(rows.filter((movie) => movie.watched).map((movie) => movie.id))
        setRatings(Object.fromEntries(rows.filter((movie) => movie.rating).map((movie) => [movie.id, movie.rating])))
      }
    } catch (error) {
      setMessage({ text: `Could not load saved movies: ${error.message}` })
    }
  }

  function showMessage(text) {
    setMessage({ text })
    setTimeout(() => setMessage(null), 2200)
  }

  async function handleSearch(event) {
    event.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    try {
      const found = await searchMovies(query)
      setResults(found)
      if (!found.length) showMessage('No movies found.')
    } catch (error) {
      showMessage(error.message || 'Search failed.')
    } finally {
      setLoading(false)
    }
  }

  async function addMovie(movie) {
    try {
      const details = await getMovieDetails(movie.id).catch(() => movie)
      const fullMovie = details || movie

      if (hasSupabase) {
        const saved = await saveMovie(fullMovie, activeHandle || 'anonymous')
        setMovies((current) => current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current])
      } else {
        setMovies((current) => current.some((item) => item.id === fullMovie.id) ? current : [{ ...fullMovie, nominated_by: activeHandle || 'You' }, ...current])
      }

      setResults([])
      setQuery('')
      showMessage(`${fullMovie.title} added to the pile.`)
    } catch (error) {
      showMessage(error.message || 'Could not add movie.')
    }
  }

  async function handleSwipe(vote, movie) {
    setVotes((current) => ({ ...current, [movie.id]: vote }))

    if (hasSupabase) {
      try {
        await voteMovie(movie, vote)
        await loadMovies()
      } catch (error) {
        showMessage(error.message || 'Could not save vote.')
        return
      }
    }

    showMessage(vote === 'like' ? `${movie.title} moved up the ranking.` : `${movie.title} skipped for now.`)
  }

  async function markWatched(movie) {
    setWatched((current) => current.includes(movie.id) ? current : [...current, movie.id])
    setVotes((current) => ({ ...current, [movie.id]: 'like' }))
    setEditingRating(movie.id)

    if (hasSupabase) {
      try {
        await markMovieWatched(movie, ratings[movie.id] || null)
        await loadMovies()
      } catch (error) {
        showMessage(error.message || 'Could not save watched movie.')
        return
      }
    }

    showMessage(`${movie.title} added to watched.`)
  }

  async function rateWatchedMovie(movie, rating) {
    setRatings((current) => ({ ...current, [movie.id]: rating }))
    setEditingRating(null)

    if (hasSupabase) {
      try {
        await saveMovieRating(movie, rating)
        await loadMovies()
      } catch (error) {
        showMessage(error.message || 'Could not save rating.')
      }
    }
  }

  async function openMovieInfo(movie) {
    setInfoMovie(movie)
    try {
      const details = await getMovieDetails(movie.id)
      if (details) setInfoMovie({ ...movie, ...details })
    } catch {
      // Keep existing local details.
    }
  }

  function resetPage() {
    setMovies(demoMovies)
    setVotes({})
    setWatched(demoMovies.filter((movie) => movie.watched).map((movie) => movie.id))
    setRatings(Object.fromEntries(demoMovies.filter((movie) => movie.rating).map((movie) => [movie.id, movie.rating])))
    setEditingRating(null)
    setInfoMovie(null)
    setResults([])
    setQuery('')
    setMessage(null)
  }

  return (
    <PageShell active="movies">
      <section className="mb-5 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4 shadow-2xl shadow-black/20 sm:rounded-[1.75rem] md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Movie night</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">Pick what to watch</h1>
            <p className="mt-3 max-w-2xl text-neutral-400">Add movies to the pile, swipe through the options, and keep a watched list with ratings.</p>
          </div>
          <button type="button" onClick={resetPage} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-neutral-200 transition hover:bg-white hover:text-neutral-950">Reset</button>
        </div>
        {!activeHandle ? <p className="mt-3 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-3 text-sm text-yellow-200">Create a profile in the navbar to keep your picks under one name.</p> : null}

        <form onSubmit={handleSearch} className="mt-5 flex flex-col gap-2 sm:flex-row">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search movies..." className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-white/30" />
          <button type="submit" disabled={loading} className="rounded-2xl bg-white px-5 py-3 font-semibold text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-60">{loading ? 'Searching...' : 'Search'}</button>
        </form>
      </section>

      {message ? <div className="mb-4 rounded-2xl bg-emerald-700 p-3 text-white">{message.text}</div> : null}

      {results.length ? (
        <section className="mb-8 rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Search results</p>
              <h2 className="mt-1 text-2xl font-bold text-white">Add to pile</h2>
            </div>
            <button type="button" onClick={() => setResults([])} className="text-sm text-neutral-400 hover:text-white">Clear</button>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {results.map((movie) => (
              <div key={movie.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900 p-3">
                {movie.poster ? <button type="button" onClick={() => openMovieInfo(movie)} className="shrink-0"><img src={movie.poster} alt="" className="h-16 w-11 rounded-lg object-cover transition hover:opacity-80" /></button> : null}
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => openMovieInfo(movie)} className="block max-w-full truncate text-left font-semibold text-white hover:underline">{movie.title}</button>
                  <div className="mt-1 text-xs text-neutral-400">{movie.year || 'Unknown year'}</div>
                </div>
                <button type="button" onClick={() => addMovie(movie)} className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-neutral-950 hover:bg-neutral-200">Add</button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mb-8">
        <SwipeDeck items={queue} onSwipe={handleSwipe} itemLabel="movies" likeLabel="Watch" dislikeLabel="Pass" infoType="movie" loadDetails={getMovieDetails} />
      </section>

      <section className="mb-8 rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Group pick</p>
            <h2 className="mt-1 text-2xl font-bold text-white">Next movies</h2>
          </div>
          <span className="text-sm text-neutral-500">Top {Math.min(6, ranking.length)}</span>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {ranking.slice(0, 6).map((movie, index) => (
            <div key={movie.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900 p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-neutral-950">{index + 1}</div>
              {movie.poster ? <button type="button" onClick={() => openMovieInfo(movie)} className="shrink-0"><img src={movie.poster} alt="" className="h-14 w-10 rounded-lg object-cover transition hover:opacity-80" /></button> : null}
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => openMovieInfo(movie)} className="block max-w-full truncate text-left font-semibold text-white hover:underline">{movie.title}</button>
                <div className="mt-1 text-xs text-neutral-400">{movie.picks + (votes[movie.id] === 'like' ? 1 : 0)} picks · score {movie.score + (votes[movie.id] === 'like' ? 1 : 0)}</div>
              </div>
              <button type="button" onClick={() => openMovieInfo(movie)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-neutral-300 hover:bg-white hover:text-neutral-950">Details</button>
              <button type="button" onClick={() => markWatched(movie)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-neutral-300 hover:bg-white hover:text-neutral-950">Watched</button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Watched</p>
            <h2 className="mt-1 text-3xl font-semibold text-white">Movie history</h2>
          </div>
          <div className="text-sm text-neutral-500">{watchedMovies.length} watched</div>
        </div>

        {watchedMovies.length === 0 ? <p className="text-neutral-400">No watched movies yet.</p> : (
          <div className="grid gap-3 md:grid-cols-2">
            {watchedMovies.map((movie) => {
              const showRatingScale = !ratings[movie.id] || editingRating === movie.id
              return (
                <div key={movie.id} className="relative flex gap-3 rounded-2xl border border-white/10 bg-neutral-900 p-3">
                  <button type="button" onClick={() => setEditingRating(editingRating === movie.id ? null : movie.id)} className="absolute right-3 top-3 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs font-black text-white backdrop-blur transition hover:bg-white hover:text-neutral-950">★ {ratings[movie.id] || 'Rate'}</button>
                  {movie.poster ? <button type="button" onClick={() => openMovieInfo(movie)} className="shrink-0"><img src={movie.poster} alt="" className="h-24 w-16 rounded-xl object-cover transition hover:opacity-80" /></button> : null}
                  <div className="min-w-0 flex-1 pr-20">
                    <button type="button" onClick={() => openMovieInfo(movie)} className="block max-w-full truncate text-left font-bold text-white hover:underline">{movie.title}</button>
                    <p className="mt-1 text-xs text-neutral-400">{movie.year} · {movie.genres?.slice(0, 2).join(' · ')}</p>
                    <button type="button" onClick={() => openMovieInfo(movie)} className="mt-2 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:bg-white hover:text-neutral-950">Details</button>
                    {showRatingScale ? (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
                          <button key={rating} type="button" onClick={() => rateWatchedMovie(movie, rating)} className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${ratings[movie.id] === rating ? 'bg-white text-neutral-950' : 'bg-white/[0.06] text-neutral-300 hover:bg-white/20'}`}>{rating}</button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {infoMovie ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-white/10 bg-neutral-950 p-5 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-bold leading-tight text-white">{infoMovie.title}</h3>
                <div className="mt-1 text-sm text-neutral-400">{infoMovie.year}</div>
              </div>
              <button type="button" onClick={() => setInfoMovie(null)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-xl text-neutral-300 transition hover:bg-white hover:text-black">×</button>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-[160px_1fr]">
              {infoMovie.poster ? <img src={infoMovie.poster} alt="" className="w-full rounded-2xl object-cover" /> : null}
              <div>
                <div className="flex flex-wrap gap-2">
                  {infoMovie.tmdbRating ? <DetailPill>TMDB ★ {Number(infoMovie.tmdbRating).toFixed(1)}</DetailPill> : null}
                  {infoMovie.runtime ? <DetailPill>{infoMovie.runtime} min</DetailPill> : null}
                  {infoMovie.genres?.map((genre) => <DetailPill key={genre}>{genre}</DetailPill>)}
                </div>
                <p className="mt-5 text-sm leading-7 text-neutral-300">{infoMovie.overview || 'No movie description available.'}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  )
}
