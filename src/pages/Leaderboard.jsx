import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppIcon from '../components/AppIcon.jsx'
import PageShell from '../components/PageShell.jsx'
import { getCommunityLeaderboard, hasSupabase } from '../lib/supabaseClient.js'

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

function FeaturedPickCard({ item }) {
  if (!item) return null

  return (
    <article className="group overflow-hidden rounded-[2rem] border border-white/10 bg-neutral-950 shadow-2xl shadow-black/20 transition hover:-translate-y-0.5 hover:border-white/20">
      <div className="relative">
        <PickPoster item={item} large />
        <div className="absolute left-4 top-4">
          <CategoryBadge category={item.category} />
        </div>
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

function GroupMiniTile({ item }) {
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
      </div>
      <div className="p-2">
        <p className="truncate text-xs font-black text-white">{item.title}</p>
        <p className="mt-0.5 text-[11px] font-semibold text-neutral-500">Score {item.score || 0}</p>
      </div>
    </div>
  )
}

function GroupSummaryCard({ group }) {
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
        {topItems.length ? topItems.map((item) => <GroupMiniTile key={`${group.id}-${item.category}-${item.id}`} item={item} />) : (
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

function ExploreBoard() {
  const [board, setBoard] = useState({ groups: [], topContent: [], totals: {} })
  const [loading, setLoading] = useState(hasSupabase)
  const [message, setMessage] = useState(null)

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
  if (message) return <div className="rounded-[2rem] border border-rose-400/30 bg-rose-950/30 p-5 text-rose-100">{message}</div>
  if (!topContent.length && !groups.length) return <EmptyState />

  return (
    <>
      {featuredItems.length ? (
        <section className="mb-6 pt-1">
          <h1 className="mb-3 px-1 text-2xl font-black text-white sm:text-3xl">Top public picks</h1>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featuredItems.map((item) => <FeaturedPickCard key={`${item.category}-${item.groupId}-${item.id}`} item={item} />)}
          </div>
        </section>
      ) : null}

      {groups.length ? (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.025] p-4 shadow-2xl shadow-black/20 backdrop-blur sm:p-5">
          <div className="mb-4 px-1">
            <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Public cliques</p>
            <h2 className="mt-1 text-2xl font-black text-white">Group summaries</h2>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {groups.slice(0, 10).map((group) => <GroupSummaryCard key={group.id} group={group} />)}
          </div>
        </section>
      ) : null}
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
