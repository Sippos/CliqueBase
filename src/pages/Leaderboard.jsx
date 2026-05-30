import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import PageShell from '../components/PageShell.jsx'
import { getCommunityLeaderboard, hasSupabase } from '../lib/supabaseClient.js'

const featuredCategories = ['Movies', 'Series', 'Games']

function EmptyState() {
  return (
    <section className="rounded-[2rem] border border-dashed border-white/15 bg-white/[0.02] p-6 text-neutral-400">
      <h2 className="text-2xl font-black text-white">No public Explore data yet</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6">Explore stays clean until a clique is made public and has rated movies, series, or games.</p>
      <Link to="/groups" className="mt-5 inline-flex rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-neutral-200">Manage cliques</Link>
    </section>
  )
}

function PickPoster({ item, large = false }) {
  const sizeClass = large ? 'h-72 sm:h-80' : 'h-56'

  if (item?.poster) {
    return <img src={item.poster} alt="" className={`${sizeClass} w-full object-cover`} />
  }

  return (
    <div className={`${sizeClass} flex w-full items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-950`}>
      <div className="text-center">
        <div className="text-5xl">{item?.icon || '★'}</div>
        <p className="mt-3 text-xs uppercase tracking-[0.3em] text-neutral-500">{item?.category || 'Pick'}</p>
      </div>
    </div>
  )
}

function FeaturedPickCard({ item }) {
  if (!item) {
    return (
      <article className="overflow-hidden rounded-[2rem] border border-dashed border-white/15 bg-white/[0.02] p-5">
        <p className="text-xs uppercase tracking-[0.28em] text-neutral-500">No pick yet</p>
        <h3 className="mt-4 text-2xl font-black text-white">Waiting for public ratings</h3>
        <p className="mt-2 text-sm leading-6 text-neutral-400">Once a public clique rates something in this category, the best pick appears here.</p>
      </article>
    )
  }

  return (
    <article className="overflow-hidden rounded-[2rem] border border-white/10 bg-neutral-950 shadow-2xl shadow-black/20">
      <div className="relative">
        <PickPoster item={item} large />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent p-5">
          <p className="text-xs uppercase tracking-[0.28em] text-neutral-300">Best {item.category}</p>
          <h3 className="mt-2 text-3xl font-black leading-tight text-white">{item.title}</h3>
          <p className="mt-1 text-sm text-neutral-300">{item.groupName || 'Public clique'}{item.nominatedBy ? ` · Added by ${item.nominatedBy}` : ''}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 p-4 text-center text-sm">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
          <div className="text-lg font-black text-white">{item.score || 0}</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">Score</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
          <div className="text-lg font-black text-white">{item.picks || 0}</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">Picks</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
          <div className="text-lg font-black text-white">{item.rating ? Number(item.rating).toFixed(1) : '—'}</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">Rating</div>
        </div>
      </div>
    </article>
  )
}

function ContentCard({ item }) {
  return (
    <article className="overflow-hidden rounded-3xl border border-white/10 bg-neutral-900 transition hover:border-white/20">
      <PickPoster item={item} />
      <div className="p-4">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">#{item.rank || '—'} · {item.category} · {item.groupName || 'Public clique'}</p>
        <h3 className="mt-1 line-clamp-2 text-xl font-black text-white">{item.title}</h3>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-neutral-300">
          <span className="rounded-full border border-white/10 px-3 py-1">Score {item.score || 0}</span>
          <span className="rounded-full border border-white/10 px-3 py-1">{item.picks || 0} picks</span>
          {item.rating ? <span className="rounded-full border border-white/10 px-3 py-1">★ {Number(item.rating).toFixed(1)}</span> : null}
          {item.completed ? <span className="rounded-full border border-white/10 px-3 py-1">Completed</span> : null}
        </div>
        {item.nominatedBy ? <p className="mt-3 text-xs text-neutral-500">Added by {item.nominatedBy}</p> : null}
      </div>
    </article>
  )
}

function GroupCard({ group }) {
  return (
    <article className="rounded-3xl border border-white/10 bg-neutral-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Public clique #{group.rank}</p>
          <h3 className="mt-1 truncate text-xl font-black text-white">{group.name}</h3>
          <p className="mt-1 text-sm text-neutral-400">{group.memberCount} members · {group.itemCount} items</p>
        </div>
        <div className="rounded-2xl border border-white/10 px-3 py-2 text-right">
          <div className="text-lg font-black text-white">{Number(group.averageRating || 0).toFixed(1)}</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">Avg</div>
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

  const groups = board.groups || []
  const topContent = board.topContent || []
  const totals = board.totals || {}
  const bestByCategory = useMemo(() => {
    const map = new Map()
    topContent.forEach((item) => {
      if (!map.has(item.category)) map.set(item.category, item)
    })
    return map
  }, [topContent])

  if (loading) return <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-10 text-center text-neutral-400">Loading Explore...</div>
  if (message) return <div className="rounded-[2rem] border border-rose-400/30 bg-rose-950/30 p-5 text-rose-100">{message}</div>
  if (!groups.length && !topContent.length) return <EmptyState />

  return (
    <>
      <section className="mb-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20 sm:p-6">
        <p className="text-xs uppercase tracking-[0.35em] text-neutral-500">Explore</p>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">Global dashboard</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-neutral-400">The best public clique picks by content type, ranked by score, picks, and ratings.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs text-neutral-400 sm:min-w-80">
            <div className="rounded-2xl border border-white/10 bg-neutral-950 px-3 py-3"><strong className="block text-lg text-white">{totals.publicGroups || totals.groups || 0}</strong>Cliques</div>
            <div className="rounded-2xl border border-white/10 bg-neutral-950 px-3 py-3"><strong className="block text-lg text-white">{totals.items || 0}</strong>Items</div>
            <div className="rounded-2xl border border-white/10 bg-neutral-950 px-3 py-3"><strong className="block text-lg text-white">{totals.score || 0}</strong>Score</div>
          </div>
        </div>
      </section>

      <section className="mb-5 grid gap-4 lg:grid-cols-3">
        {featuredCategories.map((category) => <FeaturedPickCard key={category} item={bestByCategory.get(category)} />)}
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_0.72fr]">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Ranked public picks</p>
              <h2 className="mt-1 text-2xl font-black text-white">Best picks across all cliques</h2>
            </div>
            <span className="hidden text-sm text-neutral-500 sm:inline">Movies · Series · Games</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {topContent.slice(0, 8).map((item) => <ContentCard key={`${item.category}-${item.groupId}-${item.id}`} item={item} />)}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Public discovery</p>
            <h2 className="mt-1 text-2xl font-black text-white">Top public cliques</h2>
          </div>
          <div className="space-y-3">
            {groups.slice(0, 6).map((group) => <GroupCard key={group.id} group={group} />)}
          </div>
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
