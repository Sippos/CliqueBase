import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AppIcon from '../components/AppIcon.jsx'
import PageShell from '../components/PageShell.jsx'
import { getGroupOpenPath } from '../lib/groups.js'
import { getGameDetails, getMovieDetails, getSeriesDetails } from '../lib/tmdb.js'
import { getCommunityLeaderboard, hasSupabase, saveGame, saveMovie, saveSeries } from '../lib/supabaseClient.js'

const featuredCategories = ['Movies', 'Series', 'Games']
const categoryMeta = {
  Movies: { icon: 'movies', label: 'Movie', plural: 'Movies' },
  Series: { icon: 'series', label: 'Series', plural: 'Series' },
  Games: { icon: 'games', label: 'Game', plural: 'Games' },
}

function getCategoryMeta(category = 'Pick') {
  return categoryMeta[category] || { icon: 'explore', label: category || 'Pick', plural: category || 'Picks' }
}
function itemKey(item, prefix = '') { return item ? `${prefix}${item.groupId || item.groupName || 'global'}-${item.category}-${item.id}` : prefix || 'item' }
function getNominator(item) { return item?.nominatedBy || item?.nominated_by || '' }
function itemSummary(item) { return item?.overview || item?.description || `${getCategoryMeta(item?.category).label} from ${item?.groupName || 'a public clique'}.` }
function sortByRank(items = []) {
  return items.slice().sort((a, b) => (
    Number(a.categoryRank || a.rank || 9999) - Number(b.categoryRank || b.rank || 9999)
    || Number(b.score || 0) - Number(a.score || 0)
    || Number(b.picks || 0) - Number(a.picks || 0)
    || String(a.title || '').localeCompare(String(b.title || ''))
  ))
}
function copyPayload(item) { return { ...item, id: String(item.id), nominated_by: getNominator(item) || 'public clique' } }
function formatMonthYear(value) { if (!value) return null; try { return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short' }).format(new Date(value)) } catch { return value } }
function releaseYear(item) {
  if (item?.year) return String(item.year)
  if (!item?.released) return null
  const parsed = new Date(item.released)
  return Number.isNaN(parsed.getTime()) ? null : String(parsed.getFullYear())
}
function genreText(item, limit = 2) {
  const raw = Array.isArray(item?.genres) ? item.genres : typeof item?.genres === 'string' ? item.genres.split(',') : []
  return raw.map((genre) => String(genre || '').trim()).filter(Boolean).slice(0, limit).join(', ')
}
function itemMetaLine(item) { return [genreText(item), releaseYear(item)].filter(Boolean).join(' · ') }
function detailValue(value) { if (Array.isArray(value)) return value.filter(Boolean).join(', '); if (value === null || value === undefined || value === '') return null; return String(value) }
function hasMetadata(item) { return Boolean(item?.year || item?.released || item?.genres?.length || item?.runtime || item?.seasons || item?.episodes || item?.platform || item?.platforms?.length || item?.overview || item?.description || item?.tmdbRating || item?.rawgRating) }
function mergePublicItem(base, details) {
  if (!details) return base
  return { ...base, ...details, id: base.id, category: base.category, groupId: base.groupId, groupName: base.groupName, nominatedBy: getNominator(base), score: base.score, picks: base.picks, rating: base.rating, completed: base.completed }
}

function CategoryBadge({ category }) {
  const meta = getCategoryMeta(category)
  return <span className="hidden items-center gap-1.5 rounded-full border border-white/15 bg-black/65 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white shadow-lg shadow-black/30 backdrop-blur sm:inline-flex"><AppIcon name={meta.icon} size={14} strokeWidth={2.2} className="shrink-0" />{meta.label}</span>
}
function MetricPill({ children, active = false, compact = false }) { return <span className={`rounded-full border font-semibold ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'} ${active ? 'border-white bg-white text-neutral-950 shadow-lg shadow-white/10' : 'border-white/10 bg-white/[0.05] text-neutral-200'}`}>{children}</span> }
function IconButton({ icon, label, onClick, disabled = false, strong = false, className = '' }) {
  return <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition disabled:pointer-events-none disabled:opacity-40 ${strong ? 'border-white bg-white text-neutral-950 shadow-lg shadow-black/20 hover:bg-neutral-200' : 'border-white/15 bg-black/60 text-white backdrop-blur hover:bg-white hover:text-neutral-950'} ${className}`}><AppIcon name={icon} size={15} strokeWidth={2.4} /></button>
}
function MediaArt({ item, className = '', iconSize = 38 }) {
  const meta = getCategoryMeta(item?.category)
  const image = item?.backdrop || item?.poster
  if (image) return <img src={image} alt="" draggable="false" className={`h-full w-full object-cover ${className}`} />
  return <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-950 text-neutral-400 ${className}`}><AppIcon name={meta.icon} size={iconSize} strokeWidth={1.7} /></div>
}
function EmptyState() {
  return <section className="rounded-[2rem] border border-dashed border-white/15 bg-white/[0.02] p-6 text-neutral-400"><h2 className="text-2xl font-black text-white">No public rankings yet</h2><p className="mt-2 max-w-2xl text-sm leading-6">The Explore dashboard will fill with the best rated public clique picks once movies, series, or games get votes.</p><Link to="/groups" className="mt-5 inline-flex rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-neutral-200">Manage cliques</Link></section>
}

function FeaturedPickCard({ item, onInfo, onToggleFlip, rankLabel = 'global pick', flipped = false, onCopy, onShare, saving = false }) {
  if (!item) return null
  const meta = getCategoryMeta(item.category)
  const displayRank = item.categoryRank || item.rank || '—'
  const groupPath = item.groupId ? getGroupOpenPath({ id: item.groupId }) : null
  const summary = itemSummary(item)
  return (
    <article className="group relative z-10 outline-none">
      <div role="button" tabIndex={0} onClick={onToggleFlip} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onToggleFlip?.() }} className="relative min-h-[17.1rem] overflow-hidden rounded-[1.45rem] border border-white/10 bg-neutral-950 shadow-2xl shadow-black/20 transition group-hover:-translate-y-0.5 group-hover:border-white/20 sm:min-h-[20rem] sm:rounded-[2rem]">
        <MediaArt item={item} className={`absolute inset-0 opacity-82 transition duration-500 group-hover:scale-105 ${flipped ? 'scale-105 opacity-24 sm:opacity-82' : ''}`} />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/5" />
        <div className="absolute left-4 top-4"><CategoryBadge category={item.category} /></div>
        <IconButton icon="info" label={`Show details for ${item.title}`} onClick={(event) => { event.stopPropagation(); onInfo(item) }} className="absolute right-4 top-4 hidden sm:inline-flex" />
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-neutral-300 sm:text-xs">#{displayRank} {rankLabel}</p>
          <h3 className="mt-1.5 line-clamp-2 text-2xl font-black leading-tight text-white drop-shadow-lg sm:mt-2">{item.title}</h3>
          {itemMetaLine(item) ? <p className="mt-1 block truncate text-xs font-semibold text-neutral-300 sm:hidden">{itemMetaLine(item)}</p> : null}
          <p className="mt-2 hidden text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400 sm:block">Tap the info button for details</p>
        </div>
        {flipped ? (
          <div className="absolute inset-0 z-30 flex flex-col justify-end bg-black/74 p-3 backdrop-blur-sm sm:hidden">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">{meta.label} actions</p>
            <h3 className="mt-1 line-clamp-1 text-lg font-black leading-tight text-white">{item.title}</h3>
            <p className="mt-1 line-clamp-3 text-[11px] leading-4 text-neutral-300">{summary}</p>
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              <button type="button" onClick={(event) => { event.stopPropagation(); onInfo(item) }} className="inline-flex flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.06] px-1.5 py-2 text-[10px] font-black text-white"><AppIcon name="info" size={15} />Details</button>
              <button type="button" onClick={(event) => { event.stopPropagation(); onCopy(item) }} disabled={saving} className="inline-flex flex-col items-center justify-center gap-1 rounded-xl bg-white px-1.5 py-2 text-[10px] font-black text-neutral-950 disabled:opacity-60"><AppIcon name="copy" size={15} />{saving ? '...' : 'Copy'}</button>
              <button type="button" onClick={(event) => { event.stopPropagation(); onShare(item) }} className="inline-flex flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.06] px-1.5 py-2 text-[10px] font-black text-white"><AppIcon name="share" size={15} />Share</button>
            </div>
            {groupPath ? <Link to={groupPath} onClick={(event) => event.stopPropagation()} className="mt-1.5 inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-[10px] font-black text-white"><AppIcon name="users" size={13} />Open clique</Link> : null}
            <p className="mt-2 text-center text-[9px] font-bold uppercase tracking-[0.18em] text-neutral-500">Tap card to flip back</p>
          </div>
        ) : null}
      </div>
    </article>
  )
}
function PilePeekCard({ item, offset = 1, onClick }) {
  if (!item) return null
  const rank = item.categoryRank || item.rank || '—'
  return <button type="button" onClick={onClick} aria-label={`Preview ${item.title}`} className="pointer-events-auto absolute left-1.5 right-0 h-[17.1rem] overflow-hidden rounded-[1.45rem] border border-white/10 bg-neutral-950 shadow-2xl shadow-black/30 transition hover:-translate-y-0.5 hover:border-white/20 sm:left-3 sm:h-[20rem] sm:rounded-[2rem]" style={{ top: `${(2 - offset) * 0.35}rem`, transform: `translateY(-${offset * 0.52}rem) translateX(${offset * 0.55}rem) scale(${1 - offset * 0.02})`, zIndex: 4 - offset }}><MediaArt item={item} className="absolute inset-0 opacity-38 sm:opacity-50" /><div className="absolute inset-0 bg-black/42" /><div className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/60 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white backdrop-blur sm:left-4 sm:top-4">Next #{rank}</div><div className="absolute bottom-3 left-3 right-3 text-left sm:bottom-4 sm:left-4 sm:right-4"><p className="truncate text-sm font-black text-white">{item.title}</p></div></button>
}
function ProgressDots({ count, active, onSelect }) {
  if (count < 2) return null
  return <div className="hidden items-center gap-1.5 sm:flex" aria-label="Pick position">{Array.from({ length: Math.min(count, 8) }).map((_, index) => <button key={index} type="button" onClick={() => onSelect(index)} aria-label={`Show pick ${index + 1}`} className={`h-1.5 rounded-full transition ${index === active ? 'w-6 bg-white' : 'w-1.5 bg-white/25 hover:bg-white/60'}`} />)}{count > 8 ? <span className="text-[10px] font-black text-neutral-600">+{count - 8}</span> : null}</div>
}

function FeaturedPickPile({ category, items, onInfo, onOpenLadder, onCopy, onShare, saving }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const swipeStart = useRef(null)
  useEffect(() => { setActiveIndex(0); setFlipped(false) }, [category, items.length])
  if (!items.length) return null
  const meta = getCategoryMeta(category)
  const safeIndex = ((activeIndex % items.length) + items.length) % items.length
  const activeItem = items[safeIndex]
  const nextItem = items[(safeIndex + 1) % items.length]
  const thirdItem = items[(safeIndex + 2) % items.length]
  const canStep = items.length > 1
  const displayRank = activeItem.categoryRank || activeItem.rank || safeIndex + 1
  function goTo(index) { if (canStep) { setActiveIndex(((index % items.length) + items.length) % items.length); setFlipped(false) } }
  function stepCard(delta) { if (canStep) goTo(activeIndex + delta) }
  function handleTouchStart(event) {
    const touch = event.touches?.[0]
    if (touch) swipeStart.current = { x: touch.clientX, y: touch.clientY }
  }
  function handleTouchEnd(event) {
    const start = swipeStart.current
    const touch = event.changedTouches?.[0]
    swipeStart.current = null
    if (!start || !touch || flipped) return
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    if (Math.abs(dx) > 36 && Math.abs(dx) > Math.abs(dy) * 1.25) stepCard(dx < 0 ? 1 : -1)
  }
  return (
    <section className="sm:contents">
      <div className="mb-2 flex items-center justify-between px-1 sm:hidden">
        <h2 className="inline-flex items-center gap-2 text-xl font-black text-white"><AppIcon name={meta.icon} size={18} />{meta.plural}</h2>
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">Swipe</span>
      </div>
      <div className="relative pt-3 pr-1.5 sm:pt-8 sm:pr-5" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {items.length > 2 ? <PilePeekCard item={thirdItem} offset={2} onClick={() => stepCard(2)} /> : null}
        {items.length > 1 ? <PilePeekCard item={nextItem} offset={1} onClick={() => stepCard(1)} /> : null}
        <FeaturedPickCard key={itemKey(activeItem, 'featured-')} item={activeItem} onInfo={onInfo} onToggleFlip={() => setFlipped((value) => !value)} flipped={flipped} onCopy={onCopy} onShare={onShare} saving={saving} rankLabel={`${meta.label.toLowerCase()} pick`} />
        <div className={`relative z-20 -mt-2 rounded-[1.05rem] border border-white/10 bg-black/52 p-2 shadow-xl shadow-black/25 backdrop-blur transition sm:-mt-3 sm:rounded-[1.2rem] sm:p-2.5 ${flipped ? 'hidden sm:block' : ''}`}>
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => onInfo(activeItem)} className="min-w-0 flex-1 text-left">
              <h3 className="hidden truncate text-base font-black leading-tight text-white sm:block">{activeItem.title}</h3>
              <p className="truncate text-[12px] font-black text-white sm:mt-0.5 sm:text-[11px] sm:font-normal sm:text-neutral-500"><span className="sm:hidden">#{displayRank} in {activeItem.groupName || 'Public clique'}{getNominator(activeItem) ? ` · ${getNominator(activeItem)}` : ''}</span><span className="hidden sm:inline">#{displayRank} of {items.length} · {activeItem.groupName || 'Public clique'}{getNominator(activeItem) ? ` · ${getNominator(activeItem)}` : ''}</span></p>
            </button>
            <button type="button" onClick={() => onOpenLadder(category)} aria-label={`Open ${meta.plural} ladder`} title="Open ladder" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white text-neutral-950 transition hover:bg-neutral-200"><AppIcon name="list" size={13} strokeWidth={2.4} /></button>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap gap-1.5"><span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-bold text-neutral-200">Score {activeItem.score || 0}</span><span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-bold text-neutral-200">{activeItem.picks || 0} picks</span>{activeItem.rating ? <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-bold text-neutral-200">Rating {Number(activeItem.rating).toFixed(1)}</span> : null}</div>
            <div className="flex shrink-0 items-center gap-1"><button type="button" onClick={() => stepCard(-1)} disabled={!canStep} aria-label={`Show previous ${meta.label.toLowerCase()} pick`} className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-sm font-black leading-none text-white transition hover:bg-white hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-white/[0.04] disabled:hover:text-white">‹</button><button type="button" onClick={() => stepCard(1)} disabled={!canStep} aria-label={`Show next ${meta.label.toLowerCase()} pick`} className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-sm font-black leading-none text-white transition hover:bg-white hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-white/[0.04] disabled:hover:text-white">›</button></div>
          </div>
          <div className="mt-2"><ProgressDots count={items.length} active={safeIndex} onSelect={goTo} /></div>
        </div>
      </div>
    </section>
  )
}

function CategoryLadderModal({ category, items = [], title, subtitle, saving, onInfo, onCopy, onClose }) {
  if (!category) return null
  const meta = getCategoryMeta(category)
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><article className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-neutral-950/95 shadow-2xl shadow-black/50"><div className="flex items-start justify-between gap-4 border-b border-white/10 p-5"><div><p className="text-xs font-black uppercase tracking-[0.26em] text-neutral-500">Public ladder</p><h2 className="mt-1 text-3xl font-black text-white">{title || `Top ${meta.plural}`}</h2><p className="mt-2 text-sm text-neutral-400">{subtitle || 'Browse the full ranked category without replacing the main Explore overview.'}</p></div><button type="button" onClick={onClose} className="text-2xl text-neutral-400 transition hover:text-white">×</button></div><div className="overflow-y-auto p-4"><div className="space-y-3">{items.map((item) => { const groupPath = item.groupId ? getGroupOpenPath({ id: item.groupId }) : null; return <article key={itemKey(item, 'ladder-')} className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-3 transition hover:border-white/20 hover:bg-white/[0.05] sm:grid-cols-[auto_1fr_auto] sm:items-center"><div className="flex items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-neutral-950">#{item.categoryRank || item.rank || '—'}</div><div className="h-20 w-16 shrink-0 overflow-hidden rounded-2xl bg-neutral-900">{item.poster ? <img src={item.poster} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-neutral-400"><AppIcon name={meta.icon} size={24} /></div>}</div></div><div className="min-w-0"><h3 className="line-clamp-2 text-lg font-black leading-tight text-white">{item.title}</h3><p className="mt-1 truncate text-sm text-neutral-400">{item.groupName || 'Public clique'}{getNominator(item) ? ` · Added by ${getNominator(item)}` : ''}</p><div className="mt-2 flex flex-wrap gap-2"><MetricPill>Score {item.score || 0}</MetricPill><MetricPill>{item.picks || 0} picks</MetricPill>{item.rating ? <MetricPill>Rating {Number(item.rating).toFixed(1)}</MetricPill> : null}</div></div><div className="flex flex-wrap gap-2 sm:justify-end"><button type="button" onClick={() => onInfo(item)} className="inline-flex h-10 items-center gap-2 rounded-2xl border border-white/10 px-3 text-xs font-black text-white transition hover:bg-white hover:text-neutral-950"><AppIcon name="info" size={14} />Info</button><button type="button" onClick={() => onCopy(item)} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-2xl bg-white px-3 text-xs font-black text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-60"><AppIcon name="copy" size={14} />{saving ? '...' : 'Copy'}</button>{groupPath ? <Link to={groupPath} onClick={onClose} className="inline-flex h-10 items-center gap-2 rounded-2xl border border-white/10 px-3 text-xs font-black text-white transition hover:bg-white hover:text-neutral-950"><AppIcon name="explore" size={14} />Clique</Link> : null}</div></article> })}</div></div></article></div>
}

function GroupStat({ icon, children }) { return <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-neutral-300 sm:gap-1.5 sm:px-3 sm:py-1 sm:text-xs"><AppIcon name={icon} size={12} strokeWidth={2.2} className="text-neutral-400 sm:size-auto" />{children}</span> }
function GroupRubricTile({ summary, onOpenList }) {
  const meta = getCategoryMeta(summary.category)
  const topItem = summary.items[0]
  const ratingLabel = topItem?.rating ? ` · ${Number(topItem.rating).toFixed(1)}` : ''
  return <button type="button" onClick={() => onOpenList(summary)} className="group relative min-h-[8.1rem] overflow-hidden rounded-[1rem] border border-white/10 bg-neutral-950 text-left shadow-xl shadow-black/20 transition hover:-translate-y-0.5 hover:border-white/20 sm:min-h-[11rem] sm:rounded-2xl">{topItem?.poster ? <img src={topItem.poster} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-950 text-neutral-400"><AppIcon name={meta.icon} size={30} strokeWidth={1.7} /></div>}<div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/10" /><div className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/45 px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-white shadow-lg shadow-black/30 backdrop-blur-sm"><AppIcon name={meta.icon} size={11} strokeWidth={2.2} />{meta.plural}</div><span className="absolute right-2 top-2 inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-white px-2 text-[10px] font-black text-neutral-950 shadow-lg shadow-black/30">{summary.count}</span><div className="absolute inset-x-2 bottom-2 rounded-xl bg-black/46 p-2 shadow-lg shadow-black/30 backdrop-blur-sm"><p className="line-clamp-1 text-xs font-black leading-tight text-white">{topItem ? `#1 ${topItem.title}` : 'No picks yet'}</p><p className="mt-0.5 text-[9px] font-bold text-neutral-400">Score {summary.score || 0}{ratingLabel}</p></div></button>
}
function GroupSummaryCard({ group, onOpenRubric }) {
  const allItems = group.publicItems || group.topItems || []
  const rubrics = featuredCategories.map((category) => { const items = sortByRank(allItems.filter((item) => item.category === category)).map((item, index) => ({ ...item, categoryRank: index + 1, groupId: group.id, groupName: group.name })); return { category, items, count: items.length, score: items.reduce((sum, item) => sum + Number(item.score || 0), 0) } }).filter((summary) => summary.count > 0)
  const groupPath = getGroupOpenPath(group)
  return <article className="relative rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-3 shadow-2xl shadow-black/20 backdrop-blur transition hover:border-white/20 hover:bg-white/[0.05] sm:rounded-[2rem] sm:p-4"><Link to={groupPath} aria-label={`Open ${group.name}`} className="absolute inset-0 z-0 rounded-[inherit]" /><div className="relative z-10 flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500 sm:text-xs sm:tracking-[0.22em]">#{group.rank} public clique</p><Link to={groupPath} className="mt-0.5 block truncate text-xl font-black text-white transition hover:text-neutral-200 sm:mt-1 sm:text-2xl">{group.name}</Link></div><div className="rounded-2xl border border-white/10 bg-neutral-950/70 px-2.5 py-1.5 text-right sm:px-3 sm:py-2"><div className="text-base font-black text-white sm:text-lg">{Number(group.averageRating || 0).toFixed(1)}</div><div className="text-[9px] uppercase tracking-[0.18em] text-neutral-500 sm:text-[10px] sm:tracking-[0.2em]">Avg</div></div></div><div className="relative z-10 mt-2 flex flex-nowrap gap-1 overflow-hidden sm:mt-4 sm:flex-wrap sm:gap-2"><GroupStat icon="users">{group.memberCount || 0} members</GroupStat><GroupStat icon="explore">{group.itemCount || 0} items</GroupStat><GroupStat icon="dashboard">Score {group.totalScore || 0}</GroupStat></div><div className="relative z-10 mt-3 rounded-[1.1rem] border border-white/10 bg-neutral-950/45 p-2 sm:mt-4 sm:rounded-[1.5rem] sm:p-3"><div className="mb-2 flex items-center justify-between gap-3 sm:mb-3"><span className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-neutral-500 sm:text-[10px] sm:tracking-[0.22em]"><AppIcon name="explore" size={12} />Rubrics</span><span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] font-black text-neutral-500 sm:py-1 sm:text-[10px]">{rubrics.length} active</span></div>{rubrics.length ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{rubrics.map((summary) => <GroupRubricTile key={summary.category} summary={summary} onOpenList={(nextSummary) => onOpenRubric(group, nextSummary)} />)}</div> : <div className="rounded-2xl border border-dashed border-white/10 bg-neutral-950/50 p-4 text-sm text-neutral-500">No public rubrics in this clique yet.</div>}</div><Link to={groupPath} className="relative z-10 mt-3 hidden w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white transition hover:bg-white hover:text-neutral-950 sm:inline-flex"><AppIcon name="explore" size={16} />Open public clique</Link></article>
}

function DetailRow({ label, value }) { const normalized = detailValue(value); if (!normalized) return null; return <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.025] px-3 py-1.5"><dt className="text-[9px] font-bold uppercase tracking-[0.16em] text-neutral-500">{label}</dt><dd className="text-[13px] font-semibold leading-none text-white">{normalized}</dd></div> }
function GenreChips({ genres }) { const values = Array.isArray(genres) ? genres.filter(Boolean) : detailValue(genres)?.split(',').map((genre) => genre.trim()).filter(Boolean) || []; if (!values.length) return null; return <section className="mt-4"><h3 className="text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-500">Genres</h3><div className="mt-2 flex flex-wrap gap-2">{values.map((genre) => <span key={genre} className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-neutral-200">{genre}</span>)}</div></section> }
function SourceLine({ item }) { const groupName = item.groupName || 'Public clique'; const nominatedBy = getNominator(item) || 'Someone'; return <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-400"><span className="inline-flex items-center gap-1.5"><AppIcon name="users" size={14} strokeWidth={2.2} />{groupName}</span><span className="text-neutral-600">·</span><span className="inline-flex items-center gap-1.5"><AppIcon name="user" size={14} strokeWidth={2.2} />Suggested by <span className="font-semibold text-neutral-200">{nominatedBy}</span></span></p> }
function WatchedLabel({ category }) { if (category === 'Series') return 'Finished'; if (category === 'Games') return 'Played'; return 'Watched' }
function DetailModal({ item, saving, onCopy, onClose }) {
  const [copyHintOpen, setCopyHintOpen] = useState(false)
  const [details, setDetails] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState(null)
  useEffect(() => { setCopyHintOpen(false); setDetails(null); setDetailsError(null); if (!item) return undefined; let cancelled = false; async function loadDetails() { setDetailsLoading(true); try { let nextDetails = null; if (item.category === 'Movies') nextDetails = await getMovieDetails(item); else if (item.category === 'Series') nextDetails = await getSeriesDetails(item); else if (item.category === 'Games') nextDetails = await getGameDetails(item); if (!cancelled) setDetails(nextDetails) } catch (error) { if (!cancelled) setDetailsError(error.message || 'Could not load API details.') } finally { if (!cancelled) setDetailsLoading(false) } } loadDetails(); return () => { cancelled = true } }, [item])
  if (!item) return null
  const displayItem = mergePublicItem(item, details)
  const meta = getCategoryMeta(displayItem.category)
  const sourceRating = displayItem.tmdbRating ?? displayItem.rawgRating
  const creator = displayItem.director || displayItem.regie || displayItem.creator || displayItem.createdBy || displayItem.developer
  const releaseValue = formatMonthYear(displayItem.released) || displayItem.year
  const showEmptyMetadata = !detailsLoading && !hasMetadata(displayItem)
  const groupPath = displayItem.groupId ? getGroupOpenPath({ id: displayItem.groupId }) : null
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><article className="grid max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-neutral-950/95 shadow-2xl shadow-black/50 md:grid-cols-[0.82fr_1fr]"><div className="relative min-h-72 bg-neutral-900">{displayItem.poster ? <img src={displayItem.poster} alt="" className="h-full max-h-[90vh] w-full object-cover" /> : <div className="flex h-full min-h-72 items-center justify-center text-white"><AppIcon name={meta.icon} size={72} strokeWidth={1.5} /></div>}<div className="absolute left-4 top-4"><CategoryBadge category={displayItem.category} /></div></div><div className="flex max-h-[90vh] flex-col overflow-y-auto p-6"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><h2 className="text-3xl font-black leading-tight text-white">{displayItem.title}</h2><SourceLine item={displayItem} /></div><button type="button" onClick={onClose} className="text-2xl text-neutral-400 transition hover:text-white">×</button></div><dl className="mt-4 flex flex-wrap gap-2"><DetailRow label="Released" value={releaseValue} /><DetailRow label="Runtime" value={displayItem.runtime ? `${displayItem.runtime} min` : null} /><DetailRow label="Director / Regie" value={creator} /><DetailRow label="Seasons" value={displayItem.seasons} /><DetailRow label="Episodes" value={displayItem.episodes} /><DetailRow label="Platforms" value={displayItem.platforms || displayItem.platform} /></dl><GenreChips genres={displayItem.genres} />{detailsLoading ? <p className="mt-4 text-sm text-neutral-500">Loading API details…</p> : null}{detailsError && !hasMetadata(displayItem) ? <p className="mt-4 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-3 text-xs leading-5 text-yellow-100">{detailsError}</p> : null}{displayItem.overview || displayItem.description ? <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-4"><h3 className="text-xs uppercase tracking-[0.22em] text-neutral-500">Overview</h3><p className="mt-2 text-sm leading-6 text-neutral-300">{displayItem.overview || displayItem.description}</p></section> : null}<div className="mt-5 flex flex-wrap gap-2"><MetricPill>Score {displayItem.score || 0}</MetricPill><MetricPill>{displayItem.picks || 0} picks</MetricPill>{displayItem.rating ? <MetricPill>Your rating {Number(displayItem.rating).toFixed(1)}</MetricPill> : null}{sourceRating !== null && sourceRating !== undefined ? <MetricPill>{displayItem.category === 'Games' ? 'RAWG' : 'TMDB'} {Number(sourceRating).toFixed(1)}</MetricPill> : null}{displayItem.completed ? <MetricPill active><WatchedLabel category={displayItem.category} /></MetricPill> : null}</div>{showEmptyMetadata ? <p className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-neutral-400">No extra media metadata is available for this item yet.</p> : null}<div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center"><button type="button" onClick={() => onCopy(displayItem)} disabled={saving} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-60"><AppIcon name="copy" size={18} />{saving ? 'Copying...' : 'Copy to my library'}</button>{groupPath ? <Link to={groupPath} onClick={onClose} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white hover:text-neutral-950"><AppIcon name="explore" size={18} />Open clique</Link> : null}<button type="button" onClick={() => setCopyHintOpen((value) => !value)} aria-label="What does copy to my library do?" className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-neutral-200 transition hover:bg-white hover:text-neutral-950"><AppIcon name="info" size={20} strokeWidth={2.2} /></button></div>{copyHintOpen ? <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-neutral-400">Copies this public pick into your personal library so you can rate it, mark it watched/played, or add it to your own cliques later.</p> : null}</div></article></div>
}

function ExploreBoard() {
  const [board, setBoard] = useState({ groups: [], topContent: [], totals: {} })
  const [loading, setLoading] = useState(hasSupabase)
  const [message, setMessage] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [activeLadder, setActiveLadder] = useState(null)
  const [savingItem, setSavingItem] = useState(false)
  useEffect(() => { if (!hasSupabase) return undefined; let cancelled = false; async function loadBoard() { setLoading(true); try { const data = await getCommunityLeaderboard(); if (!cancelled) setBoard(data) } catch (error) { if (!cancelled) setMessage(error.message || 'Could not load Explore.') } finally { if (!cancelled) setLoading(false) } } loadBoard(); return () => { cancelled = true } }, [])
  function flash(text, duration = 2500) { setMessage(text); window.setTimeout(() => setMessage(null), duration) }
  async function copyToLibrary(item) { setSavingItem(true); try { const payload = copyPayload(item); if (item.category === 'Movies') await saveMovie(payload, payload.nominated_by); else if (item.category === 'Series') await saveSeries(payload, payload.nominated_by); else if (item.category === 'Games') await saveGame(payload, payload.nominated_by); else throw new Error('This content type cannot be copied yet.'); flash(`${item.title} copied to your library.`); setSelectedItem(null) } catch (error) { flash(error.message || 'Could not copy this pick.', 3500) } finally { setSavingItem(false) } }
  async function shareItem(item) {
    const groupUrl = item.groupId ? `${window.location.origin}${getGroupOpenPath({ id: item.groupId })}` : window.location.href
    const text = `${item.title} · ${item.groupName || 'Public clique'}`
    try {
      if (navigator.share) await navigator.share({ title: item.title, text, url: groupUrl })
      else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(`${text} ${groupUrl}`); flash('Share link copied.') }
      else flash('Sharing is not available in this browser.', 3000)
    } catch (error) {
      if (error?.name !== 'AbortError') flash('Could not share this pick.', 3000)
    }
  }
  const groups = board.groups || []
  const topContent = board.topContent || []
  const categoryPiles = useMemo(() => featuredCategories.map((category) => { const items = sortByRank(topContent.filter((item) => item.category === category)).map((item, index) => ({ ...item, categoryRank: index + 1 })); return { category, items } }).filter((pile) => pile.items.length), [topContent])
  function openCategoryLadder(category) { const pile = categoryPiles.find((entry) => entry.category === category); const meta = getCategoryMeta(category); if (!pile) return; setActiveLadder({ category, items: pile.items, title: `Top ${meta.plural}`, subtitle: `Full public ${meta.plural.toLowerCase()} ladder.` }) }
  function openGroupRubric(group, summary) { const meta = getCategoryMeta(summary.category); setActiveLadder({ category: summary.category, items: summary.items, title: `${group.name} · ${meta.plural}`, subtitle: `All ${meta.plural.toLowerCase()} ranked inside this public clique.` }) }
  if (loading) return <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-10 text-center text-neutral-400">Loading Explore...</div>
  if (message && !topContent.length && !groups.length) return <div className="rounded-[2rem] border border-rose-400/30 bg-rose-950/30 p-5 text-rose-100">{message}</div>
  if (!topContent.length && !groups.length) return <EmptyState />
  return <>{message ? <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950 shadow-2xl">{message}</div> : null}{categoryPiles.length ? <section className="mb-6 pt-1 sm:mb-8"><div className="mb-3 flex flex-col gap-3 px-1 sm:mb-4 lg:flex-row lg:items-end lg:justify-between"><div><h1 className="text-3xl font-black text-white">Top public picks</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">Best public picks from cliques for movies, series, games and more.</p></div><div className="hidden w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-neutral-300 sm:inline-flex"><AppIcon name="explore" size={15} />{topContent.length} public picks</div></div><div className="grid gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">{categoryPiles.map((pile) => <FeaturedPickPile key={pile.category} category={pile.category} items={pile.items} onInfo={setSelectedItem} onOpenLadder={openCategoryLadder} onCopy={copyToLibrary} onShare={shareItem} saving={savingItem} />)}</div></section> : null}{groups.length ? <section><div className="mb-3 flex flex-col gap-2 px-1 sm:mb-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="hidden text-xs font-black uppercase tracking-[0.28em] text-neutral-500 sm:block">Public discovery</p><div className="mt-1 flex items-center justify-between gap-3"><h2 className="text-3xl font-black text-white">Top Cliques</h2><span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-300 sm:hidden">{groups.length} public</span></div><p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">Open a public clique to see clique choices and library.</p></div><span className="hidden w-fit rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-neutral-300 sm:inline-flex">{groups.length} public</span></div><div className="grid gap-3 sm:gap-4 xl:grid-cols-2">{groups.slice(0, 10).map((group) => <GroupSummaryCard key={group.id} group={group} onOpenRubric={openGroupRubric} />)}</div></section> : null}<CategoryLadderModal category={activeLadder?.category} items={activeLadder?.items || []} title={activeLadder?.title} subtitle={activeLadder?.subtitle} saving={savingItem} onInfo={(item) => { setActiveLadder(null); setSelectedItem(item) }} onCopy={copyToLibrary} onClose={() => setActiveLadder(null)} /><DetailModal item={selectedItem} saving={savingItem} onCopy={copyToLibrary} onClose={() => setSelectedItem(null)} /></>
}

export default function Leaderboard() { return <PageShell active="explore"><ExploreBoard /></PageShell> }
