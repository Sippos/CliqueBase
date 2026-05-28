import { useMemo, useState } from 'react'
import PageShell from '../components/PageShell.jsx'
import SwipeDeck from '../components/SwipeDeck.jsx'
import { getSavedHandle } from '../lib/handle.js'
import { demoSeries } from '../lib/demoMovies.js'
import { getSeriesDetails, searchSeries } from '../lib/tmdb.js'

function DetailPill({ children }) {
  if (!children) return null
  return <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-neutral-300">{children}</span>
}

export default function Series() {
  const [series, setSeries] = useState(demoSeries)
  const [votes, setVotes] = useState({})
  const [finished, setFinished] = useState(() => demoSeries.filter((item) => item.finished).map((item) => item.id))
  const [ratings, setRatings] = useState(() => Object.fromEntries(demoSeries.filter((item) => item.rating).map((item) => [item.id, item.rating])))
  const [editingRating, setEditingRating] = useState(null)
  const [infoSeries, setInfoSeries] = useState(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const activeHandle = getSavedHandle()

  const queue = useMemo(() => series.filter((item) => !votes[item.id] && !finished.includes(item.id)), [series, votes, finished])
  const ranking = useMemo(() => series.slice().sort((a, b) => (votes[b.id] === 'like') - (votes[a.id] === 'like') || b.score - a.score || b.picks - a.picks), [series, votes])
  const finishedSeries = useMemo(() => series.filter((item) => finished.includes(item.id)), [series, finished])

  function showMessage(text) {
    setMessage({ text })
    setTimeout(() => setMessage(null), 2200)
  }

  async function handleSearch(event) {
    event.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    try {
      const found = await searchSeries(query)
      setResults(found)
      if (!found.length) showMessage('No series found.')
    } catch (error) {
      showMessage(error.message || 'Search failed.')
    } finally {
      setLoading(false)
    }
  }

  async function addSeries(item) {
    const details = await getSeriesDetails(item).catch(() => item)
    const fullItem = { ...(details || item), nominated_by: activeHandle || 'You' }
    setSeries((current) => current.some((entry) => entry.id === fullItem.id) ? current : [fullItem, ...current])
    setResults([])
    setQuery('')
    showMessage(`${fullItem.title} added to the pile.`)
  }

  function handleSwipe(vote, item) {
    setVotes((current) => ({ ...current, [item.id]: vote }))
    showMessage(vote === 'like' ? `${item.title} moved up the ranking.` : `${item.title} skipped for now.`)
  }

  function markFinished(item) {
    setFinished((current) => current.includes(item.id) ? current : [...current, item.id])
    setVotes((current) => ({ ...current, [item.id]: 'like' }))
    setEditingRating(item.id)
    showMessage(`${item.title} added to finished series.`)
  }

  function rateSeries(item, rating) {
    setRatings((current) => ({ ...current, [item.id]: rating }))
    setEditingRating(null)
  }

  async function openSeriesInfo(item) {
    setInfoSeries(item)
    try {
      const details = await getSeriesDetails(item)
      if (details) setInfoSeries({ ...item, ...details })
    } catch {
      // Keep current details.
    }
  }

  function resetPage() {
    setSeries(demoSeries)
    setVotes({})
    setFinished(demoSeries.filter((item) => item.finished).map((item) => item.id))
    setRatings(Object.fromEntries(demoSeries.filter((item) => item.rating).map((item) => [item.id, item.rating])))
    setEditingRating(null)
    setInfoSeries(null)
    setResults([])
    setQuery('')
    setMessage(null)
  }

  return (
    <PageShell active="series">
      <section className="mb-5 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4 shadow-2xl shadow-black/20 sm:rounded-[1.75rem] md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Shows</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">Pick a series to watch</h1>
            <p className="mt-3 max-w-2xl text-neutral-400">Search real TV shows, add them to the pile, swipe through options, and rate finished series.</p>
          </div>
          <button type="button" onClick={resetPage} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-neutral-200 transition hover:bg-white hover:text-neutral-950">Reset</button>
        </div>

        <form onSubmit={handleSearch} className="mt-5 flex flex-col gap-2 sm:flex-row">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search series..." className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-white/30" />
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
            {results.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900 p-3">
                {item.poster ? <button type="button" onClick={() => openSeriesInfo(item)} className="shrink-0"><img src={item.poster} alt="" className="h-16 w-11 rounded-lg object-cover transition hover:opacity-80" /></button> : null}
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => openSeriesInfo(item)} className="block max-w-full truncate text-left font-semibold text-white hover:underline">{item.title}</button>
                  <div className="mt-1 text-xs text-neutral-400">{item.year || 'Unknown year'}</div>
                </div>
                <button type="button" onClick={() => addSeries(item)} className="rounded-xl bg-white px-3 py-2 text-xs font-semibold text-neutral-950 hover:bg-neutral-200">Add</button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mb-8">
        <SwipeDeck items={queue} onSwipe={handleSwipe} itemLabel="series" likeLabel="Watch" dislikeLabel="Pass" infoType="series" loadDetails={getSeriesDetails} />
      </section>

      <section className="mb-8 rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Group pick</p>
            <h2 className="mt-1 text-2xl font-bold text-white">Next series</h2>
          </div>
          <span className="text-sm text-neutral-500">Top {Math.min(6, ranking.length)}</span>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {ranking.slice(0, 6).map((item, index) => (
            <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900 p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-neutral-950">{index + 1}</div>
              {item.poster ? <button type="button" onClick={() => openSeriesInfo(item)} className="shrink-0"><img src={item.poster} alt="" className="h-14 w-10 rounded-lg object-cover transition hover:opacity-80" /></button> : null}
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => openSeriesInfo(item)} className="block max-w-full truncate text-left font-semibold text-white hover:underline">{item.title}</button>
                <div className="mt-1 text-xs text-neutral-400">{item.picks + (votes[item.id] === 'like' ? 1 : 0)} picks · score {item.score + (votes[item.id] === 'like' ? 1 : 0)}</div>
              </div>
              <button type="button" onClick={() => openSeriesInfo(item)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-neutral-300 hover:bg-white hover:text-neutral-950">Details</button>
              <button type="button" onClick={() => markFinished(item)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-neutral-300 hover:bg-white hover:text-neutral-950">Finished</button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Finished</p>
            <h2 className="mt-1 text-3xl font-semibold text-white">Series history</h2>
          </div>
          <div className="text-sm text-neutral-500">{finishedSeries.length} finished</div>
        </div>

        {finishedSeries.length === 0 ? <p className="text-neutral-400">No finished series yet.</p> : (
          <div className="grid gap-3 md:grid-cols-2">
            {finishedSeries.map((item) => {
              const showRatingScale = !ratings[item.id] || editingRating === item.id
              return (
                <div key={item.id} className="relative flex gap-3 rounded-2xl border border-white/10 bg-neutral-900 p-3">
                  <button type="button" onClick={() => setEditingRating(editingRating === item.id ? null : item.id)} className="absolute right-3 top-3 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs font-black text-white backdrop-blur transition hover:bg-white hover:text-neutral-950">★ {ratings[item.id] || 'Rate'}</button>
                  {item.poster ? <button type="button" onClick={() => openSeriesInfo(item)} className="shrink-0"><img src={item.poster} alt="" className="h-24 w-16 rounded-xl object-cover transition hover:opacity-80" /></button> : null}
                  <div className="min-w-0 flex-1 pr-20">
                    <button type="button" onClick={() => openSeriesInfo(item)} className="block max-w-full truncate text-left font-bold text-white hover:underline">{item.title}</button>
                    <p className="mt-1 text-xs text-neutral-400">{item.year} · {item.genres?.slice(0, 2).join(' · ')}</p>
                    <button type="button" onClick={() => openSeriesInfo(item)} className="mt-2 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:bg-white hover:text-neutral-950">Details</button>
                    {showRatingScale ? (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
                          <button key={rating} type="button" onClick={() => rateSeries(item, rating)} className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${ratings[item.id] === rating ? 'bg-white text-neutral-950' : 'bg-white/[0.06] text-neutral-300 hover:bg-white/20'}`}>{rating}</button>
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

      {infoSeries ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-white/10 bg-neutral-950 p-5 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-bold leading-tight text-white">{infoSeries.title}</h3>
                <div className="mt-1 text-sm text-neutral-400">{infoSeries.year}</div>
              </div>
              <button type="button" onClick={() => setInfoSeries(null)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-xl text-neutral-300 transition hover:bg-white hover:text-black">×</button>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-[160px_1fr]">
              {infoSeries.poster ? <img src={infoSeries.poster} alt="" className="w-full rounded-2xl object-cover" /> : null}
              <div>
                <div className="flex flex-wrap gap-2">
                  {infoSeries.tmdbRating ? <DetailPill>TMDB ★ {Number(infoSeries.tmdbRating).toFixed(1)}</DetailPill> : null}
                  {infoSeries.seasons ? <DetailPill>{infoSeries.seasons} seasons</DetailPill> : null}
                  {infoSeries.episodes ? <DetailPill>{infoSeries.episodes} episodes</DetailPill> : null}
                  {infoSeries.genres?.map((genre) => <DetailPill key={genre}>{genre}</DetailPill>)}
                </div>
                <p className="mt-5 text-sm leading-7 text-neutral-300">{infoSeries.overview || 'No series description available.'}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  )
}
