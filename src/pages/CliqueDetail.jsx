import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AppIcon from '../components/AppIcon.jsx'
import MemberShareModal from '../components/MemberShareModal.jsx'
import PageShell from '../components/PageShell.jsx'
import SwipeDeck from '../components/SwipeDeck.jsx'
import { StatusMessage } from '../components/MediaBlocks.jsx'
import { getActiveGroup, setActiveGroup } from '../lib/groups.js'
import { getSavedHandle } from '../lib/handle.js'
import { getCurrentSession, getGames, getMovies, getRemoteGroups, getSeries, hasSupabase, saveGame, saveMovie, saveSeries } from '../lib/supabaseClient.js'
import { getVideos, saveVideo } from '../lib/videoLibrary.js'

const CATEGORY_META = [
  { key: 'movies', title: 'Movies', singular: 'Movie', icon: 'movies', href: '/movies', doneKey: 'watched', addLabel: 'Search movies' },
  { key: 'series', title: 'Series', singular: 'Series', icon: 'series', href: '/series', doneKey: 'finished', addLabel: 'Search series' },
  { key: 'games', title: 'Games', singular: 'Game', icon: 'games', href: '/games', doneKey: 'played', addLabel: 'Search games' },
  { key: 'videos', title: 'Videos', singular: 'Video', icon: 'videos', href: '/videos', doneKey: 'classic', addLabel: 'Add video link' },
]

function scopedHref(category, groupId) {
  return `${category.href}?clique=${encodeURIComponent(groupId)}`
}
function artFor(item) { return item?.backdrop || item?.poster || null }
function posterFor(item) { return item?.poster || item?.backdrop || null }
function actionKey(item, prefix = '') { return item ? `${prefix}${item.type}-${item.id}` : '' }
function detailsText(item) { return item?.overview || item?.description || item?.url || 'No description available yet.' }
function releaseYearFor(item) {
  if (!item) return ''
  const raw = item.year || item.released || item.release_date || item.first_air_date || item.firstAirDate
  const match = String(raw || '').match(/\d{4}/)
  return match?.[0] || ''
}
function genreSummaryFor(item, limit = 2) {
  const values = Array.isArray(item?.genres) ? item.genres.filter(Boolean) : []
  return values.slice(0, limit).join(', ')
}
function metaLineFor(item) {
  const parts = [releaseYearFor(item), genreSummaryFor(item)].filter(Boolean)
  return parts.join(' · ')
}
function normalizeItems(rows = [], meta) {
  return rows.map((item) => ({
    ...item,
    type: meta.singular,
    category: meta.title,
    icon: meta.icon,
    done: meta.doneKey === 'classic' ? Boolean(item.classic) : Boolean(item[meta.doneKey]),
    rating: item.rating ?? null,
    score: Number(item.score || 0),
    picks: Number(item.picks || 0),
    sortValue: Number(item.score || 0) * 10 + Number(item.picks || 0) + Number(item.rating || 0) + (item.classic ? 4 : 0),
  })).sort((a, b) => b.sortValue - a.sortValue || String(a.title || '').localeCompare(String(b.title || '')))
}
function Pill({ children, light = false }) {
  return <span className={`rounded-full border px-3 py-1 text-xs font-bold ${light ? 'border-white bg-white text-neutral-950' : 'border-white/10 bg-white/[0.05] text-neutral-200'}`}>{children}</span>
}
function DetailRow({ label, value }) {
  if (!value) return null
  return <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.025] px-3 py-1.5"><span className="text-[9px] font-bold uppercase tracking-[0.16em] text-neutral-500">{label}</span><span className="text-[13px] font-semibold leading-none text-white">{value}</span></span>
}
function GenreChips({ genres }) {
  const values = Array.isArray(genres) ? genres.filter(Boolean) : []
  if (!values.length) return null
  return <section className="mt-4"><h3 className="text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-500">Genres</h3><div className="mt-2 flex flex-wrap gap-2">{values.map((genre) => <span key={genre} className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-neutral-200">{genre}</span>)}</div></section>
}
function CategoryBadge({ item, category }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/65 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white shadow-lg shadow-black/30 backdrop-blur"><AppIcon name={category?.icon || item?.icon || 'explore'} size={14} />{category?.singular || item?.type || 'Pick'}</span>
}
function ActionChip({ icon, children, onClick, disabled = false, active = false, title, className = '' }) {
  return (
    <button
      type="button"
      title={title || (typeof children === 'string' ? children : undefined)}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-sm font-black transition disabled:pointer-events-none disabled:opacity-50 ${active ? 'border-white bg-white text-neutral-950 shadow-lg shadow-white/10 hover:bg-neutral-200' : 'border-white/10 bg-white/[0.045] text-white hover:border-white/25 hover:bg-white hover:text-neutral-950'} ${className}`}
    >
      <AppIcon name={icon} size={16} />
      <span>{children}</span>
    </button>
  )
}
function IconBubble({ icon, label, onClick, disabled = false, strong = false, className = '' }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition disabled:pointer-events-none disabled:opacity-50 ${strong ? 'border-white bg-white text-neutral-950 shadow-lg shadow-white/10 hover:bg-neutral-200' : 'border-white/15 bg-black/55 text-white backdrop-blur hover:bg-white hover:text-neutral-950'} ${className}`}
    >
      <AppIcon name={icon} size={17} />
    </button>
  )
}

function AddContentModal({ groupId, groupName, onClose }) {
  if (!groupId) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-neutral-950 p-5 text-white shadow-2xl shadow-black/40">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[0.26em] text-neutral-500">Add content</p><h2 className="mt-1 text-2xl font-black">Add to {groupName}</h2></div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-2xl text-neutral-400 hover:bg-white hover:text-neutral-950">×</button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {CATEGORY_META.map((category) => <Link key={category.key} to={scopedHref(category, groupId)} onClick={onClose} className="rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-4 text-white transition hover:border-white/25 hover:bg-white/[0.07]"><span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-neutral-950"><AppIcon name={category.icon} size={19} /></span><h3 className="mt-4 text-lg font-black">{category.addLabel}</h3><p className="mt-2 text-sm text-neutral-400">Opens inside this clique.</p></Link>)}
        </div>
      </div>
    </div>
  )
}

function MiniCategoryTile({ category, onOpenList }) {
  const top = category.items[0]
  return (
    <button type="button" onClick={() => onOpenList(category)} className="group relative min-h-[10rem] overflow-hidden rounded-[1.35rem] border border-white/10 bg-neutral-950 text-left transition hover:-translate-y-0.5 hover:border-white/25">
      {artFor(top) ? <img src={artFor(top)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-82 transition duration-500 group-hover:scale-105" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.07),rgba(0,0,0,0.45))]" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/5" />
      <div className="relative flex min-h-[10rem] flex-col justify-between p-3.5">
        <div className="flex items-start justify-between gap-2"><span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-neutral-950"><AppIcon name={category.icon} size={10} />{category.title}</span><span className="rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-black text-white">{category.count}</span></div>
        <h3 className="line-clamp-2 text-lg font-black leading-tight text-white">{top?.title || `No ${category.title.toLowerCase()}`}</h3>
      </div>
    </button>
  )
}

function HeroSlide({ category, item, index, total, onOpenList }) {
  return (
    <div className="relative min-h-[28rem] bg-neutral-950">
      {artFor(item) ? <img src={artFor(item)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-82" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.16),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,0,0,0.45))]" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/5" />
      <div className="absolute left-5 top-5 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-xs font-black uppercase tracking-[0.22em] text-white backdrop-blur">{category.title} · {index + 1}/{total}</div>
      <button type="button" onClick={() => onOpenList(category)} className="absolute right-5 top-5 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-black text-neutral-950 hover:bg-neutral-200"><AppIcon name="list" size={13} />Open list</button>
      <div className="absolute inset-x-0 bottom-0 p-6"><p className="text-xs font-black uppercase tracking-[0.3em] text-neutral-300">#1 in {category.title}</p><h2 className="mt-2 text-4xl font-black leading-tight text-white">{item?.title || `No ${category.title.toLowerCase()} yet`}</h2><p className="mt-2 line-clamp-2 max-w-lg text-sm leading-6 text-neutral-300">{detailsText(item)}</p></div>
    </div>
  )
}

function CategoryOverviewCard({ category, groupId, active, copying, itemIndex, onCycle, onToggle, onInfo, onOpenPile, onShare, onCopy }) {
  const items = category.items || []
  const safeIndex = items.length ? itemIndex % items.length : 0
  const current = items[safeIndex]
  const title = current?.title || `No ${category.title.toLowerCase()} yet`
  const canCycle = items.length > 1
  const sourceRating = current?.tmdbRating ?? current?.rawgRating
  const metaLine = metaLineFor(current)
  const summaryRows = current ? [
    ['Score', current.score || 0],
    ['Picks', current.picks || 0],
    current.rating ? ['Rating', Number(current.rating).toFixed(1)] : null,
    sourceRating !== null && sourceRating !== undefined ? [current.type === 'Game' ? 'RAWG' : 'TMDB', Number(sourceRating).toFixed(1)] : null,
  ].filter(Boolean) : []
  const stopAnd = (handler) => (event) => { event.stopPropagation(); handler() }
  const flipCard = () => onToggle(category.key)

  return (
    <article
      role="button"
      tabIndex={0}
      aria-pressed={active}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); flipCard() } }}
      className={`group relative min-h-[24rem] cursor-pointer rounded-[1.75rem] text-white outline-none [perspective:1400px] focus-visible:ring-2 focus-visible:ring-white/50 ${active ? 'ring-1 ring-white/25' : ''}`}
    >
      <div className={`absolute inset-0 rounded-[1.75rem] transition duration-500 [transform-style:preserve-3d] ${active ? '[transform:rotateY(180deg)]' : ''}`}>
        <div className="absolute inset-0 overflow-hidden rounded-[1.75rem] border border-white/10 bg-neutral-950 shadow-2xl shadow-black/20 [backface-visibility:hidden] transition hover:-translate-y-0.5 hover:border-white/25">
          {artFor(current) ? <img src={artFor(current)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-85 transition duration-500 group-hover:scale-105" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.14),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,0,0,0.45))]" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/5" />
          <button type="button" onClick={flipCard} className="absolute inset-0 z-10 text-left" aria-label={`Flip ${category.title} card`} />
          <div className="pointer-events-none relative z-20 flex min-h-[24rem] flex-col justify-between p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-950"><AppIcon name={category.icon} size={12} />{category.title}</span>
              <div className="pointer-events-auto flex flex-wrap justify-end gap-2">
                {canCycle ? <IconBubble icon="chevronLeft" label={`Previous ${category.title}`} onClick={(event) => { event.stopPropagation(); onCycle(category, -1) }} /> : null}
                {canCycle ? <IconBubble icon="chevronRight" label={`Next ${category.title}`} onClick={(event) => { event.stopPropagation(); onCycle(category, 1) }} /> : null}
                <ActionChip icon="list" onClick={(event) => { event.stopPropagation(); onOpenPile(category, 'swipe') }} className="min-h-10 rounded-full px-3 text-xs">{category.count}</ActionChip>
                {current ? <IconBubble icon="info" label={`Info for ${title}`} onClick={(event) => { event.stopPropagation(); onInfo(current) }} /> : null}
              </div>
            </div>
            <div className="max-w-xl rounded-[1.5rem] border border-white/10 bg-black/45 p-4 backdrop-blur-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-300">#{safeIndex + 1} in {category.title}</p>
              <h3 className="mt-1 line-clamp-2 text-3xl font-black leading-tight text-white drop-shadow-lg">{title}</h3>
              {metaLine ? <p className="mt-2 line-clamp-1 text-sm font-bold text-neutral-200">{metaLine}</p> : null}
              {current ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-300">{detailsText(current)}</p> : null}
            </div>
          </div>
        </div>

        <div className="absolute inset-0 flex overflow-hidden rounded-[1.75rem] border border-white/15 bg-neutral-950 p-5 shadow-2xl shadow-black/30 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <div className="flex min-h-full w-full flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-300"><AppIcon name={category.icon} size={12} />{category.singular}</p><h3 className="mt-3 text-3xl font-black leading-tight text-white">{title}</h3>{metaLine ? <p className="mt-2 text-sm font-semibold text-neutral-400">{metaLine}</p> : null}</div>
              <IconBubble icon="chevronLeft" label="Flip back" onClick={stopAnd(flipCard)} />
            </div>

            {current ? (
              <>
                <div className="mt-4 flex flex-wrap gap-2">{summaryRows.map(([label, value]) => <Pill key={label}>{label} {value}</Pill>)}{current.done ? <Pill light>{current.type === 'Series' ? 'Finished' : current.type === 'Game' ? 'Played' : current.type === 'Video' ? 'Classic' : 'Watched'}</Pill> : null}</div>
                <div className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-3xl border border-white/10 bg-white/[0.035] p-4" onClick={(event) => event.stopPropagation()}>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-neutral-500">Full content</p>
                  <p className="mt-3 whitespace-pre-wrap break-words text-base leading-7 text-neutral-200">{detailsText(current)}</p>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-4">
                  <ActionChip icon="list" onClick={stopAnd(() => onOpenPile(category, 'cards'))}>Cards</ActionChip>
                  <ActionChip icon="explore" onClick={stopAnd(() => onOpenPile(category, 'swipe'))}>Pile</ActionChip>
                  <ActionChip icon="share" active onClick={stopAnd(() => onShare(current))}>Share</ActionChip>
                  <ActionChip icon="copy" disabled={copying} onClick={stopAnd(() => onCopy(current))}>{copying ? 'Copying…' : 'Copy'}</ActionChip>
                </div>
              </>
            ) : (
              <div className="mt-4 flex flex-1 flex-col justify-between rounded-3xl border border-dashed border-white/10 bg-white/[0.025] p-4">
                <p className="text-sm leading-6 text-neutral-400">No {category.title.toLowerCase()} have been added to this clique yet.</p>
                <Link to={scopedHref(category, groupId)} onClick={(event) => event.stopPropagation()} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white bg-white px-3 py-2 text-center text-sm font-black text-neutral-950 shadow-lg shadow-white/10 hover:bg-neutral-200"><AppIcon name="explore" size={16} />Add</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}

function ExploreListModal({ category, groupId, copyingKey, onClose, onInfo, onOpenPile, onShare, onCopy }) {
  if (!category) return null
  const items = category.items || []
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-neutral-950 text-white shadow-2xl shadow-black/50">
        <div className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[0.24em] text-neutral-500">Public ladder</p><h2 className="mt-1 text-3xl font-black">Top {category.title}</h2><p className="mt-2 text-sm text-neutral-400">Explore-style list overview for this clique.</p></div>
          <div className="flex flex-wrap gap-2"><ActionChip icon="explore" active onClick={() => { onClose(); onOpenPile(category, 'swipe') }}>Swipe pile</ActionChip><Link to={scopedHref(category, groupId)} onClick={onClose} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2 text-sm font-black text-white hover:bg-white hover:text-neutral-950"><AppIcon name="explore" size={16} />Open add/search</Link><ActionChip icon="chevronLeft" onClick={onClose}>Close</ActionChip></div>
        </div>
        <div className="max-h-[62vh] overflow-y-auto p-5">
          <div className="space-y-3">
            {items.length ? items.map((item, index) => {
              const image = posterFor(item)
              const saving = copyingKey === actionKey(item, 'copy-')
              const metaLine = metaLineFor(item)
              return (
                <article key={`${item.type}-${item.id}`} className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-3 transition hover:border-white/20 hover:bg-white/[0.05] sm:grid-cols-[auto_1fr_auto] sm:items-center">
                  <div className="flex items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-neutral-950">#{index + 1}</div><button type="button" onClick={() => onInfo(item)} className="h-20 w-16 shrink-0 overflow-hidden rounded-2xl bg-neutral-900">{image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-neutral-400"><AppIcon name={category.icon} size={24} /></div>}</button></div>
                  <button type="button" onClick={() => onInfo(item)} className="min-w-0 text-left"><h3 className="line-clamp-2 text-lg font-black leading-tight text-white">{item.title}</h3>{metaLine ? <p className="mt-1 line-clamp-1 text-xs font-bold text-neutral-300">{metaLine}</p> : null}<p className="mt-1 line-clamp-2 text-sm leading-5 text-neutral-400">{detailsText(item)}</p><div className="mt-2 flex flex-wrap gap-2"><Pill>Score {item.score || 0}</Pill><Pill>{item.picks || 0} picks</Pill>{item.rating ? <Pill>Rating {Number(item.rating).toFixed(1)}</Pill> : null}{item.done ? <Pill light>Done</Pill> : null}</div></button>
                  <div className="flex flex-wrap gap-2 sm:justify-end"><IconBubble icon="info" label={`Info for ${item.title}`} onClick={() => onInfo(item)} /><IconBubble icon="share" label={`Share ${item.title}`} onClick={() => onShare(item)} /><IconBubble icon="copy" label={`Copy ${item.title}`} onClick={() => onCopy(item)} disabled={saving} strong /></div>
                </article>
              )
            }) : <p className="rounded-3xl border border-dashed border-white/10 p-6 text-sm leading-6 text-neutral-400">No {category.title.toLowerCase()} in this clique yet.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

function CardTile({ item, category, saving, onInfo, onShare, onCopy }) {
  const [flipped, setFlipped] = useState(false)
  const image = artFor(item)
  const sourceRating = item.tmdbRating ?? item.rawgRating
  const metaLine = metaLineFor(item)
  const summaryRows = [
    ['Score', item.score || 0],
    ['Picks', item.picks || 0],
    item.rating ? ['Rating', Number(item.rating).toFixed(1)] : null,
    sourceRating !== null && sourceRating !== undefined ? [item.type === 'Game' ? 'RAWG' : 'TMDB', Number(sourceRating).toFixed(1)] : null,
  ].filter(Boolean)
  const toggleFlip = () => setFlipped((value) => !value)
  const stopAnd = (handler) => (event) => { event.stopPropagation(); handler() }
  return (
    <article
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      onClick={toggleFlip}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleFlip() } }}
      className="group relative min-h-[22rem] cursor-pointer rounded-[1.5rem] text-white outline-none [perspective:1400px] focus-visible:ring-2 focus-visible:ring-white/50"
    >
      <div className={`absolute inset-0 rounded-[1.5rem] transition duration-500 [transform-style:preserve-3d] ${flipped ? '[transform:rotateY(180deg)]' : ''}`}>
        <div className="absolute inset-0 overflow-hidden rounded-[1.5rem] border border-white/10 bg-neutral-950 shadow-2xl shadow-black/25 [backface-visibility:hidden] group-hover:border-white/25">
          {image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-78 transition duration-500 group-hover:scale-105" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.14),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,0,0,0.45))]" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/5" />
          <div className="pointer-events-none relative z-20 flex min-h-[22rem] flex-col justify-between p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-950"><AppIcon name={category.icon} size={12} />{category.singular}</span>
              <div className="pointer-events-auto flex gap-2">
                <IconBubble icon="info" label={`Info for ${item.title}`} onClick={stopAnd(() => onInfo(item))} />
                <IconBubble icon="share" label={`Share ${item.title}`} onClick={stopAnd(() => onShare(item))} />
                <IconBubble icon="copy" label={`Copy ${item.title}`} onClick={stopAnd(() => onCopy(item))} disabled={saving} strong />
              </div>
            </div>
            <div className="rounded-[1.35rem] border border-white/10 bg-black/55 p-3 backdrop-blur-sm">
              <h3 className="line-clamp-2 text-2xl font-black leading-tight text-white drop-shadow-lg">{item.title}</h3>
              {metaLine ? <p className="mt-2 line-clamp-1 text-sm font-bold text-neutral-200">{metaLine}</p> : null}
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-neutral-300">{detailsText(item)}</p>
            </div>
          </div>
        </div>
        <div className="absolute inset-0 flex overflow-hidden rounded-[1.5rem] border border-white/15 bg-neutral-950 p-5 shadow-2xl shadow-black/30 [backface-visibility:hidden] [transform:rotateY(180deg)]">
          <div className="flex min-h-full w-full flex-col">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-neutral-300"><AppIcon name={category.icon} size={12} />{category.singular}</p><h3 className="mt-3 text-2xl font-black leading-tight text-white">{item.title}</h3>{metaLine ? <p className="mt-2 text-sm font-semibold text-neutral-400">{metaLine}</p> : null}</div>
              <IconBubble icon="chevronLeft" label="Flip back" onClick={stopAnd(toggleFlip)} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">{summaryRows.map(([label, value]) => <Pill key={label}>{label} {value}</Pill>)}{item.done ? <Pill light>{item.type === 'Series' ? 'Finished' : item.type === 'Game' ? 'Played' : item.type === 'Video' ? 'Classic' : 'Watched'}</Pill> : null}</div>
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-3xl border border-white/10 bg-white/[0.035] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-neutral-500">Full text</p>
              <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-neutral-200">{detailsText(item)}</p>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <ActionChip icon="info" onClick={stopAnd(() => onInfo(item))}>Info</ActionChip>
              <ActionChip icon="share" onClick={stopAnd(() => onShare(item))} active>Share</ActionChip>
              <ActionChip icon="copy" disabled={saving} onClick={stopAnd(() => onCopy(item))}>{saving ? 'Copying…' : 'Copy'}</ActionChip>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

function PilePanel({ category, groupId, mode, swiped, copyingKey, onMode, onSwipe, onClose, onInfo, onShare, onCopy }) {
  if (!category) return null
  const items = category.items || []
  const deckItems = items.filter((item) => !swiped[actionKey(item, `${category.key}-`)]).slice(0, 12)
  const isCards = mode === 'cards'
  return (
    <section className="mt-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-5" id="clique-category-panel">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div><p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.24em] text-neutral-500"><AppIcon name={category.icon} size={14} />{isCards ? 'Cards view' : 'Swipe pile'}</p><h2 className="mt-1 text-3xl font-black text-white">{category.title} in this clique</h2><p className="mt-2 text-sm text-neutral-400">{isCards ? 'Each card shows year, genres, and a quick summary on the front. Flip it for the full text view.' : 'Toggle between a swipe pile and a flippable card overview without leaving this page.'}</p></div>
        <div className="flex flex-wrap gap-2"><ActionChip icon="explore" active={!isCards} onClick={() => onMode('swipe')}>Swipe</ActionChip><ActionChip icon="list" active={isCards} onClick={() => onMode('cards')}>Cards</ActionChip><Link to={scopedHref(category, groupId)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-2 text-sm font-black text-white hover:bg-white hover:text-neutral-950"><AppIcon name="explore" size={16} />Add/search</Link><ActionChip icon="chevronLeft" onClick={onClose}>Close</ActionChip></div>
      </div>
      {isCards ? <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.length ? items.map((item) => <CardTile key={`${item.type}-${item.id}`} item={item} category={category} saving={copyingKey === actionKey(item, 'copy-')} onInfo={onInfo} onShare={onShare} onCopy={onCopy} />) : <p className="rounded-3xl border border-dashed border-white/10 p-6 text-sm leading-6 text-neutral-400">No {category.title.toLowerCase()} in this clique yet.</p>}</div> : <div className="mt-6"><SwipeDeck items={deckItems} onSwipe={(vote, item) => onSwipe(category, item, vote)} itemLabel={category.title.toLowerCase()} emptyLabel={`No ${category.title.toLowerCase()} left in this pile`} likeLabel="Keep" dislikeLabel="Pass" infoType={category.singular.toLowerCase()} /></div>}
    </section>
  )
}

function ContentRow({ item, onInfo }) {
  const image = posterFor(item)
  const metaLine = metaLineFor(item)
  return <button type="button" onClick={() => onInfo(item)} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-neutral-950/70 p-2 text-left transition hover:border-white/25 hover:bg-white/[0.06]"><div className="h-14 w-16 shrink-0 overflow-hidden rounded-xl bg-neutral-900">{image ? <img src={image} alt="" className="h-full w-full object-cover opacity-90" /> : <div className="flex h-full w-full items-center justify-center text-neutral-500"><AppIcon name={item.icon || 'explore'} size={17} /></div>}</div><div className="min-w-0 flex-1"><p className="truncate font-black text-white">{item.title}</p><p className="mt-0.5 truncate text-xs text-neutral-500">{item.type}{metaLine ? ` · ${metaLine}` : ''} · Score {item.score || 0} · {item.picks || 0} picks</p></div></button>
}

function CliqueItemDetailModal({ item, groupName, saving, onShare, onCopy, onClose }) {
  const [copyHintOpen, setCopyHintOpen] = useState(false)
  useEffect(() => { setCopyHintOpen(false) }, [item])
  if (!item) return null
  const category = CATEGORY_META.find((entry) => entry.singular === item.type) || { icon: item.icon || 'explore', singular: item.type || 'Pick' }
  const releaseValue = (() => { try { return item.released ? new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short' }).format(new Date(item.released)) : item.year } catch { return item.year } })()
  const creator = item.director || item.regie || item.creator || item.createdBy || item.developer
  const sourceRating = item.tmdbRating ?? item.rawgRating
  const image = posterFor(item)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><article className="grid max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-neutral-950/95 shadow-2xl shadow-black/50 md:grid-cols-[0.82fr_1fr]"><div className="relative min-h-72 bg-neutral-900">{image ? <img src={image} alt="" className="h-full max-h-[90vh] w-full object-cover" /> : <div className="flex h-full min-h-72 items-center justify-center text-white"><AppIcon name={category.icon} size={72} strokeWidth={1.5} /></div>}<div className="absolute left-4 top-4"><CategoryBadge item={item} category={category} /></div></div><div className="flex max-h-[90vh] flex-col overflow-y-auto p-6"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><h2 className="text-3xl font-black leading-tight text-white">{item.title}</h2><p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-400"><span className="inline-flex items-center gap-1.5"><AppIcon name="users" size={14} />{groupName}</span><span className="text-neutral-600">·</span><span className="inline-flex items-center gap-1.5"><AppIcon name="user" size={14} />Added by <span className="font-semibold text-neutral-200">{item.nominated_by || item.nominatedBy || 'Someone'}</span></span></p></div><button type="button" onClick={onClose} className="text-2xl text-neutral-400 hover:text-white">×</button></div><dl className="mt-4 flex flex-wrap gap-2"><DetailRow label="Released" value={releaseValue} /><DetailRow label="Runtime" value={item.runtime ? `${item.runtime} min` : null} /><DetailRow label="Director / Regie" value={creator} /><DetailRow label="Seasons" value={item.seasons} /><DetailRow label="Episodes" value={item.episodes} /><DetailRow label="Platforms" value={item.platforms || item.platform} /></dl><GenreChips genres={item.genres} /><section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-4"><h3 className="text-xs uppercase tracking-[0.22em] text-neutral-500">Overview</h3><p className="mt-2 break-words text-sm leading-6 text-neutral-300">{detailsText(item)}</p></section><div className="mt-5 flex flex-wrap gap-2"><Pill>Score {item.score || 0}</Pill><Pill>{item.picks || 0} picks</Pill>{item.rating ? <Pill>Your rating {Number(item.rating).toFixed(1)}</Pill> : null}{sourceRating !== null && sourceRating !== undefined ? <Pill>{item.type === 'Game' ? 'RAWG' : 'TMDB'} {Number(sourceRating).toFixed(1)}</Pill> : null}{item.done ? <Pill light>{item.type === 'Series' ? 'Finished' : item.type === 'Game' ? 'Played' : item.type === 'Video' ? 'Classic' : 'Watched'}</Pill> : null}</div><div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center"><button type="button" onClick={() => onCopy(item)} disabled={saving} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-neutral-950 hover:bg-neutral-200 disabled:opacity-60"><AppIcon name="copy" size={18} />{saving ? 'Copying...' : 'Copy to my library'}</button><button type="button" onClick={() => onShare(item)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white hover:text-neutral-950"><AppIcon name="share" size={18} />Share</button>{item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 px-5 py-3 text-sm font-black text-white hover:bg-white hover:text-neutral-950"><AppIcon name="explore" size={18} />Open link</a> : null}<button type="button" onClick={() => setCopyHintOpen((value) => !value)} className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-neutral-200 hover:bg-white hover:text-neutral-950"><AppIcon name="info" size={20} /></button></div>{copyHintOpen ? <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-neutral-400">Copies this clique pick into your personal library.</p> : null}</div></article></div>
  )
}

export default function CliqueDetail() {
  const { groupId = '' } = useParams()
  const [session, setSession] = useState(null)
  const [group, setGroup] = useState(null)
  const [media, setMedia] = useState({ movies: [], series: [], games: [], videos: [] })
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [heroIndex, setHeroIndex] = useState(0)
  const [activeCategoryKey, setActiveCategoryKey] = useState('')
  const [pileCategoryKey, setPileCategoryKey] = useState('')
  const [listCategoryKey, setListCategoryKey] = useState('')
  const [pileMode, setPileMode] = useState('swipe')
  const [pileSwipes, setPileSwipes] = useState({})
  const [previewIndexes, setPreviewIndexes] = useState({})
  const [sharingItem, setSharingItem] = useState(null)
  const [copyingKey, setCopyingKey] = useState('')

  useEffect(() => {
    if (groupId) setActiveGroup(groupId)
    let cancelled = false
    async function loadClique() {
      setLoading(true); setMessage(null)
      try {
        const nextSession = hasSupabase ? await getCurrentSession().catch(() => null) : null
        if (!cancelled) setSession(nextSession)
        const remoteGroups = hasSupabase && nextSession?.user ? await getRemoteGroups().catch(() => []) : []
        const currentGroup = remoteGroups.find((item) => item.id === groupId) || getActiveGroup() || { id: groupId, name: 'Clique', members: [] }
        const [movies, series, games, videos] = hasSupabase && nextSession?.user ? await Promise.all([getMovies(groupId), getSeries(groupId), getGames(groupId), getVideos(groupId)]) : [[], [], [], []]
        if (!cancelled) { setGroup(currentGroup); setMedia({ movies, series, games, videos }) }
      } catch (error) { if (!cancelled) { setMessage({ type: 'error', text: error.message || 'Could not load this clique.' }); setGroup({ id: groupId, name: 'Clique', members: [] }); setMedia({ movies: [], series: [], games: [], videos: [] }) } }
      finally { if (!cancelled) setLoading(false) }
    }
    loadClique(); return () => { cancelled = true }
  }, [groupId])

  const categories = useMemo(() => {
    const rows = { movies: media.movies, series: media.series, games: media.games, videos: media.videos }
    return CATEGORY_META.map((meta) => { const items = normalizeItems(rows[meta.key], meta); return { ...meta, items, count: items.length, score: items.reduce((sum, item) => sum + Number(item.score || 0), 0), picks: items.reduce((sum, item) => sum + Number(item.picks || 0), 0), done: items.filter((item) => item.done || item.rating).length } })
  }, [media])

  useEffect(() => { const timer = window.setInterval(() => setHeroIndex((current) => (current + 1) % CATEGORY_META.length), 4200); return () => window.clearInterval(timer) }, [])

  const allItems = useMemo(() => categories.flatMap((category) => category.items).sort((a, b) => b.sortValue - a.sortValue), [categories])
  const totalItems = allItems.length
  const activeCategories = categories.filter((category) => category.count > 0).length
  const topCategory = categories.slice().sort((a, b) => b.count - a.count || b.score - a.score)[0]
  const heroCategory = categories[heroIndex % categories.length] || categories[0] || CATEGORY_META[0]
  const heroItem = heroCategory?.items?.[0] || null
  const pileCategory = categories.find((category) => category.key === pileCategoryKey) || null
  const listCategory = categories.find((category) => category.key === listCategoryKey) || null
  const groupName = group?.name || 'Clique'
  const selectedSaving = copyingKey === actionKey(selectedItem, 'copy-')

  function openPile(category, mode = 'swipe') { setPileCategoryKey(category.key); setPileMode(mode); setPileSwipes({}); window.setTimeout(() => document.getElementById('clique-category-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50) }
  function handlePileSwipe(category, item) { setPileSwipes((current) => ({ ...current, [actionKey(item, `${category.key}-`)]: true })) }
  function cyclePreview(category, direction) {
    if (!category.items.length) return
    setPreviewIndexes((current) => {
      const previous = current[category.key] || 0
      const next = (previous + direction + category.items.length) % category.items.length
      return { ...current, [category.key]: next }
    })
  }
  async function copyToLibrary(item) {
    if (!item || !hasSupabase || !session?.user) { setMessage({ type: 'error', text: 'Sign in from Profile before copying to My Library.' }); return }
    const key = actionKey(item, 'copy-'); setCopyingKey(key)
    try {
      const nominatedBy = getSavedHandle() || 'anonymous'
      if (item.type === 'Movie') await saveMovie(item, nominatedBy, null)
      else if (item.type === 'Series') await saveSeries(item, nominatedBy, null)
      else if (item.type === 'Game') await saveGame(item, nominatedBy, null)
      else if (item.type === 'Video') await saveVideo(item, nominatedBy, null, item.classic)
      else throw new Error('This content type cannot be copied yet.')
      setMessage({ type: 'success', text: `Copied "${item.title}" to My Library.` })
    } catch (error) { setMessage({ type: 'error', text: error.message || 'Could not copy this item.' }) }
    finally { setCopyingKey('') }
  }

  return (
    <PageShell active="cliques">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] shadow-2xl shadow-black/20"><div className="grid gap-0 xl:grid-cols-[1.05fr_0.95fr]"><div className="p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="text-xs font-black uppercase tracking-[0.3em] text-neutral-500">Clique workspace</p><h1 className="mt-2 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl">{groupName}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">{totalItems} items across {activeCategories} active content types.</p></div><button type="button" onClick={() => setAddOpen(true)} className="inline-flex h-10 w-fit shrink-0 items-center gap-2 rounded-full bg-white px-4 text-sm font-black text-neutral-950 hover:bg-neutral-200"><AppIcon name="explore" size={15} />Add</button></div>{!session?.user && hasSupabase ? <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-neutral-300">Sign in from Profile to add and vote inside cliques.</p> : null}<div className="mt-5 grid gap-3 sm:grid-cols-2">{categories.map((category) => <MiniCategoryTile key={category.key} category={category} onOpenList={(next) => setListCategoryKey(next.key)} />)}</div></div><HeroSlide category={heroCategory} item={heroItem} index={heroIndex % categories.length} total={categories.length || 4} onOpenList={(next) => setListCategoryKey(next.key)} /></div></section>
      <StatusMessage message={message} />
      <section className="mt-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.3em] text-neutral-500">Category overview</p><h2 className="mt-1 text-3xl font-black text-white">Contents at a glance</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">Strongest category: {topCategory?.title || 'none yet'}.</p></div><button type="button" onClick={() => setAddOpen(true)} className="inline-flex h-10 w-fit items-center gap-2 rounded-full border border-white/10 px-4 text-sm font-black text-white hover:bg-white hover:text-neutral-950"><AppIcon name="explore" size={15} />Add</button></div>{loading ? <div className="mt-5 grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((item) => <div key={item} className="h-96 animate-pulse rounded-[1.75rem] bg-white/[0.06]" />)}</div> : <div className="mt-5 grid gap-4 md:grid-cols-2">{categories.map((category) => <CategoryOverviewCard key={category.key} category={category} groupId={groupId} active={activeCategoryKey === category.key} copying={copyingKey === actionKey(category.items[previewIndexes[category.key] || 0], 'copy-')} itemIndex={previewIndexes[category.key] || 0} onCycle={cyclePreview} onToggle={(key) => setActiveCategoryKey((current) => current === key ? '' : key)} onInfo={setSelectedItem} onOpenPile={openPile} onShare={setSharingItem} onCopy={copyToLibrary} />)}</div>}</section>
      <PilePanel category={pileCategory} groupId={groupId} mode={pileMode} swiped={pileSwipes} copyingKey={copyingKey} onMode={setPileMode} onSwipe={handlePileSwipe} onClose={() => setPileCategoryKey('')} onInfo={setSelectedItem} onShare={setSharingItem} onCopy={copyToLibrary} />
      <section className="mt-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.3em] text-neutral-500">Recent content</p><h2 className="mt-1 text-2xl font-black text-white">Latest visible items</h2></div><span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-neutral-300">{allItems.length} total</span></div>{allItems.length ? <div className="mt-4 grid gap-2 md:grid-cols-2">{allItems.slice(0, 8).map((item) => <ContentRow key={`${item.type}-${item.id}`} item={item} onInfo={setSelectedItem} />)}</div> : <p className="mt-4 rounded-3xl border border-dashed border-white/10 p-5 text-sm leading-6 text-neutral-400">Nothing has been added yet. Use Add to start this clique library.</p>}</section>
      <CliqueItemDetailModal item={selectedItem} groupName={groupName} saving={selectedSaving} onShare={setSharingItem} onCopy={copyToLibrary} onClose={() => setSelectedItem(null)} />
      <ExploreListModal category={listCategory} groupId={groupId} copyingKey={copyingKey} onClose={() => setListCategoryKey('')} onInfo={setSelectedItem} onOpenPile={openPile} onShare={setSharingItem} onCopy={copyToLibrary} />
      {sharingItem ? <MemberShareModal item={sharingItem} type={sharingItem?.type?.toLowerCase()} onClose={() => setSharingItem(null)} onMessage={(text) => setMessage({ type: 'success', text })} /> : null}
      {addOpen ? <AddContentModal groupId={groupId} groupName={groupName} onClose={() => setAddOpen(false)} /> : null}
    </PageShell>
  )
}
