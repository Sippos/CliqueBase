import { useMemo, useState } from 'react'
import PageShell from '../components/PageShell.jsx'
import { DetailPill, InfoModal, PageHero, StatusMessage } from '../components/MediaBlocks.jsx'
import { getSavedHandle } from '../lib/handle.js'
import { getActiveGroup } from '../lib/groups.js'

function detectSource(url) {
  const value = String(url || '').toLowerCase()
  if (value.includes('spotify.com')) return 'Spotify'
  if (value.includes('music.apple.com')) return 'Apple Music'
  if (value.includes('youtube.com') || value.includes('youtu.be')) return 'YouTube'
  if (value.includes('soundcloud.com')) return 'SoundCloud'
  return 'Music link'
}

function getYoutubeId(url) {
  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes('youtu.be')) return parsed.pathname.replace('/', '')
    return parsed.searchParams.get('v') || ''
  } catch {
    return ''
  }
}

function makeTitleFromUrl(url) {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return 'Shared song'
  }
}

function makeTrack(draft, handle, group) {
  const cleanUrl = draft.url.trim()
  const source = detectSource(cleanUrl)
  const youtubeId = source === 'YouTube' ? getYoutubeId(cleanUrl) : ''

  return {
    id: `music-${Date.now()}`,
    title: draft.title.trim() || makeTitleFromUrl(cleanUrl),
    url: cleanUrl,
    source,
    nominated_by: handle || 'Someone',
    groupName: group?.name || '',
    poster: youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : '',
    createdAt: new Date().toISOString(),
    saved: false,
  }
}

function TrackCard({ track, onSave, onRemove, onInfo }) {
  return (
    <article className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 transition hover:-translate-y-0.5 hover:bg-white/[0.05]">
      <div className="flex flex-col gap-4 sm:flex-row">
        <button type="button" onClick={() => onInfo(track)} className="flex h-24 w-full shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-neutral-900 sm:w-36">
          {track.poster ? <img src={track.poster} alt="" className="h-full w-full object-cover" /> : <span className="text-4xl">🎵</span>}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <DetailPill>{track.source}</DetailPill>
            {track.groupName ? <DetailPill>{track.groupName}</DetailPill> : null}
            {track.saved ? <DetailPill>Saved</DetailPill> : null}
          </div>
          <button type="button" onClick={() => onInfo(track)} className="mt-3 block w-full truncate text-left text-2xl font-black text-white hover:underline">{track.title}</button>
          <p className="mt-1 text-sm text-neutral-400">Added by {track.nominated_by}</p>
          <p className="mt-2 truncate text-sm text-neutral-600">{track.url}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={track.url} target="_blank" rel="noreferrer" className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-neutral-200">Open link</a>
            <button type="button" onClick={() => onSave(track)} className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white hover:text-neutral-950">{track.saved ? 'Unsave' : 'Save'}</button>
            <button type="button" onClick={() => onRemove(track)} className="rounded-2xl border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500 hover:text-white">Delete</button>
          </div>
        </div>
      </div>
    </article>
  )
}

export default function Music() {
  const [tracks, setTracks] = useState([])
  const [draft, setDraft] = useState({ url: '', title: '' })
  const [message, setMessage] = useState(null)
  const [infoTrack, setInfoTrack] = useState(null)
  const activeHandle = getSavedHandle()
  const activeGroup = getActiveGroup()

  const savedTracks = useMemo(() => tracks.filter((track) => track.saved), [tracks])
  const feedTracks = useMemo(() => tracks.slice().sort((a, b) => Number(b.saved) - Number(a.saved) || String(b.createdAt).localeCompare(String(a.createdAt))), [tracks])

  function showMessage(text, type = 'success') {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 2200)
  }

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function addTrack(event) {
    event.preventDefault()
    if (!draft.url.trim()) {
      showMessage('Paste a song link first.', 'error')
      return
    }

    const next = makeTrack(draft, activeHandle, activeGroup)
    setTracks((current) => [next, ...current])
    setDraft({ url: '', title: '' })
    showMessage(`"${next.title}" added to the music feed.`)
  }

  function toggleSaved(track) {
    setTracks((current) => current.map((item) => item.id === track.id ? { ...item, saved: !item.saved } : item))
    showMessage(track.saved ? `"${track.title}" removed from saved songs.` : `"${track.title}" saved.`)
  }

  function removeTrack(track) {
    setTracks((current) => current.filter((item) => item.id !== track.id))
    if (infoTrack?.id === track.id) setInfoTrack(null)
    showMessage(`"${track.title}" deleted.`)
  }

  return (
    <PageShell active="music">
      <PageHero
        eyebrow="Music feed"
        title="Drop a song link"
        description="Paste a Spotify, YouTube, SoundCloud, Apple Music, or any song link. Keep the feed simple for now; save favorites as they stand out."
      >
        <form onSubmit={addTrack} className="mt-5 rounded-3xl border border-white/10 bg-neutral-950/80 p-3">
          <div className="grid gap-2 md:grid-cols-[1fr_0.7fr_auto]">
            <input value={draft.url} onChange={(event) => updateDraft('url', event.target.value)} placeholder="Paste song link..." className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
            <input value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} placeholder="Title optional" className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
            <button className="rounded-2xl bg-white px-5 py-3 font-semibold text-neutral-950 hover:bg-neutral-200">Add song</button>
          </div>
        </form>
      </PageHero>

      <StatusMessage message={message} />

      {activeGroup ? (
        <section className="mb-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 text-sm text-neutral-300">
          Active group: <strong className="text-white">{activeGroup.name}</strong>. Music is currently stored locally until the music backend is added.
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1fr_0.7fr]">
        <div className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Feed</p>
              <h2 className="mt-1 text-3xl font-black text-white">Song links</h2>
            </div>
            <span className="text-sm text-neutral-500">{tracks.length} link{tracks.length === 1 ? '' : 's'}</span>
          </div>
          {feedTracks.length ? feedTracks.map((track) => <TrackCard key={track.id} track={track} onInfo={setInfoTrack} onSave={toggleSaved} onRemove={removeTrack} />) : <p className="rounded-[2rem] border border-dashed border-white/15 p-8 text-center text-neutral-500">No song links yet. Paste the first one above.</p>}
        </div>

        <aside className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Saved</p>
          <h2 className="mt-1 text-3xl font-black text-white">Favorites</h2>
          <div className="mt-4 space-y-3">
            {savedTracks.length ? savedTracks.map((track) => (
              <button key={track.id} type="button" onClick={() => setInfoTrack(track)} className="flex w-full items-center gap-3 rounded-2xl bg-neutral-900 p-3 text-left transition hover:bg-neutral-800">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg text-neutral-950">🎵</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-white">{track.title}</div>
                  <div className="truncate text-xs text-neutral-500">{track.source}</div>
                </div>
              </button>
            )) : <p className="rounded-2xl border border-dashed border-white/15 p-4 text-sm text-neutral-500">Save links from the feed to keep favorites here.</p>}
          </div>
        </aside>
      </section>

      <InfoModal item={infoTrack} onClose={() => setInfoTrack(null)}>
        <div className="mt-4 flex flex-wrap gap-2">
          {infoTrack?.source ? <DetailPill>{infoTrack.source}</DetailPill> : null}
          {infoTrack?.saved ? <DetailPill>Saved</DetailPill> : null}
          {infoTrack?.nominated_by ? <DetailPill>Added by {infoTrack.nominated_by}</DetailPill> : null}
        </div>
        {infoTrack?.poster ? <img src={infoTrack.poster} alt="" className="mt-5 max-h-80 w-full rounded-3xl object-cover" /> : null}
        <p className="mt-5 break-words text-sm leading-7 text-neutral-300">{infoTrack?.url || 'No link available.'}</p>
        {infoTrack?.url ? <a href={infoTrack.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-neutral-200">Open song</a> : null}
      </InfoModal>
    </PageShell>
  )
}
