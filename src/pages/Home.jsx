import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PageShell from '../components/PageShell.jsx'
import { GROUPS_CHANGED_EVENT, getActiveGroup, getActiveGroupId, parseInviteCode } from '../lib/groups.js'
import { getCurrentSession, getGames, getMovies, getRemoteGroups, getSeries, hasSupabase } from '../lib/supabaseClient.js'

const sections = [
  { title: 'Movies', to: '/movies', code: 'MOV', description: 'Search, submit, vote, and rate movies.' },
  { title: 'Series', to: '/series', code: 'SER', description: 'Build a watchlist and rate finished shows.' },
  { title: 'Games', to: '/games', code: 'GAM', description: 'Search the games API and add real suggestions.' },
  { title: 'Videos', to: '/videos', code: 'VID', description: 'Drop links into a fresh group feed.' },
  { title: 'Music', to: '/music', code: 'MUS', description: 'Paste song links into a simple feed.' },
  { title: 'Board', to: '/leaderboard', code: 'BRD', description: 'Explore public groups and global rankings.' },
]

function StartCard({ section }) {
  return (
    <Link to={section.to} className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 transition hover:-translate-y-0.5 hover:bg-white/[0.06]">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-xs font-black tracking-[0.18em] text-neutral-950">{section.code}</div>
        <div className="min-w-0">
          <h2 className="text-2xl font-black text-white">{section.title}</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-400">{section.description}</p>
          <span className="mt-4 inline-flex rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-neutral-200">Open {section.title}</span>
        </div>
      </div>
    </Link>
  )
}

function StatCard({ label, value, detail }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">{label}</p>
      <h2 className="mt-2 text-3xl font-black text-white">{value}</h2>
      <p className="mt-1 text-sm text-neutral-400">{detail}</p>
    </div>
  )
}

function ContentRow({ item }) {
  return (
    <Link to={item.to} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900 p-3 transition hover:bg-neutral-800">
      {item.poster ? <img src={item.poster} alt="" className="h-14 w-10 rounded-lg object-cover" /> : <div className="flex h-14 w-10 items-center justify-center rounded-lg bg-white/[0.06] text-[10px] font-black text-neutral-400">{item.code}</div>}
      <div className="min-w-0 flex-1">
        <div className="truncate font-bold text-white">{item.title}</div>
        <div className="mt-1 text-xs text-neutral-500">{item.type} · score {item.score || 0} · {item.picks || 0} picks</div>
      </div>
      {item.rating ? <div className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-neutral-300">★ {Number(item.rating).toFixed(1)}</div> : null}
    </Link>
  )
}

function FeaturedPick({ item }) {
  if (!item) {
    return (
      <div className="relative flex min-h-[320px] items-end overflow-hidden bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.16),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,0,0,0.4))] p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">Empty dashboard</p>
          <h2 className="mt-2 text-3xl font-black text-white">Add the first pick</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-neutral-300">Once this context has movies, series, or games, the strongest pick will be featured here.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/movies" className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-neutral-200">Add movie</Link>
            <Link to="/games" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white hover:text-neutral-950">Add game</Link>
          </div>
        </div>
      </div>
    )
  }

  const image = item.backdrop || item.poster

  return (
    <Link to={item.to} className="group relative flex min-h-[320px] items-end overflow-hidden bg-neutral-900 p-5">
      {image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-65 transition group-hover:scale-105" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.16),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,0,0,0.4))]" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />
      <div className="relative max-w-md">
        <p className="text-xs uppercase tracking-[0.3em] text-neutral-300">Featured {item.type}</p>
        <h2 className="mt-2 text-3xl font-black text-white sm:text-4xl">{item.title}</h2>
        <p className="mt-2 line-clamp-3 text-sm leading-6 text-neutral-300">{item.overview || `Score ${item.score || 0} · ${item.picks || 0} picks`}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-white">
          <span className="rounded-full border border-white/20 bg-black/35 px-3 py-1.5">{item.type}</span>
          <span className="rounded-full border border-white/20 bg-black/35 px-3 py-1.5">Score {item.score || 0}</span>
          <span className="rounded-full border border-white/20 bg-black/35 px-3 py-1.5">{item.picks || 0} picks</span>
          {item.rating ? <span className="rounded-full border border-white/20 bg-black/35 px-3 py-1.5">★ {Number(item.rating).toFixed(1)}</span> : null}
        </div>
      </div>
    </Link>
  )
}

function InviteCard({ inviteDraft, setInviteDraft, inviteError, setInviteError, onSubmit }) {
  return (
    <section className="mt-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
      <div className="grid gap-4 md:grid-cols-[0.75fr_1.25fr] md:items-center">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Join by invite</p>
          <h2 className="mt-1 text-2xl font-black text-white">Got a group link?</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-400">Paste an invite link or code to join a friend’s group.</p>
        </div>
        <form onSubmit={onSubmit} className="rounded-3xl border border-white/10 bg-neutral-950/80 p-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input value={inviteDraft} onChange={(event) => { setInviteDraft(event.target.value); setInviteError('') }} placeholder="Paste invite link or code" className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
            <button className="rounded-2xl bg-white px-5 py-3 font-semibold text-neutral-950 hover:bg-neutral-200">Open invite</button>
          </div>
          {inviteError ? <p className="mt-2 text-sm text-rose-200">{inviteError}</p> : null}
        </form>
      </div>
    </section>
  )
}

function normalizeItems(rows, type, code, to) {
  return rows.map((item) => ({
    ...item,
    type,
    code,
    to,
    rating: item.rating || null,
    sortValue: Number(item.score || 0) * 10 + Number(item.picks || 0) + Number(item.rating || 0),
  }))
}

export default function Home() {
  const navigate = useNavigate()
  const [inviteDraft, setInviteDraft] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [loading, setLoading] = useState(hasSupabase)
  const [status, setStatus] = useState(hasSupabase ? 'checking' : 'local')
  const [context, setContext] = useState(() => ({ type: getActiveGroup() ? 'group' : 'personal', name: getActiveGroup()?.name || 'Personal library', groupId: getActiveGroup()?.id || null }))
  const [media, setMedia] = useState({ movies: [], series: [], games: [] })
  const [message, setMessage] = useState('')

  useEffect(() => {
    refreshDashboard()

    function handleGroupChange() {
      refreshDashboard()
    }

    window.addEventListener(GROUPS_CHANGED_EVENT, handleGroupChange)
    return () => window.removeEventListener(GROUPS_CHANGED_EVENT, handleGroupChange)
  }, [])

  const allItems = useMemo(() => [
    ...normalizeItems(media.movies, 'Movie', 'MOV', '/movies'),
    ...normalizeItems(media.series, 'Series', 'SER', '/series'),
    ...normalizeItems(media.games, 'Game', 'GAM', '/games'),
  ].sort((a, b) => b.sortValue - a.sortValue), [media])

  const featuredItem = allItems[0] || null
  const ratedCount = useMemo(() => allItems.filter((item) => item.rating).length, [allItems])
  const totalPicks = useMemo(() => allItems.reduce((sum, item) => sum + Number(item.picks || 0), 0), [allItems])

  async function refreshDashboard() {
    setLoading(true)
    setMessage('')

    if (!hasSupabase) {
      const group = getActiveGroup()
      setContext({ type: group ? 'group' : 'personal', name: group?.name || 'Personal library', groupId: group?.id || null })
      setMedia({ movies: [], series: [], games: [] })
      setStatus('local')
      setLoading(false)
      return
    }

    try {
      const session = await getCurrentSession()
      if (!session?.user) {
        setStatus('signed-out')
        setContext({ type: 'personal', name: 'Personal library', groupId: null })
        setMedia({ movies: [], series: [], games: [] })
        setLoading(false)
        return
      }

      const remoteGroups = await getRemoteGroups().catch(() => [])
      const activeId = getActiveGroupId()
      const group = remoteGroups.find((item) => item.id === activeId) || null
      const groupId = group?.id || null

      setContext({ type: group ? 'group' : 'personal', name: group?.name || 'Personal library', groupId })

      const [movies, seriesRows, games] = await Promise.all([
        getMovies(groupId),
        getSeries(groupId),
        getGames(groupId),
      ])

      setMedia({ movies, series: seriesRows, games })
      setStatus('ready')
    } catch (error) {
      setStatus('error')
      setMessage(error.message || 'Could not load dashboard.')
      setMedia({ movies: [], series: [], games: [] })
    } finally {
      setLoading(false)
    }
  }

  function openInvite(event) {
    event.preventDefault()
    const code = parseInviteCode(inviteDraft)
    if (!code) {
      setInviteError('Paste an invite link or code first.')
      return
    }
    navigate(`/invite/${encodeURIComponent(code)}`)
  }

  return (
    <PageShell active="home">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] shadow-2xl shadow-black/20">
        <div className="grid gap-0 md:grid-cols-[1.05fr_0.95fr]">
          <div className="p-5 sm:p-8">
            <p className="text-xs uppercase tracking-[0.35em] text-neutral-500">{context.type === 'group' ? 'Group dashboard' : 'Personal dashboard'}</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-6xl">
              {context.name}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-400 sm:text-lg">
              {context.type === 'group'
                ? 'Shared movie, series, and game picks for this group.'
                : 'Your private library before you send picks into a group.'}
            </p>
            {status === 'signed-out' ? (
              <p className="mt-4 inline-flex rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-neutral-300">Sign in from Profile to save picks and join groups.</p>
            ) : null}
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Link to="/movies" className="rounded-2xl bg-white px-5 py-3 text-center font-semibold text-neutral-950 transition hover:bg-neutral-200">Add movie</Link>
              <Link to="/series" className="rounded-2xl border border-white/10 px-5 py-3 text-center font-semibold text-white transition hover:bg-white hover:text-neutral-950">Add series</Link>
              <Link to="/games" className="rounded-2xl border border-white/10 px-5 py-3 text-center font-semibold text-white transition hover:bg-white hover:text-neutral-950">Add game</Link>
            </div>
          </div>

          <FeaturedPick item={loading ? null : featuredItem} />
        </div>
      </section>

      {message ? <div className="mt-5 rounded-2xl border border-rose-400/30 bg-rose-950/30 p-4 text-sm text-rose-100">{message}</div> : null}

      <section className="mt-5 grid gap-3 md:grid-cols-3">
        <StatCard label="Items" value={loading ? '…' : allItems.length} detail="Movies, series, and games" />
        <StatCard label="Votes" value={loading ? '…' : totalPicks} detail="Submitted votes/picks" />
        <StatCard label="Rated" value={loading ? '…' : ratedCount} detail="Watched, finished, or played" />
      </section>

      {!context.groupId ? (
        <InviteCard inviteDraft={inviteDraft} setInviteDraft={setInviteDraft} inviteError={inviteError} setInviteError={setInviteError} onSubmit={openInvite} />
      ) : null}

      <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.8fr]">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Ranking</p>
              <h2 className="mt-1 text-3xl font-black text-white">Top picks</h2>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {loading ? <p className="rounded-2xl border border-white/10 p-4 text-neutral-400">Loading dashboard...</p> : allItems.length ? allItems.slice(0, 8).map((item) => <ContentRow key={`${item.type}-${item.id}`} item={item} />) : (
              <p className="rounded-2xl border border-dashed border-white/15 p-5 text-neutral-400">No picks yet. Add the first movie, series, or game to start building this dashboard.</p>
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Explore</p>
          <h2 className="mt-1 text-3xl font-black text-white">Sections</h2>
          <div className="mt-4 grid gap-3">
            {sections.map((section) => <StartCard key={section.title} section={section} />)}
          </div>
        </div>
      </section>
    </PageShell>
  )
}
