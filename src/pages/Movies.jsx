import { useMemo, useState } from 'react'
import PageShell from '../components/PageShell.jsx'
import SwipeDeck from '../components/SwipeDeck.jsx'
import { getSavedHandle } from '../lib/handle.js'
import { demoMovies } from '../lib/demoMovies.js'

export default function Movies() {
  const [votes, setVotes] = useState({})
  const [message, setMessage] = useState(null)
  const activeHandle = getSavedHandle()

  const queue = useMemo(() => demoMovies.filter((movie) => !votes[movie.id]), [votes])
  const likedMovies = useMemo(() => demoMovies.filter((movie) => votes[movie.id] === 'like'), [votes])
  const passedMovies = useMemo(() => demoMovies.filter((movie) => votes[movie.id] === 'dislike'), [votes])

  function handleSwipe(vote, movie) {
    setVotes((current) => ({ ...current, [movie.id]: vote }))
    setMessage({ type: 'success', text: vote === 'like' ? `Added ${movie.title} to your yes list.` : `Passed on ${movie.title}.` })
    setTimeout(() => setMessage(null), 2200)
  }

  function resetDemo() {
    setVotes({})
    setMessage(null)
  }

  return (
    <PageShell active="movies">
      <section className="mb-5 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4 shadow-2xl shadow-black/20 sm:rounded-[1.75rem] md:p-5">
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Movie night</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">Pick what to watch</h1>
        <p className="mt-3 max-w-2xl text-neutral-400">
          This is the safe demo version: no frontend API keys, no public database writes. Next step is adding a serverless TMDB search endpoint.
        </p>
        {!activeHandle ? (
          <p className="mt-3 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-3 text-sm text-yellow-200">
            Optional: create a local profile with the Profile button in the navbar.
          </p>
        ) : null}
      </section>

      {message ? <div className="mb-4 rounded-2xl bg-emerald-700 p-3 text-white">{message.text}</div> : null}

      <SwipeDeck items={queue} onSwipe={handleSwipe} itemLabel="movies" likeLabel="Watch" dislikeLabel="Pass" infoType="movie" />

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Your picks</p>
              <h2 className="mt-1 text-2xl font-bold text-white">Watch list</h2>
            </div>
            <span className="text-sm text-neutral-500">{likedMovies.length}</span>
          </div>
          {likedMovies.length === 0 ? <p className="text-neutral-400">No yes votes yet.</p> : (
            <div className="space-y-2">
              {likedMovies.map((movie) => <div key={movie.id} className="rounded-2xl border border-white/10 bg-neutral-900 p-3 font-semibold text-white">{movie.title}</div>)}
            </div>
          )}
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Skipped</p>
              <h2 className="mt-1 text-2xl font-bold text-white">Pass list</h2>
            </div>
            <span className="text-sm text-neutral-500">{passedMovies.length}</span>
          </div>
          {passedMovies.length === 0 ? <p className="text-neutral-400">No passes yet.</p> : (
            <div className="space-y-2">
              {passedMovies.map((movie) => <div key={movie.id} className="rounded-2xl border border-white/10 bg-neutral-900 p-3 font-semibold text-white">{movie.title}</div>)}
            </div>
          )}
        </div>
      </section>

      {Object.keys(votes).length ? (
        <button type="button" onClick={resetDemo} className="mt-4 w-full rounded-2xl border border-white/10 px-4 py-3 font-semibold text-neutral-200 transition hover:bg-white hover:text-neutral-950">
          Reset demo votes
        </button>
      ) : null}
    </PageShell>
  )
}
