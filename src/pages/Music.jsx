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
    status: 'playlist',
    favorite: true,
    archived: false,
    note: 'Already in the playlist.',
  },
  {
    id: 'youtube-music-demo',
    title: 'Music video drop',
    artist: 'YouTube link',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    source: 'youtube',
    category: 'Classics',
    nominated_by: 'CliqueBase',
    status: 'suggestion',
    favorite: false,
    archived: false,
    note: 'Someone said: we have to put that in the playlist.',
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
    status: draft.addNow ? 'playlist' : 'suggestion',
    favorite: draft.favorite || draft.addNow,
    archived: false,
    note: draft.note.trim(),
    poster: youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : '',
    createdAt: new Date().toISOString(),
  }
}

function TrackCard({ track, onAddToPlaylist, onMoveToSuggestions, onFavorite, onArchive, onRemove, onInfo, compact = false }) {
  const isSuggestion = track.status === 'suggestion'

  return (
    <article className={`rounded-[2rem] border p-4 transition hover:-translate-y-0.5 ${track.archived ? 'border-white/5 bg-white/[0.015] opacity-60' : isSuggestion ? 'border-amber-300/20 bg-amber-300/[0.06] hover:bg-amber-300/[0.09]' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'}`}>
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className={`${compact ? 'h-20 sm:w-28' : 'h-28 sm:w-44'} flex w-full items-center justify-center overflow-hidden rounded-3xl bg-neutral-900`}>
          {track.poster ? <img src={track.poster} alt="" className="h-full w-full object-cover" /> : <span className="text-5xl">{track.source === 'spotify' ? '🎧' : track.source === 'youtube' ? '▶️' : '🎵'}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <DetailPill>{track.source}</DetailPill>
            <DetailPill>{track.category}</DetailPill>
            <DetailPill>{isSuggestion ? 'Suggestion' : 'In playlist'}</DetailPill>
            {track.favorite ? <DetailPill>Favorite</DetailPill> : null}
            {track.archived ? <DetailPill>Archived</DetailPill> : null}
            {track.groupName ? <DetailPill>{track.groupName}</DetailPill> : null}
          </div>
          <h2 className="mt-3 text-2xl font-black text-white">{track.title}</h2>
          <p className="mt-1 text-sm text-neutral-400">{track.artist} · suggested by {track.nominated_by}</p>
          {track.note ? <p className="mt-2 text-sm text-neutral-500">{track.note}</p> : null}
          <p className="mt-2 truncate text-sm text-neutral-600">{track.url}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {isSuggestion ? (
              <button type="button" onClick={() => onAddToPlaylist(track)} className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-neutral-200">Add to playlist</button>
            ) : (
              <button type="button" onClick={() => onMoveToSuggestions(track)} className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white hover:text-neutral-950">Move back to suggestions</button>
            )}
            <a href={track.url} target="_blank" rel="noreferrer" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white hover:text-neutral-950">Open</a>
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
  const [draft, setDraft] = useState({ url: '', title: '', artist: '', category: 'Chill', favorite: false, addNow: false, note: '' })
  const [filter, setFilter] = useState('All')
  const [showArchived, setShowArchived] = useState(false)
  const [message, setMessage] = useState(null)
  const [infoTrack, setInfoTrack] = useState(null)
  const activeHandle = getSavedHandle()
  const activeGroup = getActiveGroup()

  const filteredTracks = useMemo(() => {
    return tracks
      .filter((track) => filter === 'All' || track.category === filter)
      .filter((track) => showArchived || !track.archived)
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || String(a.title).localeCompare(String(b.title)))
  }, [tracks, filter, showArchived])

  const suggestions = useMemo(() => filteredTracks.filter((track) => track.status === 'suggestion'), [filteredTracks])
  const playlistTracks = useMemo(() => filteredTracks.filter((track) => track.status !== 'suggestion'), [filteredTracks])
  const favoriteTracks = useMemo(() => tracks.filter((track) => track.favorite && !track.archived && track.status !== 'suggestion'), [tracks])
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
    setDraft({ url: '', title: '', artist: '', category: draft.category, favorite: false, addNow: false, note: '' })
    setFilter(next.category)
    showMessage(next.status === 'playlist' ? `${next.title} added to the playlist.` : `${next.title} added as a playlist suggestion.`)
  }

  function addToPlaylist(track) {
    setTracks((current) => current.map((item) => item.id === track.id ? { ...item, status: 'playlist', favorite: true } : item))
    showMessage(`${track.title} moved into the playlist.`)
  }

  function moveToSuggestions(track) {
    setTracks((current) => current.map((item) => item.id === track.id ? { ...item, status: 'suggestion', favorite: false } : item))
    showMessage(`${track.title} moved back to suggestions.`)
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

  const cardHandlers = {
    onAddToPlaylist: addToPlaylist,
    onMoveToSuggestions: moveToSuggestions,
    onFavorite: toggleFavorite,
    onArchive: toggleArchive,
    onRemove: removeTrack,
    onInfo: setInfoTrack,
  }

  return (
    <PageShell active="music">
      <PageHero eyebrow="Playlist suggestions" title="We have to put that in the playlist" copy="When someone drops a Spotify or YouTube Music link, save it as a suggestion first. Then the group can move it into the real playlist database when it fits.">
        <form onSubmit={addTrack} className="space-y-3 rounded-3xl border border-white/10 bg-neutral-950/80 p-3">
          <input value={draft.url} onChange={(event) => updateDraft('url', event.target.value)} placeholder="Spotify or YouTube music URL" className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
          <div className="grid gap-2 sm:grid-cols-3">
            <input value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} placeholder="Title optional" className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
            <input value={draft.artist} onChange={(event) => updateDraft('artist', event.target.value)} placeholder="Artist optional" className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
            <select value={draft.category} onChange={(event) => updateDraft('category', event.target.value)} className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none">
              {FORM_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
            </select>
          </div>
          <textarea value={draft.note} onChange={(event) => updateDraft('note', event.target.value)} placeholder="Why should this go in the playlist?" className="min-h-24 w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-neutral-300">
              <input type="checkbox" checked={draft.addNow} onChange={(event) => updateDraft('addNow', event.target.checked)} />
              Add directly to playlist
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-neutral-300">
              <input type="checkbox" checked={draft.favorite} onChange={(event) => updateDraft('favorite', event.target.checked)} />
              Mark as favorite
            </label>
          </div>
          <button className="w-full rounded-2xl bg-white px-5 py-3 font-semibold text-neutral-950">Suggest for playlist</button>
        </form>
      </PageHero>

      <StatusMessage message={message} />

      {activeGroup ? (
        <section className="mb-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 text-sm text-neutral-300">
          Active group: <strong className="text-white">{activeGroup.name}</strong>. New suggestions are tied to this group.
        </section>
      ) : null}

      <section className="mb-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
          <div>
            <label className="text-xs uppercase tracking-[0.3em] text-neutral-500">Mood / genre</label>
            <select value={filter} onChange={(event) => setFilter(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none">
              {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
            </select>
          </div>
          <label className="flex h-12 items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900 px-4 text-sm text-neutral-300">
            <input type="checkbox" checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} />
            Show archived
          </label>
          <div className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-neutral-400">
            {suggestions.length} suggestions · {playlistTracks.length} in playlist
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
        <div className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-amber-200/60">Incoming ideas</p>
                <h2 className="mt-1 text-3xl font-black text-white">Playlist suggestions</h2>
              </div>
              <span className="text-sm text-neutral-500">Review first</span>
            </div>
            {suggestions.length ? suggestions.map((track) => <TrackCard key={track.id} track={track} compact {...cardHandlers} />) : <p className="rounded-[2rem] border border-dashed border-white/15 p-8 text-center text-neutral-500">No suggestions waiting for this category.</p>}
          </section>

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Accepted links</p>
                <h2 className="mt-1 text-3xl font-black text-white">Playlist database</h2>
              </div>
              <span className="text-sm text-neutral-500">Saved library</span>
            </div>
            {playlistTracks.length ? playlistTracks.map((track) => <TrackCard key={track.id} track={track} {...cardHandlers} />) : <p className="rounded-[2rem] border border-dashed border-white/15 p-8 text-center text-neutral-500">No playlist tracks in this category yet.</p>}
          </section>
        </div>

        <aside className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Playlist favorites</p>
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
            )) : <p className="rounded-2xl border border-dashed border-white/15 p-4 text-sm text-neutral-500">Accept and favorite tracks to build the group playlist.</p>}
          </div>
        </aside>
      </section>

      <InfoModal item={infoTrack} onClose={() => setInfoTrack(null)}>
        {infoTrack ? (
          <>
            <DetailPill>{infoTrack.source}</DetailPill>
            <DetailPill>{infoTrack.category}</DetailPill>
            <DetailPill>{infoTrack.status === 'suggestion' ? 'Suggestion' : 'In playlist'}</DetailPill>
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
