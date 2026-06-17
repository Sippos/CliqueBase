import { useMemo, useState } from 'react'
import PageShell from '../components/PageShell.jsx'
import SwipeDeck from '../components/SwipeDeck.jsx'
import { getSavedHandle } from '../lib/handle.js'
import { useMediaVotes } from '../hooks/useMediaVotes.js'

function DetailPill({ children }) {
  if (!children) return null
  return <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-neutral-300">{children}</span>
}

function makeId(prefix, title) {
  return `${prefix}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now()}`
}

export default function MediaPage({ active, eyebrow, title, description, items, itemLabel, likeLabel = 'Pick', historyLabel = 'Finished' }) {
  const [library, setLibrary] = useState(items)
  const [votes, recordVote, setVotesDirectly] = useMediaVotes(itemLabel || 'media', null)
  const [finished, setFinished] = useState(() => items.filter((item) => item.watched || item.finished).map((item) => item.id))
  const [ratings, setRatings] = useState(() => Object.fromEntries(items.filter((item) => item.rating).map((item) => [item.id, item.rating])))
  const [editingRating, setEditingRating] = useState(null)
  const [infoItem, setInfoItem] = useState(null)
  const [message, setMessage] = useState(null)
  const [draft, setDraft] = useState({ title: '', year: '', poster: '', overview: '' })
  const activeHandle = getSavedHandle()

  const queue = useMemo(() => library.filter((item) => !votes[item.id] && !finished.includes(item.id)), [library, votes, finished])
  const ranking = useMemo(() => library.slice().sort((a, b) => (votes[b.id] === 'like') - (votes[a.id] === 'like') || b.score - a.score || b.picks - a.picks), [library, votes])
  const finishedItems = useMemo(() => library.filter((item) => finished.includes(item.id)), [library, finished])

  function showMessage(text) {
    setMessage({ text })
    setTimeout(() => setMessage(null), 2200)
  }

  function handleSwipe(vote, item) {
    recordVote(item.id, vote)
    showMessage(vote === 'like' ? `${item.title} moved up the ranking.` : `${item.title} skipped for now.`)
  }

  function markFinished(item) {
    setFinished((current) => current.includes(item.id) ? current : [...current, item.id])
    recordVote(item.id, 'like')
    setEditingRating(item.id)
    showMessage(`${item.title} added to ${historyLabel.toLowerCase()}.`)
  }

  function rateItem(item, rating) {
    setRatings((current) => ({ ...current, [item.id]: rating }))
    setEditingRating(null)
  }

  function addItem(event) {
    event.preventDefault()
    const cleanTitle = draft.title.trim()
    if (!cleanTitle) return

    const newItem = {
      id: makeId(active, cleanTitle),
      title: cleanTitle,
      year: draft.year.trim() || 'New pick',
      poster: draft.poster.trim() || null,
      overview: draft.overview.trim() || '',
      nominated_by: activeHandle || 'You',
      picks: 0,
      score: 0,
    }

    setLibrary((current) => [newItem, ...current])
    setDraft({ title: '', year: '', poster: '', overview: '' })
    showMessage(`${newItem.title} added to the pile.`)
  }

  function resetPage() {
    setLibrary(items)
    setVotesDirectly({})
    setFinished(items.filter((item) => item.watched || item.finished).map((item) => item.id))
    setRatings(Object.fromEntries(items.filter((item) => item.rating).map((item) => [item.id, item.rating])))
    setEditingRating(null)
    setInfoItem(null)
    setDraft({ title: '', year: '', poster: '', overview: '' })
    setMessage(null)
  }

  return (
    <PageShell active={active}>
      <div className="mb-5 pt-2">
        <div className="flex flex-col gap-4 px-1 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">{eyebrow}</p>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl md:text-5xl">{title}</h1>
            <p className="mt-3 max-w-2xl text-neutral-400">{description}</p>
          </div>
          <button type="button" onClick={resetPage} className="shrink-0 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-neutral-200 transition hover:bg-white hover:text-neutral-950">Reset</button>
        </div>

        <div className="px-1">
          <form onSubmit={addItem} className="mt-5 grid gap-2 md:grid-cols-[1fr_0.45fr_1fr_auto]">
            <input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder={`Add ${itemLabel.slice(0, -1)} title...`} className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-white/30" />
            <input value={draft.year} onChange={(event) => setDraft((current) => ({ ...current, year: event.target.value }))} placeholder="Year / label" className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-white/30" />
            <input value={draft.poster} onChange={(event) => setDraft((current) => ({ ...current, poster: event.target.value }))} placeholder="Poster image URL" className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-white/30" />
            <button type="submit" className="rounded-2xl bg-white px-5 py-3 font-semibold text-neutral-950 transition hover:bg-neutral-200">Add</button>
          </form>
          <textarea value={draft.overview} onChange={(event) => setDraft((current) => ({ ...current, overview: event.target.value }))} placeholder="Optional note or description" className="mt-2 min-h-20 w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-white/30" />
        </div>
      </div>

      {message ? <div className="mb-4 rounded-2xl bg-emerald-700 p-3 text-white">{message.text}</div> : null}

      <section className="mb-8">
        <SwipeDeck items={queue} onSwipe={handleSwipe} itemLabel={itemLabel} likeLabel={likeLabel} dislikeLabel="Pass" infoType={itemLabel.slice(0, -1)} />
      </section>

      <section className="mb-8 rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Group pick</p>
            <h2 className="mt-1 text-2xl font-bold text-white">Top {itemLabel}</h2>
          </div>
          <span className="text-sm text-neutral-500">Top {Math.min(8, ranking.length)}</span>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {ranking.slice(0, 8).map((item, index) => (
            <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900 p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-neutral-950">{index + 1}</div>
              {item.poster ? <button type="button" onClick={() => setInfoItem(item)} className="shrink-0"><img src={item.poster} alt="" className="h-14 w-10 rounded-lg object-cover transition hover:opacity-80" /></button> : null}
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => setInfoItem(item)} className="block max-w-full truncate text-left font-semibold text-white hover:underline">{item.title}</button>
                <div className="mt-1 text-xs text-neutral-400">{item.picks + (votes[item.id] === 'like' ? 1 : 0)} picks · score {item.score + (votes[item.id] === 'like' ? 1 : 0)}</div>
              </div>
              <button type="button" onClick={() => setInfoItem(item)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-neutral-300 hover:bg-white hover:text-neutral-950">Details</button>
              <button type="button" onClick={() => markFinished(item)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-neutral-300 hover:bg-white hover:text-neutral-950">Done</button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">{historyLabel}</p>
            <h2 className="mt-1 text-3xl font-semibold text-white">History</h2>
          </div>
          <div className="text-sm text-neutral-500">{finishedItems.length} saved</div>
        </div>

        {finishedItems.length === 0 ? <p className="text-neutral-400">Nothing saved yet.</p> : (
          <div className="grid gap-3 md:grid-cols-2">
            {finishedItems.map((item) => {
              const showRatingScale = !ratings[item.id] || editingRating === item.id
              return (
                <div key={item.id} className="relative flex gap-3 rounded-2xl border border-white/10 bg-neutral-900 p-3">
                  <button type="button" onClick={() => setEditingRating(editingRating === item.id ? null : item.id)} className="absolute right-3 top-3 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs font-black text-white backdrop-blur transition hover:bg-white hover:text-neutral-950">★ {ratings[item.id] || 'Rate'}</button>
                  {item.poster ? <button type="button" onClick={() => setInfoItem(item)} className="shrink-0"><img src={item.poster} alt="" className="h-24 w-16 rounded-xl object-cover transition hover:opacity-80" /></button> : null}
                  <div className="min-w-0 flex-1 pr-20">
                    <button type="button" onClick={() => setInfoItem(item)} className="block max-w-full truncate text-left font-bold text-white hover:underline">{item.title}</button>
                    <p className="mt-1 text-xs text-neutral-400">{item.year || 'No year'}{item.genres?.length ? ` · ${item.genres.slice(0, 2).join(' · ')}` : ''}</p>
                    <button type="button" onClick={() => setInfoItem(item)} className="mt-2 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:bg-white hover:text-neutral-950">Details</button>
                    {showRatingScale ? (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
                          <button key={rating} type="button" onClick={() => rateItem(item, rating)} className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${ratings[item.id] === rating ? 'bg-white text-neutral-950' : 'bg-white/[0.06] text-neutral-300 hover:bg-white/20'}`}>{rating}</button>
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

      {infoItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-white/10 bg-neutral-950 p-5 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-bold leading-tight text-white">{infoItem.title}</h3>
                <div className="mt-1 text-sm text-neutral-400">{infoItem.year}</div>
              </div>
              <button type="button" onClick={() => setInfoItem(null)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-xl text-neutral-300 transition hover:bg-white hover:text-black">×</button>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-[160px_1fr]">
              {infoItem.poster ? <img src={infoItem.poster} alt="" className="w-full rounded-2xl object-cover" /> : null}
              <div>
                <div className="flex flex-wrap gap-2">
                  {infoItem.platform ? <DetailPill>{infoItem.platform}</DetailPill> : null}
                  {infoItem.genres?.map((genre) => <DetailPill key={genre}>{genre}</DetailPill>)}
                  {ratings[infoItem.id] ? <DetailPill>Your rating ★ {ratings[infoItem.id]}</DetailPill> : null}
                </div>
                <p className="mt-5 text-sm leading-7 text-neutral-300">{infoItem.overview || infoItem.description || 'No description yet.'}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  )
}
