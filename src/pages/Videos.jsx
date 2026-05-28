import { useMemo, useState } from 'react'
import PageShell from '../components/PageShell.jsx'
import SwipeDeck from '../components/SwipeDeck.jsx'
import { getSavedHandle } from '../lib/handle.js'
import { demoVideos } from '../lib/demoMovies.js'

function getYoutubeId(url) {
  const value = String(url || '').trim()
  if (!value) return null

  const patterns = [
    /youtu\.be\/([^?&#/]+)/,
    /youtube\.com\/watch\?v=([^?&#/]+)/,
    /youtube\.com\/shorts\/([^?&#/]+)/,
    /youtube\.com\/embed\/([^?&#/]+)/,
  ]

  for (const pattern of patterns) {
    const match = value.match(pattern)
    if (match?.[1]) return match[1]
  }

  return null
}

function makeTitleFromUrl(url) {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return 'Saved video'
  }
}

function makeVideo(url, title, activeHandle) {
  const cleanUrl = url.trim()
  const youtubeId = getYoutubeId(cleanUrl)
  const fallbackTitle = title.trim() || makeTitleFromUrl(cleanUrl)

  return {
    id: `video-${Date.now()}`,
    title: fallbackTitle,
    year: 'Saved link',
    url: cleanUrl,
    poster: youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : null,
    overview: cleanUrl,
    nominated_by: activeHandle || 'You',
    picks: 0,
    score: 0,
  }
}

function DetailPill({ children }) {
  if (!children) return null
  return <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-neutral-300">{children}</span>
}

export default function Videos() {
  const [videos, setVideos] = useState(demoVideos)
  const [votes, setVotes] = useState({})
  const [saved, setSaved] = useState(() => demoVideos.filter((item) => item.saved).map((item) => item.id))
  const [ratings, setRatings] = useState(() => Object.fromEntries(demoVideos.filter((item) => item.rating).map((item) => [item.id, item.rating])))
  const [editingRating, setEditingRating] = useState(null)
  const [infoVideo, setInfoVideo] = useState(null)
  const [draft, setDraft] = useState({ url: '', title: '' })
  const [message, setMessage] = useState(null)
  const activeHandle = getSavedHandle()

  const queue = useMemo(() => videos.filter((item) => !votes[item.id] && !saved.includes(item.id)), [videos, votes, saved])
  const ranking = useMemo(() => videos.slice().sort((a, b) => (votes[b.id] === 'like') - (votes[a.id] === 'like') || b.score - a.score || b.picks - a.picks), [videos, votes])
  const savedVideos = useMemo(() => videos.filter((item) => saved.includes(item.id)), [videos, saved])

  function showMessage(text) {
    setMessage({ text })
    setTimeout(() => setMessage(null), 2200)
  }

  function addVideo(event) {
    event.preventDefault()
    if (!draft.url.trim()) return

    const video = makeVideo(draft.url, draft.title, activeHandle)
    setVideos((current) => [video, ...current])
    setDraft({ url: '', title: '' })
    showMessage(`${video.title} added to the pile.`)
  }

  function handleSwipe(vote, item) {
    setVotes((current) => ({ ...current, [item.id]: vote }))
    showMessage(vote === 'like' ? `${item.title} moved up the ranking.` : `${item.title} skipped for now.`)
  }

  function markSaved(item) {
    setSaved((current) => current.includes(item.id) ? current : [...current, item.id])
    setVotes((current) => ({ ...current, [item.id]: 'like' }))
    setEditingRating(item.id)
    showMessage(`${item.title} added to saved videos.`)
  }

  function rateVideo(item, rating) {
    setRatings((current) => ({ ...current, [item.id]: rating }))
    setEditingRating(null)
  }

  function resetPage() {
    setVideos(demoVideos)
    setVotes({})
    setSaved(demoVideos.filter((item) => item.saved).map((item) => item.id))
    setRatings(Object.fromEntries(demoVideos.filter((item) => item.rating).map((item) => [item.id, item.rating])))
    setEditingRating(null)
    setInfoVideo(null)
    setDraft({ url: '', title: '' })
    setMessage(null)
  }

  return (
    <PageShell active="videos">
      <section className="mb-5 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4 shadow-2xl shadow-black/20 sm:rounded-[1.75rem] md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Shared links</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl md:text-4xl">Save videos by URL</h1>
            <p className="mt-3 max-w-2xl text-neutral-400">Paste a video link. A title is optional, and YouTube links get a thumbnail automatically.</p>
          </div>
          <button type="button" onClick={resetPage} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-neutral-200 transition hover:bg-white hover:text-neutral-950">Reset</button>
        </div>

        <form onSubmit={addVideo} className="mt-5 grid gap-2 md:grid-cols-[1fr_0.7fr_auto]">
          <input value={draft.url} onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))} placeholder="Paste video URL..." className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-white/30" />
          <input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Optional title" className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-white/30" />
          <button type="submit" className="rounded-2xl bg-white px-5 py-3 font-semibold text-neutral-950 transition hover:bg-neutral-200">Add</button>
        </form>
      </section>

      {message ? <div className="mb-4 rounded-2xl bg-emerald-700 p-3 text-white">{message.text}</div> : null}

      <section className="mb-8">
        <SwipeDeck items={queue} onSwipe={handleSwipe} itemLabel="videos" likeLabel="Save" dislikeLabel="Pass" infoType="video" />
      </section>

      <section className="mb-8 rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Group pick</p>
            <h2 className="mt-1 text-2xl font-bold text-white">Top videos</h2>
          </div>
          <span className="text-sm text-neutral-500">Top {Math.min(6, ranking.length)}</span>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {ranking.slice(0, 6).map((item, index) => (
            <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900 p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-neutral-950">{index + 1}</div>
              {item.poster ? <button type="button" onClick={() => setInfoVideo(item)} className="shrink-0"><img src={item.poster} alt="" className="h-14 w-20 rounded-lg object-cover transition hover:opacity-80" /></button> : null}
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => setInfoVideo(item)} className="block max-w-full truncate text-left font-semibold text-white hover:underline">{item.title}</button>
                <div className="mt-1 text-xs text-neutral-400">{item.picks + (votes[item.id] === 'like' ? 1 : 0)} picks · score {item.score + (votes[item.id] === 'like' ? 1 : 0)}</div>
              </div>
              <button type="button" onClick={() => setInfoVideo(item)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-neutral-300 hover:bg-white hover:text-neutral-950">Details</button>
              <button type="button" onClick={() => markSaved(item)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-neutral-300 hover:bg-white hover:text-neutral-950">Saved</button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Saved</p>
            <h2 className="mt-1 text-3xl font-semibold text-white">Video history</h2>
          </div>
          <div className="text-sm text-neutral-500">{savedVideos.length} saved</div>
        </div>

        {savedVideos.length === 0 ? <p className="text-neutral-400">No saved videos yet.</p> : (
          <div className="grid gap-3 md:grid-cols-2">
            {savedVideos.map((item) => {
              const showRatingScale = !ratings[item.id] || editingRating === item.id
              return (
                <div key={item.id} className="relative flex gap-3 rounded-2xl border border-white/10 bg-neutral-900 p-3">
                  <button type="button" onClick={() => setEditingRating(editingRating === item.id ? null : item.id)} className="absolute right-3 top-3 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs font-black text-white backdrop-blur transition hover:bg-white hover:text-neutral-950">★ {ratings[item.id] || 'Rate'}</button>
                  {item.poster ? <button type="button" onClick={() => setInfoVideo(item)} className="shrink-0"><img src={item.poster} alt="" className="h-24 w-32 rounded-xl object-cover transition hover:opacity-80" /></button> : null}
                  <div className="min-w-0 flex-1 pr-20">
                    <button type="button" onClick={() => setInfoVideo(item)} className="block max-w-full truncate text-left font-bold text-white hover:underline">{item.title}</button>
                    {item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-neutral-400 hover:text-white">Open link</a> : null}
                    {showRatingScale ? (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
                          <button key={rating} type="button" onClick={() => rateVideo(item, rating)} className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${ratings[item.id] === rating ? 'bg-white text-neutral-950' : 'bg-white/[0.06] text-neutral-300 hover:bg-white/20'}`}>{rating}</button>
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

      {infoVideo ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-white/10 bg-neutral-950 p-5 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-bold leading-tight text-white">{infoVideo.title}</h3>
                <div className="mt-1 text-sm text-neutral-400">{infoVideo.year}</div>
              </div>
              <button type="button" onClick={() => setInfoVideo(null)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-xl text-neutral-300 transition hover:bg-white hover:text-black">×</button>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-[220px_1fr]">
              {infoVideo.poster ? <img src={infoVideo.poster} alt="" className="w-full rounded-2xl object-cover" /> : null}
              <div>
                <div className="flex flex-wrap gap-2">
                  {infoVideo.url ? <DetailPill>Link</DetailPill> : null}
                  {ratings[infoVideo.id] ? <DetailPill>Your rating ★ {ratings[infoVideo.id]}</DetailPill> : null}
                </div>
                <p className="mt-5 break-words text-sm leading-7 text-neutral-300">{infoVideo.overview || infoVideo.url || 'No description yet.'}</p>
                {infoVideo.url ? <a href={infoVideo.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-neutral-200">Open video</a> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  )
}
