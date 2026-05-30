import { useEffect, useMemo, useState } from 'react'
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

function itemKey(item, prefix = '') {
  if (!item) return prefix || 'item'
  return `${prefix}${item.groupId || item.groupName || 'global'}-${item.category}-${item.id}`
}

function getNominator(item) {
  return item?.nominatedBy || item?.nominated_by || ''
}

function sortByRank(items = []) {
  return items.slice().sort((a, b) => (
    (Number(a.categoryRank || a.rank || 9999) - Number(b.categoryRank || b.rank || 9999))
    || (Number(b.score || 0) - Number(a.score || 0))
    || (Number(b.picks || 0) - Number(a.picks || 0))
    || String(a.title || '').localeCompare(String(b.title || ''))
  ))
}

function copyPayload(item) {
  return {
    ...item,
    id: String(item.id),
    nominated_by: getNominator(item) || 'public clique',
  }
}

function formatMonthYear(value) {
  if (!value) return null
  try {
    return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short' }).format(new Date(value))
  } catch {
    return value
  }
}

function detailValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ')
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

function hasMetadata(item) {
  return Boolean(
    item?.year || item?.released || item?.genres?.length || item?.runtime || item?.seasons || item?.episodes || item?.platform || item?.platforms?.length || item?.overview || item?.description || item?.tmdbRating || item?.rawgRating
  )
}

function mergePublicItem(base, details) {
  if (!details) return base
  return {
    ...base,
    ...details,
    id: base.id,
    category: base.category,
    groupId: base.groupId,
    groupName: base.groupName,
    nominatedBy: getNominator(base),
    score: base.score,
    picks: base.picks,
    rating: base.rating,
    completed: base.completed,
  }
}

function CategoryBadge({ category }) {
  const meta = getCategoryMeta(category)

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/65 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white shadow-lg shadow-black/30 backdrop-blur">
      <AppIcon name={meta.icon} size={14} strokeWidth={2.2} className="shrink-0" />
      {meta.label}
    </span>
  )
}

function MetricPill({ children, active = false }) {
  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${active ? 'border-white bg-white text-neutral-950 shadow-lg shadow-white/10' : 'border-white/10 bg-white/[0.05] text-neutral-200'}`}>
      {children}
    </span>
  )
}

function InfoButton({ item, onInfo, className = '' }) {
  return (
    <button
      type="button"
      onClick={(event) => { event.stopPropagation(); onInfo(item) }}
      aria-label={`Show details for ${item.title}`}
      className={`flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/65 text-white shadow-lg shadow-black/30 backdrop-blur transition hover:bg-white hover:text-neutral-950 ${className}`}
    >
      <AppIcon name="info" size={18} strokeWidth={2.2} />
    </button>
  )
}

function EmptyState() {
  return (
    <section className="rounded-[2rem] border border-dashed border-white/15 bg-white/[0.02] p-6 text-neutral-400">
      <h2 className="text-2xl font-black text-white">No public rankings yet</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6">The Explore dashboard will fill with the best rated public clique picks once movies, series, or games get votes.</p>
      <Link to="/groups" className="mt-5 inline-flex rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-neutral-200">Manage cliques</Link>
    </section>
  )
}

function PickPoster({ item, large = false }) {
  const sizeClass = large ? 'h-64 sm:h-72 lg:h-80' : 'h-52 sm:h-56'
  const meta = getCategoryMeta(item?.category)

  if (item?.poster) {
    return <img src={item.poster} alt="" className={`${sizeClass} w-full object-cover`} />
  }

  return (
    <div className={`${sizeClass} flex w-full items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-950`}>
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white" aria-hidden="true">
          <AppIcon name={meta.icon} size={38} strokeWidth={1.7} />
        </div>
        <p className="mt-3 text-xs uppercase tracking-[0.3em] text-neutral-500">{meta.plural}</p>
      </div>
    </div>
  )
}

function FlipBack({ item, compact = false, saving = false, onCopy, onInfo }) {
  const meta = getCategoryMeta(item.category)
  const summary = item.overview || item.description || `${meta.label} from ${item.groupName || 'a public clique'}.`

  return (
    <div className={`absolute inset-0 flex flex-col rounded-[2rem] border border-white/15 bg-neutral-950 p-4 shadow-2xl shadow-black/40 ${compact ? 'rounded-2xl p-2.5' : ''}`} style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
      <div className="flex items-start justify-between gap-2">
        <span className={`inline-flex items-center justify-center rounded-2xl bg-white text-neutral-950 ${compact ? 'h-8 w-8' : 'h-11 w-11'}`}>
          <AppIcon name={meta.icon} size={compact ? 16 : 20} />
        </span>
        <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">Actions</span>
      </div>

      <h3 className={`${compact ? 'mt-2 line-clamp-2 text-xs' : 'mt-4 line-clamp-2 text-xl'} font-black leading-tight text-white`}>{item.title}</h3>
      <p className={`${compact ? 'mt-1 line-clamp-2 text-[11px] leading-4' : 'mt-2 line-clamp-4 text-sm leading-6'} flex-1 text-neutral-400`}>{summary}</p>

      <div className={`${compact ? 'mt-2 gap-1.5' : 'mt-4 gap-2'} grid grid-cols-2`}>
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); onCopy(item) }}
          disabled={saving}
          className={`${compact ? 'rounded-xl px-2 py-1.5 text-[11px]' : 'rounded-2xl px-3 py-3 text-sm'} inline-flex items-center justify-center gap-1.5 bg-white font-black text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-60`}
        >
          <AppIcon name="dashboard" size={compact ? 13 : 16} />
          {saving ? '...' : 'Copy'}
        </button>
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); onInfo(item) }}
          className={`${compact ? 'rounded-xl px-2 py-1.5 text-[11px]' : 'rounded-2xl px-3 py-3 text-sm'} inline-flex items-center justify-center gap-1.5 border border-white/10 font-black text-white transition hover:bg-white hover:text-neutral-950`}
        >
          <AppIcon name="info" size={compact ? 13 : 16} />
          Info
        </button>
      </div>
      {!compact ? <p className="mt-3 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-600">Tap again to flip back</p> : null}
    </div>
  )
}

function FeaturedPickCard({ item, flipped, saving, onToggle, onInfo, onCopy, className = '', rankLabel = 'global pick' }) {
  if (!item) return null
  const displayRank = item.categoryRank || item.rank || '—'

  function handleKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onToggle(item)
    }
  }

  return (
    <article
      tabIndex={0}
      role="button"
      aria-pressed={flipped}
      aria-label={`${flipped ? 'Hide actions for' : 'Show actions for'} ${item.title}`}
      onClick={() => onToggle(item)}
      onKeyDown={handleKeyDown}
      className={`group relative z-10 outline-none ${className}`}
      style={{ perspective: '1000px' }}
    >
      <div
        className="relative min-h-[20rem] rounded-[2rem] transition-transform duration-500 group-hover:-translate-y-0.5 group-focus-visible:ring-2 group-focus-visible:ring-white/50"
        style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
      >
        <div className="absolute inset-0 overflow-hidden rounded-[2rem] border border-white/10 bg-neutral-950 shadow-2xl shadow-black/20 transition group-hover:border-white/20" style={{ backfaceVisibility: 'hidden' }}>
          <div className="relative">
            <PickPoster item={item} large />
            <div className="absolute left-4 top-4">
              <CategoryBadge category={item.category} />
            </div>
            <InfoButton item={item} onInfo={onInfo} className="absolute right-4 top-4" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/75 to-transparent p-5">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-neutral-300">#{displayRank} {rankLabel}</p>
              <h3 className="mt-2 line-clamp-2 text-3xl font-black leading-tight text-white">{item.title}</h3>
              <p className="mt-1 truncate text-sm text-neutral-300">{item.groupName || 'Public clique'}{getNominator(item) ? ` · Added by ${getNominator(item)}` : ''}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <MetricPill>Score {item.score || 0}</MetricPill>
                <MetricPill>{item.picks || 0} picks</MetricPill>
                {item.rating ? <MetricPill>Rating {Number(item.rating).toFixed(1)}</MetricPill> : null}
              </div>
            </div>
          </div>
        </div>

        <FlipBack item={item} saving={saving} onCopy={onCopy} onInfo={onInfo} />
      </div>
    </article>
  )
}

function FeaturedPickPile({ category, items, flippedKey, saving, onToggle, onInfo, onCopy, onOpenLadder }) {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    setActiveIndex(0)
  }, [category, items.length])

  if (!items.length) return null

  const meta = getCategoryMeta(category)
  const safeIndex = ((activeIndex % items.length) + items.length) % items.length
  const activeItem = items[safeIndex]
  const activeKey = itemKey(activeItem, 'featured-')
  const canStep = items.length > 1

  function stepCard(delta) {
    if (!canStep) return
    setActiveIndex((current) => ((current + delta) % items.length + items.length) % items.length)
  }

  return (
    <div className="relative pt-3 pr-3">
      <div className="pointer-events-none absolute right-0 top-0 h-[20rem] w-[92%] rounded-[2rem] border border-white/10 bg-white/[0.035] shadow-2xl shadow-black/20" />
      <div className="pointer-events-none absolute right-3 top-3 h-[20rem] w-[94%] rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-2xl shadow-black/20" />
      <FeaturedPickCard
        key={activeKey}
        item={activeItem}
        flipped={flippedKey === activeKey}
        saving={saving}
        onToggle={(nextItem) => onToggle(nextItem, 'featured-')}
        onInfo={onInfo}
        onCopy={onCopy}
        rankLabel={`${meta.label.toLowerCase()} pick`}
      />

      <div className="relative z-20 -mt-2 rounded-[1.5rem] border border-white/10 bg-black/35 p-3 backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 pt-0.5">
            <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-neutral-400">
              <AppIcon name={meta.icon} size={14} />
              {items.length} {meta.plural} ranked
            </span>
            <p className="mt-2 truncate text-xs text-neutral-500">Showing #{activeItem.categoryRank || activeItem.rank || safeIndex + 1} of {items.length}</p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <button
              type="button"
              onClick={() => onOpenLadder(category)}
              className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-neutral-950 transition hover:bg-neutral-200"
            >
              Ladder
              <AppIcon name="explore" size={11} />
            </button>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => stepCard(-1)}
                disabled={!canStep}
                aria-label={`Show previous ${meta.label.toLowerCase()} pick`}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-base font-black leading-none text-white transition hover:bg-white hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-white/[0.04] disabled:hover:text-white"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => stepCard(1)}
                disabled={!canStep}
                aria-label={`Show next ${meta.label.toLowerCase()} pick`}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-base font-black leading-none text-white transition hover:bg-white hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-white/[0.04] disabled:hover:text-white"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CategoryLadderModal({ category, items, saving, onInfo, onCopy, onClose }) {
  if (!category) return null

  const meta = getCategoryMeta(category)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <article className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-neutral-950/95 shadow-2xl shadow-black/50">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.26em] text-neutral-500">Public ladder</p>
            <h2 className="mt-1 text-3xl font-black text-white">Top {meta.plural}</h2>
            <p className="mt-2 text-sm text-neutral-400">Browse the full ranked category without replacing the main Explore overview.</p>
          </div>
          <button type="button" onClick={onClose} className="text-2xl text-neutral-400 transition hover:text-white">×</button>
        </div>

        <div className="overflow-y-auto p-4">
          <div className="space-y-3">
            {items.map((item) => {
              const groupPath = item.groupId ? getGroupOpenPath({ id: item.groupId }) : null
              return (
                <article key={itemKey(item, 'ladder-')} className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-3 transition hover:border-white/20 hover:bg-white/[0.05] sm:grid-cols-[auto_1fr_auto] sm:items-center">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-neutral-950">#{item.categoryRank || item.rank || '—'}</div>
                    <div className="h-20 w-16 shrink-0 overflow-hidden rounded-2xl bg-neutral-900">
                      {item.poster ? <img src={item.poster} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-neutral-400"><AppIcon name={meta.icon} size={24} /></div>}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <h3 className="line-clamp-2 text-lg font-black leading-tight text-white">{item.title}</h3>
                    <p className="mt-1 truncate text-sm text-neutral-400">{item.groupName || 'Public clique'}{getNominator(item) ? ` · Added by ${getNominator(item)}` : ''}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <MetricPill>Score {item.score || 0}</MetricPill>
                      <MetricPill>{item.picks || 0} picks</MetricPill>
                      {item.rating ? <MetricPill>Rating {Number(item.rating).toFixed(1)}</MetricPill> : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <button type="button" onClick={() => onInfo(item)} className="inline-flex h-10 items-center gap-2 rounded-2xl border border-white/10 px-3 text-xs font-black text-white transition hover:bg-white hover:text-neutral-950">
                      <AppIcon name="info" size={14} />
                      Info
                    </button>
                    <button type="button" onClick={() => onCopy(item)} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-2xl bg-white px-3 text-xs font-black text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-60">
                      <AppIcon name="dashboard" size={14} />
                      {saving ? '...' : 'Copy'}
                    </button>
                    {groupPath ? (
                      <Link to={groupPath} onClick={onClose} className="inline-flex h-10 items-center gap-2 rounded-2xl border border-white/10 px-3 text-xs font-black text-white transition hover:bg-white hover:text-neutral-950">
                        <AppIcon name="explore" size={14} />
                        Clique
                      </Link>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </article>
    </div>
  )
}

function GroupStat({ icon, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-neutral-300">
      <AppIcon name={icon} size={13} strokeWidth={2.2} className="text-neutral-400" />
      {children}
    </span>
  )
}

function GroupMiniTile({ item, flipped, saving, onToggle, onInfo, onCopy }) {
  const meta = getCategoryMeta(item?.category)

  function handleKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onToggle(item)
    }
  }

  return (
    <div
      tabIndex={0}
      role="button"
      aria-pressed={flipped}
      aria-label={`${flipped ? 'Hide actions for' : 'Show actions for'} ${item.title}`}
      onClick={() => onToggle(item)}
      onKeyDown={handleKeyDown}
      className="min-w-[9rem] snap-start outline-none sm:min-w-[10rem]"
      style={{ perspective: '800px' }}
    >
      <div
        className="relative min-h-[10.5rem] rounded-2xl transition-transform duration-500 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-white/50"
        style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
      >
        <div className="absolute inset-0 overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/70" style={{ backfaceVisibility: 'hidden' }}>
          <div className="relative h-24 overflow-hidden bg-neutral-900">
            {item?.poster ? (
              <img src={item.poster} alt="" className="h-full w-full object-cover opacity-90" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-neutral-300">
                <AppIcon name={meta.icon} size={28} strokeWidth={1.7} />
              </div>
            )}
            <span className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/65 text-white backdrop-blur">
              <AppIcon name={meta.icon} size={14} strokeWidth={2.2} />
            </span>
            <InfoButton item={item} onInfo={onInfo} className="absolute right-2 top-2 h-7 w-7" />
          </div>
          <div className="p-2">
            <p className="line-clamp-2 text-xs font-black leading-tight text-white">{item.title}</p>
            <p className="mt-1 text-[11px] font-semibold text-neutral-500">Score {item.score || 0}</p>
          </div>
        </div>

        <FlipBack item={item} compact saving={saving} onCopy={onCopy} onInfo={onInfo} />
      </div>
    </div>
  )
}

function GroupSummaryCard({ group, onInfo, onCopy, saving, flippedKey, onToggle }) {
  const allItems = group.publicItems || group.topItems || []
  const displayItems = sortByRank(allItems).slice(0, 8)
  const groupPath = getGroupOpenPath(group)

  return (
    <article className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-4 shadow-2xl shadow-black/20 backdrop-blur transition hover:border-white/20 hover:bg-white/[0.05]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">#{group.rank} public clique</p>
          <Link to={groupPath} className="mt-1 block truncate text-2xl font-black text-white transition hover:text-neutral-200">{group.name}</Link>
        </div>
        <div className="rounded-2xl border border-white/10 bg-neutral-950/70 px-3 py-2 text-right">
          <div className="text-lg font-black text-white">{Number(group.averageRating || 0).toFixed(1)}</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">Avg</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <GroupStat icon="users">{group.memberCount || 0} members</GroupStat>
        <GroupStat icon="explore">{group.itemCount || 0} items</GroupStat>
        <GroupStat icon="dashboard">Score {group.totalScore || 0}</GroupStat>
      </div>

      <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-neutral-950/45 p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
            <AppIcon name="explore" size={13} />
            Top picks
          </span>
          <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-black text-neutral-500">{allItems.length} in ladder</span>
        </div>
        {displayItems.length ? (
          <div className="flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {displayItems.map((item) => {
              const enrichedItem = { ...item, groupId: group.id, groupName: group.name }
              const flipKey = itemKey(enrichedItem, 'mini-')
              return (
                <GroupMiniTile
                  key={flipKey}
                  item={enrichedItem}
                  flipped={flippedKey === flipKey}
                  saving={saving}
                  onToggle={(nextItem) => onToggle(nextItem, 'mini-')}
                  onInfo={onInfo}
                  onCopy={onCopy}
                />
              )
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-neutral-950/50 p-4 text-sm text-neutral-500">No public picks in this clique yet.</div>
        )}
      </div>

      <Link to={groupPath} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-white transition hover:bg-white hover:text-neutral-950">
        <AppIcon name="explore" size={16} />
        Open public clique
      </Link>
    </article>
  )
}

function DetailRow({ label, value }) {
  const normalized = detailValue(value)
  if (!normalized) return null

  return (
    <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.025] px-3 py-1.5">
      <dt className="text-[9px] font-bold uppercase tracking-[0.16em] text-neutral-500">{label}</dt>
      <dd className="text-[13px] font-semibold leading-none text-white">{normalized}</dd>
    </div>
  )
}

function GenreChips({ genres }) {
  const values = Array.isArray(genres)
    ? genres.filter(Boolean)
    : detailValue(genres)?.split(',').map((genre) => genre.trim()).filter(Boolean) || []

  if (!values.length) return null

  return (
    <section className="mt-4">
      <h3 className="text-[10px] font-bold uppercase tracking-[0.22em] text-neutral-500">Genres</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((genre) => (
          <span key={genre} className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-neutral-200">
            {genre}
          </span>
        ))}
      </div>
    </section>
  )
}

function SourceLine({ item }) {
  const groupName = item.groupName || 'Public clique'
  const nominatedBy = getNominator(item) || 'Someone'

  return (
    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-400">
      <span className="inline-flex items-center gap-1.5">
        <AppIcon name="users" size={14} strokeWidth={2.2} />
        {groupName}
      </span>
      <span className="text-neutral-600">·</span>
      <span className="inline-flex items-center gap-1.5">
        <AppIcon name="user" size={14} strokeWidth={2.2} />
        Suggested by <span className="font-semibold text-neutral-200">{nominatedBy}</span>
      </span>
    </p>
  )
}

function WatchedLabel({ category }) {
  if (category === 'Series') return 'Finished'
  if (category === 'Games') return 'Played'
  return 'Watched'
}

function DetailModal({ item, saving, onCopy, onClose }) {
  const [copyHintOpen, setCopyHintOpen] = useState(false)
  const [details, setDetails] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [detailsError, setDetailsError] = useState(null)

  useEffect(() => {
    setCopyHintOpen(false)
    setDetails(null)
    setDetailsError(null)

    if (!item) return undefined

    let cancelled = false

    async function loadDetails() {
      setDetailsLoading(true)
      try {
        let nextDetails = null
        if (item.category === 'Movies') nextDetails = await getMovieDetails(item)
        else if (item.category === 'Series') nextDetails = await getSeriesDetails(item)
        else if (item.category === 'Games') nextDetails = await getGameDetails(item)

        if (!cancelled) setDetails(nextDetails)
      } catch (error) {
        if (!cancelled) setDetailsError(error.message || 'Could not load API details.')
      } finally {
        if (!cancelled) setDetailsLoading(false)
      }
    }

    loadDetails()
    return () => { cancelled = true }
  }, [item])

  if (!item) return null

  const displayItem = mergePublicItem(item, details)
  const meta = getCategoryMeta(displayItem.category)
  const sourceRating = displayItem.tmdbRating ?? displayItem.rawgRating
  const creator = displayItem.director || displayItem.regie || displayItem.creator || displayItem.createdBy || displayItem.developer
  const releaseValue = formatMonthYear(displayItem.released) || displayItem.year
  const showEmptyMetadata = !detailsLoading && !hasMetadata(displayItem)
  const groupPath = displayItem.groupId ? getGroupOpenPath({ id: displayItem.groupId }) : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <article className="grid max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-neutral-950/95 shadow-2xl shadow-black/50 md:grid-cols-[0.82fr_1fr]">
        <div className="relative min-h-72 bg-neutral-900">
          {displayItem.poster ? (
            <img src={displayItem.poster} alt="" className="h-full max-h-[90vh] w-full object-cover" />
          ) : (
            <div className="flex h-full min-h-72 items-center justify-center text-white">
              <AppIcon name={meta.icon} size={72} strokeWidth={1.5} />
            </div>
          )}
          <div className="absolute left-4 top-4">
            <CategoryBadge category={displayItem.category} />
          </div>
        </div>

        <div className="flex max-h-[90vh] flex-col overflow-y-auto p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-3xl font-black leading-tight text-white">{displayItem.title}</h2>
              <SourceLine item={displayItem} />
            </div>
            <button type="button" onClick={onClose} className="text-2xl text-neutral-400 transition hover:text-white">×</button>
          </div>

          <dl className="mt-4 flex flex-wrap gap-2">
            <DetailRow label="Released" value={releaseValue} />
            <DetailRow label="Runtime" value={displayItem.runtime ? `${displayItem.runtime} min` : null} />
            <DetailRow label="Director / Regie" value={creator} />
            <DetailRow label="Seasons" value={displayItem.seasons} />
            <DetailRow label="Episodes" value={displayItem.episodes} />
            <DetailRow label="Platforms" value={displayItem.platforms || displayItem.platform} />
          </dl>

          <GenreChips genres={displayItem.genres} />

          {detailsLoading ? <p className="mt-4 text-sm text-neutral-500">Loading API details…</p> : null}
          {detailsError && !hasMetadata(displayItem) ? <p className="mt-4 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-3 text-xs leading-5 text-yellow-100">{detailsError}</p> : null}

          {displayItem.overview || displayItem.description ? (
            <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-xs uppercase tracking-[0.22em] text-neutral-500">Overview</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-300">{displayItem.overview || displayItem.description}</p>
            </section>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <MetricPill>Score {displayItem.score || 0}</MetricPill>
            <MetricPill>{displayItem.picks || 0} picks</MetricPill>
            {displayItem.rating ? <MetricPill>Your rating {Number(displayItem.rating).toFixed(1)}</MetricPill> : null}
            {sourceRating !== null && sourceRating !== undefined ? <MetricPill>{displayItem.category === 'Games' ? 'RAWG' : 'TMDB'} {Number(sourceRating).toFixed(1)}</MetricPill> : null}
            {displayItem.completed ? <MetricPill active><WatchedLabel category={displayItem.category} /></MetricPill> : null}
          </div>

          {showEmptyMetadata ? (
            <p className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-neutral-400">
              No extra media metadata is available for this item yet. Apply the latest public leaderboard SQL migration and make sure the item was saved from the TMDB/RAWG detail API so year, genre, runtime, and overview can be stored.
            </p>
          ) : null}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => onCopy(displayItem)}
              disabled={saving}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-60"
            >
              <AppIcon name="dashboard" size={18} />
              {saving ? 'Copying...' : 'Copy to my library'}
            </button>
            {groupPath ? (
              <Link to={groupPath} onClick={onClose} className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white hover:text-neutral-950">
                <AppIcon name="explore" size={18} />
                Open clique
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => setCopyHintOpen((value) => !value)}
              aria-label="What does copy to my library do?"
              className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-neutral-200 transition hover:bg-white hover:text-neutral-950"
            >
              <AppIcon name="info" size={20} strokeWidth={2.2} />
            </button>
          </div>

          {copyHintOpen ? (
            <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-neutral-400">
              Copies this public pick into your personal library so you can rate it, mark it watched/played, or add it to your own cliques later.
            </p>
          ) : null}
        </div>
      </article>
    </div>
  )
}

function ExploreBoard() {
  const [board, setBoard] = useState({ groups: [], topContent: [], totals: {} })
  const [loading, setLoading] = useState(hasSupabase)
  const [message, setMessage] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [activeLadder, setActiveLadder] = useState(null)
  const [savingItem, setSavingItem] = useState(false)
  const [flippedKey, setFlippedKey] = useState(null)

  useEffect(() => {
    if (!hasSupabase) return undefined
    let cancelled = false

    async function loadBoard() {
      setLoading(true)
      try {
        const data = await getCommunityLeaderboard()
        if (!cancelled) setBoard(data)
      } catch (error) {
        if (!cancelled) setMessage(error.message || 'Could not load Explore.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadBoard()
    return () => { cancelled = true }
  }, [])

  function toggleTile(item, prefix = '') {
    const key = itemKey(item, prefix)
    setFlippedKey((current) => current === key ? null : key)
  }

  async function copyToLibrary(item) {
    setSavingItem(true)
    try {
      const payload = copyPayload(item)
      if (item.category === 'Movies') await saveMovie(payload, payload.nominated_by)
      else if (item.category === 'Series') await saveSeries(payload, payload.nominated_by)
      else if (item.category === 'Games') await saveGame(payload, payload.nominated_by)
      else throw new Error('This content type cannot be copied yet.')
      setMessage(`${item.title} copied to your library.`)
      setSelectedItem(null)
      setFlippedKey(null)
      setTimeout(() => setMessage(null), 2500)
    } catch (error) {
      setMessage(error.message || 'Could not copy this pick.')
      setTimeout(() => setMessage(null), 3500)
    } finally {
      setSavingItem(false)
    }
  }

  const groups = board.groups || []
  const topContent = board.topContent || []
  const categoryPiles = useMemo(() => featuredCategories
    .map((category) => {
      const items = sortByRank(topContent.filter((item) => item.category === category))
        .map((item, index) => ({ ...item, categoryRank: index + 1 }))
      return { category, items }
    })
    .filter((pile) => pile.items.length), [topContent])
  const activeLadderItems = useMemo(() => categoryPiles.find((pile) => pile.category === activeLadder)?.items || [], [activeLadder, categoryPiles])

  if (loading) return <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-10 text-center text-neutral-400">Loading Explore...</div>
  if (message && !topContent.length && !groups.length) return <div className="rounded-[2rem] border border-rose-400/30 bg-rose-950/30 p-5 text-rose-100">{message}</div>
  if (!topContent.length && !groups.length) return <EmptyState />

  return (
    <>
      {message ? <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950 shadow-2xl">{message}</div> : null}

      {categoryPiles.length ? (
        <section className="mb-8 pt-1">
          <div className="mb-4 flex flex-col gap-3 px-1 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-neutral-500">Explore</p>
              <h1 className="mt-1 text-3xl font-black text-white">Top public picks</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">Best public pick per media type. Use the arrows to preview second and third picks, or open the full ladder.</p>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-neutral-300">
              <AppIcon name="explore" size={15} />
              {topContent.length} public picks
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {categoryPiles.map((pile) => (
              <FeaturedPickPile
                key={pile.category}
                category={pile.category}
                items={pile.items}
                flippedKey={flippedKey}
                saving={savingItem}
                onToggle={toggleTile}
                onInfo={setSelectedItem}
                onCopy={copyToLibrary}
                onOpenLadder={setActiveLadder}
              />
            ))}
          </div>
        </section>
      ) : null}

      {groups.length ? (
        <section>
          <div className="mb-4 flex flex-col gap-2 px-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-neutral-500">Public discovery</p>
              <h2 className="mt-1 text-3xl font-black text-white">Top Cliques</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">Open a public clique to continue from the preview into its full shared ladder.</p>
            </div>
            <span className="w-fit rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-neutral-300">{groups.length} public</span>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {groups.slice(0, 10).map((group) => (
              <GroupSummaryCard
                key={group.id}
                group={group}
                onInfo={setSelectedItem}
                onCopy={copyToLibrary}
                saving={savingItem}
                flippedKey={flippedKey}
                onToggle={toggleTile}
              />
            ))}
          </div>
        </section>
      ) : null}

      <CategoryLadderModal
        category={activeLadder}
        items={activeLadderItems}
        saving={savingItem}
        onInfo={(item) => { setActiveLadder(null); setSelectedItem(item) }}
        onCopy={copyToLibrary}
        onClose={() => setActiveLadder(null)}
      />
      <DetailModal item={selectedItem} saving={savingItem} onCopy={copyToLibrary} onClose={() => setSelectedItem(null)} />
    </>
  )
}

export default function Leaderboard() {
  return (
    <PageShell active="explore">
      <ExploreBoard />
    </PageShell>
  )
}
