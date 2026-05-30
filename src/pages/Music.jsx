import { useMemo, useState } from 'react'
import PageShell from '../components/PageShell.jsx'
import { DetailPill, InfoModal, PageHero, StatusMessage } from '../components/MediaBlocks.jsx'
import { getSavedHandle } from '../lib/handle.js'
import { getActiveGroup } from '../lib/groups.js'

const CATEGORIES = ['All', 'Chill', 'Pop', 'Rap', 'Rock', 'Party', 'Gym', 'Classics', 'Other']
const FORM_CATEGORIES = CATEGORIES.filter((category) => category !== 'All')

const initialTracks = [
  {
    id: 'spotify-daft-punk',
    title: 'Instant Crush',
    artist: 'Daft Punk · Julian Casablancas',
    url: 'https://open.spotify.com/track/2cGxRwrMyEAp8dEbuZaVv6',
    source: 'spotify',
    category: 'Pop',
    nominated_by: 'CliqueBase',
    favorite: true,
    archived: false,
    note: 'First demo Spotify link.',
  },
  {
    id: 'youtube-music-demo',
    title: 'Music video drop',
    artist: 'YouTube link',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    source: 'youtube',
    category: 'Classics',
    nominated_by: 'CliqueBase',
    favorite: false,
    archived: false,
    note: 'Demo YouTube music link.',
  },
]

function detectSource(url) {
  const value = String(url || '').toLowerCase()
  if (value.includes('spotify.com')) return 'spotify'
  if (value.includes('youtube.com') || value.includes('youtu.be')) return 'youtube'
  return 'link'
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
    return parsed.hostname.replace('www.', '')
  } catch {
    return 'Shared music link'
  }
}

function makeTrack(draft, handle, group) {
  const source = detectSource(draft.url)
  const youtubeId = source === 'youtube' ? getYoutubeId(draft.url) : ''

  return {
    id: `${source}-${Date.now()}`,
    title: draft.title.trim() || makeTitleFromUrl(draft.url),
    artist: draft.artist.trim() || (source === 'spotify' ? 'Spotify' : source === 'youtube' ? 'YouTube Music' : 'Shared link'),
    url: draft.url.trim(),
    source,
    category: draft.category,
    nominated_by: handle || 'anonymous',
    groupId: group?.id || '',
    groupName: group?.name || '',
    favorite: draft.favorite,
    archived: false,
    note: draft.note.trim(),
    poster: youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : '',
    createdAt: new Date().toISOString(),
  }
}

function TrackCard({ track, onFavorite, onArchive, onRemove, onInfo }) {
  return (
    <article className={`rounded-[2rem] border p-4 transition hover:-translate-y-0.5 ${track.archived ? 'border-white/5 bg-white/[0.015] opacity-60' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'}`}>
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex h-28 w-full items-center justify-center overflow-hidden rounded-3xl bg-neutral-900 sm:w-44">
          {track.poster ? <img src={track.poster} alt="" className="h-full w-full object-cover" /> : <span className="text-5xl">{track.source === 'spotify' ? '🎧' : track.source === 'youtube' ? '▶️' : '🎵'}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <DetailPill>{track.source}</DetailPill>
            <DetailPill>{track.category}</DetailPill>
            {track.favorite ? <DetailPill>Favorite</DetailPill> : null}
            {track.archived ? <DetailPill>Archived</DetailPill> : null}
            {track.groupName ? <DetailPill>{track.groupName}</DetailPill> : null}
          </div>
          <h2 className="mt-3 text-2xl font-black text-white">{track.title}</h2>
          <p className="mt-1 text-sm text-neutral-400">{track.artist} · added by {track.nominated_by}</p>
          {track.note ? <p className="mt-2 text-sm text-neutral-500">{track.note}</p> : null}
          <p className="mt-2 truncate text-sm text-neutral-600">{track.url}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={track.url} target="_blank" rel="noreferrer" className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950">Open</a>
            <button type="button" onClick={() => onFavorite(track)} className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white hover:text-neutral-950">{track.favorite ? 'Unfavorite' : 'Favorite'}</button>
            <button type="button" onClick={() => onArchive(track)} className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white hover:text-neutral-950">{track.archived ? 'Restore' : 'Archive'}</button>
            <button type="button" onClick={() => onInfo(track)} className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white hover:text-neutral-950">Info</button>
            <button type="button" onClick={() => onRemove(track)} className="rounded-2xl border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500 hover:text-white">Delete</button>
          </div>
        </div>
      </div>
    </article>
  )
}

export default function Music() {
  const [tracks, setTracks] = useState(initialTracks)
  const [draft, setDraft] = useState({ url: '', title: '', artist: '', category: 'Chill', favorite: false, note: '' })
  const [filter, setFilter] = useState('All')
  const [showArchived, setShowArchived] = useState(false)
  const [message, setMessage] = useState(null)
  const [infoTrack, setInfoTrack] = useState(null)
  const activeHandle = getSavedHandle()
  const activeGroup = getActiveGroup()

  const visibleTracks = useMemo(() => {
    return tracks
      .filter((track) => filter === 'All' || track.category === filter)
      .filter((track) => showArchived || !track.archived)
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || String(a.title).localeCompare(String(b.title)))
  }, [tracks, filter, showArchived])

  const favoriteTracks = useMemo(() => tracks.filter((track) => track.favorite && !track.archived), [tracks])
  const categoryCounts = useMemo(() => {
    return CATEGORIES.reduce((acc, category) => {
      acc[category] = category === 'All' ? tracks.filter((track) => !track.archived).length : tracks.filter((track) => track.category === category && !track.archived).length
      return acc
    }, {})
  }, [tracks])

  function showMessage(text, tone = 'ok') {
    setMessage({ text, tone })
    setTimeout(() => setMessage(null), 2200)
  }

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function addTrack(event) {
    event.preventDefault()
    if (!draft.url.trim()) {
      showMessage('Paste a Spotify or YouTube music link first.', 'warn')
      return
    }

    const next = makeTrack(draft, activeHandle, activeGroup)
    setTracks((current) => [next, ...current])
    setDraft({ url: '', title: '', artist: '', category: draft.category, favorite: false, note: '' })
    setFilter(next.category)
    showMessage(`${next.title} added to ${next.category}${activeGroup ? ` for ${activeGroup.name}` : ''}.`)
  }

  function toggleFavorite(track) {
    setTracks((current) => current.map((item) => item.id === track.id ? { ...item, favorite: !item.favorite } : item))
    showMessage(track.favorite ? `${track.title} removed from favorites.` : `${track.title} marked as favorite.`)
  }

  function toggleArchive(track) {
    setTracks((current) => current.map((item) => item.id === track.id ? { ...item, archived: !item.archived } : item))
    showMessage(track.archived ? `${track.title} restored.` : `${track.title} archived.`)
  }

  function removeTrack(track) {
    setTracks((current) => current.filter((item) => item.id !== track.id))
    if (infoTrack?.id === track.id) setInfoTrack(null)
    showMessage(`${track.title} deleted.`)
  }

  return (
    <PageShell active="music">
      <PageHero eyebrow="Music database" title="Save Spotify and YouTube Music by mood" copy="Music is a library, not a voting queue. Add links, choose a genre or mood, favorite the best ones, and keep everything attached to your active group.">
        <form onSubmit={addTrack} className="space-y-3 rounded-3xl border border-white/10 bg-neutral-950/80 p-3">
          <input value={draft.url} onChange={(event) => updateDraft('url', event.target.value)} placeholder="Spotify or YouTube music URL" className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
          <div className="grid gap-2 sm:grid-cols-3">
            <input value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} placeholder="Title optional" className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
            <input value={draft.artist} onChange={(event) => updateDraft('artist', event.target.value)} placeholder="Artist optional" className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
            <select value={draft.category} onChange={(event) => updateDraft('category', event.target.value)} className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none">
              {FORM_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
            </select>
          </div>
          <textarea value={draft.note} onChange={(event) => updateDraft('note', event.target.value)} placeholder="Optional note, vibe, or when to play it" className="min-h-24 w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-neutral-300">
            <input type="checkbox" checked={draft.favorite} onChange={(event) => updateDraft('favorite', event.target.checked)} />
            Mark as favorite immediately
          </label>
          <button className="w-full rounded-2xl bg-white px-5 py-3 font-semibold text-neutral-950">Save music link</button>
        </form>
      </PageHero>

      <StatusMessage message={message} />

      {activeGroup ? (
        <section className="mb-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 text-sm text-neutral-300">
          Active group: <strong className="text-white">{activeGroup.name}</strong>. New music links will be tagged to this group.
        </section>
      ) : null}

      <section className="mb-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
          <div>
            <label className="text-xs uppercase tracking-[0.3em] text-neutral-500">Filter category</label>
            <select value={filter} onChange={(event) => setFilter(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none">
              {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
            </select>
          </div>
          <label className="flex h-12 items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900 px-4 text-sm text-neutral-300">
            <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
            Show archived
          </label>
          <div className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-neutral-400">
            {visibleTracks.length} shown · {favoriteTracks.length} favorites
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {CATEGORIES.map((category) => (
            <button key={category} type="button" onClick={() => setFilter(category)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === category ? 'bg-white text-neutral-950' : 'border border-white/10 text-neutral-300 hover:bg-white hover:text-neutral-950'}`}>
              {category} {categoryCounts[category] ?? 0}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.75fr]">
        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Music library</p>
              <h2 className="mt-1 text-3xl font-black text-white">{filter === 'All' ? 'All saved music' : filter}</h2>
            </div>
            <span className="text-sm text-neutral-500">Database view</span>
          </div>
          {visibleTracks.length ? visibleTracks.map((track) => <TrackCard key={track.id} track={track} onFavorite={toggleFavorite} onArchive={toggleArchive} onRemove={removeTrack} onInfo={setInfoTrack} />) : <p className="rounded-[2rem] border border-dashed border-white/15 p-8 text-center text-neutral-500">No music links in this category yet.</p>}
        </div>

        <aside className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Favorites</p>
          <h2 className="mt-1 text-3xl font-black text-white">Best tracks</h2>
          <div className="mt-4 space-y-3">
            {favoriteTracks.length ? favoriteTracks.map((track) => (
              <button key={track.id} type="button" onClick={() => setInfoTrack(track)} className="flex w-full items-center gap-3 rounded-2xl bg-neutral-900 p-3 text-left transition hover:bg-neutral-800">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg text-neutral-950">{track.source === 'spotify' ? '🎧' : track.source === 'youtube' ? '▶️' : '🎵'}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-white">{track.title}</div>
                  <div className="truncate text-xs text-neutral-500">{track.artist} · {track.category}</div>
                </div>
              </button>
            )) : <p className="rounded-2xl border border-dashed border-white/15 p-4 text-sm text-neutral-500">Favorite tracks to build the group playlist.</p>}
          </div>
        </aside>
      </section>

      <InfoModal item={infoTrack} onClose={() => setInfoTrack(null)}>
        {infoTrack ? (
          <>
            <DetailPill>{infoTrack.source}</DetailPill>
            <DetailPill>{infoTrack.category}</DetailPill>
            {infoTrack.favorite ? <DetailPill>Favorite</DetailPill> : null}
            {infoTrack.groupName ? <DetailPill>{infoTrack.groupName}</DetailPill> : null}
            <p className="mt-4 text-neutral-300">{infoTrack.artist}</p>
            {infoTrack.note ? <p className="mt-3 text-sm leading-6 text-neutral-400">{infoTrack.note}</p> : null}
            <a href={infoTrack.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-2xl bg-white px-4 py-2 font-semibold text-neutral-950">Open link</a>
          </>
        ) : null}
      </InfoModal>
    </PageShell>
  )
}
