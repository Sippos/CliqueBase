import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PageShell from '../components/PageShell.jsx'
import { GROUPS_CHANGED_EVENT, getActiveGroup, getActiveGroupId, parseInviteCode } from '../lib/groups.js'
import { getCurrentSession, getGames, getMovies, getRemoteGroups, getSeries, hasSupabase } from '../lib/supabaseClient.js'

function StatCard({ label, value, detail }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">{label}</p>
      <h2 className="mt-2 text-3xl font-black text-white">{value}</h2>
      <p className="mt-1 text-sm text-neutral-400">{detail}</p>
    </div>
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
  })).sort((a, b) => b.sortValue - a.sortValue)
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

function CategoryTopCard({ category, loading }) {
  const top = category.top
  const image = top?.backdrop || top?.poster

  return (
    <article className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03]">
      <Link to={category.to} className="relative block min-h-52 overflow-hidden bg-neutral-900">
        {image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-75 transition hover:scale-105" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,0,0,0.45))]" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <span className="absolute left-4 top-4 rounded-2xl bg-white px-3 py-2 text-xs font-black tracking-[0.18em] text-neutral-950">{category.code}</span>
        {!top ? <span className="absolute bottom-4 left-4 right-4 text-sm font-semibold text-neutral-300">No {category.title.toLowerCase()} yet</span> : null}
      </Link>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Top {category.singular}</p>
            <h3 className="mt-1 text-3xl font-black text-white">{category.title}</h3>
          </div>
          <div className="rounded-2xl border border-white/10 px-3 py-2 text-right text-xs text-neutral-400">
            <strong className="block text-lg text-white">{category.count}</strong>
            items
          </div>
        </div>

        {loading ? (
          <p className="mt-6 rounded-2xl border border-white/10 p-4 text-sm text-neutral-400">Loading {category.title.toLowerCase()}...</p>
        ) : top ? (
          <>
            <Link to={category.to} className="mt-6 block text-2xl font-black leading-tight text-white hover:underline">{top.title}</Link>
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-neutral-400">{top.overview || `Leading ${category.singular.toLowerCase()} by score and picks in this context.`}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-neutral-300">
              <span className="rounded-full border border-white/10 px-3 py-1.5">Score {top.score || 0}</span>
              <span className="rounded-full border border-white/10 px-3 py-1.5">{top.picks || 0} picks</span>
              {top.rating ? <span className="rounded-full border border-white/10 px-3 py-1.5">★ {Number(top.rating).toFixed(1)}</span> : null}
              <span className="rounded-full border border-white/10 px-3 py-1.5">{category.rated} rated</span>
            </div>
          </>
        ) : (
          <div className="mt-6 flex flex-col gap-5">
            <p className="text-sm leading-6 text-neutral-400">No {category.title.toLowerCase()} have been submitted here yet. Start this rubric with the first real pick.</p>
            <Link to={category.to} className="inline-flex w-fit rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-neutral-200">Add {category.singular.toLowerCase()}</Link>
          </div>
        )}
      </div>
    </article>
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
    function handleGroupChange() { refreshDashboard() }
    window.addEventListener(GROUPS_CHANGED_EVENT, handleGroupChange)
    return () => window.removeEventListener(GROUPS_CHANGED_EVENT, handleGroupChange)
  }, [])

  const movieItems = useMemo(() => normalizeItems(media.movies, 'Movie', 'MOV', '/movies'), [media.movies])
  const seriesItems = useMemo(() => normalizeItems(media.series, 'Series', 'SER', '/series'), [media.series])
  const gameItems = useMemo(() => normalizeItems(media.games, 'Game', 'GAM', '/games'), [media.games])
  const allItems = useMemo(() => [...movieItems, ...seriesItems, ...gameItems].sort((a, b) => b.sortValue - a.sortValue), [movieItems, seriesItems, gameItems])
  const categories = useMemo(() => [
    { title: 'Movies', singular: 'Movie', code: 'MOV', to: '/movies', top: movieItems[0], count: movieItems.length, rated: movieItems.filter((item) => item.rating).length },
    { title: 'Series', singular: 'Series', code: 'SER', to: '/series', top: seriesItems[0], count: seriesItems.length, rated: seriesItems.filter((item) => item.rating).length },
    { title: 'Games', singular: 'Game', code: 'GAM', to: '/games', top: gameItems[0], count: gameItems.length, rated: gameItems.filter((item) => item.rating).length },
  ], [movieItems, seriesItems, gameItems])

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
      const [movies, seriesRows, games] = await Promise.all([getMovies(groupId), getSeries(groupId), getGames(groupId)])
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
            <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-6xl">{context.name}</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-400 sm:text-lg">{context.type === 'group' ? 'Shared movie, series, and game picks for this group.' : 'Your private library before you send picks into a group.'}</p>
            {status === 'signed-out' ? <p className="mt-4 inline-flex rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-neutral-300">Sign in from Profile to save picks and join groups.</p> : null}
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

      {!context.groupId ? <InviteCard inviteDraft={inviteDraft} setInviteDraft={setInviteDraft} inviteError={inviteError} setInviteError={setInviteError} onSubmit={openInvite} /> : null}

      <section className="mt-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Best by section</p>
          <h2 className="mt-1 text-3xl font-black text-white">Category leaders</h2>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {categories.map((category) => <CategoryTopCard key={category.title} category={category} loading={loading} />)}
        </div>
      </section>
    </PageShell>
  )
}
