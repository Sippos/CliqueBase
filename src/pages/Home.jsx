import { Link } from 'react-router-dom'
import PageShell from '../components/PageShell.jsx'
import { demoGames, demoMovies, demoSeries, demoVideos } from '../lib/demoMovies.js'
import { getActiveGroup } from '../lib/groups.js'

const demoMusic = [
  { id: 'music-1', title: 'Instant Crush', picks: 3, score: 8, poster: '', category: 'Music', icon: '🎵' },
  { id: 'music-2', title: 'Party playlist drop', picks: 2, score: 5, poster: '', category: 'Music', icon: '🎵' },
  { id: 'music-3', title: 'YouTube music video', picks: 1, score: 3, poster: '', category: 'Music', icon: '🎵' },
]

const sections = [
  { title: 'Movies', to: '/movies', items: demoMovies.slice().sort((a, b) => b.score - a.score).slice(0, 3) },
  { title: 'Series', to: '/series', items: demoSeries.slice(0, 3) },
  { title: 'Games', to: '/games', items: demoGames.slice(0, 3) },
  { title: 'Videos', to: '/videos', items: demoVideos.slice(0, 2) },
  { title: 'Music', to: '/music', items: demoMusic.slice(0, 3) },
]

const featuredPool = [
  ...demoMovies.slice(0, 4).map((item) => ({ ...item, category: 'Movie', icon: '🎬', action: '/movies' })),
  ...demoSeries.slice(0, 4).map((item) => ({ ...item, category: 'Series', icon: '📺', action: '/series' })),
  ...demoGames.slice(0, 4).map((item) => ({ ...item, category: 'Game', icon: '🎮', action: '/games' })),
]

function getFeaturedItem() {
  if (!featuredPool.length) return null
  const day = new Date().getDate()
  return featuredPool[day % featuredPool.length]
}

function TopCard({ item, index }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-neutral-950">{index + 1}</div>
      {item.poster ? <img src={item.poster} alt="" className="h-14 w-10 rounded-lg object-cover" /> : <div className="flex h-14 w-10 items-center justify-center rounded-lg bg-neutral-800 text-lg">★</div>}
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-white">{item.title}</div>
        <div className="mt-1 text-xs text-neutral-400">{item.picks} picks · score {item.score}</div>
      </div>
    </div>
  )
}

export default function Home() {
  const featured = getFeaturedItem()
  const activeGroup = getActiveGroup()

  return (
    <PageShell active="home">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] shadow-2xl shadow-black/20">
        <div className="grid gap-0 md:grid-cols-[1.15fr_0.85fr]">
          <div className="p-5 sm:p-8">
            <p className="text-xs uppercase tracking-[0.35em] text-neutral-500">CliqueBase</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-6xl">
              Decide what is worth watching, playing, hearing, and saving.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-400 sm:text-lg">
              Build a clique, collect recommendations, vote through the pile, and discover what public groups rate highest.
            </p>
            {activeGroup ? (
              <p className="mt-4 inline-flex rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-neutral-300">
                Active group: <strong className="ml-1 text-white">{activeGroup.name}</strong>
              </p>
            ) : (
              <p className="mt-4 inline-flex rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-neutral-300">
                Open Profile to create your first group, then start voting with friends.
              </p>
            )}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link to="/movies" className="rounded-2xl bg-white px-5 py-3 text-center font-semibold text-neutral-950 transition hover:bg-neutral-200">
                Start voting
              </Link>
              <Link to="/leaderboard" className="rounded-2xl border border-white/10 px-5 py-3 text-center font-semibold text-white transition hover:bg-white hover:text-neutral-950">
                Explore community
              </Link>
            </div>
          </div>

          <div className="relative min-h-[320px] bg-neutral-900">
            {featured?.poster ? <img src={featured.poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" /> : null}
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/30 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-neutral-300">Featured pick · {featured?.icon} {featured?.category}</p>
              <h2 className="mt-2 text-3xl font-black text-white">{featured?.title || 'Start a new recommendation pile'}</h2>
              <p className="mt-2 text-sm text-neutral-300">A rotating preview from movies, series, and games. Later this can become a live community or group highlight.</p>
              {featured?.action ? <Link to={featured.action} className="mt-4 inline-flex rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950">Open {featured.category}</Link> : null}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        {sections.map((section) => (
          <Link key={section.title} to={section.to} className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 transition hover:-translate-y-0.5 hover:bg-white/[0.06]">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Top picks</p>
                <h2 className="mt-1 text-2xl font-bold text-white">{section.title}</h2>
              </div>
              <span className="text-sm text-neutral-500">View all</span>
            </div>
            <div className="space-y-2">
              {section.items.map((item, index) => <TopCard key={item.id} item={item} index={index} />)}
            </div>
          </Link>
        ))}
      </section>
    </PageShell>
  )
}
