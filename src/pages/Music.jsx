import { useEffect, useMemo, useState } from 'react'
import PageShell from '../components/PageShell.jsx'
import { DetailPill, InfoModal, StatusMessage } from '../components/MediaBlocks.jsx'
import { getSavedHandle } from '../lib/handle.js'
import { getActiveGroup } from '../lib/groups.js'
import { deleteMusicItem, getMusicItems, lookupMusicMetadata, saveMusicItem, updateMusicSaved } from '../lib/musicLibrary.js'

const sourceHints = ['Spotify track link', 'Album link', 'YouTube music video', 'Apple Music link']

function trackMeta(track) {
  return [track.artist, track.album].filter(Boolean).join(' · ') || track.source || 'Music link'
}

function TrackCover({ track, className = 'h-20 w-20', rounded = 'rounded-2xl' }) {
  return track?.poster ? (
    <img src={track.poster} alt="" loading="lazy" decoding="async" className={`${className} ${rounded} shrink-0 object-cover shadow-xl shadow-black/30 ring-1 ring-white/10`} />
  ) : (
    <div className={`${className} ${rounded} flex shrink-0 items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-950 text-3xl shadow-xl shadow-black/30 ring-1 ring-white/10`}>♪</div>
  )
}

function SourceBadge({ track }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-300">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
      {track.source || 'Music'}
    </span>
  )
}

function Composer({ draft, saving, onSubmit, onChange }) {
  return (
    <form onSubmit={onSubmit} className="rounded-[2rem] border border-emerald-200/15 bg-gradient-to-br from-emerald-400/12 via-white/[0.055] to-cyan-500/10 p-3 shadow-2xl shadow-emerald-950/20 ring-1 ring-white/10 sm:p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="min-w-0 flex-1">
          <label className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-100/70">Paste music</label>
          <input value={draft.url} onChange={(event) => onChange('url', event.target.value)} placeholder="Spotify, YouTube, Apple Music, SoundCloud…" className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-emerald-200/40" />
        </div>
        <div className="min-w-0 lg:w-72">
          <label className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Fallback search/title</label>
          <input value={draft.title} onChange={(event) => onChange('title', event.target.value)} placeholder="Song or album name" className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-white/30" />
        </div>
        <button disabled={saving} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-neutral-950 shadow-lg shadow-white/10 transition hover:bg-neutral-200 disabled:opacity-50">{saving ? 'Adding…' : 'Add to music'}</button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {sourceHints.map((hint) => <span key={hint} className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[11px] font-semibold text-neutral-400">{hint}</span>)}
      </div>
    </form>
  )
}

function FeaturedTrack({ track, onInfo, onSave, onRemove }) {
  if (!track) {
    return (
      <section className="rounded-[2rem] border border-dashed border-white/15 bg-white/[0.025] p-6 text-center shadow-2xl shadow-black/20">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[2rem] bg-neutral-900 text-5xl text-neutral-500">♪</div>
        <h2 className="mt-4 text-2xl font-black text-white">No music yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-400">Paste a Spotify link above. CliqueBase will use the cover art as the visual anchor for the music room.</p>
      </section>
    )
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.09] via-emerald-400/10 to-cyan-500/10 p-4 shadow-2xl shadow-black/30 ring-1 ring-white/10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <button type="button" onClick={() => onInfo(track)} className="shrink-0 overflow-hidden rounded-[1.6rem] text-left">
          <TrackCover track={track} className="aspect-square w-full sm:h-44 sm:w-44" rounded="rounded-[1.6rem]" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            <SourceBadge track={track} />
            {track.groupName ? <DetailPill>{track.groupName}</DetailPill> : null}
            {track.saved ? <DetailPill>Saved</DetailPill> : null}
          </div>
          <p className="mt-4 text-xs font-black uppercase tracking-[0.26em] text-neutral-500">Latest drop</p>
          <button type="button" onClick={() => onInfo(track)} className="mt-1 block max-w-full truncate text-left text-3xl font-black tracking-tight text-white hover:underline sm:text-4xl">{track.title}</button>
          <p className="mt-2 truncate text-sm text-neutral-300">{trackMeta(track)}</p>
          <p className="mt-1 text-xs text-neutral-500">Added by {track.nominated_by}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {track.url ? <a href={track.url} target="_blank" rel="noreferrer" className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-neutral-950 hover:bg-neutral-200">Open</a> : null}
            {track.previewUrl ? <a href={track.previewUrl} target="_blank" rel="noreferrer" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white hover:text-neutral-950">Preview</a> : null}
            <button type="button" onClick={() => onSave(track)} className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-black text-neutral-200 hover:bg-white hover:text-neutral-950">{track.saved ? 'Unsave' : 'Save'}</button>
            <button type="button" onClick={() => onRemove(track)} className="rounded-2xl border border-red-500/30 px-4 py-2 text-sm font-black text-red-200 hover:bg-red-500 hover:text-white">Delete</button>
          </div>
        </div>
      </div>
    </section>
  )
}

function TrackRow({ track, onInfo, onSave, onRemove }) {
  return (
    <article className="group rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-3 transition hover:border-emerald-100/25 hover:bg-white/[0.06]">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => onInfo(track)} className="shrink-0 overflow-hidden rounded-2xl text-left">
          <TrackCover track={track} className="h-16 w-16" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onInfo(track)} className="block max-w-full truncate text-left font-black text-white hover:underline">{track.title}</button>
            {track.saved ? <span className="shrink-0 rounded-full bg-emerald-300 px-2 py-0.5 text-[10px] font-black text-neutral-950">Saved</span> : null}
          </div>
          <p className="mt-1 truncate text-xs text-neutral-400">{trackMeta(track)}</p>
          <p className="mt-0.5 truncate text-[11px] text-neutral-600">{track.source} · Added by {track.nominated_by}</p>
        </div>
        <div className="hidden shrink-0 flex-wrap justify-end gap-2 sm:flex">
          {track.url ? <a href={track.url} target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-neutral-300 hover:bg-white hover:text-neutral-950">Open</a> : null}
          <button type="button" onClick={() => onSave(track)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-neutral-300 hover:bg-white hover:text-neutral-950">{track.saved ? 'Unsave' : 'Save'}</button>
          <button type="button" onClick={() => onRemove(track)} className="rounded-xl border border-red-400/20 px-3 py-2 text-xs font-bold text-red-200 hover:bg-red-500 hover:text-white">Delete</button>
        </div>
      </div>
      <div className="mt-3 flex gap-2 sm:hidden">
        {track.url ? <a href={track.url} target="_blank" rel="noreferrer" className="flex-1 rounded-xl border border-white/10 px-3 py-2 text-center text-xs font-bold text-neutral-300">Open</a> : null}
        <button type="button" onClick={() => onSave(track)} className="flex-1 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-neutral-300">{track.saved ? 'Unsave' : 'Save'}</button>
        <button type="button" onClick={() => onRemove(track)} className="flex-1 rounded-xl border border-red-400/20 px-3 py-2 text-xs font-bold text-red-200">Delete</button>
      </div>
    </article>
  )
}

function SavedShelf({ tracks, onInfo }) {
  return (
    <aside className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 shadow-2xl shadow-black/20">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Saved</p>
          <h2 className="mt-1 text-2xl font-black text-white">Favorites</h2>
        </div>
        <span className="text-xs text-neutral-500">{tracks.length}</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-1">
        {tracks.length ? tracks.slice(0, 8).map((track) => (
          <button key={track.id} type="button" onClick={() => onInfo(track)} className="min-w-0 rounded-2xl bg-neutral-900/80 p-2 text-left transition hover:bg-neutral-800">
            <TrackCover track={track} className="aspect-square w-full lg:h-14 lg:w-14" rounded="rounded-xl" />
            <div className="mt-2 min-w-0 lg:mt-0 lg:inline-block lg:w-[calc(100%-4.3rem)] lg:pl-3 lg:align-top">
              <div className="truncate text-sm font-black text-white">{track.title}</div>
              <div className="truncate text-xs text-neutral-500">{track.artist || track.source}</div>
            </div>
          </button>
        )) : <p className="col-span-full rounded-2xl border border-dashed border-white/15 p-4 text-sm leading-6 text-neutral-500">Save tracks from the feed to build a quick shelf.</p>}
      </div>
    </aside>
  )
}

function StorageStatus({ activeGroup, storageMode }) {
  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-neutral-300">
      <strong className="text-white">{activeGroup ? activeGroup.name : 'Personal music library'}</strong>
      <span className="text-neutral-500"> · </span>
      Storage: <strong className="text-white">{storageMode === 'remote' ? 'Supabase' : 'local fallback'}</strong>
      {storageMode === 'local' ? <span className="text-neutral-500">. Run the music SQL migration/sign in for synced music.</span> : null}
    </section>
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
  const featuredTrack = feedTracks[0] || null
  const listTracks = featuredTrack ? feedTracks.filter((track) => track.id !== featuredTrack.id) : feedTracks

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
      const metadataLabel = result.track.metadataReady ? ' with cover art' : ''
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
      <section className="mb-5 overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-neutral-900 via-neutral-950 to-emerald-950/50 p-4 shadow-2xl shadow-black/30 ring-1 ring-white/10 sm:p-5">
        <div className="grid gap-5 lg:grid-cols-[1fr_20rem] lg:items-end">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-200/70">Music room</p>
            <h1 className="mt-2 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-5xl">Share tracks, albums, and playlist links with covers.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400 sm:text-base">Spotify links now become cover-first music cards. YouTube still gets thumbnails, and everything can be saved into your personal shelf or active clique.</p>
          </div>
          <StorageStatus activeGroup={activeGroup} storageMode={storageMode} />
        </div>
        <div className="mt-5"><Composer draft={draft} saving={saving} onSubmit={addTrack} onChange={updateDraft} /></div>
      </section>

      <StatusMessage message={message} />

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <main className="min-w-0 space-y-4">
          {loading ? <p className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 text-neutral-400">Loading music…</p> : <FeaturedTrack track={featuredTrack} onInfo={setInfoTrack} onSave={toggleSaved} onRemove={removeTrack} />}

          <section className="rounded-[2rem] border border-white/10 bg-white/[0.025] p-4 shadow-2xl shadow-black/20">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Queue</p>
                <h2 className="mt-1 text-2xl font-black text-white">Latest music</h2>
              </div>
              <span className="text-sm text-neutral-500">{tracks.length} item{tracks.length === 1 ? '' : 's'}</span>
            </div>
            <div className="mt-4 grid gap-2">
              {loading ? null : listTracks.length ? listTracks.map((track) => <TrackRow key={track.id} track={track} onInfo={setInfoTrack} onSave={toggleSaved} onRemove={removeTrack} />) : featuredTrack ? <p className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-neutral-500">Add another song to build the queue.</p> : <p className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-neutral-500">No links yet. Paste a Spotify URL above to create the first card.</p>}
            </div>
          </section>
        </main>

        <div className="grid gap-4 lg:sticky lg:top-28">
          <SavedShelf tracks={savedTracks} onInfo={setInfoTrack} />
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-neutral-400">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-neutral-500">Supported</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {['Spotify cover', 'YouTube thumbnail', 'Apple link', 'SoundCloud link'].map((item) => <span key={item} className="rounded-full border border-white/10 bg-neutral-900 px-3 py-1.5 text-xs font-bold text-neutral-300">{item}</span>)}
            </div>
          </section>
        </div>
      </section>

      <InfoModal item={infoTrack} onClose={() => setInfoTrack(null)}>
        <div className="mt-4 grid gap-5 md:grid-cols-[15rem_1fr] md:items-start">
          <TrackCover track={infoTrack} className="aspect-square w-full" rounded="rounded-[2rem]" />
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              {infoTrack?.source ? <DetailPill>{infoTrack.source}</DetailPill> : null}
              {infoTrack?.itemType ? <DetailPill>{infoTrack.itemType}</DetailPill> : null}
              {infoTrack?.saved ? <DetailPill>Saved</DetailPill> : null}
              {infoTrack?.nominated_by ? <DetailPill>Added by {infoTrack.nominated_by}</DetailPill> : null}
            </div>
            {infoTrack?.artist || infoTrack?.album ? <p className="mt-4 text-sm text-neutral-300">{[infoTrack.artist, infoTrack.album].filter(Boolean).join(' · ')}</p> : null}
            <p className="mt-5 break-words text-sm leading-7 text-neutral-400">{infoTrack?.url || 'No link available.'}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {infoTrack?.url ? <a href={infoTrack.url} target="_blank" rel="noreferrer" className="inline-flex rounded-2xl bg-white px-4 py-3 text-sm font-black text-neutral-950 hover:bg-neutral-200">Open song</a> : null}
              {infoTrack?.previewUrl ? <a href={infoTrack.previewUrl} target="_blank" rel="noreferrer" className="inline-flex rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white hover:text-neutral-950">Play preview</a> : null}
              <button type="button" onClick={() => infoTrack && toggleSaved(infoTrack)} className="inline-flex rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white hover:text-neutral-950">{infoTrack?.saved ? 'Unsave' : 'Save'}</button>
            </div>
          </div>
        </div>
      </InfoModal>
    </PageShell>
  )
}
