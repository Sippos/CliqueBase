import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import SwipeDeck from '../components/SwipeDeck.jsx'
import PageShell from '../components/PageShell.jsx'
import { DetailPill, InfoModal, PageHero, StatusMessage, displayYear } from '../components/MediaBlocks.jsx'
import { getSavedHandle } from '../lib/handle.js'
import { getActiveGroupId } from '../lib/groups.js'
import { deleteVideo, getVideos, makeVideoFromLink, markVideoClassic, saveVideo, updateVideo, voteVideo } from '../lib/videoLibrary.js'
import { useMediaVotes } from '../hooks/useMediaVotes.js'

function scopedGroupFromLocation(search) {
  const params = new URLSearchParams(search)
  return params.get('clique') || params.get('group') || params.get('scope') || getActiveGroupId() || null
}

function VideoCard({ video, onInfo, onClassic, onEdit, onDelete }) {
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
          {video.classic ? <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-neutral-950">Classic</span> : <button type="button" onClick={() => onClassic(video)} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-neutral-300 hover:bg-white hover:text-neutral-950">Mark classic</button>}
          {video.url ? <a href={video.url} target="_blank" rel="noreferrer" className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-neutral-300 hover:bg-white hover:text-neutral-950">Open link</a> : null}
          <button type="button" onClick={() => onEdit(video)} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-neutral-300 hover:bg-white hover:text-neutral-950">Edit</button>
          <button type="button" onClick={() => onDelete(video)} className="rounded-full border border-rose-400/30 px-3 py-1.5 text-xs text-rose-100 hover:bg-rose-200 hover:text-rose-950">Delete</button>
        </div>
      </div>
    </div>
  )
}

function EditVideoModal({ video, value, setValue, onClose, onSave, onDelete, loading }) {
  if (!video) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-neutral-950 p-5 text-white shadow-2xl shadow-black/40">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Edit suggestion</p>
            <h2 className="mt-1 text-2xl font-semibold">Video title</h2>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-2xl text-neutral-400 hover:bg-white hover:text-neutral-950">×</button>
        </div>
        <input autoFocus value={value} onChange={(event) => setValue(event.target.value)} className="mt-5 w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" placeholder="Video title" />
        <p className="mt-3 break-words text-xs leading-5 text-neutral-500">{video.url}</p>
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button type="button" disabled={loading} onClick={onSave} className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-neutral-200 disabled:opacity-60">Save title</button>
          <button type="button" disabled={loading} onClick={() => onDelete(video)} className="rounded-2xl border border-rose-400/30 px-4 py-3 text-sm font-semibold text-rose-100 hover:bg-rose-200 hover:text-rose-950 disabled:opacity-60">Delete</button>
          <button type="button" onClick={onClose} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-neutral-300 hover:bg-white hover:text-neutral-950">Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function Videos() {
  const location = useLocation()
  const groupId = scopedGroupFromLocation(location.search)
  const [videos, setVideos] = useState([])
  const [votes, recordVote] = useMediaVotes('video', groupId)
  const [infoVideo, setInfoVideo] = useState(null)
  const [editingVideo, setEditingVideo] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [draft, setDraft] = useState({ url: '', title: '' })
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)
  const deckRef = useRef(null)
  const activeHandle = getSavedHandle()
  const isClique = Boolean(groupId)

  const classicVideos = useMemo(() => videos.filter((item) => item.classic), [videos])
  const feedVideos = useMemo(() => videos.slice().sort((a, b) => Number(b.classic) - Number(a.classic) || (b.score || 0) - (a.score || 0)), [videos])
  const votePile = useMemo(() => videos.filter((item) => !item.classic && !votes[item.id]).slice(0, 20), [videos, votes])

  useEffect(() => {
    let cancelled = false
    async function loadVideos() {
      setLoading(true)
      setMessage(null)
      try {
        const nextVideos = await getVideos(groupId)
        if (!cancelled) setVideos(nextVideos)
      } catch (error) {
        if (!cancelled) setMessage({ type: 'error', text: error.message || 'Could not load videos.' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadVideos()
    return () => { cancelled = true }
  }, [groupId])

  function showMessage(text, type = 'success') {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 2200)
  }

  async function addVideo(event, markClassic = false) {
    event.preventDefault()
    if (!draft.url.trim()) return

    setLoading(true)
    try {
      const draftVideo = await makeVideoFromLink(draft.url, draft.title, activeHandle)
      const saved = await saveVideo(draftVideo, activeHandle || 'anonymous', groupId, markClassic)
      setVideos((current) => [saved, ...current.filter((item) => item.id !== saved.id)])
      setDraft({ url: '', title: '' })
      showMessage(markClassic ? `"${saved.title}" saved as classic.` : `"${saved.title}" uploaded to ${isClique ? 'this clique' : 'your video feed'}.`)
    } catch (error) {
      showMessage(error.message || 'Could not upload that video link.', 'error')
    } finally {
      setLoading(false)
    }
  }

  function startEdit(video) {
    setEditingVideo(video)
    setEditTitle(video.title || '')
  }

  async function saveEdit() {
    if (!editingVideo) return
    setLoading(true)
    try {
      const saved = await updateVideo(editingVideo, { title: editTitle }, groupId)
      setVideos((current) => current.map((item) => item.id === saved.id ? saved : item))
      setInfoVideo((current) => current?.id === saved.id ? saved : current)
      setEditingVideo(null)
      showMessage(`Renamed to "${saved.title}".`)
    } catch (error) {
      showMessage(error.message || 'Could not update this video.', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function removeVideo(video) {
    if (!video) return
    const confirmed = window.confirm(`Delete "${video.title}" from ${isClique ? 'this clique' : 'your feed'}?`)
    if (!confirmed) return
    setLoading(true)
    try {
      await deleteVideo(video, groupId)
      setVideos((current) => current.filter((item) => item.id !== video.id))
      if (infoVideo?.id === video.id) setInfoVideo(null)
      if (editingVideo?.id === video.id) setEditingVideo(null)
      showMessage(`Deleted "${video.title}".`)
    } catch (error) {
      showMessage(error.message || 'Could not delete this video.', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function markClassic(video) {
    setLoading(true)
    try {
      const saved = await markVideoClassic(video, groupId)
      setVideos((current) => current.map((item) => item.id === saved.id ? saved : item))
      recordVote(video.id, 'like')
      showMessage(`"${saved.title}" saved as classic.`)
    } catch (error) {
      showMessage(error.message || 'Could not mark this video as classic.', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function handleSwipe(vote, video) {
    recordVote(video.id, vote)
    try {
      await voteVideo(video, vote, groupId)
      if (vote === 'like') await markClassic(video)
      else showMessage(`You passed on "${video.title}".`)
    } catch (error) {
      showMessage(error.message || 'Could not save your vote.', 'error')
    }
  }

  async function refreshPage() {
    setInfoVideo(null)
    setEditingVideo(null)
    setDraft({ url: '', title: '' })
    setMessage(null)
    setLoading(true)
    try {
      setVideos(await getVideos(groupId))
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Could not refresh videos.' })
    } finally {
      setLoading(false)
    }
  }

  const cardActions = {
    onInfo: setInfoVideo,
    onClassic: markClassic,
    onEdit: startEdit,
    onDelete: removeVideo,
  }

  return (
    <PageShell active="videos">
      <PageHero
        eyebrow={isClique ? 'Clique video tab' : 'Video library'}
        title={isClique ? 'Upload videos to this clique' : 'Start a fresh video feed'}
        description={isClique ? 'Paste YouTube, TikTok, Instagram, or any video link. Everyone in the clique can see it here, vote on it, and pin classics.' : 'Paste YouTube or other video links, keep a feed, swipe the non-classics, and pin the best links forever.'}
        warning={!activeHandle ? 'Create a profile with the Profile button in the navbar before uploading so your name appears on links.' : null}
        actions={<button type="button" onClick={refreshPage} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-neutral-200 transition hover:bg-white hover:text-neutral-950">Refresh videos</button>}
      >
        <form onSubmit={(event) => addVideo(event, false)} className="mt-5 space-y-3">
          <input className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" placeholder="Paste YouTube / TikTok / Instagram / video link" value={draft.url} onChange={(event) => setDraft((current) => ({ ...current, url: event.target.value }))} />
          <input className="w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" placeholder="Custom title (optional — YouTube title is used automatically)" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button type="submit" disabled={loading} className="rounded-2xl bg-white px-5 py-3 font-semibold text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-60">{loading ? 'Saving...' : isClique ? 'Upload to clique' : 'Upload to feed'}</button>
            <button type="button" disabled={loading} onClick={(event) => addVideo(event, true)} className="rounded-2xl border border-white/10 px-5 py-3 font-semibold text-white transition hover:bg-white hover:text-neutral-950 disabled:opacity-60">Upload as classic</button>
          </div>
        </form>
      </PageHero>

      <StatusMessage message={message} />

      <section className="mb-10 rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Latest uploads</p>
            <h2 className="mt-1 text-3xl font-semibold text-white">{isClique ? 'Clique video feed' : 'Video feed'}</h2>
          </div>
          <div className="text-sm text-neutral-500">{videos.length} uploaded link{videos.length === 1 ? '' : 's'}</div>
        </div>
        {loading && feedVideos.length === 0 ? <p className="rounded-2xl border border-white/10 p-5 text-neutral-400">Loading videos...</p> : null}
        {!loading && feedVideos.length === 0 ? <p className="rounded-2xl border border-dashed border-white/15 p-5 text-neutral-400">No videos yet. Use the upload box above to add the first video link to this {isClique ? 'clique' : 'feed'}.</p> : null}
        {feedVideos.length ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{feedVideos.map((video) => <VideoCard key={video.id} video={video} {...cardActions} />)}</div> : null}
      </section>

      <section ref={deckRef} className="mb-10">
        <SwipeDeck items={votePile} onSwipe={handleSwipe} itemLabel="videos" emptyLabel="No video links to vote on yet" likeLabel="Classic" dislikeLabel="Pass" infoType="video" />
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Hall of fame</p>
            <h2 className="mt-1 text-3xl font-semibold text-white">Classic funny videos</h2>
          </div>
          <div className="max-w-xs text-sm text-neutral-500 sm:text-right">Pinned links the {isClique ? 'clique' : 'group'} wants to remember forever</div>
        </div>
        {classicVideos.length === 0 ? <p className="rounded-2xl border border-dashed border-white/15 p-5 text-neutral-400">No classics yet.</p> : <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{classicVideos.map((video) => <VideoCard key={video.id} video={video} {...cardActions} />)}</div>}
      </section>

      <InfoModal item={infoVideo} onClose={() => setInfoVideo(null)} year={displayYear(infoVideo?.year)}>
        <div className="mt-4 flex flex-wrap gap-2">
          {infoVideo?.platform ? <DetailPill>{infoVideo.platform}</DetailPill> : null}
          {infoVideo?.classic ? <DetailPill>Classic</DetailPill> : null}
          {infoVideo?.nominated_by ? <DetailPill>Added by {infoVideo.nominated_by}</DetailPill> : null}
        </div>
        {infoVideo?.poster ? <img src={infoVideo.poster} alt="" className="mt-5 max-h-80 w-full rounded-3xl object-cover" /> : null}
        <p className="mt-5 break-words text-sm leading-7 text-neutral-300">{infoVideo?.overview || infoVideo?.url || 'No description yet.'}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {infoVideo?.url ? <a href={infoVideo.url} target="_blank" rel="noreferrer" className="inline-flex rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-neutral-200">Open video</a> : null}
          {infoVideo ? <button type="button" onClick={() => startEdit(infoVideo)} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-neutral-200 hover:bg-white hover:text-neutral-950">Edit title</button> : null}
          {infoVideo ? <button type="button" onClick={() => removeVideo(infoVideo)} className="rounded-2xl border border-rose-400/30 px-4 py-3 text-sm font-semibold text-rose-100 hover:bg-rose-200 hover:text-rose-950">Delete</button> : null}
        </div>
      </InfoModal>

      <EditVideoModal video={editingVideo} value={editTitle} setValue={setEditTitle} onClose={() => setEditingVideo(null)} onSave={saveEdit} onDelete={removeVideo} loading={loading} />
    </PageShell>
  )
}
