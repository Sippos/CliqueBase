import { useMemo, useState } from 'react'
import PageShell from '../components/PageShell.jsx'
import SwipeDeck from '../components/SwipeDeck.jsx'
import { getSavedHandle } from '../lib/handle.js'
import { demoMovies } from '../lib/demoMovies.js'

export default function Movies() {
  const [votes, setVotes] = useState({})
  const [watched, setWatched] = useState(() => demoMovies.filter((movie) => movie.watched).map((movie) => movie.id))
  const [ratings, setRatings] = useState(() => Object.fromEntries(demoMovies.filter((movie) => movie.rating).map((movie) => [movie.id, movie.rating])))
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
    setMessage({ text: `${movie.title} added to watched.` })
    setTimeout(() => setMessage(null), 2200)
  }

  function resetPage() {
    setVotes({})
    setWatched(demoMovies.filter((movie) => movie.watched).map((movie) => movie.id))
    setRatings(Object.fromEntries(demoMovies.filter((movie) => movie.rating).map((movie) => [movie.id, movie.rating])))
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

      <section className="mb-8 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <SwipeDeck items={queue} onSwipe={handleSwipe} itemLabel="movies" likeLabel="Watch" dislikeLabel="Pass" infoType="movie" />

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Group pick</p>
              <h2 className="mt-1 text-2xl font-bold text-white">Next movies</h2>
            </div>
            <span className="text-sm text-neutral-500">Top {Math.min(4, ranking.length)}</span>
          </div>
          <div className="space-y-2">
            {ranking.slice(0, 4).map((movie, index) => (
              <div key={movie.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900 p-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-neutral-950">{index + 1}</div>
                {movie.poster ? <img src={movie.poster} alt="" className="h-14 w-10 rounded-lg object-cover" /> : null}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-white">{movie.title}</div>
                  <div className="mt-1 text-xs text-neutral-400">{movie.picks + (votes[movie.id] === 'like' ? 1 : 0)} picks · score {movie.score + (votes[movie.id] === 'like' ? 1 : 0)}</div>
                </div>
                <button type="button" onClick={() => markWatched(movie)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-neutral-300 hover:bg-white hover:text-neutral-950">Watched</button>
              </div>
            ))}
          </div>
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
            {watchedMovies.map((movie) => (
              <div key={movie.id} className="flex gap-3 rounded-2xl border border-white/10 bg-neutral-900 p-3">
                {movie.poster ? <img src={movie.poster} alt="" className="h-24 w-16 rounded-xl object-cover" /> : null}
                <div className="min-w-0 flex-1">
                  <h3 className="truncate font-bold text-white">{movie.title}</h3>
                  <p className="mt-1 text-xs text-neutral-400">{movie.year} · {movie.genres?.slice(0, 2).join(' · ')}</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {[2, 4, 6, 8, 10].map((rating) => (
                      <button key={rating} type="button" onClick={() => setRatings((current) => ({ ...current, [movie.id]: rating }))} className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${ratings[movie.id] === rating ? 'bg-white text-neutral-950' : 'bg-white/[0.06] text-neutral-300 hover:bg-white/20'}`}>{rating}</button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-neutral-500">Your rating: {ratings[movie.id] || 'not rated'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  )
}
