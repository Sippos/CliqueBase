import { useMemo, useState } from 'react'
import PageShell from '../components/PageShell.jsx'
import { DetailPill, InfoModal, PageHero, StatusMessage } from '../components/MediaBlocks.jsx'
import { getSavedHandle } from '../lib/handle.js'
import { getActiveGroup } from '../lib/groups.js'

const initialTracks = [
  {
    id: 'spotify-daft-punk',
    title: 'Instant Crush',
    artist: 'Daft Punk · Julian Casablancas',
    url: 'https://open.spotify.com/track/2cGxRwrMyEAp8dEbuZaVv6',
    source: 'spotify',
    category: 'Music',
    nominated_by: 'CliqueBase',
    score: 8,
    picks: 3,
    saved: true,
  },
  {
    id: 'youtube-music-demo',
    title: 'Music video drop',
    artist: 'YouTube link',
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    source: 'youtube',
    category: 'Music',
    nominated_by: 'CliqueBase',
    score: 5,
    picks: 2,
    saved: false,
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
    score: 0,
    picks: 1,
    saved: draft.saved,
    poster: youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : '',
  }
}

function TrackCard({ track, onVote, onSave, onInfo }) {
  return (
    <article className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 transition hover:-translate-y-0.5 hover:bg-white/[0.06]">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex h-28 w-full items-center justify-center overflow-hidden rounded-3xl bg-neutral-900 sm:w-44">
          {track.poster ? <img src={track.poster} alt="" className="h-full w-full object-cover" /> : <span className="text-5xl">{track.source === 'spotify' ? '🎧' : track.source === 'youtube' ? '▶️' : '🎵'}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <DetailPill>{track.source}</DetailPill>
            <DetailPill>{track.category}</DetailPill>
            {track.groupName ? <DetailPill>{track.groupName}</DetailPill> : null}
          </div>
          <h2 className="mt-3 text-2xl font-black text-white">{track.title}</h2>
          <p className="mt-1 text-sm text-neutral-400">{track.artist} · by {track.nominated_by}</p>
          <p className="mt-2 truncate text-sm text-neutral-500">{track.url}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={track.url} target="_blank" rel="noreferrer" className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950">Open</a>
            <button type="button" onClick={() => onVote(track, 1)} className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-white">+ Vote</button>
            <button type="button" onClick={() => onVote(track, -1)} className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-white">Skip</button>
            <button type="button" onClick={() => onSave(track)} className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-white">{track.saved ? 'Saved' : 'Save'}</button>
            <button type="button" onClick={() => onInfo(track)} className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-white">Info</button>
          </div>
        </div>
        <div className="rounded-3xl bg-neutral-900 px-5 py-4 text-center">
          <div className="text-4xl font-black text-white">{track.score}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.25em] text-neutral-500">score</div>
        </div>
      </div>
    </article>
  )
}

export default function Music() {
  const [tracks, setTracks] = useState(initialTracks)
  const [draft, setDraft] = useState({ url: '', title: '', artist: '', category: 'Music', saved: false })
  const [message, setMessage] = useState(null)
  const [infoTrack, setInfoTrack] = useState(null)
  const activeHandle = getSavedHandle()
  const activeGroup = getActiveGroup()

  const sortedTracks = useMemo(() => tracks.slice().sort((a, b) => b.score - a.score || b.picks - a.picks), [tracks])
  const savedTracks = useMemo(() => sortedTracks.filter((track) => track.saved), [sortedTracks])
  const musicTracks = useMemo(() => sortedTracks.filter((track) => track.category === 'Music'), [sortedTracks])

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
    setDraft({ url: '', title: '', artist: '', category: 'Music', saved: false })
    showMessage(`${next.title} added${activeGroup ? ` to ${activeGroup.name}` : ''}.`)
  }

  function voteTrack(track, delta) {
    setTracks((current) => current.map((item) => item.id === track.id ? { ...item, score: item.score + delta, picks: Math.max(0, item.picks + (delta > 0 ? 1 : 0)) } : item))
    showMessage(delta > 0 ? `${track.title} got a vote.` : `${track.title} skipped.`)
  }

  function saveTrack(track) {
    setTracks((current) => current.map((item) => item.id === track.id ? { ...item, saved: !item.saved } : item))
    showMessage(track.saved ? `${track.title} removed from saved.` : `${track.title} saved.`)
  }

  return (
    <PageShell active="music">
      <PageHero eyebrow="Music links" title="Spotify and YouTube Music in one voting pile" copy="Paste Spotify tracks, albums, playlists, or YouTube music links. Your active group is attached to new suggestions so this can later sync cleanly with Supabase.">
        <form onSubmit={addTrack} className="space-y-3 rounded-3xl border border-white/10 bg-neutral-950/80 p-3">
          <input value={draft.url} onChange={(event) => updateDraft('url', event.target.value)} placeholder="Spotify or YouTube music URL" className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
          <div className="grid gap-2 sm:grid-cols-3">
            <input value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} placeholder="Title optional" className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
            <input value={draft.artist} onChange={(event) => updateDraft('artist', event.target.value)} placeholder="Artist optional" className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
            <select value={draft.category} onChange={(event) => updateDraft('category', event.target.value)} className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none">
              <option>Music</option>
              <option>Party</option>
              <option>Chill</option>
              <option>Gym</option>
              <option>Classics</option>
            </select>
          </div>
          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-neutral-300">
            <input type="checkbox" checked={draft.saved} onChange={(event) => updateDraft('saved', event.target.checked)} />
            Save as playlist favorite immediately
          </label>
          <button className="w-full rounded-2xl bg-white px-5 py-3 font-semibold text-neutral-950">Add music link</button>
        </form>
      </PageHero>

      <StatusMessage message={message} />

      {activeGroup ? (
        <section className="mb-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 text-sm text-neutral-300">
          Active group: <strong className="text-white">{activeGroup.name}</strong>. New music links will be tagged to this group.
        </section>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1fr_0.75fr]">
        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Voting queue</p>
              <h2 className="mt-1 text-3xl font-black text-white">Music suggestions</h2>
            </div>
            <span className="text-sm text-neutral-500">{musicTracks.length} music links</span>
          </div>
          {sortedTracks.map((track) => <TrackCard key={track.id} track={track} onVote={voteTrack} onSave={saveTrack} onInfo={setInfoTrack} />)}
        </div>

        <aside className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Saved playlist</p>
          <h2 className="mt-1 text-3xl font-black text-white">Favorites</h2>
          <div className="mt-4 space-y-3">
            {savedTracks.length ? savedTracks.map((track, index) => (
              <div key={track.id} className="flex items-center gap-3 rounded-2xl bg-neutral-900 p-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-black text-neutral-950">{index + 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-white">{track.title}</div>
                  <div className="truncate text-xs text-neutral-500">{track.artist}</div>
                </div>
                <span className="font-bold text-white">{track.score}</span>
              </div>
            )) : <p className="rounded-2xl border border-dashed border-white/15 p-4 text-sm text-neutral-500">Save tracks to build the group playlist.</p>}
          </div>
        </aside>
      </section>

      <InfoModal item={infoTrack} onClose={() => setInfoTrack(null)}>
        {infoTrack ? (
          <>
            <DetailPill>{infoTrack.source}</DetailPill>
            <DetailPill>{infoTrack.category}</DetailPill>
            <DetailPill>{infoTrack.score} score</DetailPill>
            <p className="mt-4 text-neutral-300">{infoTrack.artist}</p>
            <a href={infoTrack.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-2xl bg-white px-4 py-2 font-semibold text-neutral-950">Open link</a>
          </>
        ) : null}
      </InfoModal>
    </PageShell>
  )
}
