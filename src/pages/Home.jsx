import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AppIcon from '../components/AppIcon.jsx'
import PageShell from '../components/PageShell.jsx'
import { GROUPS_CHANGED_EVENT, getActiveGroup, getActiveGroupId, parseInviteCode, setActiveGroup } from '../lib/groups.js'
import { getCurrentSession, getGames, getMovies, getRemoteGroups, getSeries, hasSupabase } from '../lib/supabaseClient.js'

const TYPE_ICONS = {
  Movie: 'movies',
  Series: 'series',
  Game: 'games',
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

function MiniPosterStack({ items }) {
  const visible = items.slice(0, 3)

  if (!visible.length) {
    return (
      <div className="flex h-20 items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.03] text-xs font-semibold text-neutral-500">
        Empty
      </div>
    )
  }

  return (
    <div className="flex h-20 items-end -space-x-4 overflow-hidden rounded-3xl bg-black/25 px-4 pb-3 pt-2">
      {visible.map((item, index) => {
        const image = item.poster || item.backdrop
        return (
          <div key={`${item.type}-${item.id}`} className="h-16 w-11 shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-neutral-900 shadow-xl shadow-black/30" style={{ zIndex: visible.length - index }}>
            {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-white/10" />}
          </div>
        )
      })}
    </div>
  )
}

function LibrarySectionCard({ category, loading }) {
  const picks = category.items.reduce((sum, item) => sum + Number(item.picks || 0), 0)
  const topTitle = category.top?.title || `Add your first ${category.singular.toLowerCase()}`

  return (
    <Link to={category.to} className="group flex min-h-[13rem] flex-col justify-between rounded-[1.6rem] border border-white/10 bg-white/[0.06] p-4 text-white transition hover:-translate-y-0.5 hover:border-white/25 hover:bg-white hover:text-neutral-950">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-neutral-950 group-hover:bg-neutral-950 group-hover:text-white">
            <AppIcon name={category.icon} size={19} strokeWidth={2.4} />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] opacity-55">Open list</p>
            <h3 className="text-lg font-black leading-tight">{category.title}</h3>
          </div>
        </div>
        <div className="text-right">
          <p className="text-4xl font-black leading-none">{loading ? '…' : category.count}</p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] opacity-55">items</p>
        </div>
      </div>

      <div className="mt-4">
        <MiniPosterStack items={category.items} />
      </div>

      <div className="mt-4 space-y-3">
        <p className="line-clamp-1 text-sm font-black">{loading ? 'Loading section…' : topTitle}</p>
        <div className="grid grid-cols-2 gap-2 text-xs font-black">
          <span className="rounded-2xl border border-current/10 bg-black/10 px-3 py-2 text-center group-hover:bg-neutral-950 group-hover:text-white">{loading ? '…' : category.rated} rated</span>
          <span className="rounded-2xl border border-current/10 bg-black/10 px-3 py-2 text-center group-hover:bg-neutral-950 group-hover:text-white">{loading ? '…' : picks} picks</span>
        </div>
      </div>
    </Link>
  )
}

function RecentLibraryRow({ item }) {
  const image = item.poster || item.backdrop
  const icon = TYPE_ICONS[item.type] || 'dashboard'

  return (
    <Link to={item.to} className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-2.5 text-white transition hover:bg-white hover:text-neutral-950">
      <div className="h-14 w-10 shrink-0 overflow-hidden rounded-xl bg-neutral-900">
        {image ? <img src={image} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-white/10" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.16em] opacity-60">
          <AppIcon name={icon} size={12} strokeWidth={2.4} />
          <span>{item.type}</span>
        </div>
        <div className="mt-0.5 truncate text-sm font-black">{item.title}</div>
      </div>
      <span className="shrink-0 rounded-full border border-current/10 px-2.5 py-1 text-xs font-black">★ {item.rating ? Number(item.rating).toFixed(1) : '—'}</span>
    </Link>
  )
}

function LibraryOverviewPanel({ items, categories, loading }) {
  const recentItems = items.slice(0, 3)
  const totalRated = categories.reduce((sum, category) => sum + category.rated, 0)

  return (
    <section className="mt-6 rounded-[1.9rem] border border-white/10 bg-neutral-950/70 p-4 shadow-2xl shadow-black/20">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500">Library overview</p>
          <h2 className="mt-1 text-2xl font-black text-white">Open a section</h2>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-right">
          <p className="text-2xl font-black text-white">{loading ? '…' : items.length}</p>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">total items</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {categories.map((category) => <LibrarySectionCard key={category.title} category={category} loading={loading} />)}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-neutral-500">Recent content</p>
            <span className="rounded-full border border-white/10 px-2.5 py-1 text-xs font-black text-neutral-400">{loading ? '…' : totalRated} rated</span>
          </div>
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-2xl bg-white/[0.06]" />)}
            </div>
          ) : recentItems.length ? (
            <div className="space-y-2">
              {recentItems.map((item) => <RecentLibraryRow key={`${item.type}-${item.id}`} item={item} />)}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-white/10 p-4 text-sm leading-6 text-neutral-400">No saved content yet. Open Movies, Series, or Games and add your first item.</p>
          )}
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-neutral-500">What this is</p>
          <h3 className="mt-2 text-xl font-black text-white">Your private media base</h3>
          <p className="mt-2 text-sm leading-6 text-neutral-400">Keep your watched movies, finished series, and played games here. Clique voting stays in clique spaces.</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-black text-neutral-300">
            {categories.map((category) => (
              <Link key={category.title} to={category.to} className="rounded-2xl border border-white/10 px-2 py-3 transition hover:bg-white hover:text-neutral-950">
                <AppIcon name={category.icon} size={16} className="mx-auto mb-1" strokeWidth={2.4} />
                {category.title}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function LibraryShowcase({ items, loading }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex((current) => items.length ? Math.min(current, items.length - 1) : 0)
  }, [items.length])

  useEffect(() => {
    if (items.length < 2) return undefined
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % items.length)
    }, 4200)
    return () => window.clearInterval(timer)
  }, [items.length])

  if (loading) {
    return (
      <div className="relative flex min-h-[320px] items-end overflow-hidden bg-neutral-950 p-5">
        <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(0,0,0,0.45))]" />
        <div className="relative">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Library reel</p>
          <h2 className="mt-2 text-3xl font-black text-white">Loading your library…</h2>
        </div>
      </div>
    )
  }

  if (!items.length) {
    return (
      <div className="relative flex min-h-[320px] items-end overflow-hidden bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.16),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,0,0,0.4))] p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">Empty library</p>
          <h2 className="mt-2 text-3xl font-black text-white">Add the first item</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-neutral-300">Once you add watched movies, finished series, or played games, this corner becomes a slideshow of your library.</p>
        </div>
      </div>
    )
  }

  const item = items[index] || items[0]
  const image = item.backdrop || item.poster

  return (
    <div className="relative min-h-[320px] overflow-hidden bg-neutral-950">
      <Link to={item.to} className="group absolute inset-0 flex items-end p-5">
        {image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-65 transition duration-700 group-hover:scale-105" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.16),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,0,0,0.4))]" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />
        <div className="absolute left-5 top-5 right-5 flex items-center justify-between gap-3">
          <span className="rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-xs font-black uppercase tracking-[0.22em] text-white backdrop-blur">Library reel</span>
          <span className="rounded-full border border-white/15 bg-black/35 px-3 py-1.5 text-xs font-bold text-neutral-200 backdrop-blur">{index + 1}/{items.length}</span>
        </div>
        <div className="relative max-w-md">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-300">{item.type}</p>
          <h2 className="mt-2 text-3xl font-black text-white sm:text-4xl">{item.title}</h2>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-neutral-300">{item.overview || `Score ${item.score || 0} · ${item.picks || 0} picks`}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-white">
            <span className="rounded-full border border-white/20 bg-black/35 px-3 py-1.5">Score {item.score || 0}</span>
            <span className="rounded-full border border-white/20 bg-black/35 px-3 py-1.5">{item.picks || 0} picks</span>
            {item.rating ? <span className="rounded-full border border-white/20 bg-black/35 px-3 py-1.5">★ {Number(item.rating).toFixed(1)}</span> : null}
          </div>
        </div>
      </Link>
    </div>
  )
}

function CategoryTopCard({ category, loading }) {
  const top = category.top
  const image = top?.backdrop || top?.poster

  return (
    <article className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03]">
      <div className="relative min-h-52 overflow-hidden bg-neutral-900">
        {image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-75 transition hover:scale-105" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,0,0,0.45))]" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        <Link to={category.to} className="absolute inset-0 z-0" aria-label={`Open ${category.title}`} />
        <span className="absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-xs font-black tracking-[0.16em] text-neutral-950">
          <AppIcon name={category.icon} size={13} strokeWidth={2.4} />
          {category.title}
        </span>
        <Link to={category.to} className="absolute right-4 top-4 z-10 rounded-2xl border border-white/15 bg-black/55 px-3 py-2 text-xs font-black text-white backdrop-blur transition hover:bg-white hover:text-neutral-950">Open list</Link>
        {!top ? <span className="absolute bottom-4 left-4 right-4 z-10 text-sm font-semibold text-neutral-300">No {category.title.toLowerCase()} yet</span> : null}
      </div>

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
            <p className="mt-2 line-clamp-3 text-sm leading-6 text-neutral-400">{top.overview || `Leading ${category.singular.toLowerCase()} by score and picks in this workspace.`}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-neutral-300">
              <span className="rounded-full border border-white/10 px-3 py-1.5">Score {top.score || 0}</span>
              <span className="rounded-full border border-white/10 px-3 py-1.5">{top.picks || 0} picks</span>
              {top.rating ? <span className="rounded-full border border-white/10 px-3 py-1.5">★ {Number(top.rating).toFixed(1)}</span> : null}
              <span className="rounded-full border border-white/10 px-3 py-1.5">{category.rated} rated</span>
            </div>
          </>
        ) : (
          <div className="mt-6 flex flex-col gap-5">
            <p className="text-sm leading-6 text-neutral-400">No {category.title.toLowerCase()} have been submitted here yet. Start this workspace with the first real pick.</p>
            <Link to={category.to} className="inline-flex w-fit rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-neutral-200">Open {category.title.toLowerCase()}</Link>
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
          <h2 className="mt-1 text-2xl font-black text-white">Got a clique link?</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-400">Paste an invite link or code to join a friend’s shared voting space.</p>
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
  const { groupId: routeGroupId } = useParams()
  const [inviteDraft, setInviteDraft] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [loading, setLoading] = useState(hasSupabase)
  const [status, setStatus] = useState(hasSupabase ? 'checking' : 'local')
  const [context, setContext] = useState(() => ({ type: getActiveGroup() ? 'group' : 'personal', name: getActiveGroup()?.name || 'My Library', groupId: getActiveGroup()?.id || null }))
  const [media, setMedia] = useState({ movies: [], series: [], games: [] })
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (routeGroupId) setActiveGroup(routeGroupId)
    refreshDashboard(routeGroupId || null)
    function handleGroupChange() { refreshDashboard(routeGroupId || null) }
    window.addEventListener(GROUPS_CHANGED_EVENT, handleGroupChange)
    return () => window.removeEventListener(GROUPS_CHANGED_EVENT, handleGroupChange)
  }, [routeGroupId])

  const movieItems = useMemo(() => normalizeItems(media.movies, 'Movie', 'MOV', '/movies'), [media.movies])
  const seriesItems = useMemo(() => normalizeItems(media.series, 'Series', 'SER', '/series'), [media.series])
  const gameItems = useMemo(() => normalizeItems(media.games, 'Game', 'GAM', '/games'), [media.games])
  const allItems = useMemo(() => [...movieItems, ...seriesItems, ...gameItems].sort((a, b) => b.sortValue - a.sortValue), [movieItems, seriesItems, gameItems])
  const categories = useMemo(() => [
    { title: 'Movies', singular: 'Movie', code: 'MOV', icon: TYPE_ICONS.Movie, to: '/movies', items: movieItems, top: movieItems[0], count: movieItems.length, rated: movieItems.filter((item) => item.rating).length },
    { title: 'Series', singular: 'Series', code: 'SER', icon: TYPE_ICONS.Series, to: '/series', items: seriesItems, top: seriesItems[0], count: seriesItems.length, rated: seriesItems.filter((item) => item.rating).length },
    { title: 'Games', singular: 'Game', code: 'GAM', icon: TYPE_ICONS.Game, to: '/games', items: gameItems, top: gameItems[0], count: gameItems.length, rated: gameItems.filter((item) => item.rating).length },
  ], [movieItems, seriesItems, gameItems])

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
      if (!session?.user) {
        setStatus('signed-out')
        setContext({ type: 'personal', name: 'My Library', groupId: null })
        setMedia({ movies: [], series: [], games: [] })
        setLoading(false)
        return
      }
      const remoteGroups = await getRemoteGroups().catch(() => [])
      const activeId = preferredGroupId || getActiveGroupId()
      const group = remoteGroups.find((item) => item.id === activeId) || null
      const groupId = group?.id || null
      if (preferredGroupId && group) setActiveGroup(group.id)
      setContext({ type: group ? 'group' : 'personal', name: group?.name || 'My Library', groupId })
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
    <PageShell active={context.type === 'group' ? 'cliques' : 'library'}>
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] shadow-2xl shadow-black/20">
        <div className="grid gap-0 xl:grid-cols-[1.12fr_0.88fr]">
          <div className="p-5 sm:p-8">
            <h1 className="max-w-3xl text-4xl font-black tracking-tight text-white sm:text-6xl">{context.name}</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-400 sm:text-lg">{context.type === 'group' ? 'Shared movie, series, and game picks for this clique.' : 'Your watched movies, finished series, and played games in one place.'}</p>
            {status === 'signed-out' ? <p className="mt-4 inline-flex rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-neutral-300">Sign in from Profile to save picks and join cliques.</p> : null}
            <LibraryOverviewPanel items={loading ? [] : allItems} categories={categories} loading={loading} />
          </div>
          <LibraryShowcase items={loading ? [] : allItems} loading={loading} />
        </div>
      </section>

      {message ? <div className="mt-5 rounded-2xl border border-rose-400/30 bg-rose-950/30 p-4 text-sm text-rose-100">{message}</div> : null}

      <section className="mt-5 grid gap-3 md:grid-cols-3">
        <StatCard label="Items" value={loading ? '…' : allItems.length} detail="Movies, series, and games" />
        <StatCard label="Picks" value={loading ? '…' : totalPicks} detail="Saved votes across lists" />
        <StatCard label="Rated" value={loading ? '…' : ratedCount} detail="Watched, finished, or played" />
      </section>

      {!context.groupId ? <InviteCard inviteDraft={inviteDraft} setInviteDraft={setInviteDraft} inviteError={inviteError} setInviteError={setInviteError} onSubmit={openInvite} /> : null}

      <section className="mt-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Section highlights</p>
          <h2 className="mt-1 text-3xl font-black text-white">Top items by category</h2>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {categories.map((category) => <CategoryTopCard key={category.title} category={category} loading={loading} />)}
        </div>
      </section>
    </PageShell>
  )
}
