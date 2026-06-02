import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import AppIcon from '../components/AppIcon.jsx'
import MemberShareModal from '../components/MemberShareModal.jsx'
import PageShell from '../components/PageShell.jsx'
import { GROUPS_CHANGED_EVENT, getActiveGroup, getActiveGroupId, setActiveGroup } from '../lib/groups.js'
import { getSavedHandle } from '../lib/handle.js'
import { getCurrentSession, getGames, getMovies, getRemoteGroups, getSeries, hasSupabase, saveGame, saveMovie, saveSeries, voteGame, voteMovie, voteSeries } from '../lib/supabaseClient.js'

const TYPE_ICONS = { Movie: 'movies', Series: 'series', Game: 'games' }

function normalizeItems(rows, type, code) {
  return rows.map((item) => ({
    ...item,
    type,
    code,
    rating: item.rating || null,
    sortValue: Number(item.score || 0) * 10 + Number(item.picks || 0) + Number(item.rating || 0),
  })).sort((a, b) => b.sortValue - a.sortValue)
}

function itemActionKey(item, prefix = '') { return item ? `${prefix}${item.type}-${item.id}` : '' }
function itemText(item) { return item?.overview || item?.description || 'No description yet.' }
function plural(value, singular, pluralLabel = `${singular}s`) { return `${value} ${Number(value) === 1 ? singular : pluralLabel}` }
function imageFor(item) { return item?.backdrop || item?.poster || null }
function categoryTargetId(category) { return `top-${category.title.toLowerCase()}` }
function itemMetaChips(item) {
  if (!item) return []
  const genres = Array.isArray(item.genres) ? item.genres.filter(Boolean) : []
  const platforms = Array.isArray(item.platforms) ? item.platforms.filter(Boolean) : []
  const fallbackPlatform = item.platform || platforms[0]
  return [item.year, genres[0], genres[1] || (!genres.length ? fallbackPlatform : '')].filter(Boolean).slice(0, 3)
}

function SmallIconButton({ icon, label, onClick, disabled = false, strong = false, className = '' }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className={`inline-flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur transition disabled:pointer-events-none disabled:opacity-50 ${strong ? 'border-white bg-white text-neutral-950 hover:bg-neutral-200' : 'border-white/15 bg-black/55 text-white hover:bg-white hover:text-neutral-950'} ${className}`}>
      <AppIcon name={icon} size={14} strokeWidth={2.4} />
    </button>
  )
}

function OverviewMetric({ icon, label, value, detail }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5 sm:gap-2 sm:p-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-neutral-300 sm:h-7 sm:w-7"><AppIcon name={icon} size={13} strokeWidth={2.4} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[8px] font-black uppercase tracking-[0.14em] text-neutral-500 sm:text-[9px] sm:tracking-[0.2em]">{label}</span>
        <span className="mt-0.5 block text-base font-black leading-none text-white sm:text-lg">{value}</span>
        {detail ? <span className="mt-0.5 block truncate text-[10px] text-neutral-500 sm:text-[11px]">{detail}</span> : null}
      </span>
    </div>
  )
}

function LibraryOverviewPanel({ items, loading, ratedCount, totalPicks }) {
  return (
    <section className="mt-3 rounded-[1.4rem] border border-white/10 bg-neutral-950/70 p-2 shadow-2xl shadow-black/20 sm:mt-5 sm:rounded-[1.6rem] sm:p-3">
      <div className="grid grid-cols-3 gap-2">
        <OverviewMetric icon="dashboard" label="Total" value={loading ? '…' : items.length} detail="saved" />
        <OverviewMetric icon="info" label="Rated" value={loading ? '…' : ratedCount} detail="scores" />
        <OverviewMetric icon="users" label="Picks" value={loading ? '…' : totalPicks} detail="votes" />
      </div>
    </section>
  )
}

function LibraryShowcase({ items, loading, onShare, onInfo }) {
  const [index, setIndex] = useState(0)
  useEffect(() => { setIndex((current) => items.length ? Math.min(current, items.length - 1) : 0) }, [items.length])
  useEffect(() => { if (items.length < 2) return undefined; const timer = window.setInterval(() => setIndex((current) => (current + 1) % items.length), 4200); return () => window.clearInterval(timer) }, [items.length])
  if (loading) return <div className="relative flex min-h-[260px] items-end overflow-hidden bg-neutral-950 p-5 xl:min-h-full"><div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(0,0,0,0.45))]" /><div className="relative"><p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Library reel</p><h2 className="mt-2 text-2xl font-black text-white">Loading your library…</h2></div></div>
  if (!items.length) return <div className="relative flex min-h-[260px] items-end overflow-hidden bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.16),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,0,0,0.4))] p-5 xl:min-h-full"><div><p className="text-xs uppercase tracking-[0.3em] text-neutral-400">Empty library</p><h2 className="mt-2 text-2xl font-black text-white">Add the first item</h2><p className="mt-2 max-w-sm text-sm leading-6 text-neutral-300">Watched movies, finished series, and played games will appear here once you save them.</p></div></div>
  const item = items[index] || items[0]
  const image = imageFor(item)
  return (
    <div className="relative min-h-[260px] overflow-hidden bg-neutral-950 xl:min-h-full">
      <button type="button" onClick={() => onInfo?.(item)} className="group absolute inset-0 flex items-end p-5 text-left">
        {image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-65 transition duration-700 group-hover:scale-105" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.16),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,0,0,0.4))]" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />
        <div className="absolute left-5 top-5 right-5 flex items-center justify-between gap-3"><span className="rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-xs font-black uppercase tracking-[0.22em] text-white backdrop-blur">Library reel</span><span className="rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-xs font-bold text-neutral-200 backdrop-blur">{index + 1}/{items.length}</span></div>
        <div className="relative max-w-md pr-20"><p className="text-xs uppercase tracking-[0.3em] text-neutral-300">{item.type}</p><h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">{item.title}</h2><p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-300">{itemText(item)}</p></div>
      </button>
      <div className="absolute bottom-5 right-5 z-10 flex gap-2"><SmallIconButton icon="info" label={`Show details for ${item.title}`} onClick={() => onInfo?.(item)} /><SmallIconButton icon="share" label={`Share ${item.title}`} onClick={() => onShare?.(item)} strong /></div>
    </div>
  )
}

function CategorySpotlightCard({ category, loading, isClique, saving, index, onCycle, onOpenPile, onInfo, onShare, onCopy }) {
  const items = category.items || []
  const safeIndex = items.length ? index % items.length : 0
  const item = items[safeIndex]
  const image = imageFor(item)
  const canCycle = items.length > 1
  const title = loading ? 'Loading section…' : item?.title || `No ${category.title.toLowerCase()} yet`
  const chips = itemMetaChips(item)

  return (
    <article id={categoryTargetId(category)} data-top-category={category.title} className="group relative min-h-[15.25rem] snap-start overflow-hidden rounded-[1.6rem] border border-white/10 bg-neutral-950/80 text-white shadow-2xl shadow-black/20 transition hover:-translate-y-0.5 hover:border-white/25 sm:min-h-[19rem] sm:rounded-[1.75rem]">
      {image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-82 transition duration-500 group-hover:scale-105" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.14),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,0,0,0.45))]" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/5" />
      <button type="button" onClick={() => item ? onInfo?.(item) : onOpenPile?.(category)} className="absolute inset-0 z-10" aria-label={`Open ${title}`} />

      <div className="pointer-events-none relative z-20 flex min-h-[15.25rem] flex-col justify-between p-3 sm:min-h-[19rem] sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/45 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-neutral-100 backdrop-blur sm:px-3 sm:text-[10px] sm:tracking-[0.16em]">Featured</span>
          <div className="pointer-events-auto flex flex-wrap justify-end gap-2">
            <SmallIconButton icon="list" label={`Open ${category.title} list`} onClick={(event) => { event.stopPropagation(); onOpenPile?.(category) }} strong />
            {item ? <SmallIconButton icon="info" label={`Show details for ${item.title}`} onClick={(event) => { event.stopPropagation(); onInfo?.(item) }} /> : null}
            {item ? <SmallIconButton icon="share" label={`Share ${item.title}`} onClick={(event) => { event.stopPropagation(); onShare?.(item) }} /> : null}
            {isClique && item ? <SmallIconButton icon="copy" label={`Copy ${item.title} to My Library`} onClick={(event) => { event.stopPropagation(); onCopy?.(item) }} disabled={saving} /> : null}
          </div>
        </div>

        <div className="pointer-events-auto flex max-w-[94%] items-end gap-3 rounded-[1.35rem] border border-white/10 bg-black/62 p-3 shadow-2xl shadow-black/30 backdrop-blur-md sm:max-w-[88%] sm:p-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-300">{loading ? 'Loading…' : 'Top pick'}</p>
            <h3 className="mt-1 line-clamp-2 text-xl font-black leading-tight text-white sm:text-2xl">{title}</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {chips.length ? chips.map((chip) => <span key={chip} className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-[10px] font-bold text-neutral-200">{chip}</span>) : <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-[10px] font-bold text-neutral-300">{item ? `${item.picks || 0} picks` : 'Empty'}</span>}
            </div>
          </div>
          {canCycle ? <SmallIconButton icon="chevronRight" label={`Next ${category.singular}`} onClick={(event) => { event.stopPropagation(); onCycle?.(category, 1) }} strong className="mb-0.5 shrink-0" /> : null}
        </div>
      </div>
    </article>
  )
}

function LibraryListPanel({ category, categories = [], loading, isClique, votingKey, copyingKey, viewMode = 'grid', onViewModeChange, onSelectCategory, onClose, onVote, onInfo, onShare, onCopy }) {
  if (!category) return null
  const items = category.items || []
  const isGrid = viewMode === 'grid'
  return (
    <section className="mt-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 sm:p-5" id="library-inline-list">
      <div className="border-b border-white/10 pb-4 sm:pb-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 sm:text-xs sm:tracking-[0.24em]"><AppIcon name={category.icon} size={14} />Library</p>
            <h2 className="mt-1 text-2xl font-black text-white sm:text-3xl">{category.title}</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-neutral-400 sm:mt-2 sm:text-sm sm:leading-6">{loading ? 'Loading…' : plural(items.length, 'item')} in this section.</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => onViewModeChange?.(isGrid ? 'list' : 'grid')} className="inline-flex items-center gap-1.5 rounded-2xl border border-white/10 px-3 py-2 text-xs font-black text-neutral-300 transition hover:bg-white hover:text-neutral-950"><AppIcon name={isGrid ? 'list' : 'dashboard'} size={13} />{isGrid ? 'List' : 'Grid'}</button>
            <button type="button" onClick={onClose} className="rounded-2xl border border-white/10 px-3 py-2 text-xs font-black text-neutral-300 transition hover:bg-white hover:text-neutral-950 sm:px-4 sm:text-sm">Hide</button>
          </div>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {categories.map((entry) => {
            const active = entry.title === category.title
            return <button key={entry.title} type="button" onClick={() => onSelectCategory?.(entry)} className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-black transition ${active ? 'border-white bg-white text-neutral-950' : 'border-white/10 bg-white/[0.03] text-neutral-300 hover:bg-white hover:text-neutral-950'}`}><AppIcon name={entry.icon} size={13} />{entry.title}</button>
          })}
        </div>
      </div>
      {loading ? <p className="mt-5 rounded-3xl border border-white/10 p-5 text-sm text-neutral-400">Loading list…</p> : items.length ? (
        <div className={isGrid ? 'mt-5 grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-3' : 'mt-5 space-y-2 sm:space-y-3'}>
          {items.map((item, index) => {
            const image = imageFor(item)
            const voteBusy = votingKey === itemActionKey(item, 'vote-')
            const copyBusy = copyingKey === itemActionKey(item, 'copy-')
            const chips = itemMetaChips(item)

            if (!isGrid) {
              return (
                <article key={`${item.type}-${item.id}`} className="flex gap-3 overflow-hidden rounded-[1.35rem] border border-white/10 bg-neutral-950/80 p-2">
                  <button type="button" onClick={() => onInfo?.(item)} className="relative h-24 w-20 shrink-0 overflow-hidden rounded-[1rem] bg-white/[0.04] text-left" aria-label={`Show details for ${item.title}`}>
                    {image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.14),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,0,0,0.45))]" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-black text-white">#{index + 1}</span>
                  </button>
                  <div className="min-w-0 flex-1 py-1 pr-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">{item.type}</p>
                    <h3 className="mt-0.5 line-clamp-2 text-base font-black leading-tight text-white">{item.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {chips.length ? chips.map((chip) => <span key={chip} className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-bold text-neutral-300">{chip}</span>) : null}
                      <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-bold text-neutral-300">{item.picks || 0} picks</span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <SmallIconButton icon="info" label={`Show details for ${item.title}`} onClick={() => onInfo?.(item)} />
                      <SmallIconButton icon="share" label={`Share ${item.title}`} onClick={() => onShare?.(item)} />
                      {isClique ? <SmallIconButton icon="copy" label={`Copy ${item.title} to My Library`} onClick={() => onCopy?.(item)} disabled={copyBusy} /> : null}
                      {isClique ? <button type="button" disabled={voteBusy} onClick={() => onVote?.(item, 'like')} className="rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-60">{voteBusy ? 'Saving…' : 'Watch'}</button> : null}
                    </div>
                  </div>
                </article>
              )
            }

            return (
              <article key={`${item.type}-${item.id}`} className="overflow-hidden rounded-[1.25rem] border border-white/10 bg-neutral-950/80 sm:rounded-[1.5rem]">
                <div className="group relative h-32 overflow-hidden sm:h-44">
                  <button type="button" onClick={() => onInfo?.(item)} className="absolute inset-0 z-10 text-left" aria-label={`Show details for ${item.title}`} />
                  {image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-75 transition duration-500 group-hover:scale-105" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.14),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,0,0,0.45))]" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />
                  <span className="absolute left-2 top-2 rounded-full border border-white/15 bg-black/55 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-white backdrop-blur sm:left-3 sm:top-3 sm:px-3 sm:py-1 sm:text-xs sm:tracking-[0.18em]">#{index + 1}</span>
                  <div className="absolute right-2 top-2 z-20 hidden gap-2 sm:right-3 sm:top-3 sm:flex"><SmallIconButton icon="info" label={`Show details for ${item.title}`} onClick={() => onInfo?.(item)} /><SmallIconButton icon="share" label={`Share ${item.title}`} onClick={() => onShare?.(item)} />{isClique ? <SmallIconButton icon="copy" label={`Copy ${item.title} to My Library`} onClick={() => onCopy?.(item)} disabled={copyBusy} /> : null}</div>
                  <div className="absolute inset-x-0 bottom-0 p-2 sm:p-4"><p className="text-[9px] uppercase tracking-[0.18em] text-neutral-300 sm:text-xs sm:tracking-[0.22em]">{item.type}</p><h3 className="mt-0.5 line-clamp-2 text-sm font-black leading-tight text-white sm:mt-1 sm:text-2xl">{item.title}</h3></div>
                </div>
                <div className="p-2 sm:p-4">
                  <div className="flex flex-wrap gap-1 text-[10px] font-semibold text-neutral-300 sm:gap-2 sm:text-xs">
                    {chips.length ? chips.slice(0, 2).map((chip) => <span key={chip} className="rounded-full border border-white/10 px-2 py-1 sm:px-3 sm:py-1.5">{chip}</span>) : null}
                    <span className="rounded-full border border-white/10 px-2 py-1 sm:px-3 sm:py-1.5">{item.picks || 0} picks</span>
                    {item.rating ? <span className="hidden rounded-full border border-white/10 px-3 py-1.5 sm:inline-flex">★ {Number(item.rating).toFixed(1)}</span> : null}
                  </div>
                  <div className="mt-2 flex gap-2 sm:hidden"><SmallIconButton icon="info" label={`Show details for ${item.title}`} onClick={() => onInfo?.(item)} /><SmallIconButton icon="share" label={`Share ${item.title}`} onClick={() => onShare?.(item)} />{isClique ? <SmallIconButton icon="copy" label={`Copy ${item.title} to My Library`} onClick={() => onCopy?.(item)} disabled={copyBusy} /> : null}</div>
                  {isClique ? <div className="mt-3 flex flex-wrap gap-2 sm:mt-4"><button type="button" disabled={voteBusy} onClick={() => onVote?.(item, 'like')} className="rounded-2xl bg-white px-3 py-2 text-xs font-black text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-60 sm:text-sm">{voteBusy ? 'Saving…' : 'Watch'}</button><button type="button" disabled={voteBusy} onClick={() => onVote?.(item, 'dislike')} className="rounded-2xl border border-white/10 px-3 py-2 text-xs font-black text-white transition hover:bg-white hover:text-neutral-950 disabled:opacity-60 sm:text-sm">Pass</button></div> : null}
                </div>
              </article>
            )
          })}
        </div>
      ) : <p className="mt-5 rounded-3xl border border-dashed border-white/10 p-5 text-sm leading-6 text-neutral-400">No {category.title.toLowerCase()} saved here yet.</p>}
    </section>
  )
}

function ItemInfoModal({ item, onClose }) {
  if (!item) return null
  const image = imageFor(item)
  const icon = TYPE_ICONS[item.type] || 'explore'
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-white/10 bg-neutral-950 p-5 text-white shadow-2xl shadow-black/40"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-neutral-500"><AppIcon name={icon} size={14} />{item.type}</p><h2 className="mt-2 text-2xl font-black leading-tight">{item.title}</h2></div><button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-2xl text-neutral-400 transition hover:bg-white hover:text-neutral-950">×</button></div>{image ? <img src={image} alt="" className="mt-5 h-56 w-full rounded-3xl object-cover" /> : null}<div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-neutral-300"><span className="rounded-full border border-white/10 px-3 py-1.5">Score {item.score || 0}</span><span className="rounded-full border border-white/10 px-3 py-1.5">{item.picks || 0} picks</span>{item.rating ? <span className="rounded-full border border-white/10 px-3 py-1.5">★ {Number(item.rating).toFixed(1)}</span> : null}{item.runtime ? <span className="rounded-full border border-white/10 px-3 py-1.5">{item.runtime} min</span> : null}{item.seasons ? <span className="rounded-full border border-white/10 px-3 py-1.5">{item.seasons} seasons</span> : null}</div><p className="mt-5 text-sm leading-7 text-neutral-300">{itemText(item)}</p></div></div>
}

export default function Home() {
  const { groupId: routeGroupId } = useParams()
  const topScrollerRef = useRef(null)
  const [loading, setLoading] = useState(hasSupabase)
  const [status, setStatus] = useState(hasSupabase ? 'checking' : 'local')
  const [context, setContext] = useState(() => ({ type: getActiveGroup() ? 'group' : 'personal', name: getActiveGroup()?.name || 'My Library', groupId: getActiveGroup()?.id || null }))
  const [media, setMedia] = useState({ movies: [], series: [], games: [] })
  const [message, setMessage] = useState('')
  const [shareNotice, setShareNotice] = useState('')
  const [sharingItem, setSharingItem] = useState(null)
  const [infoItem, setInfoItem] = useState(null)
  const [activePileTitle, setActivePileTitle] = useState('Movies')
  const [copyingKey, setCopyingKey] = useState('')
  const [votingKey, setVotingKey] = useState('')
  const [spotlightIndexes, setSpotlightIndexes] = useState({})
  const [listViewMode, setListViewMode] = useState('grid')
  const [activeTopTitle, setActiveTopTitle] = useState('Movies')

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
  const allItems = useMemo(() => [...movieItems, ...seriesItems, ...gameItems].sort((a, b) => b.sortValue - a.sortValue), [movieItems, seriesItems, gameItems])
  const categories = useMemo(() => [
    { title: 'Movies', singular: 'Movie', code: 'MOV', icon: TYPE_ICONS.Movie, groupId: context.groupId, items: movieItems, top: movieItems[0], count: movieItems.length, rated: movieItems.filter((item) => item.rating).length },
    { title: 'Series', singular: 'Series', code: 'SER', icon: TYPE_ICONS.Series, groupId: context.groupId, items: seriesItems, top: seriesItems[0], count: seriesItems.length, rated: seriesItems.filter((item) => item.rating).length },
    { title: 'Games', singular: 'Game', code: 'GAM', icon: TYPE_ICONS.Game, groupId: context.groupId, items: gameItems, top: gameItems[0], count: gameItems.length, rated: gameItems.filter((item) => item.rating).length },
  ], [context.groupId, movieItems, seriesItems, gameItems])
  const activePile = useMemo(() => categories.find((category) => category.title === activePileTitle) || categories[0] || null, [categories, activePileTitle])
  const ratedCount = useMemo(() => allItems.filter((item) => item.rating).length, [allItems])
  const totalPicks = useMemo(() => allItems.reduce((sum, item) => sum + Number(item.picks || 0), 0), [allItems])
  const isClique = Boolean(context.groupId)

  useEffect(() => {
    if (!categories.some((category) => category.title === activeTopTitle)) setActiveTopTitle(categories[0]?.title || '')
    if (!categories.some((category) => category.title === activePileTitle)) setActivePileTitle(categories[0]?.title || '')
  }, [activeTopTitle, activePileTitle, categories])

  async function refreshDashboard(preferredGroupId = null) {
    setLoading(true)
    setMessage('')
    if (!hasSupabase) {
      const group = preferredGroupId ? setActiveGroup(preferredGroupId) : getActiveGroup()
      setContext({ type: group ? 'group' : 'personal', name: group?.name || 'My Library', groupId: group?.id || null })
      setMedia({ movies: [], series: [], games: [] })
      setStatus('local')
      setLoading(false)
      return
    }
    try {
      const session = await getCurrentSession()
      if (!session?.user) {
        setStatus('signed-out')
        setContext({ type: 'personal', name: 'My Library', groupId: null })
        setMedia({ movies: [], series: [], games: [] })
        setLoading(false)
        return
      }
      const remoteGroups = await getRemoteGroups().catch(() => [])
      const activeId = preferredGroupId || getActiveGroupId()
      const group = remoteGroups.find((item) => item.id === activeId) || null
      const localGroup = getActiveGroup()
      const groupId = activeId || null
      if (groupId) setActiveGroup(groupId)
      setContext({ type: groupId ? 'group' : 'personal', name: group?.name || (groupId && localGroup?.id === groupId ? localGroup.name : null) || (groupId ? 'Clique' : 'My Library'), groupId })
      const [movies, seriesRows, games] = await Promise.all([getMovies(groupId), getSeries(groupId), getGames(groupId)])
      setMedia({ movies, series: seriesRows, games })
      setStatus('ready')
    } catch (error) {
      setStatus('error')
      setMessage(error.message || 'Could not load this workspace.')
      setMedia({ movies: [], series: [], games: [] })
    } finally {
      setLoading(false)
    }
  }

  function openShare(item) { setSharingItem(item) }
  function handleShareMessage(text) { setShareNotice(text); setTimeout(() => setShareNotice(''), 2600) }
  function openPile(category) { setActivePileTitle(category.title); window.setTimeout(() => document.getElementById('library-inline-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50) }
  function selectPile(category) { setActivePileTitle(category.title); setActiveTopTitle(category.title); window.setTimeout(() => document.getElementById('library-inline-list')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50) }
  function jumpToSpotlight(category) { setActiveTopTitle(category.title); setActivePileTitle(category.title); document.getElementById(categoryTargetId(category))?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' }) }
  function handleTopScroll(event) {
    const container = event.currentTarget
    const cards = Array.from(container.querySelectorAll('[data-top-category]'))
    if (!cards.length) return
    const current = cards.reduce((best, card) => {
      const distance = Math.abs(card.offsetLeft - container.scrollLeft)
      return !best || distance < best.distance ? { distance, title: card.dataset.topCategory } : best
    }, null)
    if (current?.title && current.title !== activeTopTitle) {
      setActiveTopTitle(current.title)
      setActivePileTitle(current.title)
    }
  }
  function cycleSpotlight(category, direction) { if (!category?.items?.length) return; setSpotlightIndexes((current) => { const previous = current[category.title] || 0; const next = (previous + direction + category.items.length) % category.items.length; return { ...current, [category.title]: next } }) }
  async function copyToLibrary(item) { if (!item || !hasSupabase || status !== 'ready') return handleShareMessage('Sign in from Profile before copying to My Library.'); const key = itemActionKey(item, 'copy-'); setCopyingKey(key); try { const nominatedBy = getSavedHandle() || 'anonymous'; if (item.type === 'Movie') await saveMovie(item, nominatedBy, null); else if (item.type === 'Series') await saveSeries(item, nominatedBy, null); else if (item.type === 'Game') await saveGame(item, nominatedBy, null); else throw new Error('Unsupported item type.'); handleShareMessage(`Copied "${item.title}" to My Library.`) } catch (error) { handleShareMessage(error.message || 'Could not copy this item to My Library.') } finally { setCopyingKey('') } }
  async function voteInClique(item, vote) { if (!item || !context.groupId || !hasSupabase || status !== 'ready') return handleShareMessage('Open a clique first to vote.'); const key = itemActionKey(item, 'vote-'); setVotingKey(key); try { if (item.type === 'Movie') await voteMovie(item, vote, context.groupId); else if (item.type === 'Series') await voteSeries(item, vote, context.groupId); else if (item.type === 'Game') await voteGame(item, vote, context.groupId); else throw new Error('Unsupported item type.'); handleShareMessage(vote === 'like' ? `Voted to watch "${item.title}".` : `Passed on "${item.title}".`); await refreshDashboard(context.groupId) } catch (error) { handleShareMessage(error.message || 'Could not save your vote.') } finally { setVotingKey('') } }

  return (
    <PageShell active={isClique ? 'cliques' : 'library'}>
      <section className="overflow-hidden rounded-[1.55rem] border border-white/10 bg-white/[0.03] shadow-2xl shadow-black/20 sm:rounded-[2rem]">
        <div className="grid gap-0 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="p-3 sm:p-6">
            <h1 className="max-w-3xl text-2xl font-black tracking-tight text-white sm:text-5xl">{context.name}</h1>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-neutral-400 sm:mt-2 sm:text-base sm:leading-6">{isClique ? 'Shared movie, series, and game picks for this clique.' : 'Your saved movies, series, and games.'}</p>
            {status === 'signed-out' ? <p className="mt-3 inline-flex rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-neutral-300">Sign in from Profile to save picks and sync your library.</p> : null}
            <LibraryOverviewPanel items={loading ? [] : allItems} loading={loading} ratedCount={ratedCount} totalPicks={totalPicks} />
          </div>
          <div className="hidden xl:block">
            <LibraryShowcase items={loading ? [] : allItems} loading={loading} onShare={openShare} onInfo={setInfoItem} />
          </div>
        </div>
      </section>

      {shareNotice ? <div className="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-950/30 p-4 text-sm text-emerald-100">{shareNotice}</div> : null}
      {message ? <div className="mt-5 rounded-2xl border border-rose-400/30 bg-rose-950/30 p-4 text-sm text-rose-100">{message}</div> : null}

      <section className="mt-4 rounded-[1.55rem] border border-white/10 bg-white/[0.03] p-4 sm:mt-5 sm:rounded-[2rem] sm:p-5">
        <div className="flex items-center justify-between gap-3"><h2 className="text-2xl font-black text-white sm:text-3xl">Highlights</h2></div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
          {categories.map((category) => {
            const active = category.title === activeTopTitle
            return <button key={category.title} type="button" onClick={() => jumpToSpotlight(category)} className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-black transition ${active ? 'border-white bg-white text-neutral-950' : 'border-white/10 bg-white/[0.03] text-neutral-300 hover:bg-white hover:text-neutral-950'}`}><AppIcon name={category.icon} size={13} />{category.title}</button>
          })}
        </div>
        <div ref={topScrollerRef} onScroll={handleTopScroll} className="mt-4 grid auto-cols-[minmax(14.5rem,74%)] grid-flow-col gap-3 overflow-x-auto pb-2 snap-x snap-mandatory lg:mt-5 lg:auto-cols-auto lg:grid-flow-row lg:grid-cols-3 lg:gap-4 lg:overflow-visible lg:pb-0">
          {categories.map((category) => {
            const index = spotlightIndexes[category.title] || 0
            const item = category.items[index % Math.max(category.items.length, 1)] || category.top
            return <CategorySpotlightCard key={category.title} category={category} index={index} loading={loading} isClique={isClique} saving={copyingKey === itemActionKey(item, 'copy-')} onCycle={cycleSpotlight} onOpenPile={openPile} onInfo={setInfoItem} onShare={openShare} onCopy={copyToLibrary} />
          })}
        </div>
      </section>

      <LibraryListPanel category={activePile} categories={categories} loading={loading} isClique={isClique} votingKey={votingKey} copyingKey={copyingKey} viewMode={listViewMode} onViewModeChange={setListViewMode} onSelectCategory={selectPile} onClose={() => setActivePileTitle('')} onVote={voteInClique} onInfo={setInfoItem} onShare={openShare} onCopy={copyToLibrary} />
      <ItemInfoModal item={infoItem} onClose={() => setInfoItem(null)} />
      {sharingItem ? <MemberShareModal item={sharingItem} type={sharingItem?.type?.toLowerCase()} onClose={() => setSharingItem(null)} onMessage={handleShareMessage} /> : null}
    </PageShell>
  )
}
