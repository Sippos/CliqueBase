import { useMemo, useState } from 'react'
import PageShell from '../components/PageShell.jsx'
import SwipeDeck from '../components/SwipeDeck.jsx'
import { getSavedHandle } from '../lib/handle.js'
import { demoMovies } from '../lib/demoMovies.js'

function DetailPill({ children }) {
  if (!children) return null
  return <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-neutral-300">{children}</span>
}

export default function Movies() {
  const [votes, setVotes] = useState({})
  const [watched, setWatched] = useState(() => demoMovies.filter((movie) => movie.watched).map((movie) => movie.id))
  const [ratings, setRatings] = useState(() => Object.fromEntries(demoMovies.filter((movie) => movie.rating).map((movie) => [movie.id, movie.rating])))
  const [editingRating, setEditingRating] = useState(null)
  const [infoMovie, setInfoMovie] = useState(null)
  const [message, setMessage] = useState(null)
  const activeHandle = getSavedHandle()

  const queue = useMemo(() => demoMovies.filter((movie) => !votes[movie.id] && !watched.includes(movie.id)), [votes, watched])
  const ranking = useMemo(() => demoMovies.slice().sort((a, b) => (votes[b.id] === 'like') - (votes[a.id] === 'like') || b.score - a.score), [votes])
  const watchedMovies = useMemo(() => demoMovies.filter((movie) => watched.includes(movie.id)), [watched])

  function handleSwipe(vote, movie) {
    setVotes((current) => ({ ...current, [movie.id]: vote }))
    setMessage({ text: vote === 'like' ? `${movie.title} moved up the ranking.` : `${movie.title} skipped for now.` })
    setTimeout(() => setMessage(null), 2200)
  }

  function markWatched(movie) {
    setWatched((current) => current.includes(movie.id) ? current : [...current, movie.id])
    setVotes((current) => ({ ...current, [movie.id]: 'like' }))
    setEditingRating(movie.id)
    setMessage({ text: `${movie.title} added to watched.` })
    setTimeout(() => setMessage(null), 2200)
  }

  function rateMovie(movie, rating) {
    setRatings((current) => ({ ...current, [movie.id]: rating }))
    setEditingRating(null)
  }

  function resetPage() {
    setVotes({})
    setWatched(demoMovies.filter((movie) => movie.watched).map((movie) => movie.id))
    setRatings(Object.fromEntries(demoMovies.filter((movie) => movie.rating).map((movie) => [movie.id, movie.rating])))
    setEditingRating(null)
    setInfoMovie(null)
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
      </section>

      {message ? <div className="mb-4 rounded-2xl bg-emerald-700 p-3 text-white">{message.text}</div> : null}

      <section className="mb-8">
        <SwipeDeck items={queue} onSwipe={handleSwipe} itemLabel="movies" likeLabel="Watch" dislikeLabel="Pass" infoType="movie" />
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
              {movie.poster ? <button type="button" onClick={() => setInfoMovie(movie)} className="shrink-0"><img src={movie.poster} alt="" className="h-14 w-10 rounded-lg object-cover transition hover:opacity-80" /></button> : null}
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => setInfoMovie(movie)} className="block max-w-full truncate text-left font-semibold text-white hover:underline">{movie.title}</button>
                <div className="mt-1 text-xs text-neutral-400">{movie.picks + (votes[movie.id] === 'like' ? 1 : 0)} picks · score {movie.score + (votes[movie.id] === 'like' ? 1 : 0)}</div>
              </div>
              <button type="button" onClick={() => setInfoMovie(movie)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-neutral-300 hover:bg-white hover:text-neutral-950">Details</button>
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
                  <button type="button" onClick={() => setEditingRating(editingRating === movie.id ? null : movie.id)} className="absolute right-3 top-3 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs font-black text-white backdrop-blur transition hover:bg-white hover:text-neutral-950">
                    ★ {ratings[movie.id] || 'Rate'}
                  </button>
                  {movie.poster ? <button type="button" onClick={() => setInfoMovie(movie)} className="shrink-0"><img src={movie.poster} alt="" className="h-24 w-16 rounded-xl object-cover transition hover:opacity-80" /></button> : null}
                  <div className="min-w-0 flex-1 pr-20">
                    <button type="button" onClick={() => setInfoMovie(movie)} className="block max-w-full truncate text-left font-bold text-white hover:underline">{movie.title}</button>
                    <p className="mt-1 text-xs text-neutral-400">{movie.year} · {movie.genres?.slice(0, 2).join(' · ')}</p>
                    <button type="button" onClick={() => setInfoMovie(movie)} className="mt-2 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:bg-white hover:text-neutral-950">Details</button>
                    {showRatingScale ? (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
                          <button key={rating} type="button" onClick={() => rateMovie(movie, rating)} className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${ratings[movie.id] === rating ? 'bg-white text-neutral-950' : 'bg-white/[0.06] text-neutral-300 hover:bg-white/20'}`}>{rating}</button>
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
