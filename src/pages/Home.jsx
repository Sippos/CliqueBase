import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AppIcon from '../components/AppIcon.jsx'
import MemberShareModal from '../components/MemberShareModal.jsx'
import PageShell from '../components/PageShell.jsx'
import { GROUPS_CHANGED_EVENT, getActiveGroup, getActiveGroupId, parseInviteCode, setActiveGroup } from '../lib/groups.js'
import { getSavedHandle } from '../lib/handle.js'
import { getCurrentSession, getGames, getMovies, getRemoteGroups, getSeries, hasSupabase, saveGame, saveMovie, saveSeries, voteGame, voteMovie, voteSeries } from '../lib/supabaseClient.js'

const TYPE_ICONS = { Movie: 'movies', Series: 'series', Game: 'games' }

function StatCard({ label, value, detail }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">{label}</p>
      <h2 className="mt-2 text-3xl font-black text-white">{value}</h2>
      <p className="mt-1 text-sm text-neutral-400">{detail}</p>
    </div>
  )
}

function normalizeItems(rows, type, code) {
  return rows.map((item) => ({
    ...item,
    type,
    code,
    rating: item.rating || null,
    sortValue: Number(item.score || 0) * 10 + Number(item.picks || 0) + Number(item.rating || 0),
  })).sort((a, b) => b.sortValue - a.sortValue)
}

function itemActionKey(item, prefix = '') {
  return item ? `${prefix}${item.type}-${item.id}` : ''
}

function itemText(item) {
  return item?.overview || item?.description || 'No description yet.'
}

function WheelHint() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-200 backdrop-blur">
      <AppIcon name="chevronDown" size={12} />
      Wheel skips
    </span>
  )
}

function IconButton({ icon, label, onClick, disabled = false, strong = false, className = '' }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-full border text-sm transition disabled:pointer-events-none disabled:opacity-50 ${strong ? 'border-white bg-white text-neutral-950 shadow-lg shadow-black/20 hover:bg-neutral-200' : 'border-white/15 bg-black/60 text-white backdrop-blur hover:bg-white hover:text-neutral-950'} ${className}`}
    >
      <AppIcon name={icon} size={16} strokeWidth={2.4} />
    </button>
  )
}

function ActionButton({ icon, children, onClick, disabled = false, active = false, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-black transition disabled:pointer-events-none disabled:opacity-60 ${active ? 'border-white bg-white text-neutral-950 shadow-lg shadow-black/20 hover:bg-neutral-200' : 'border-white/10 bg-white/[0.04] text-white hover:bg-white hover:text-neutral-950'} ${className}`}
    >
      <AppIcon name={icon} size={16} strokeWidth={2.4} />
      {children}
    </button>
  )
}

function LibrarySectionCard({ category, loading, onShare, onOpen }) {
  const top = category.top
  const image = top?.backdrop || top?.poster
  const topTitle = top?.title || `No ${category.title.toLowerCase()} yet`

  return (
    <article className="group relative min-h-[9.5rem] overflow-hidden rounded-[1.35rem] border border-white/10 bg-neutral-950 text-white transition hover:-translate-y-0.5 hover:border-white/25">
      {image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-74 transition duration-500 group-hover:scale-105" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.14),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,0,0,0.45))]" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/5" />
      <button type="button" onClick={() => onOpen?.(category)} className="absolute inset-0 z-0" aria-label={`Open ${category.title} pile`} />

      <div className="pointer-events-none relative z-10 flex h-full min-h-[9.5rem] flex-col justify-between p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="inline-flex items-center gap-2 text-xs font-black text-white drop-shadow">
            <AppIcon name={category.icon} size={14} strokeWidth={2.4} />
            {category.title}
          </div>
          <div className="pointer-events-auto flex gap-2">
            {top ? <button type="button" onClick={() => onShare?.(top)} className="rounded-full bg-black/45 px-3 py-1 text-sm font-black text-white backdrop-blur transition hover:bg-white hover:text-neutral-950">Share</button> : null}
            <button type="button" onClick={() => onOpen?.(category)} aria-label={`Open ${category.title} pile`} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm font-black text-neutral-950 shadow-lg shadow-black/20 transition hover:bg-neutral-200">
              <AppIcon name="list" size={14} strokeWidth={2.4} />
              Pile {loading ? '…' : category.count}
            </button>
          </div>
        </div>
        <h3 className="line-clamp-2 text-xl font-black leading-tight text-white drop-shadow-lg">{loading ? 'Loading section…' : topTitle}</h3>
      </div>
    </article>
  )
}

function LibraryOverviewPanel({ items, categories, loading, onShare, onOpen }) {
  return (
    <section className="mt-4 rounded-[1.6rem] border border-white/10 bg-neutral-950/70 p-3 shadow-2xl shadow-black/20">
      <div className="flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500">Library overview</p>
          <h2 className="mt-1 text-xl font-black text-white">Category overview</h2>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-right">
          <p className="text-xl font-black text-white">{loading ? '…' : items.length}</p>
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-neutral-500">total items</p>
        </div>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        {categories.map((category) => <LibrarySectionCard key={category.title} category={category} loading={loading} onShare={onShare} onOpen={onOpen} />)}
      </div>
    </section>
  )
}

function LibraryShowcase({ items, loading, onShare, onInfo }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex((current) => items.length ? Math.min(current, items.length - 1) : 0)
  }, [items.length])

  useEffect(() => {
    if (items.length < 2) return undefined
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % items.length), 4200)
    return () => window.clearInterval(timer)
  }, [items.length])

  if (loading) {
    return (
      <div className="relative flex min-h-[250px] items-end overflow-hidden bg-neutral-950 p-5">
        <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(0,0,0,0.45))]" />
        <div className="relative"><p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Library reel</p><h2 className="mt-2 text-2xl font-black text-white">Loading your library…</h2></div>
      </div>
    )
  }

  if (!items.length) {
    return (
      <div className="relative flex min-h-[250px] items-end overflow-hidden bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.16),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,0,0,0.4))] p-5">
        <div><p className="text-xs uppercase tracking-[0.3em] text-neutral-400">Empty library</p><h2 className="mt-2 text-2xl font-black text-white">Add the first item</h2><p className="mt-2 max-w-sm text-sm leading-6 text-neutral-300">Once you add watched movies, finished series, or played games, this corner becomes a slideshow of your library.</p></div>
      </div>
    )
  }

  const item = items[index] || items[0]
  const image = item.backdrop || item.poster

  return (
    <div className="relative min-h-[250px] overflow-hidden bg-neutral-950">
      <button type="button" onClick={() => onInfo?.(item)} className="group absolute inset-0 flex items-end p-5 text-left">
        {image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-65 transition duration-700 group-hover:scale-105" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.16),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,0,0,0.4))]" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />
        <div className="absolute left-5 top-5 right-5 flex items-center justify-between gap-3"><span className="rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-xs font-black uppercase tracking-[0.22em] text-white backdrop-blur">Library reel</span><span className="rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-xs font-bold text-neutral-200 backdrop-blur">{index + 1}/{items.length}</span></div>
        <div className="relative max-w-md pr-24"><p className="text-xs uppercase tracking-[0.3em] text-neutral-300">{item.type}</p><h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">{item.title}</h2><p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-300">{item.overview || `Score ${item.score || 0} · ${item.picks || 0} picks`}</p></div>
      </button>
      <button type="button" onClick={() => onShare?.(item)} className="absolute bottom-5 right-5 z-10 rounded-2xl bg-white px-4 py-2 text-sm font-black text-neutral-950 shadow-2xl shadow-black/30 transition hover:bg-neutral-200">Share</button>
    </div>
  )
}

function CategoryFlipCard({ category, loading, flipped, saving, itemIndex = 0, onToggle, onCycle, onInfo, onShare, onCopy, onOpenPile }) {
  const wheelLockRef = useRef(0)
  const items = category.items || []
  const safeIndex = items.length ? itemIndex % items.length : 0
  const top = items[safeIndex]
  const image = top?.poster || top?.backdrop
  const displayTitle = top?.title || category.title
  const summary = top?.overview || `Open the full ${category.title.toLowerCase()} list for this clique.`
  const canCycle = items.length > 1

  function handleToggle() {
    if (!top && !loading) return
    onToggle?.(category)
  }

  function openPile(event) {
    event.stopPropagation()
    onOpenPile?.(category)
  }

  function cycle(event, direction) {
    event.stopPropagation()
    if (!canCycle) return
    onCycle?.(category, direction)
  }

  function handleWheel(event) {
    if (!canCycle) return
    const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX
    if (Math.abs(delta) < 10) return
    const now = Date.now()
    if (now - wheelLockRef.current < 180) return
    wheelLockRef.current = now
    event.preventDefault()
    event.stopPropagation()
    onCycle?.(category, delta > 0 ? 1 : -1)
  }

  return (
    <article tabIndex={0} role="button" aria-pressed={flipped} aria-label={`${flipped ? 'Hide actions for' : 'Show actions for'} ${category.title}`} onClick={handleToggle} onWheel={handleWheel} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handleToggle() } }} className="group relative cursor-pointer outline-none" style={{ perspective: '1000px' }}>
      <div className="relative min-h-[24rem] rounded-[2rem] transition-transform duration-500 group-hover:-translate-y-0.5 group-focus-visible:ring-2 group-focus-visible:ring-white/50" style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
        <div className="absolute inset-0 overflow-hidden rounded-[2rem] border border-white/10 bg-neutral-950 shadow-2xl shadow-black/20 transition group-hover:border-white/20" style={{ backfaceVisibility: 'hidden' }}>
          {image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-88 transition duration-500 group-hover:scale-105" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.14),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,0,0,0.45))]" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/5" />

          <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/65 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-black/30 backdrop-blur"><AppIcon name={category.icon} size={14} strokeWidth={2.4} />{category.singular}</div>

          <div className="absolute right-4 top-4 flex items-center gap-2">
            {top ? <IconButton icon="info" label={`Show details for ${displayTitle}`} onClick={(event) => { event.stopPropagation(); onInfo?.(top) }} /> : null}
            <button type="button" onClick={openPile} aria-label={`Open ${category.title} pile`} className="inline-flex h-11 items-center gap-1.5 rounded-full border border-white/15 bg-white px-3 text-sm font-black text-neutral-950 shadow-lg shadow-black/30 transition hover:bg-neutral-200"><AppIcon name="list" size={15} strokeWidth={2.4} />Pile {loading ? '…' : category.count}</button>
          </div>

          {canCycle ? <div className="absolute bottom-4 right-4 z-20 flex gap-2"><IconButton icon="chevronLeft" label={`Previous ${category.singular}`} onClick={(event) => cycle(event, -1)} /><IconButton icon="chevronRight" label={`Next ${category.singular}`} onClick={(event) => cycle(event, 1)} /></div> : null}

          <div className="absolute inset-x-0 bottom-0 p-5 pr-28">
            <div className="flex flex-wrap items-center gap-2"><p className="text-xs font-black uppercase tracking-[0.24em] text-neutral-300">#{safeIndex + 1} {category.singular.toLowerCase()} pick</p>{canCycle ? <WheelHint /> : null}</div>
            <h3 className="mt-2 line-clamp-2 text-3xl font-black leading-tight text-white drop-shadow-lg">{loading ? 'Loading…' : displayTitle}</h3>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-white"><span className="rounded-full border border-white/15 bg-black/45 px-3 py-1.5 backdrop-blur">Score {top?.score || 0}</span><span className="rounded-full border border-white/15 bg-black/45 px-3 py-1.5 backdrop-blur">{top?.picks || 0} picks</span>{top?.rating ? <span className="rounded-full border border-white/15 bg-black/45 px-3 py-1.5 backdrop-blur">Rating {Number(top.rating).toFixed(1)}</span> : null}</div>
          </div>
        </div>

        <div className="absolute inset-0 flex flex-col rounded-[2rem] border border-white/15 bg-neutral-950 p-5 shadow-2xl shadow-black/40" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
          <div className="flex items-start justify-between gap-3"><span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-neutral-950"><AppIcon name={category.icon} size={20} /></span><div className="flex gap-2">{canCycle ? <IconButton icon="chevronLeft" label={`Previous ${category.singular}`} onClick={(event) => cycle(event, -1)} /> : null}{canCycle ? <IconButton icon="chevronRight" label={`Next ${category.singular}`} onClick={(event) => cycle(event, 1)} /> : null}<button type="button" onClick={openPile} className="inline-flex items-center gap-1.5 rounded-2xl bg-white px-3 py-2 text-xs font-black text-neutral-950 transition hover:bg-neutral-200"><AppIcon name="list" size={14} strokeWidth={2.4} />Ladder ↗</button></div></div>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.24em] text-neutral-500">{category.title} actions</p>
          <h3 className="mt-2 line-clamp-2 text-2xl font-black leading-tight text-white">{displayTitle}</h3>
          <p className="mt-3 line-clamp-5 flex-1 text-sm leading-6 text-neutral-400">{summary}</p>
          <div className="mt-5 flex gap-2">{top ? <button type="button" onClick={(event) => { event.stopPropagation(); onShare?.(top) }} aria-label={`Share ${displayTitle}`} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 px-3 py-3 text-sm font-black text-white transition hover:bg-white hover:text-neutral-950"><AppIcon name="link" size={16} />Share</button> : null}{top ? <button type="button" onClick={(event) => { event.stopPropagation(); onCopy?.(top) }} disabled={saving} aria-label={`Copy ${displayTitle}`} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 px-3 py-3 text-sm font-black text-white transition hover:bg-white hover:text-neutral-950 disabled:opacity-60"><AppIcon name="dashboard" size={16} />{saving ? 'Copying…' : 'Copy'}</button> : null}</div>
          <p className="mt-3 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-600">Tap card to flip back · wheel skips items</p>
        </div>
      </div>
    </article>
  )
}

function SwipePileCard({ item, index, total, busy, dragOffset, onPointerDown, onPointerMove, onPointerUp, onSkip, onVote, onInfo, onShare, onCopy }) {
  const image = item?.backdrop || item?.poster
  const rotation = dragOffset / 18
  const voteHint = dragOffset > 42 ? 'WATCH' : dragOffset < -42 ? 'PASS' : ''
  if (!item) return null

  return (
    <article className="mx-auto w-full max-w-xl">
      <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-neutral-950/70 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-neutral-400"><span>Use arrows or mouse wheel to skip</span><span>{index + 1}/{total}</span></div>
      <div className="relative min-h-[31rem] touch-pan-y overflow-hidden rounded-[2rem] border border-white/10 bg-neutral-950 shadow-2xl shadow-black/30 transition-transform duration-150" style={{ transform: `translateX(${dragOffset}px) rotate(${rotation}deg)` }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        {image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" draggable="false" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.16),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,0,0,0.45))]" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/5" />
        {voteHint ? <div className="absolute left-5 top-20 rotate-[-8deg] rounded-2xl border-2 border-white px-4 py-2 text-2xl font-black tracking-[0.2em] text-white shadow-2xl shadow-black/30">{voteHint}</div> : null}
        <div className="absolute left-5 top-5 right-5 flex items-center justify-between gap-3"><span className="rounded-full border border-white/15 bg-black/55 px-3 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-white backdrop-blur">{item.type}</span><span className="rounded-full border border-white/15 bg-black/55 px-3 py-1.5 text-xs font-bold text-neutral-200 backdrop-blur">{index + 1}/{total}</span></div>
        {total > 1 ? <div className="absolute inset-y-0 left-3 right-3 z-20 flex items-center justify-between pointer-events-none"><IconButton icon="chevronLeft" label="Previous card" onClick={(event) => { event.stopPropagation(); onSkip?.(-1) }} className="pointer-events-auto" /><IconButton icon="chevronRight" label="Next card" onClick={(event) => { event.stopPropagation(); onSkip?.(1) }} className="pointer-events-auto" /></div> : null}
        <div className="absolute inset-x-0 bottom-0 p-5"><h3 className="line-clamp-2 text-4xl font-black leading-tight text-white drop-shadow-lg">{item.title}</h3><p className="mt-3 line-clamp-3 text-sm leading-6 text-neutral-300">{itemText(item)}</p><div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-neutral-200"><span className="rounded-full border border-white/15 bg-black/45 px-3 py-1.5 backdrop-blur">Score {item.score || 0}</span><span className="rounded-full border border-white/15 bg-black/45 px-3 py-1.5 backdrop-blur">{item.picks || 0} picks</span>{item.rating ? <span className="rounded-full border border-white/15 bg-black/45 px-3 py-1.5 backdrop-blur">★ {Number(item.rating).toFixed(1)}</span> : null}</div></div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3"><button type="button" disabled={busy} onClick={() => onVote?.(item, 'dislike')} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white hover:text-neutral-950 disabled:opacity-60">Pass</button><button type="button" disabled={busy} onClick={() => onVote?.(item, 'like')} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-60">{busy ? 'Saving…' : 'Watch'}</button><button type="button" onClick={() => onInfo?.(item)} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white hover:text-neutral-950">Info</button><button type="button" onClick={() => onShare?.(item)} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white hover:text-neutral-950">Share</button><button type="button" onClick={() => onCopy?.(item)} className="col-span-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white hover:text-neutral-950">Copy to My Library</button></div>
      <p className="mt-3 text-center text-xs font-semibold uppercase tracking-[0.18em] text-neutral-600">Swipe right to watch · swipe left to pass · scroll wheel skips</p>
    </article>
  )
}

function CliquePilePanel({ category, loading, votingKey, onClose, onVote, onInfo, onShare, onCopy }) {
  const wheelLockRef = useRef(0)
  const [viewMode, setViewMode] = useState('swipe')
  const [cardIndex, setCardIndex] = useState(0)
  const [dragStartX, setDragStartX] = useState(null)
  const [dragOffset, setDragOffset] = useState(0)
  const categoryTitle = category?.title || ''
  const items = category?.items || []
  const safeIndex = items.length ? ((cardIndex % items.length) + items.length) % items.length : 0
  const activeItem = items[safeIndex]
  const activeVoteKey = itemActionKey(activeItem, 'vote-')
  const activeBusy = votingKey === activeVoteKey

  useEffect(() => { setViewMode('swipe'); setCardIndex(0); setDragOffset(0); setDragStartX(null) }, [categoryTitle])
  useEffect(() => { setCardIndex((current) => items.length ? Math.min(current, items.length - 1) : 0) }, [items.length])

  if (!category) return null

  function skipCard(direction) {
    if (!items.length) return
    setDragOffset(0)
    setDragStartX(null)
    setCardIndex((current) => items.length > 1 ? (current + direction + items.length) % items.length : 0)
  }

  function handleWheel(event) {
    if (viewMode !== 'swipe' || items.length < 2) return
    const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX
    if (Math.abs(delta) < 10) return
    const now = Date.now()
    if (now - wheelLockRef.current < 170) return
    wheelLockRef.current = now
    event.preventDefault()
    event.stopPropagation()
    skipCard(delta > 0 ? 1 : -1)
  }

  function voteAndAdvance(item, vote) {
    if (!item) return
    onVote?.(item, vote)
    skipCard(1)
  }

  function handlePointerDown(event) { setDragStartX(event.clientX); event.currentTarget.setPointerCapture?.(event.pointerId) }
  function handlePointerMove(event) { if (dragStartX === null) return; setDragOffset(Math.max(-140, Math.min(140, event.clientX - dragStartX))) }
  function handlePointerUp() {
    if (dragStartX === null) return
    const offset = dragOffset
    setDragStartX(null)
    setDragOffset(0)
    if (offset > 80) voteAndAdvance(activeItem, 'like')
    if (offset < -80) voteAndAdvance(activeItem, 'dislike')
  }

  return (
    <section className="mt-5 max-h-[calc(100vh-7rem)] overflow-y-auto overscroll-contain rounded-[2rem] border border-white/10 bg-white/[0.03] p-5" id="clique-inline-pile">
      <div className="sticky top-0 z-30 -mx-5 -mt-5 flex flex-wrap items-start justify-between gap-3 border-b border-white/10 bg-neutral-950/90 p-5 backdrop-blur">
        <div><p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-neutral-500"><AppIcon name={category.icon} size={14} />Clique pile</p><h2 className="mt-1 text-3xl font-black text-white">{category.title} voting list</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">Vote directly inside this clique. In swipe mode, use the arrows or mouse wheel to skip through cards.</p></div>
        <div className="flex flex-wrap gap-2"><div className="rounded-2xl border border-white/10 bg-neutral-950 p-1"><button type="button" onClick={() => setViewMode('swipe')} className={`rounded-xl px-4 py-2 text-sm font-black transition ${viewMode === 'swipe' ? 'bg-white text-neutral-950' : 'text-neutral-400 hover:text-white'}`}>Swipe pile</button><button type="button" onClick={() => setViewMode('list')} className={`rounded-xl px-4 py-2 text-sm font-black transition ${viewMode === 'list' ? 'bg-white text-neutral-950' : 'text-neutral-400 hover:text-white'}`}>All list</button></div><button type="button" onClick={onClose} className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-black text-neutral-300 transition hover:bg-white hover:text-neutral-950">Close pile</button></div>
      </div>

      {loading ? <p className="mt-5 rounded-3xl border border-white/10 p-5 text-sm text-neutral-400">Loading pile…</p> : items.length ? (
        viewMode === 'swipe' ? (
          <div className="mt-5" onWheel={handleWheel}>
            <SwipePileCard item={activeItem} index={safeIndex} total={items.length} busy={activeBusy} dragOffset={dragOffset} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onSkip={skipCard} onVote={voteAndAdvance} onInfo={onInfo} onShare={onShare} onCopy={onCopy} />
          </div>
        ) : (
          <div className="mt-5 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map((item, index) => {
                const image = item.backdrop || item.poster
                const voteKey = itemActionKey(item, 'vote-')
                const busy = votingKey === voteKey
                return (
                  <article key={`${item.type}-${item.id}`} className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-neutral-950/80">
                    <button type="button" onClick={() => onInfo?.(item)} className="group relative block h-44 w-full overflow-hidden text-left">{image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-75 transition duration-500 group-hover:scale-105" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.14),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,0,0,0.45))]" />}<div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" /><span className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/55 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-white backdrop-blur">#{index + 1}</span><div className="absolute inset-x-0 bottom-0 p-4"><p className="text-xs uppercase tracking-[0.22em] text-neutral-300">{item.type}</p><h3 className="mt-1 line-clamp-2 text-2xl font-black leading-tight text-white">{item.title}</h3></div></button>
                    <div className="p-4"><p className="line-clamp-2 text-sm leading-6 text-neutral-400">{itemText(item)}</p><div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-neutral-300"><span className="rounded-full border border-white/10 px-3 py-1.5">Score {item.score || 0}</span><span className="rounded-full border border-white/10 px-3 py-1.5">{item.picks || 0} picks</span>{item.rating ? <span className="rounded-full border border-white/10 px-3 py-1.5">★ {Number(item.rating).toFixed(1)}</span> : null}</div><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" disabled={busy} onClick={() => onVote?.(item, 'like')} className="rounded-2xl bg-white px-3 py-2 text-sm font-black text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-60">{busy ? 'Saving…' : 'Watch'}</button><button type="button" disabled={busy} onClick={() => onVote?.(item, 'dislike')} className="rounded-2xl border border-white/10 px-3 py-2 text-sm font-black text-white transition hover:bg-white hover:text-neutral-950 disabled:opacity-60">Pass</button><button type="button" onClick={() => onShare?.(item)} className="rounded-2xl border border-white/10 px-3 py-2 text-sm font-black text-white transition hover:bg-white hover:text-neutral-950">Share</button><button type="button" onClick={() => onCopy?.(item)} className="rounded-2xl border border-white/10 px-3 py-2 text-sm font-black text-white transition hover:bg-white hover:text-neutral-950">Copy</button></div></div>
                  </article>
                )
              })}
            </div>
          </div>
        )
      ) : <p className="mt-5 rounded-3xl border border-dashed border-white/10 p-5 text-sm leading-6 text-neutral-400">No {category.title.toLowerCase()} in this clique yet. Add the first pick from the media search later.</p>}
    </section>
  )
}

function ItemInfoModal({ item, onClose }) {
  if (!item) return null
  const image = item.backdrop || item.poster
  const icon = TYPE_ICONS[item.type] || 'explore'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-white/10 bg-neutral-950 p-5 text-white shadow-2xl shadow-black/40">
        <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-neutral-500"><AppIcon name={icon} size={14} />{item.type}</p><h2 className="mt-2 text-2xl font-black leading-tight">{item.title}</h2></div><button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-2xl text-neutral-400 transition hover:bg-white hover:text-neutral-950">×</button></div>
        {image ? <img src={image} alt="" className="mt-5 h-56 w-full rounded-3xl object-cover" /> : null}
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-neutral-300"><span className="rounded-full border border-white/10 px-3 py-1.5">Score {item.score || 0}</span><span className="rounded-full border border-white/10 px-3 py-1.5">{item.picks || 0} picks</span>{item.rating ? <span className="rounded-full border border-white/10 px-3 py-1.5">★ {Number(item.rating).toFixed(1)}</span> : null}{item.runtime ? <span className="rounded-full border border-white/10 px-3 py-1.5">{item.runtime} min</span> : null}{item.seasons ? <span className="rounded-full border border-white/10 px-3 py-1.5">{item.seasons} seasons</span> : null}</div>
        <p className="mt-5 text-sm leading-7 text-neutral-300">{item.overview || item.description || 'No description available yet.'}</p>
      </div>
    </div>
  )
}

function InviteCard({ inviteDraft, setInviteDraft, inviteError, setInviteError, onSubmit }) {
  return (
    <section className="mt-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
      <div className="grid gap-4 md:grid-cols-[0.75fr_1.25fr] md:items-center">
        <div><p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Join by invite</p><h2 className="mt-1 text-2xl font-black text-white">Got a clique link?</h2><p className="mt-2 text-sm leading-6 text-neutral-400">Paste an invite link or code to join a friend’s shared voting space.</p></div>
        <form onSubmit={onSubmit} className="rounded-3xl border border-white/10 bg-neutral-950/80 p-3"><div className="flex flex-col gap-2 sm:flex-row"><input value={inviteDraft} onChange={(event) => { setInviteDraft(event.target.value); setInviteError('') }} placeholder="Paste invite link or code" className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" /><button className="rounded-2xl bg-white px-5 py-3 font-semibold text-neutral-950 hover:bg-neutral-200">Open invite</button></div>{inviteError ? <p className="mt-2 text-sm text-rose-200">{inviteError}</p> : null}</form>
      </div>
    </section>
  )
}

export default function Home() {
  const navigate = useNavigate()
  const { groupId: routeGroupId } = useParams()
  const [inviteDraft, setInviteDraft] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [loading, setLoading] = useState(hasSupabase)
  const [status, setStatus] = useState(hasSupabase ? 'checking' : 'local')
  const [context, setContext] = useState(() => ({ type: getActiveGroup() ? 'group' : 'personal', name: getActiveGroup()?.name || 'My Library', groupId: getActiveGroup()?.id || null }))
  const [media, setMedia] = useState({ movies: [], series: [], games: [] })
  const [message, setMessage] = useState('')
  const [shareNotice, setShareNotice] = useState('')
  const [sharingItem, setSharingItem] = useState(null)
  const [infoItem, setInfoItem] = useState(null)
  const [flippedCategory, setFlippedCategory] = useState('')
  const [activePileTitle, setActivePileTitle] = useState('')
  const [copyingKey, setCopyingKey] = useState('')
  const [votingKey, setVotingKey] = useState('')
  const [categoryIndexes, setCategoryIndexes] = useState({})

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
  const activePile = useMemo(() => categories.find((category) => category.title === activePileTitle) || null, [categories, activePileTitle])
  const ratedCount = useMemo(() => allItems.filter((item) => item.rating).length, [allItems])
  const totalPicks = useMemo(() => allItems.reduce((sum, item) => sum + Number(item.picks || 0), 0), [allItems])

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
      if (!session?.user) { setStatus('signed-out'); setContext({ type: 'personal', name: 'My Library', groupId: null }); setMedia({ movies: [], series: [], games: [] }); setLoading(false); return }
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

  function openInvite(event) { event.preventDefault(); const code = parseInviteCode(inviteDraft); if (!code) return setInviteError('Paste an invite link or code first.'); navigate(`/invite/${encodeURIComponent(code)}`) }
  function openShare(item) { setSharingItem(item) }
  function handleShareMessage(text) { setShareNotice(text); setTimeout(() => setShareNotice(''), 2600) }
  function toggleCategory(category) { setFlippedCategory((current) => current === category.title ? '' : category.title) }
  function openPile(category) { setActivePileTitle(category.title); setFlippedCategory(''); window.setTimeout(() => document.getElementById('clique-inline-pile')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50) }
  function currentCategoryItem(category) { const index = categoryIndexes[category.title] || 0; return category.items[index % Math.max(category.items.length, 1)] || category.top }
  function cycleCategory(category, direction) {
    if (!category?.items?.length) return
    setCategoryIndexes((current) => {
      const previous = current[category.title] || 0
      const next = (previous + direction + category.items.length) % category.items.length
      return { ...current, [category.title]: next }
    })
  }

  async function copyToLibrary(item) {
    if (!item || !hasSupabase || status !== 'ready') return handleShareMessage('Sign in from Profile before copying to My Library.')
    const key = itemActionKey(item, 'copy-')
    setCopyingKey(key)
    try {
      const nominatedBy = getSavedHandle() || 'anonymous'
      if (item.type === 'Movie') await saveMovie(item, nominatedBy, null)
      else if (item.type === 'Series') await saveSeries(item, nominatedBy, null)
      else if (item.type === 'Game') await saveGame(item, nominatedBy, null)
      else throw new Error('Unsupported item type.')
      handleShareMessage(`Copied "${item.title}" to My Library.`)
    } catch (error) { handleShareMessage(error.message || 'Could not copy this item to My Library.') }
    finally { setCopyingKey('') }
  }

  async function voteInClique(item, vote) {
    if (!item || !context.groupId || !hasSupabase || status !== 'ready') return handleShareMessage('Open a clique first to vote.')
    const key = itemActionKey(item, 'vote-')
    setVotingKey(key)
    try {
      if (item.type === 'Movie') await voteMovie(item, vote, context.groupId)
      else if (item.type === 'Series') await voteSeries(item, vote, context.groupId)
      else if (item.type === 'Game') await voteGame(item, vote, context.groupId)
      else throw new Error('Unsupported item type.')
      handleShareMessage(vote === 'like' ? `Voted to watch "${item.title}".` : `Passed on "${item.title}".`)
      await refreshDashboard(context.groupId)
    } catch (error) { handleShareMessage(error.message || 'Could not save your vote.') }
    finally { setVotingKey('') }
  }

  return (
    <PageShell active="explore">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] shadow-2xl shadow-black/20">
        <div className="grid gap-0 xl:grid-cols-[1.05fr_0.95fr]"><div className="p-4 sm:p-6"><h1 className="max-w-3xl text-3xl font-black tracking-tight text-white sm:text-5xl">{context.name}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400 sm:text-base">{context.type === 'group' ? 'Shared movie, series, and game picks for this clique.' : 'Your watched movies, finished series, and played games in one place.'}</p>{status === 'signed-out' ? <p className="mt-3 inline-flex rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-neutral-300">Sign in from Profile to save picks and join cliques.</p> : null}<LibraryOverviewPanel items={loading ? [] : allItems} categories={categories} loading={loading} onShare={openShare} onOpen={openPile} /></div><LibraryShowcase items={loading ? [] : allItems} loading={loading} onShare={openShare} onInfo={setInfoItem} /></div>
      </section>

      {shareNotice ? <div className="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-950/30 p-4 text-sm text-emerald-100">{shareNotice}</div> : null}
      {message ? <div className="mt-5 rounded-2xl border border-rose-400/30 bg-rose-950/30 p-4 text-sm text-rose-100">{message}</div> : null}

      <section className="mt-5 grid gap-3 md:grid-cols-3"><StatCard label="Items" value={loading ? '…' : allItems.length} detail="Movies, series, and games" /><StatCard label="Picks" value={loading ? '…' : totalPicks} detail="Saved votes across lists" /><StatCard label="Rated" value={loading ? '…' : ratedCount} detail="Watched, finished, or played" /></section>
      {!context.groupId ? <InviteCard inviteDraft={inviteDraft} setInviteDraft={setInviteDraft} inviteError={inviteError} setInviteError={setInviteError} onSubmit={openInvite} /> : null}

      <section className="mt-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
        <div><p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Section highlights</p><h2 className="mt-1 text-3xl font-black text-white">Top items by category</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">Use the arrows or mouse wheel to skip through category cards, or press Pile for swipe voting and the full scrollable list.</p></div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">{categories.map((category) => { const item = currentCategoryItem(category); const index = categoryIndexes[category.title] || 0; return <CategoryFlipCard key={category.title} category={category} loading={loading} flipped={flippedCategory === category.title} saving={copyingKey === itemActionKey(item, 'copy-')} itemIndex={index} onToggle={toggleCategory} onCycle={cycleCategory} onInfo={setInfoItem} onShare={openShare} onCopy={copyToLibrary} onOpenPile={openPile} /> })}</div>
      </section>

      <CliquePilePanel category={activePile} loading={loading} votingKey={votingKey} onClose={() => setActivePileTitle('')} onVote={voteInClique} onInfo={setInfoItem} onShare={openShare} onCopy={copyToLibrary} />
      <ItemInfoModal item={infoItem} onClose={() => setInfoItem(null)} />
      <MemberShareModal item={sharingItem} type={sharingItem?.type?.toLowerCase()} onClose={() => setSharingItem(null)} onMessage={handleShareMessage} />
    </PageShell>
  )
}
