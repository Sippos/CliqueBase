import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import PageShell from '../components/PageShell.jsx'
import { DetailPill, displayYear } from '../components/MediaBlocks.jsx'
import { getSavedHandle } from '../lib/handle.js'
import { GROUPS_CHANGED_EVENT, getActiveGroupId, setActiveGroup as setActiveGroupContext } from '../lib/groups.js'
import { mediaTypeLabel, mediaTypePath, normalizeShareType, readSharePayload } from '../lib/share.js'
import { getCurrentSession, getRemoteGroups, hasSupabase, saveGame, saveMovie, saveSeries } from '../lib/supabaseClient.js'
import { saveVideo } from '../lib/videoLibrary.js'
import { saveMusicItem } from '../lib/musicLibrary.js'

function scopeLabel(scope, groups) {
  if (scope === 'personal') return 'Personal library'
  return groups.find((group) => group.id === scope)?.name || 'Selected clique'
}

function fallbackPayload(type, id) {
  return {
    type,
    id,
    title: 'Shared pick',
    year: '',
    released: null,
    poster: null,
    backdrop: null,
    overview: 'This shared item can be saved to your library.',
    url: '',
    genres: [],
  }
}

export default function Share() {
  const { type: routeType, id } = useParams()
  const [searchParams] = useSearchParams()
  const type = normalizeShareType(routeType)
  const encoded = searchParams.get('data')
  const payload = useMemo(() => readSharePayload(encoded) || fallbackPayload(type, id), [encoded, type, id])
  const [groups, setGroups] = useState([])
  const [selectedScope, setSelectedScope] = useState(() => getActiveGroupId() || 'personal')
  const [status, setStatus] = useState(hasSupabase ? 'checking' : 'local')
  const [message, setMessage] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    refreshContext()
    function handleGroupChange() {
      setSelectedScope(getActiveGroupId() || 'personal')
    }
    window.addEventListener(GROUPS_CHANGED_EVENT, handleGroupChange)
    return () => window.removeEventListener(GROUPS_CHANGED_EVENT, handleGroupChange)
  }, [])

  async function refreshContext() {
    if (!hasSupabase) return
    try {
      const session = await getCurrentSession()
      if (!session?.user) {
        setStatus('signed-out')
        return
      }
      const remoteGroups = await getRemoteGroups().catch(() => [])
      setGroups(remoteGroups)
      const activeGroupId = getActiveGroupId()
      setSelectedScope(activeGroupId && remoteGroups.some((group) => group.id === activeGroupId) ? activeGroupId : 'personal')
      setStatus('ready')
    } catch (error) {
      setStatus('error')
      setMessage({ type: 'error', text: error.message || 'Could not load sharing options.' })
    }
  }

  async function saveSharedPick() {
    const groupId = selectedScope === 'personal' ? null : selectedScope
    const nominatedBy = getSavedHandle() || 'anonymous'
    setSaving(true)
    setMessage(null)
    try {
      if (hasSupabase && status !== 'ready' && payload.type !== 'music') throw new Error('Sign in from Profile before saving shared picks.')
      if (payload.type === 'movie') await saveMovie(payload, nominatedBy, groupId)
      else if (payload.type === 'series') await saveSeries(payload, nominatedBy, groupId)
      else if (payload.type === 'game') await saveGame(payload, nominatedBy, groupId)
      else if (payload.type === 'video') await saveVideo(payload, nominatedBy, groupId)
      else if (payload.type === 'music') await saveMusicItem(payload, { groupId, nominatedBy })
      else throw new Error('Unsupported shared item type.')

      if (groupId) setActiveGroupContext(groupId)
      setMessage({ type: 'success', text: `${payload.title} saved to ${scopeLabel(selectedScope, groups)}.` })
    } catch (error) {
      setMessage({ type: 'error', text: error.message || 'Could not save this shared pick.' })
    } finally {
      setSaving(false)
    }
  }

  const image = payload.backdrop || payload.poster
  const year = displayYear(payload.released || payload.year)
  const targetPath = mediaTypePath(payload.type)

  return (
    <PageShell active="library">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] shadow-2xl shadow-black/20">
        <div className="grid gap-0 md:grid-cols-[0.95fr_1.05fr]">
          <div className="relative min-h-[18rem] bg-neutral-950">
            {image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.14),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,0,0,0.4))]" />}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />
            <span className="absolute left-5 top-5 rounded-full border border-white/15 bg-black/40 px-3 py-1.5 text-xs font-black uppercase tracking-[0.22em] text-white backdrop-blur">Shared {mediaTypeLabel(payload.type)}</span>
          </div>

          <div className="p-5 sm:p-8">
            <p className="text-xs uppercase tracking-[0.35em] text-neutral-500">Receive share</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-white">{payload.title}</h1>
            {year ? <p className="mt-2 text-sm font-semibold text-neutral-400">{year}</p> : null}
            {payload.artist || payload.album ? <p className="mt-2 text-sm font-semibold text-neutral-400">{[payload.artist, payload.album].filter(Boolean).join(' · ')}</p> : null}
            <p className="mt-4 max-w-2xl text-sm leading-7 text-neutral-300">{payload.overview || payload.url || 'Save this shared pick to your library or a clique.'}</p>

            <div className="mt-5 flex flex-wrap gap-2">
              {payload.platform ? <DetailPill>{payload.platform}</DetailPill> : null}
              {payload.source ? <DetailPill>{payload.source}</DetailPill> : null}
              {payload.tmdbRating ? <DetailPill>TMDB ★ {Number(payload.tmdbRating).toFixed(1)}</DetailPill> : null}
              {payload.rawgRating ? <DetailPill>RAWG ★ {Number(payload.rawgRating).toFixed(1)}</DetailPill> : null}
              {payload.genres?.slice(0, 4).map((genre) => <DetailPill key={genre}>{genre}</DetailPill>)}
            </div>

            {message ? <div className={`mt-5 rounded-2xl p-3 text-sm text-white ${message.type === 'error' ? 'bg-red-600' : 'bg-emerald-700'}`}>{message.text}</div> : null}
            {status === 'signed-out' ? <div className="mt-5 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-3 text-sm text-yellow-100">Sign in from Profile first, then reopen this share link.</div> : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
              {hasSupabase ? (
                <label className="grid flex-1 gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
                  Save to
                  <select value={selectedScope} onChange={(event) => setSelectedScope(event.target.value)} disabled={status !== 'ready'} className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-sm font-semibold normal-case tracking-normal text-white outline-none disabled:opacity-50">
                    <option value="personal">Personal library</option>
                    {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                  </select>
                </label>
              ) : null}
              <button type="button" onClick={saveSharedPick} disabled={saving || (hasSupabase && status !== 'ready')} className="rounded-2xl bg-white px-5 py-3 font-black text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-60">{saving ? 'Saving...' : 'Save pick'}</button>
              <Link to={targetPath} className="rounded-2xl border border-white/10 px-5 py-3 text-center font-semibold text-white transition hover:bg-white hover:text-neutral-950">Open {mediaTypeLabel(payload.type)} page</Link>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  )
}
