import { useMemo, useRef, useState } from 'react'
import SwipeDeck from '../components/SwipeDeck.jsx'
import PageShell from '../components/PageShell.jsx'
import { DetailPill, InfoModal, PageHero, StatusMessage, displayYear } from '../components/MediaBlocks.jsx'
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
    platform: youtubeId ? 'YouTube' : 'Link',
    nominated_by: activeHandle || 'You',
    picks: 0,
    score: 0,
  }
}

function VideoCard({ video, onInfo, onClassic }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-neutral-950/70 transition hover:border-white/20">
      <div className="relative">
        <button type="button" onClick={() => onInfo(video)} className="block w-full text-left">
          {video.poster ? (
            <img src={video.poster} alt="" className="h-52 w-full object-cover transition hover:scale-105" />
          ) : (
            <div className="flex h-52 items-center justify-center bg-neutral-900 text-neutral-500 uppercase tracking-[0.3em]">{video.platform || 'video'}</div>
          )}
        </button>
        <button type="button" onClick={() => onInfo(video)} className="absolute right-3 top-3 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-sm text-white backdrop-blur hover:bg-white hover:text-black">ⓘ</button>
      </div>
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-neutral-500">
          <span>{video.platform || 'link'}</span>
          <span>•</span>
          <span>by {video.nominated_by || 'Someone'}</span>
        </div>
        <button type="button" onClick={() => onInfo(video)} className="mt-2 block w-full text-left text-lg font-semibold leading-tight text-white hover:underline">{video.title}</button>
        <div className="mt-3 flex flex-wrap gap-2">
          {video.saved ? <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-neutral-950">Classic</span> : <button type="button" onClick={() => onClassic(video)} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-neutral-300 hover:bg-white hover:text-neutral-950">Mark classic</button>}
          {video.url ? <a href={video.url} target="_blank" rel="noreferrer" className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-neutral-300 hover:bg-white hover:text-neutral-950">Open link</a> : null}
        </div>
      </div>
    </div>
  )
}

export default function Videos() {
  const [videos, setVideos] = useState(demoVideos)
  const [votes, setVotes] = useState({})
  const [classics, setClassics] = useState(() => demoVideos.filter((item) => item.saved).map((item) => item.id))
  const [infoVideo, setInfoVideo] = useState(null)
  const [draft, setDraft] = useState({ url: '', title: '' })
  const [message, setMessage] = useState(null)
  const deckRef = useRef(null)
  const activeHandle = getSavedHandle()

  const classicVideos = useMemo(() => videos.filter((item) => classics.includes(item.id)), [videos, classics])
  const feedVideos = useMemo(() => videos.slice().sort((a, b) => (classics.includes(b.id)) - (classics.includes(a.id)) || (b.score || 0) - (a.score || 0)), [videos, classics])
  const votePile = useMemo(() => videos.filter((item) => !classics.includes(item.id) && !votes[item.id]).slice(0, 20), [videos, classics, votes])

  function showMessage(text, type = 'success') {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 2200)
  }

  function addVideo(event, markClassic = false) {
    event.preventDefault()
    if (!draft.url.trim()) return

    const video = makeVideo(draft.url, draft.title, activeHandle)
    setVideos((current) => [video, ...current])
    if (markClassic) setClassics((current) => [video.id, ...current])
    setDraft({ url: '', title: '' })
    showMessage(markClassic ? `"${video.title}" saved as classic.` : `"${video.title}" uploaded to the feed.`)
  }

  function markClassic(video) {
    setClassics((current) => current.includes(video.id) ? current : [video.id, ...current])
    setVotes((current) => ({ ...current, [video.id]: 'like' }))
    showMessage(`"${video.title}" saved as classic.`)
  }

  function handleSwipe(vote, video) {
    setVotes((current) => ({ ...current, [video.id]: vote }))
    if (vote === 'like') markClassic(video)
    else showMessage(`You passed on "${video.title}".`)
  }

  function resetPage() {
    setVideos(demoVideos)
    setVotes({})
    setClassics(demoVideos.filter((item) => item.saved).map((item) => item.id))
    setInfoVideo(null)
    setDraft({ url: '', title: '' })
    setMessage(null)
  }

  return (
    <PageShell active="videos">
      <PageHero
        eyebrow="Shared link dump"
        title="Upload funny links"
        description="Paste YouTube or other video links, keep a group feed, swipe the non-classics, and pin the best links forever."
        warning={!activeHandle ? 'Create a profile with the Profile button in the navbar before uploading so your name appears on links.' : null}
        actions={<button type="button" onClick={resetPage} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-neutral-200 transition hover:bg-white hover:text-neutral-950">Reset</button>}
      >
        <form onSubmit={(event) => addVideo(event, false)} className="mt-5 space-y-3">
          <input className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" placeholder="Paste YouTube / TikTok / Instagram / video link" value={draft.url} onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))} />
          <input className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" placeholder="Funny title (optional)" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button type="submit" className="rounded-2xl bg-white px-5 py-3 font-semibold text-neutral-950 transition hover:bg-neutral-200">Upload to feed</button>
            <button type="button" onClick={(event) => addVideo(event, true)} className="rounded-2xl border border-white/10 px-5 py-3 font-semibold text-white transition hover:bg-white hover:text-neutral-950">Upload as classic</button>
          </div>
        </form>
      </PageHero>

      <StatusMessage message={message} />

      <section className="mb-10 rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Latest uploads</p>
            <h2 className="mt-1 text-3xl font-semibold text-white">Video feed</h2>
          </div>
          <div className="text-sm text-neutral-500">{videos.length} uploaded link{videos.length === 1 ? '' : 's'}</div>
        </div>
        {feedVideos.length === 0 ? <p className="text-neutral-400">No links uploaded yet.</p> : <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{feedVideos.map((video) => <VideoCard key={video.id} video={{ ...video, saved: classics.includes(video.id) }} onInfo={setInfoVideo} onClassic={markClassic} />)}</div>}
      </section>

      <section ref={deckRef} className="mb-10">
        <SwipeDeck items={votePile} onSwipe={handleSwipe} itemLabel="videos" emptyLabel="No non-classic videos left to vote on" likeLabel="Classic" dislikeLabel="Pass" infoType="video" />
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Hall of fame</p>
            <h2 className="mt-1 text-3xl font-semibold text-white">Classic funny videos</h2>
          </div>
          <div className="max-w-xs text-sm text-neutral-500 sm:text-right">Pinned links the group wants to remember forever</div>
        </div>
        {classicVideos.length === 0 ? <p className="text-neutral-400">No classics yet.</p> : <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{classicVideos.map((video) => <VideoCard key={video.id} video={{ ...video, saved: true }} onInfo={setInfoVideo} onClassic={markClassic} />)}</div>}
      </section>

      <InfoModal item={infoVideo} onClose={() => setInfoVideo(null)} year={displayYear(infoVideo?.year)}>
        <div className="mt-4 flex flex-wrap gap-2">
          {infoVideo?.platform ? <DetailPill>{infoVideo.platform}</DetailPill> : null}
          {classics.includes(infoVideo?.id) ? <DetailPill>Classic</DetailPill> : null}
          {infoVideo?.nominated_by ? <DetailPill>Added by {infoVideo.nominated_by}</DetailPill> : null}
        </div>
        {infoVideo?.poster ? <img src={infoVideo.poster} alt="" className="mt-5 max-h-80 w-full rounded-3xl object-cover" /> : null}
        <p className="mt-5 break-words text-sm leading-7 text-neutral-300">{infoVideo?.overview || infoVideo?.url || 'No description yet.'}</p>
        {infoVideo?.url ? <a href={infoVideo.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-neutral-200">Open video</a> : null}
      </InfoModal>
    </PageShell>
  )
}
