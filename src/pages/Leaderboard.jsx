import PageShell from '../components/PageShell.jsx'
import { demoGames, demoMovies, demoSeries, demoVideos } from '../lib/demoMovies.js'

const categories = [
  { label: 'Movies', items: demoMovies, accent: '🎬' },
  { label: 'Series', items: demoSeries, accent: '📺' },
  { label: 'Games', items: demoGames, accent: '🎮' },
  { label: 'Videos', items: demoVideos, accent: '📹' },
]

function ranked(items) {
  return items.slice().sort((a, b) => b.score - a.score || b.picks - a.picks)
}

export default function Leaderboard() {
  const allItems = categories.flatMap((category) => category.items.map((item) => ({ ...item, category: category.label })))
  const overall = ranked(allItems).slice(0, 8)

  return (
    <PageShell active="leaderboard">
      <section className="mb-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20 sm:p-8">
        <p className="text-xs uppercase tracking-[0.35em] text-neutral-500">Group stats</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">Leaderboard</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-400">See what is winning across movies, series, games, and videos.</p>
      </section>

      <section className="mb-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Overall</p>
            <h2 className="mt-1 text-2xl font-bold text-white">Top picks</h2>
          </div>
          <span className="text-sm text-neutral-500">All categories</span>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {overall.map((item, index) => (
            <div key={`${item.category}-${item.id}`} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900 p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-neutral-950">{index + 1}</div>
              {item.poster ? <img src={item.poster} alt="" className="h-14 w-10 rounded-lg object-cover" /> : null}
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-white">{item.title}</div>
                <div className="mt-1 text-xs text-neutral-400">{item.category} · {item.picks} picks · score {item.score}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {categories.map((category) => (
          <div key={category.label} className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">{category.accent} Category</p>
                <h2 className="mt-1 text-2xl font-bold text-white">{category.label}</h2>
              </div>
              <span className="text-sm text-neutral-500">{category.items.length} picks</span>
            </div>
            <div className="space-y-2">
              {ranked(category.items).slice(0, 4).map((item, index) => (
                <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-neutral-900 p-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-sm font-black text-white">{index + 1}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-white">{item.title}</div>
                    <div className="text-xs text-neutral-500">{item.picks} picks · score {item.score}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </PageShell>
  )
}
