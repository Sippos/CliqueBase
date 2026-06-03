import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AppIcon from '../components/AppIcon.jsx'
import MemberShareModal from '../components/MemberShareModal.jsx'
import PageShell from '../components/PageShell.jsx'
import { GROUPS_CHANGED_EVENT, getActiveGroup, getActiveGroupId, setActiveGroup } from '../lib/groups.js'
import { getSavedHandle } from '../lib/handle.js'
import { getCurrentSession, getGames, getMovies, getRemoteGroups, getSeries, hasSupabase, saveGame, saveMovie, saveSeries } from '../lib/supabaseClient.js'
import { getVideos, saveVideo } from '../lib/videoLibrary.js'

const TYPE_ICONS = { Movie: 'movies', Series: 'series', Game: 'games', Video: 'videos' }
const TYPE_PATHS = { Movies: '/movies', Series: '/series', Games: '/games', Videos: '/videos' }

function normalizeItems(rows, type, code) {
  return rows.map((item) => ({
    ...item,
    type,
    code,
    rating: item.rating || null,
    sortValue: Number(item.score || 0) * 10 + Number(item.picks || 0) + Number(item.rating || 0) + (item.classic ? 8 : 0),
  })).sort((a, b) => b.sortValue - a.sortValue)
}

function itemActionKey(item, prefix = '') { return item ? `${prefix}${item.type}-${item.id}` : '' }
function itemText(item) { return item?.overview || item?.description || item?.url || 'No description yet.' }
function imageFor(item) { return item?.backdrop || item?.poster || null }
function addPath(category, groupId) { return groupId ? `${TYPE_PATHS[category.title]}?clique=${encodeURIComponent(groupId)}` : TYPE_PATHS[category.title] }
function itemTypeForShare(item) { return String(item?.type || '').toLowerCase() }
function itemMetaChips(item) {
  if (!item) return []
  const genres = Array.isArray(item.genres) ? item.genres.filter(Boolean) : []
  const platforms = Array.isArray(item.platforms) ? item.platforms.filter(Boolean) : []
  const fallbackPlatform = item.platform || platforms[0]
  return [item.year, genres[0], genres[1] || (!genres.length ? fallbackPlatform : '')].filter(Boolean).slice(0, 3)
}

function SmallIconButton({ icon, label, onClick, disabled = false, strong = false }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className={`inline-flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur transition disabled:pointer-events-none disabled:opacity-50 ${strong ? 'border-white bg-white text-neutral-950 hover:bg-neutral-200' : 'border-white/15 bg-black/55 text-white hover:bg-white hover:text-neutral-950'}`}>
      <AppIcon name={icon} size={14} strokeWidth={2.4} />
    </button>
  )
}

function AddMenu({ categories, groupId }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-black text-neutral-950 transition hover:bg-neutral-200">
        <span>Add</span>
        <AppIcon name="chevronDown" size={14} />
      </button>
      {open ? (
        <div className="absolute right-0 top-12 z-30 w-56 overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 p-2 shadow-2xl shadow-black/40">
          {categories.map((category) => (
            <Link key={category.title} to={addPath(category, groupId)} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-black text-neutral-200 transition hover:bg-white hover:text-neutral-950">
              <AppIcon name={category.icon} size={14} />
              {category.singular}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function LibraryReel({ items, loading, onShare, onInfo }) {
  const [index, setIndex] = useState(0)
  useEffect(() => { setIndex((current) => items.length ? Math.min(current, items.length - 1) : 0) }, [items.length])
  useEffect(() => {
    if (items.length < 2) return undefined
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % items.length), 4200)
    return () => window.clearInterval(timer)
  }, [items.length])

  if (loading) {
    return <div className="relative flex min-h-[18rem] items-end overflow-hidden rounded-[1.5rem] bg-neutral-950 p-5"><div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(0,0,0,0.45))]" /><div className="relative"><p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Library reel</p><h2 className="mt-2 text-2xl font-black text-white">Loading…</h2></div></div>
  }

  if (!items.length) {
    return <div className="relative flex min-h-[18rem] items-end overflow-hidden rounded-[1.5rem] bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.16),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,0,0,0.4))] p-5"><div><p className="text-xs uppercase tracking-[0.3em] text-neutral-400">Empty library</p><h2 className="mt-2 text-2xl font-black text-white">Add your first pick</h2><p className="mt-2 max-w-sm text-sm leading-6 text-neutral-300">Use the Add menu to save movies, series, games, or videos.</p></div></div>
  }

  const item = items[index] || items[0]
  const image = imageFor(item)
  return (
    <div className="relative min-h-[18rem] overflow-hidden rounded-[1.5rem] bg-neutral-950">
      <button type="button" onClick={() => onInfo?.(item)} className="group absolute inset-0 flex items-end p-5 text-left">
        {image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-65 transition duration-700 group-hover:scale-105" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.16),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,0,0,0.4))]" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />
        <div className="absolute left-5 top-5 right-5 flex items-center justify-between gap-3">
          <span className="rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-xs font-black uppercase tracking-[0.22em] text-white backdrop-blur">Library reel</span>
          <span className="rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-xs font-bold text-neutral-200 backdrop-blur">{index + 1}/{items.length}</span>
        </div>
        <div className="relative max-w-md pr-20">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-300">{item.type}</p>
          <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">{item.title}</h2>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-300">{itemText(item)}</p>
        </div>
      </button>
      <div className="absolute bottom-5 right-5 z-10 flex gap-2">
        <SmallIconButton icon="info" label={`Show details for ${item.title}`} onClick={() => onInfo?.(item)} />
        <SmallIconButton icon="share" label={`Share ${item.title}`} onClick={() => onShare?.(item)} strong />
      </div>
    </div>
  )
}

function ShelfCard({ item, isClique, copying, onInfo, onShare, onCopy }) {
  const image = imageFor(item)
  const chips = itemMetaChips(item)
  return (
    <article className="w-[15rem] shrink-0 overflow-hidden rounded-[1.25rem] border border-white/10 bg-neutral-950/80 text-white transition hover:border-white/25 sm:w-[17rem]">
      <div className="group relative h-32 overflow-hidden sm:h-36">
        <button type="button" onClick={() => onInfo?.(item)} className="absolute inset-0 z-10 text-left" aria-label={`Show details for ${item.title}`} />
        {image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-75 transition duration-500 group-hover:scale-105" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.14),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,0,0,0.45))]" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />
        <span className="absolute left-2 top-2 rounded-full border border-white/15 bg-black/55 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-white backdrop-blur">{item.type}</span>
        <div className="absolute right-2 top-2 z-20 flex gap-1.5">
          <SmallIconButton icon="info" label={`Show details for ${item.title}`} onClick={() => onInfo?.(item)} />
          <SmallIconButton icon="share" label={`Share ${item.title}`} onClick={() => onShare?.(item)} />
          {isClique ? <SmallIconButton icon="copy" label={`Copy ${item.title} to My Library`} onClick={() => onCopy?.(item)} disabled={copying} /> : null}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-3">
          <h3 className="line-clamp-2 text-base font-black leading-tight text-white">{item.title}</h3>
        </div>
      </div>
      <div className="p-3">
        <div className="flex flex-wrap gap-1 text-[10px] font-semibold text-neutral-300">
          {chips.slice(0, 2).map((chip) => <span key={chip} className="rounded-full border border-white/10 px-2 py-1">{chip}</span>)}
          {item.rating ? <span className="rounded-full border border-white/10 px-2 py-1">★ {Number(item.rating).toFixed(1)}</span> : null}
          {item.classic ? <span className="rounded-full border border-white/10 px-2 py-1">Classic</span> : null}
        </div>
      </div>
    </article>
  )
}

function CategoryShelf({ category, loading, isClique, copyingKey, onInfo, onShare, onCopy }) {
  const items = category.items || []
  return (
    <section id={`library-${category.title.toLowerCase()}`} className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4 text-white sm:rounded-[1.75rem] sm:p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500"><AppIcon name={category.icon} size={14} />Library</p>
          <h2 className="mt-1 text-2xl font-black">{category.title}</h2>
          <p className="mt-1 text-sm text-neutral-500">{loading ? 'Loading…' : `${items.length} saved`}</p>
        </div>
      </div>
      {loading ? <p className="mt-4 rounded-2xl border border-white/10 p-4 text-sm text-neutral-400">Loading {category.title.toLowerCase()}…</p> : items.length ? (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
          {items.map((item) => <ShelfCard key={`${item.type}-${item.id}`} item={item} isClique={isClique} copying={copyingKey === itemActionKey(item, 'copy-')} onInfo={onInfo} onShare={onShare} onCopy={onCopy} />)}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-neutral-950/50 p-5 text-sm text-neutral-500">No {category.title.toLowerCase()} saved yet. Use the Add menu above.</div>
      )}
    </section>
  )
}

function ItemInfoModal({ item, onClose }) {
  if (!item) return null
  const image = imageFor(item)
  const icon = TYPE_ICONS[item.type] || 'explore'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-white/10 bg-neutral-950 p-5 text-white shadow-2xl shadow-black/40">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0"><p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-neutral-500"><AppIcon name={icon} size={14} />{item.type}</p><h2 className="mt-2 text-2xl font-black leading-tight">{item.title}</h2></div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-2xl text-neutral-400 transition hover:bg-white hover:text-neutral-950">×</button>
        </div>
        {image ? <img src={image} alt="" className="mt-5 h-56 w-full rounded-3xl object-cover" /> : null}
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-neutral-300">
          <span className="rounded-full border border-white/10 px-3 py-1.5">Score {item.score || 0}</span>
          <span className="rounded-full border border-white/10 px-3 py-1.5">{item.picks || 0} picks</span>
          {item.rating ? <span className="rounded-full border border-white/10 px-3 py-1.5">★ {Number(item.rating).toFixed(1)}</span> : null}
          {item.classic ? <span className="rounded-full border border-white/10 px-3 py-1.5">Classic</span> : null}
          {item.platform ? <span className="rounded-full border border-white/10 px-3 py-1.5">{item.platform}</span> : null}
        </div>
        <p className="mt-5 break-words text-sm leading-7 text-neutral-300">{itemText(item)}</p>
        {item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-2xl bg-white px-4 py-3 text-sm font-black text-neutral-950 hover:bg-neutral-200">Open video</a> : null}
      </div>
    </div>
  )
}

export default function Home() {
  const { groupId: routeGroupId } = useParams()
  const [loading, setLoading] = useState(hasSupabase)
  const [status, setStatus] = useState(hasSupabase ? 'checking' : 'local')
  const [context, setContext] = useState(() => ({ type: getActiveGroup() ? 'group' : 'personal', name: getActiveGroup()?.name || 'My Library', groupId: getActiveGroup()?.id || null }))
  const [media, setMedia] = useState({ movies: [], series: [], games: [], videos: [] })
  const [message, setMessage] = useState('')
  const [shareNotice, setShareNotice] = useState('')
  const [sharingItem, setSharingItem] = useState(null)
  const [infoItem, setInfoItem] = useState(null)
  const [copyingKey, setCopyingKey] = useState('')

  useEffect(() => {
    if (routeGroupId) setActiveGroup(routeGroupId)
    refreshDashboard(routeGroupId || null)
    function handleGroupChange() { refreshDashboard(routeGroupId || null) }
    window.addEventListener(GROUPS_CHANGED_EVENT, handleGroupChange)
    return () => window.removeEventListener(GROUPS_CHANGED_EVENT, handleGroupChange)
  }, [routeGroupId])

  const movieItems = useMemo(() => normalizeItems(media.movies, 'Movie', 'MOV'), [media.movies])
  const seriesItems = useMemo(() => normalizeItems(media.series, 'Series', 'SER'), [media.series])
  const gameItems = useMemo(() => normalizeItems(media.games, 'Game', 'GAM'), [media.games])
  const videoItems = useMemo(() => normalizeItems(media.videos, 'Video', 'VID'), [media.videos])
  const allItems = useMemo(() => [...movieItems, ...seriesItems, ...gameItems, ...videoItems].sort((a, b) => b.sortValue - a.sortValue), [movieItems, seriesItems, gameItems, videoItems])
  const categories = useMemo(() => [
    { title: 'Movies', singular: 'Movie', code: 'MOV', icon: TYPE_ICONS.Movie, groupId: context.groupId, items: movieItems },
    { title: 'Series', singular: 'Series', code: 'SER', icon: TYPE_ICONS.Series, groupId: context.groupId, items: seriesItems },
    { title: 'Games', singular: 'Game', code: 'GAM', icon: TYPE_ICONS.Game, groupId: context.groupId, items: gameItems },
    { title: 'Videos', singular: 'Video', code: 'VID', icon: TYPE_ICONS.Video, groupId: context.groupId, items: videoItems },
  ], [context.groupId, movieItems, seriesItems, gameItems, videoItems])
  const ratedCount = useMemo(() => allItems.filter((item) => item.rating).length, [allItems])
  const totalPicks = useMemo(() => allItems.reduce((sum, item) => sum + Number(item.picks || 0), 0), [allItems])
  const isClique = Boolean(context.groupId)

  async function refreshDashboard(preferredGroupId = null) {
    setLoading(true)
    setMessage('')
    if (!hasSupabase) {
      const group = preferredGroupId ? setActiveGroup(preferredGroupId) : getActiveGroup()
      setContext({ type: group ? 'group' : 'personal', name: group?.name || 'My Library', groupId: group?.id || null })
      setMedia({ movies: [], series: [], games: [], videos: [] })
      setStatus('local')
      setLoading(false)
      return
    }
    try {
      const session = await getCurrentSession()
      if (!session?.user) {
        setStatus('signed-out')
        setContext({ type: 'personal', name: 'My Library', groupId: null })
        setMedia({ movies: [], series: [], games: [], videos: [] })
        return
      }
      const remoteGroups = await getRemoteGroups().catch(() => [])
      const activeId = preferredGroupId || getActiveGroupId()
      const group = remoteGroups.find((item) => item.id === activeId) || null
      const localGroup = getActiveGroup()
      const groupId = activeId || null
      if (groupId) setActiveGroup(groupId)
      setContext({ type: groupId ? 'group' : 'personal', name: group?.name || (groupId && localGroup?.id === groupId ? localGroup.name : null) || (groupId ? 'Clique' : 'My Library'), groupId })
      const [movies, seriesRows, games, videos] = await Promise.all([getMovies(groupId), getSeries(groupId), getGames(groupId), getVideos(groupId)])
      setMedia({ movies, series: seriesRows, games, videos })
      setStatus('ready')
    } catch (error) {
      setStatus('error')
      setMessage(error.message || 'Could not load this workspace.')
      setMedia({ movies: [], series: [], games: [], videos: [] })
    } finally {
      setLoading(false)
    }
  }

  function openShare(item) { setSharingItem(item) }
  function handleShareMessage(text) { setShareNotice(text); setTimeout(() => setShareNotice(''), 2600) }

  async function copyToLibrary(item) {
    if (!item || !hasSupabase || status !== 'ready') return handleShareMessage('Sign in from Profile before copying to My Library.')
    const key = itemActionKey(item, 'copy-')
    setCopyingKey(key)
    try {
      const nominatedBy = getSavedHandle() || 'anonymous'
      if (item.type === 'Movie') await saveMovie(item, nominatedBy, null)
      else if (item.type === 'Series') await saveSeries(item, nominatedBy, null)
      else if (item.type === 'Game') await saveGame(item, nominatedBy, null)
      else if (item.type === 'Video') await saveVideo(item, nominatedBy, null)
      else throw new Error('Unsupported item type.')
      handleShareMessage(`Copied "${item.title}" to My Library.`)
    } catch (error) {
      handleShareMessage(error.message || 'Could not copy this item to My Library.')
    } finally {
      setCopyingKey('')
    }
  }

  return (
    <PageShell active={isClique ? 'cliques' : 'library'}>
      <section className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.03] text-white shadow-2xl shadow-black/20">
        <div className="grid gap-0 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">{context.name}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">{isClique ? 'Shared movies, series, games, and videos for this clique.' : 'Your saved movies, series, games, and videos.'}</p>
              </div>
              <AddMenu categories={categories} groupId={context.groupId} />
            </div>
            {status === 'signed-out' ? <p className="mt-3 inline-flex rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-neutral-300">Sign in from Profile to save picks and sync your library.</p> : null}
            <div className="mt-4 grid grid-cols-3 gap-2 sm:max-w-xl">
              <div className="rounded-2xl border border-white/10 bg-neutral-950/70 p-3"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">Total</p><p className="mt-1 text-2xl font-black">{loading ? '…' : allItems.length}</p></div>
              <div className="rounded-2xl border border-white/10 bg-neutral-950/70 p-3"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">Rated</p><p className="mt-1 text-2xl font-black">{loading ? '…' : ratedCount}</p></div>
              <div className="rounded-2xl border border-white/10 bg-neutral-950/70 p-3"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">Picks</p><p className="mt-1 text-2xl font-black">{loading ? '…' : totalPicks}</p></div>
            </div>
          </div>
          <div className="p-3 pt-0 xl:p-3">
            <LibraryReel items={loading ? [] : allItems} loading={loading} onShare={openShare} onInfo={setInfoItem} />
          </div>
        </div>
      </section>

      {shareNotice ? <div className="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-950/30 p-4 text-sm text-emerald-100">{shareNotice}</div> : null}
      {message ? <div className="mt-5 rounded-2xl border border-rose-400/30 bg-rose-950/30 p-4 text-sm text-rose-100">{message}</div> : null}

      <div className="mt-5 grid gap-5">
        {categories.map((category) => <CategoryShelf key={category.title} category={category} loading={loading} isClique={isClique} copyingKey={copyingKey} onInfo={setInfoItem} onShare={openShare} onCopy={copyToLibrary} />)}
      </div>

      <ItemInfoModal item={infoItem} onClose={() => setInfoItem(null)} />
      {sharingItem ? <MemberShareModal item={sharingItem} type={itemTypeForShare(sharingItem)} onClose={() => setSharingItem(null)} onMessage={handleShareMessage} /> : null}
    </PageShell>
  )
}
