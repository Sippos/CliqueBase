import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppIcon from '../components/AppIcon.jsx'
import PageShell from '../components/PageShell.jsx'
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

function CategoryBadge({ category }) {
  const meta = getCategoryMeta(category)

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/65 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white shadow-lg shadow-black/30 backdrop-blur">
      <AppIcon name={meta.icon} size={14} strokeWidth={2.2} className="shrink-0" />
      {meta.label}
    </span>
  )
}

function MetricPill({ children }) {
  return <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold text-neutral-200">{children}</span>
}

function InfoButton({ item, onInfo, className = '' }) {
  return (
    <button
      type="button"
      onClick={() => onInfo(item)}
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

function FeaturedPickCard({ item, onInfo }) {
  if (!item) return null

  return (
    <article className="group overflow-hidden rounded-[2rem] border border-white/10 bg-neutral-950 shadow-2xl shadow-black/20 transition hover:-translate-y-0.5 hover:border-white/20">
      <div className="relative">
        <PickPoster item={item} large />
        <div className="absolute left-4 top-4">
          <CategoryBadge category={item.category} />
        </div>
        <InfoButton item={item} onInfo={onInfo} className="absolute right-4 top-4" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/75 to-transparent p-5">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-neutral-300">#{item.rank || '—'} global pick</p>
          <h3 className="mt-2 line-clamp-2 text-3xl font-black leading-tight text-white">{item.title}</h3>
          <p className="mt-1 truncate text-sm text-neutral-300">{item.groupName || 'Public clique'}{item.nominatedBy ? ` · Added by ${item.nominatedBy}` : ''}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <MetricPill>Score {item.score || 0}</MetricPill>
            <MetricPill>{item.picks || 0} picks</MetricPill>
            {item.rating ? <MetricPill>Rating {Number(item.rating).toFixed(1)}</MetricPill> : null}
          </div>
        </div>
      </div>
    </article>
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

function GroupMiniTile({ item, onInfo }) {
  const meta = getCategoryMeta(item?.category)

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/70">
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
        <p className="truncate text-xs font-black text-white">{item.title}</p>
        <p className="mt-0.5 text-[11px] font-semibold text-neutral-500">Score {item.score || 0}</p>
      </div>
    </div>
  )
}

function GroupSummaryCard({ group, onInfo }) {
  const allItems = group.publicItems || group.topItems || []
  const topItems = (group.topItems || allItems).slice(0, 4)
  const categoryCounts = featuredCategories.map((category) => ({
    category,
    count: allItems.filter((item) => item.category === category).length,
  }))

  return (
    <article className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-4 shadow-2xl shadow-black/20 backdrop-blur transition hover:border-white/20 hover:bg-white/[0.05]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">Public clique #{group.rank}</p>
          <h3 className="mt-1 truncate text-2xl font-black text-white">{group.name}</h3>
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

      <div className="mt-4 grid grid-cols-2 gap-2">
        {topItems.length ? topItems.map((item) => <GroupMiniTile key={`${group.id}-${item.category}-${item.id}`} item={{ ...item, groupName: group.name }} onInfo={onInfo} />) : (
          <div className="col-span-2 rounded-2xl border border-dashed border-white/10 bg-neutral-950/50 p-4 text-sm text-neutral-500">No public picks in this clique yet.</div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {categoryCounts.map(({ category, count }) => {
          const meta = getCategoryMeta(category)
          return (
            <span key={category} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">
              <AppIcon name={meta.icon} size={13} strokeWidth={2.2} />
              {count} {meta.plural}
            </span>
          )
        })}
      </div>
    </article>
  )
}

function copyPayload(item) {
  return {
    ...item,
    id: String(item.id),
    nominated_by: item.nominatedBy || item.nominated_by || 'public clique',
  }
}

function formatDate(value) {
  if (!value) return null
  try {
    return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value))
  } catch {
    return value
  }
}

function detailValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ')
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

function DetailRow({ label, value }) {
  const normalized = detailValue(value)
  if (!normalized) return null

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
      <dt className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold leading-5 text-white">{normalized}</dd>
    </div>
  )
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
    nominatedBy: base.nominatedBy,
    score: base.score,
    picks: base.picks,
    rating: base.rating,
    completed: base.completed,
  }
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
  const releaseLabel = displayItem.category === 'Games' ? 'Released' : 'Release'
  const sourceRating = displayItem.tmdbRating ?? displayItem.rawgRating
  const creator = displayItem.director || displayItem.regie || displayItem.creator || displayItem.createdBy || displayItem.developer
  const showEmptyMetadata = !detailsLoading && !hasMetadata(displayItem)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <article className="grid max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/10 bg-neutral-950 shadow-2xl shadow-black/50 md:grid-cols-[0.8fr_1fr]">
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

        <div className="flex max-h-[90vh] flex-col overflow-y-auto p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">{meta.label} info</p>
              <h2 className="mt-2 text-3xl font-black leading-tight text-white">{displayItem.title}</h2>
              <p className="mt-2 text-sm text-neutral-400">{displayItem.groupName || 'Public clique'}{displayItem.nominatedBy ? ` · Added by ${displayItem.nominatedBy}` : ''}</p>
            </div>
            <button type="button" onClick={onClose} className="text-2xl text-neutral-400 transition hover:text-white">×</button>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <MetricPill>Score {displayItem.score || 0}</MetricPill>
            <MetricPill>{displayItem.picks || 0} picks</MetricPill>
            {displayItem.rating ? <MetricPill>Your rating {Number(displayItem.rating).toFixed(1)}</MetricPill> : null}
            {sourceRating !== null && sourceRating !== undefined ? <MetricPill>{displayItem.category === 'Games' ? 'RAWG' : 'TMDB'} {Number(sourceRating).toFixed(1)}</MetricPill> : null}
            {displayItem.completed ? <MetricPill>Completed</MetricPill> : null}
          </div>

          {detailsLoading ? <p className="mt-4 text-sm text-neutral-500">Loading API details…</p> : null}
          {detailsError && !hasMetadata(displayItem) ? <p className="mt-4 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-3 text-xs leading-5 text-yellow-100">{detailsError}</p> : null}

          <dl className="mt-5 grid grid-cols-2 gap-2">
            <DetailRow label="Year" value={displayItem.year} />
            <DetailRow label={releaseLabel} value={formatDate(displayItem.released)} />
            <DetailRow label="Genres" value={displayItem.genres} />
            <DetailRow label="Director / Regie" value={creator} />
            <DetailRow label="Runtime" value={displayItem.runtime ? `${displayItem.runtime} min` : null} />
            <DetailRow label="Seasons" value={displayItem.seasons} />
            <DetailRow label="Episodes" value={displayItem.episodes} />
            <DetailRow label="Platforms" value={displayItem.platforms || displayItem.platform} />
          </dl>

          {showEmptyMetadata ? (
            <p className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-neutral-400">
              No extra media metadata is available for this item yet. Apply the latest public leaderboard SQL migration and make sure the item was saved from the TMDB/RAWG detail API so year, genre, runtime, and overview can be stored.
            </p>
          ) : null}

          {displayItem.overview || displayItem.description ? (
            <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <h3 className="text-xs uppercase tracking-[0.22em] text-neutral-500">Overview</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-300">{displayItem.overview || displayItem.description}</p>
            </section>
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
  const [savingItem, setSavingItem] = useState(false)

  useEffect(() => {
    if (!hasSupabase) return
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
  const bestByCategory = useMemo(() => {
    const map = new Map()
    topContent.forEach((item) => {
      if (!map.has(item.category)) map.set(item.category, item)
    })
    return map
  }, [topContent])
  const featuredItems = featuredCategories
    .map((category) => bestByCategory.get(category))
    .filter(Boolean)

  if (loading) return <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-10 text-center text-neutral-400">Loading Explore...</div>
  if (message && !topContent.length && !groups.length) return <div className="rounded-[2rem] border border-rose-400/30 bg-rose-950/30 p-5 text-rose-100">{message}</div>
  if (!topContent.length && !groups.length) return <EmptyState />

  return (
    <>
      {message ? <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950 shadow-2xl">{message}</div> : null}

      {featuredItems.length ? (
        <section className="mb-6 pt-1">
          <h1 className="mb-3 px-1 text-2xl font-black text-white sm:text-3xl">Top public picks</h1>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featuredItems.map((item) => <FeaturedPickCard key={`${item.category}-${item.groupId}-${item.id}`} item={item} onInfo={setSelectedItem} />)}
          </div>
        </section>
      ) : null}

      {groups.length ? (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.025] p-4 shadow-2xl shadow-black/20 backdrop-blur sm:p-5">
          <div className="mb-4 px-1">
            <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Public cliques</p>
            <h2 className="mt-1 text-2xl font-black text-white">Public Cliques</h2>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {groups.slice(0, 10).map((group) => <GroupSummaryCard key={group.id} group={group} onInfo={setSelectedItem} />)}
          </div>
        </section>
      ) : null}

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
