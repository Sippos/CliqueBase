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

function ContentCard({ item }) {
  return (
    <article className="group overflow-hidden rounded-3xl border border-white/10 bg-neutral-900 transition hover:-translate-y-0.5 hover:border-white/20">
      <div className="relative">
        <PickPoster item={item} />
        <div className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/70 px-3 py-1 text-xs font-black text-white shadow-lg shadow-black/30 backdrop-blur">
          #{item.rank || '—'}
        </div>
        <div className="absolute right-3 top-3">
          <CategoryBadge category={item.category} />
        </div>
      </div>
      <div className="p-4">
        <h3 className="line-clamp-2 text-xl font-black leading-tight text-white">{item.title}</h3>
        <p className="mt-2 truncate text-sm text-neutral-400">{item.groupName || 'Public clique'}{item.nominatedBy ? ` · Added by ${item.nominatedBy}` : ''}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <MetricPill>Score {item.score || 0}</MetricPill>
          <MetricPill>{item.picks || 0} picks</MetricPill>
          {item.rating ? <MetricPill>Rating {Number(item.rating).toFixed(1)}</MetricPill> : null}
          {item.completed ? <MetricPill>Completed</MetricPill> : null}
        </div>
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
  if (!topContent.length) return <EmptyState />

  return (
    <>
      <section className="mb-5 px-1">
        <p className="text-xs uppercase tracking-[0.35em] text-neutral-500">Explore</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">Community rankings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">The best movies, series, and games from public cliques, ranked globally by score, picks, and ratings.</p>
      </section>

      {featuredItems.length ? (
        <section className="mb-6">
          <div className="mb-3 flex items-end justify-between gap-3 px-1">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Best by category</p>
              <h2 className="mt-1 text-2xl font-black text-white">Top public picks</h2>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {featuredItems.map((item) => <FeaturedPickCard key={`${item.category}-${item.groupId}-${item.id}`} item={item} />)}
          </div>
        </section>
      ) : null}

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
        <div className="mb-4 px-1">
          <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Global ranking</p>
          <h2 className="mt-1 text-2xl font-black text-white">Best ranked content</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {topContent.slice(0, 12).map((item) => <ContentCard key={`${item.category}-${item.groupId}-${item.id}`} item={item} />)}
        </div>
      </section>
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
