import { useEffect, useMemo, useState } from 'react'
import PageShell from '../components/PageShell.jsx'
import { DetailPill, InfoModal, PageHero, StatusMessage } from '../components/MediaBlocks.jsx'
import { getSavedHandle } from '../lib/handle.js'
import { getActiveGroup } from '../lib/groups.js'
import { deleteMusicItem, getMusicItems, lookupMusicMetadata, saveMusicItem, updateMusicSaved } from '../lib/musicLibrary.js'

function TrackArtwork({ track, large = false }) {
  const sizeClass = large ? 'max-h-80 w-full rounded-3xl' : 'h-24 w-full rounded-3xl sm:w-36'
  return track.poster ? (
    <img src={track.poster} alt="" loading="lazy" decoding="async" className={`${sizeClass} object-cover`} />
  ) : (
    <div className={`${sizeClass} flex shrink-0 items-center justify-center bg-neutral-900 text-4xl`}>🎵</div>
  )
}

function TrackCard({ track, onSave, onRemove, onInfo }) {
  return (
    <article className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 transition hover:-translate-y-0.5 hover:bg-white/[0.05]">
      <div className="flex flex-col gap-4 sm:flex-row">
        <button type="button" onClick={() => onInfo(track)} className="shrink-0 overflow-hidden rounded-3xl text-left">
          <TrackArtwork track={track} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <DetailPill>{track.source}</DetailPill>
            <DetailPill>{track.itemType}</DetailPill>
            {track.groupName ? <DetailPill>{track.groupName}</DetailPill> : null}
            {track.saved ? <DetailPill>Saved</DetailPill> : null}
          </div>
          <button type="button" onClick={() => onInfo(track)} className="mt-3 block w-full truncate text-left text-2xl font-black text-white hover:underline">{track.title}</button>
          {track.artist || track.album ? <p className="mt-1 truncate text-sm text-neutral-300">{[track.artist, track.album].filter(Boolean).join(' · ')}</p> : null}
          <p className="mt-1 text-sm text-neutral-400">Added by {track.nominated_by}</p>
          <p className="mt-2 truncate text-sm text-neutral-600">{track.url}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {track.url ? <a href={track.url} target="_blank" rel="noreferrer" className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-neutral-200">Open link</a> : null}
            {track.previewUrl ? <a href={track.previewUrl} target="_blank" rel="noreferrer" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white hover:text-neutral-950">Preview</a> : null}
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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [storageMode, setStorageMode] = useState('local')
  const activeHandle = getSavedHandle()
  const activeGroup = getActiveGroup()

  const savedTracks = useMemo(() => tracks.filter((track) => track.saved), [tracks])
  const feedTracks = useMemo(() => tracks.slice().sort((a, b) => Number(b.saved) - Number(a.saved) || String(b.createdAt).localeCompare(String(a.createdAt))), [tracks])

  function showMessage(text, type = 'success') {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 2600)
  }

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  async function refreshMusic() {
    setLoading(true)
    try {
      const result = await getMusicItems(activeGroup?.id || null)
      setTracks(result.tracks)
      setStorageMode(result.source)
    } catch (error) {
      showMessage(error.message || 'Could not load music.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refreshMusic() }, [activeGroup?.id])

  async function addTrack(event) {
    event.preventDefault()
    if (!draft.url.trim() && !draft.title.trim()) {
      showMessage('Paste a Spotify link or type a song title first.', 'error')
      return
    }

    setSaving(true)
    try {
      const lookedUp = await lookupMusicMetadata(draft)
      const result = await saveMusicItem(lookedUp, { group: activeGroup, nominatedBy: activeHandle, saved: false })
      setTracks((current) => [result.track, ...current.filter((item) => item.id !== result.track.id)])
      setStorageMode(result.source)
      setDraft({ url: '', title: '' })
      const metadataLabel = result.track.metadataReady ? ' with cover and artist info' : ''
      showMessage(`"${result.track.title}" added${metadataLabel}.`)
    } catch (error) {
      showMessage(error.message || 'Could not add that song.', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function toggleSaved(track) {
    try {
      const result = await updateMusicSaved(track, !track.saved)
      setStorageMode(result.source)
      setTracks((current) => current.map((item) => item.id === track.id ? result.track : item))
      if (infoTrack?.id === track.id) setInfoTrack(result.track)
      showMessage(track.saved ? `"${track.title}" removed from saved songs.` : `"${track.title}" saved.`)
    } catch (error) {
      showMessage(error.message || 'Could not update saved state.', 'error')
    }
  }

  async function removeTrack(track) {
    try {
      const result = await deleteMusicItem(track)
      setStorageMode(result.source)
      setTracks((current) => current.filter((item) => item.id !== track.id))
      if (infoTrack?.id === track.id) setInfoTrack(null)
      showMessage(`"${track.title}" deleted.`)
    } catch (error) {
      showMessage(error.message || 'Could not delete song.', 'error')
    }
  }

  return (
    <PageShell active="music">
      <PageHero
        eyebrow="Music feed"
        title="Drop a song link"
        description="Paste a Spotify link to fetch cover art, artist, album, and preview metadata. YouTube links still get thumbnails automatically; other links can be saved manually."
      >
        <form onSubmit={addTrack} className="mt-5 rounded-3xl border border-white/10 bg-neutral-950/80 p-3">
          <div className="grid gap-2 md:grid-cols-[1fr_0.7fr_auto]">
            <input value={draft.url} onChange={(event) => updateDraft('url', event.target.value)} placeholder="Paste Spotify, YouTube, Apple Music..." className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
            <input value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} placeholder="Or search by title" className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
            <button disabled={saving} className="rounded-2xl bg-white px-5 py-3 font-semibold text-neutral-950 hover:bg-neutral-200 disabled:opacity-50">{saving ? 'Adding…' : 'Add song'}</button>
          </div>
        </form>
      </PageHero>

      <StatusMessage message={message} />

      <section className="mb-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 text-sm text-neutral-300">
        {activeGroup ? <>Active group: <strong className="text-white">{activeGroup.name}</strong>.</> : <>Personal music library.</>} Music is stored in <strong className="text-white">{storageMode === 'remote' ? 'Supabase' : 'local fallback'}</strong>{storageMode === 'local' ? ' until the music table/function is deployed or you sign in.' : '.'}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.7fr]">
        <div className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Feed</p>
              <h2 className="mt-1 text-3xl font-black text-white">Song links</h2>
            </div>
            <span className="text-sm text-neutral-500">{tracks.length} link{tracks.length === 1 ? '' : 's'}</span>
          </div>
          {loading ? <p className="rounded-[2rem] border border-white/10 p-6 text-neutral-400">Loading music…</p> : feedTracks.length ? feedTracks.map((track) => <TrackCard key={track.id} track={track} onInfo={setInfoTrack} onSave={toggleSaved} onRemove={removeTrack} />) : <p className="rounded-[2rem] border border-dashed border-white/15 p-8 text-center text-neutral-500">No song links yet. Paste the first one above.</p>}
        </div>

        <aside className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Saved</p>
          <h2 className="mt-1 text-3xl font-black text-white">Favorites</h2>
          <div className="mt-4 space-y-3">
            {savedTracks.length ? savedTracks.map((track) => (
              <button key={track.id} type="button" onClick={() => setInfoTrack(track)} className="flex w-full items-center gap-3 rounded-2xl bg-neutral-900 p-3 text-left transition hover:bg-neutral-800">
                {track.poster ? <img src={track.poster} alt="" loading="lazy" decoding="async" className="h-10 w-10 rounded-xl object-cover" /> : <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-lg text-neutral-950">🎵</div>}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-white">{track.title}</div>
                  <div className="truncate text-xs text-neutral-500">{track.artist || track.source}</div>
                </div>
              </button>
            )) : <p className="rounded-2xl border border-dashed border-white/15 p-4 text-sm text-neutral-500">Save links from the feed to keep favorites here.</p>}
          </div>
        </aside>
      </section>

      <InfoModal item={infoTrack} onClose={() => setInfoTrack(null)}>
        <div className="mt-4 flex flex-wrap gap-2">
          {infoTrack?.source ? <DetailPill>{infoTrack.source}</DetailPill> : null}
          {infoTrack?.itemType ? <DetailPill>{infoTrack.itemType}</DetailPill> : null}
          {infoTrack?.saved ? <DetailPill>Saved</DetailPill> : null}
          {infoTrack?.nominated_by ? <DetailPill>Added by {infoTrack.nominated_by}</DetailPill> : null}
        </div>
        {infoTrack?.artist || infoTrack?.album ? <p className="mt-4 text-sm text-neutral-300">{[infoTrack.artist, infoTrack.album].filter(Boolean).join(' · ')}</p> : null}
        {infoTrack ? <div className="mt-5 overflow-hidden rounded-3xl"><TrackArtwork track={infoTrack} large /></div> : null}
        <p className="mt-5 break-words text-sm leading-7 text-neutral-300">{infoTrack?.url || 'No link available.'}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {infoTrack?.url ? <a href={infoTrack.url} target="_blank" rel="noreferrer" className="inline-flex rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-neutral-200">Open song</a> : null}
          {infoTrack?.previewUrl ? <a href={infoTrack.previewUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white hover:text-neutral-950">Play preview</a> : null}
        </div>
      </InfoModal>
    </PageShell>
  )
}
