import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageShell from '../components/PageShell.jsx'
import { getCommunityLeaderboard, hasSupabase } from '../lib/supabaseClient.js'

function StatCard({ label, value, detail }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">{label}</p>
      <h2 className="mt-2 truncate text-2xl font-black text-white">{value}</h2>
      <p className="mt-1 text-sm text-neutral-400">{detail}</p>
    </div>
  )
}

function EmptyState() {
  return (
    <section className="rounded-[2rem] border border-dashed border-white/15 bg-white/[0.02] p-6 text-neutral-400">
      <h2 className="text-2xl font-black text-white">No public Explore data yet</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6">Explore stays clean until a clique is made public and has rated movies, series, or games.</p>
      <Link to="/groups" className="mt-5 inline-flex rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-neutral-200">Manage cliques</Link>
    </section>
  )
}

function ContentCard({ item }) {
  return (
    <article className="flex gap-3 rounded-3xl border border-white/10 bg-neutral-900 p-3">
      {item.poster ? <img src={item.poster} alt="" className="h-20 w-14 shrink-0 rounded-xl object-cover" /> : <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-xs text-neutral-500">{item.category?.slice(0, 3)}</div>}
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">{item.category} · {item.groupName || 'Public clique'}</p>
        <h3 className="mt-1 truncate text-lg font-black text-white">{item.title}</h3>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-neutral-300">
          <span className="rounded-full border border-white/10 px-3 py-1">Score {item.score || 0}</span>
          <span className="rounded-full border border-white/10 px-3 py-1">{item.picks || 0} picks</span>
          {item.rating ? <span className="rounded-full border border-white/10 px-3 py-1">★ {Number(item.rating).toFixed(1)}</span> : null}
        </div>
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
  const topItem = topContent[0]

  if (loading) return <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-10 text-center text-neutral-400">Loading Explore...</div>
  if (message) return <div className="rounded-[2rem] border border-rose-400/30 bg-rose-950/30 p-5 text-rose-100">{message}</div>
  if (!groups.length && !topContent.length) return <EmptyState />

  return (
    <>
      <section className="mb-5 grid gap-3 md:grid-cols-3">
        <StatCard label="Top public pick" value={topItem?.title || 'None yet'} detail={topItem ? `${topItem.category} · ${topItem.groupName}` : 'Rated public items appear here'} />
        <StatCard label="Public cliques" value={totals.publicGroups || totals.groups || 0} detail={`${totals.members || 0} visible members`} />
        <StatCard label="Public items" value={totals.items || 0} detail={`${totals.picks || 0} picks · ${totals.score || 0} score`} />
      </section>

      <section className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Global ratings</p>
              <h2 className="mt-1 text-2xl font-black text-white">Top public picks</h2>
            </div>
            <span className="text-sm text-neutral-500">Movies · Series · Games</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {topContent.slice(0, 8).map((item) => <ContentCard key={`${item.category}-${item.groupId}-${item.id}`} item={item} />)}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-4">
            <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Public discovery</p>
            <h2 className="mt-1 text-2xl font-black text-white">Public cliques</h2>
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
      <section className="mb-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20 sm:p-8">
        <p className="text-xs uppercase tracking-[0.35em] text-neutral-500">Explore</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">Public picks, without the clutter.</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-neutral-400">Explore only shows public clique activity. Your personal library and private clique dashboards stay separate.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/dashboard" className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-neutral-950 hover:bg-neutral-200">Open my library</Link>
          <Link to="/groups" className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white hover:text-neutral-950">Manage cliques</Link>
        </div>
      </section>

      <ExploreBoard />
    </PageShell>
  )
}
