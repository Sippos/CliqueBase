import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import PageShell from '../components/PageShell.jsx'
import { getActiveGroup, getGroupOpenPath, getGroups, setActiveGroup } from '../lib/groups.js'
import { getCommunityLeaderboard, getCurrentSession, getRemoteGroups, hasSupabase } from '../lib/supabaseClient.js'

function StatCard({ label, value, detail }) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">{label}</p>
      <h2 className="mt-2 truncate text-2xl font-black text-white">{value}</h2>
      <p className="mt-1 text-sm text-neutral-400">{detail}</p>
    </div>
  )
}

function Panel({ eyebrow, title, aside, children }) {
  return (
    <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">{eyebrow}</p>
          <h2 className="mt-1 text-2xl font-bold text-white">{title}</h2>
        </div>
        {aside ? <span className="text-right text-sm text-neutral-500">{aside}</span> : null}
      </div>
      {children}
    </div>
  )
}

function RankBubble({ label }) {
  return <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-sm font-black text-white">{label}</div>
}

function Metric({ value, label, detail }) {
  return (
    <div className="rounded-2xl border border-white/10 px-3 py-2 text-right">
      <div className="text-lg font-black text-white">{value}</div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">{label}</div>
      {detail ? <div className="mt-1 text-xs text-neutral-400">{detail}</div> : null}
    </div>
  )
}

function EmptyPanel({ title, description }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-neutral-400">
      <strong className="block text-base text-white">{title}</strong>
      <span className="mt-1 block leading-6">{description}</span>
    </div>
  )
}

function ContentRow({ item }) {
  const rankLabel = item.rank ? `#${item.rank}` : item.category?.slice(0, 2)?.toUpperCase() || '•'

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900 p-3">
      <RankBubble label={rankLabel} />
      {item.poster ? <img src={item.poster} alt="" className="h-16 w-11 rounded-lg object-cover" /> : null}
      <div className="min-w-0 flex-1">
        <div className="truncate text-lg font-bold text-white">{item.title}</div>
        <div className="mt-1 text-xs text-neutral-400">{item.category} · {item.groupName ? `from ${item.groupName}` : `by ${item.nominated_by || item.nominatedBy || 'Unknown'}`}</div>
        {item.rating ? <div className="mt-1 text-xs text-neutral-500">Rated ★ {Number(item.rating).toFixed(1)}/10</div> : null}
      </div>
      <Metric value={item.score || 0} label="Score" detail={`${item.picks || 0} picks`} />
    </div>
  )
}

function PublicGroupCard({ group }) {
  const publicItems = group.publicItems || group.topItems || []

  return (
    <div className="rounded-[1.75rem] border border-white/10 bg-neutral-900 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.3em] text-neutral-500">Public group #{group.rank}</div>
          <h3 className="mt-1 truncate text-2xl font-black text-white">{group.name}</h3>
          <p className="mt-1 text-sm text-neutral-400">{group.memberCount} members · {group.itemCount} public items · {group.completedCount} rated/finished</p>
        </div>
        <Metric value={Number(group.averageRating || 0).toFixed(1)} label="Avg rating" detail={`${group.totalScore || 0} score`} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-neutral-300">
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5">{group.totalPicks || 0} picks</span>
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-emerald-100">Public dashboard</span>
      </div>

      {publicItems.length ? (
        <div className="mt-4 space-y-2">
          {publicItems.map((item) => (
            <div key={`${group.id}-${item.category}-${item.id}`} className="flex items-center gap-2 rounded-2xl bg-white/[0.04] p-2">
              {item.poster ? <img src={item.poster} alt="" className="h-12 w-8 rounded-md object-cover" /> : <div className="flex h-12 w-8 items-center justify-center rounded-md bg-white/[0.06] text-xs">{item.category?.slice(0, 2)}</div>}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-white">{item.title}</div>
                <div className="text-xs text-neutral-500">Score {item.score || 0} · {item.picks || 0} picks{item.rating ? ` · ★ ${Number(item.rating).toFixed(1)}` : ''}</div>
              </div>
            </div>
          ))}
        </div>
      ) : <p className="mt-4 rounded-2xl border border-dashed border-white/10 p-3 text-sm text-neutral-500">No public rated content yet.</p>}
    </div>
  )
}

function FreshDashboard() {
  return (
    <>
      <section className="mb-5 grid gap-3 md:grid-cols-4">
        <StatCard label="Top public group" value="None yet" detail="Publish a group to appear here." />
        <StatCard label="Top public item" value="None yet" detail="Global ratings start after real ratings exist." />
        <StatCard label="Public groups" value="0" detail="No public groups shown yet." />
        <StatCard label="Public picks" value="0" detail="Dashboard rankings start from public groups." />
      </section>
      <Panel eyebrow="Fresh start" title="No global rating data yet" aside="Real content only">
        <EmptyPanel title="Build the Dashboard from public groups" description="The main Dashboard combines global ratings with quick access to your Personal Library and groups. It fills when groups publish themselves and rate movies, series, or games." />
      </Panel>
    </>
  )
}

function GlobalRatings() {
  const [board, setBoard] = useState({ groups: [], topContent: [], totals: {} })
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function loadBoard() {
      setLoading(true)
      try {
        const data = await getCommunityLeaderboard()
        if (!cancelled) setBoard(data)
      } catch (error) {
        if (!cancelled) setMessage(error.message || 'Could not load Dashboard ratings.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadBoard()
    return () => {
      cancelled = true
    }
  }, [])

  const groups = board.groups || []
  const topContent = board.topContent || []
  const totals = board.totals || {}
  const topGroup = groups[0]
  const topItem = topContent[0]
  const topGames = topContent.filter((item) => item.category === 'Games').slice(0, 5)
  const topMovies = topContent.filter((item) => item.category === 'Movies').slice(0, 5)
  const topSeries = topContent.filter((item) => item.category === 'Series').slice(0, 5)

  if (loading) return <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-10 text-center text-neutral-400">Loading Dashboard ratings...</div>
  if (message) return <div className="rounded-[2rem] border border-rose-400/30 bg-rose-950/30 p-5 text-rose-100">{message}</div>
  if (!groups.length && !topContent.length) return <FreshDashboard />

  return (
    <>
      <section className="mb-5 grid gap-3 md:grid-cols-4">
        <StatCard label="Top public group" value={topGroup?.name || 'No public groups yet'} detail={topGroup ? `★ ${Number(topGroup.averageRating || 0).toFixed(1)} avg · ${topGroup.memberCount} members` : 'Publish a group to join ratings.'} />
        <StatCard label="Top public item" value={topItem?.title || 'No public content yet'} detail={topItem ? `${topItem.category} · ${topItem.groupName} · score ${topItem.score}` : 'Public groups need rated content.'} />
        <StatCard label="Public groups" value={totals.publicGroups || totals.groups || 0} detail={`${totals.members || 0} visible members`} />
        <StatCard label="Public picks" value={totals.picks || 0} detail={`${totals.items || 0} visible items · ${totals.score || 0} score`} />
      </section>

      <section className="mb-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel eyebrow="Global groups" title="Best rated public groups" aside="Only opted-in groups">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {groups.length ? groups.slice(0, 8).map((group) => <PublicGroupCard key={group.id} group={group} />) : <EmptyPanel title="No public groups yet" description="Publish a group when you are ready for people to scout it." />}
          </div>
        </Panel>

        <Panel eyebrow="Global ratings" title="Overall top public content" aside="Movies · Series · Games">
          <div className="space-y-3">
            {topContent.length ? topContent.slice(0, 10).map((item) => <ContentRow key={`${item.category}-${item.groupId}-${item.id}`} item={item} />) : <EmptyPanel title="No ranked content yet" description="Ratings from public groups will fill this list." />}
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <Panel eyebrow="Movies" title="Top public movies" aside="Dashboard">
          <div className="space-y-3">{topMovies.length ? topMovies.map((item) => <ContentRow key={`movie-${item.groupId}-${item.id}`} item={item} />) : <p className="text-sm text-neutral-500">No public movies yet.</p>}</div>
        </Panel>
        <Panel eyebrow="Series" title="Top public series" aside="Dashboard">
          <div className="space-y-3">{topSeries.length ? topSeries.map((item) => <ContentRow key={`series-${item.groupId}-${item.id}`} item={item} />) : <p className="text-sm text-neutral-500">No public series yet.</p>}</div>
        </Panel>
        <Panel eyebrow="Games" title="Top public games" aside="Dashboard">
          <div className="space-y-3">{topGames.length ? topGames.map((item) => <ContentRow key={`game-${item.groupId}-${item.id}`} item={item} />) : <p className="text-sm text-neutral-500">No public games yet.</p>}</div>
        </Panel>
      </section>
    </>
  )
}

function YourSpaces() {
  const [groups, setGroups] = useState([])
  const [activeGroup, setActiveGroupState] = useState(null)
  const [signedIn, setSignedIn] = useState(!hasSupabase)

  useEffect(() => {
    let cancelled = false

    async function loadSpaces() {
      if (hasSupabase) {
        try {
          const session = await getCurrentSession()
          if (cancelled) return
          setSignedIn(Boolean(session?.user))
          if (!session?.user) {
            setGroups([])
            setActiveGroupState(null)
            return
          }
          const remoteGroups = await getRemoteGroups().catch(() => [])
          if (cancelled) return
          setGroups(remoteGroups)
          setActiveGroupState(getActiveGroup())
          return
        } catch {
          if (!cancelled) {
            setSignedIn(false)
            setGroups([])
            setActiveGroupState(null)
          }
          return
        }
      }

      setGroups(getGroups())
      setActiveGroupState(getActiveGroup())
    }

    loadSpaces()
    function handleChange() { loadSpaces() }
    window.addEventListener('cliquebase:groups-changed', handleChange)
    return () => {
      cancelled = true
      window.removeEventListener('cliquebase:groups-changed', handleChange)
    }
  }, [])

  function activate(group) {
    setActiveGroup(group.id)
    setActiveGroupState(group)
  }

  return (
    <section className="mt-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Your spaces</p>
          <h2 className="mt-1 text-3xl font-black text-white">Jump into a dashboard</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">Use the main Dashboard for global ratings, then jump into your Personal Library or one of your group dashboards.</p>
        </div>
        <Link to="/groups" className="w-fit rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-neutral-200">Manage groups</Link>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <Link to="/library" onClick={() => setActiveGroup('')} className={`rounded-3xl border p-4 transition ${!activeGroup ? 'border-white bg-white text-neutral-950' : 'border-white/10 bg-neutral-900 text-white hover:bg-white/[0.08]'}`}>
          <p className={`text-xs uppercase tracking-[0.25em] ${!activeGroup ? 'text-neutral-500' : 'text-neutral-500'}`}>Private</p>
          <h3 className="mt-2 text-2xl font-black">Personal Library</h3>
          <p className={`mt-2 text-sm ${!activeGroup ? 'text-neutral-600' : 'text-neutral-400'}`}>Your own saved picks and ratings.</p>
          <span className="mt-4 inline-flex rounded-2xl border border-current/20 px-3 py-2 text-xs font-semibold">{!activeGroup ? 'Active' : 'Open dashboard'}</span>
        </Link>

        {signedIn ? groups.map((group) => (
          <Link key={group.id} to={getGroupOpenPath(group)} onClick={() => activate(group)} className={`rounded-3xl border p-4 transition ${activeGroup?.id === group.id ? 'border-white bg-white text-neutral-950' : 'border-white/10 bg-neutral-900 text-white hover:bg-white/[0.08]'}`}>
            <p className={`text-xs uppercase tracking-[0.25em] ${activeGroup?.id === group.id ? 'text-neutral-500' : 'text-neutral-500'}`}>{group.isPublic ? 'Public group' : 'Private group'}</p>
            <h3 className="mt-2 truncate text-2xl font-black">{group.name}</h3>
            <p className={`mt-2 text-sm ${activeGroup?.id === group.id ? 'text-neutral-600' : 'text-neutral-400'}`}>{group.members?.length || 1} members · shared voting dashboard</p>
            <span className="mt-4 inline-flex rounded-2xl border border-current/20 px-3 py-2 text-xs font-semibold">{activeGroup?.id === group.id ? 'Active' : 'Open dashboard'}</span>
          </Link>
        )) : (
          <div className="rounded-3xl border border-dashed border-white/15 bg-neutral-900 p-4 text-neutral-400">
            <h3 className="text-xl font-bold text-white">Sign in to see groups</h3>
            <p className="mt-2 text-sm leading-6">Use Profile to sign in, then your group dashboards will appear here.</p>
          </div>
        )}

        {signedIn && !groups.length ? (
          <Link to="/groups" className="rounded-3xl border border-dashed border-white/15 bg-neutral-900 p-4 text-neutral-400 hover:bg-white/[0.08]">
            <h3 className="text-xl font-bold text-white">Create or join a group</h3>
            <p className="mt-2 text-sm leading-6">Start a group dashboard for friends, roommates, or a movie crew.</p>
          </Link>
        ) : null}
      </div>
    </section>
  )
}

export default function Leaderboard() {
  return (
    <PageShell active="home">
      <section className="mb-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20 sm:p-8">
        <p className="text-xs uppercase tracking-[0.35em] text-neutral-500">Main dashboard</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">What should we watch, play, or try next?</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-neutral-400">Start here for global ratings and public group suggestions. Then jump into your Personal Library or a specific group dashboard from the spaces below.</p>
      </section>

      {hasSupabase ? <GlobalRatings /> : <FreshDashboard />}
      <YourSpaces />
    </PageShell>
  )
}
