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

function getSubmitters(items) {
  const people = new Map()

  for (const item of items) {
    const name = item.nominated_by || 'Unknown'
    const current = people.get(name) || {
      name,
      submitted: 0,
      totalScore: 0,
      totalPicks: 0,
      categories: new Set(),
    }

    current.submitted += 1
    current.totalScore += Number(item.score || 0)
    current.totalPicks += Number(item.picks || 0)
    current.categories.add(item.category)

    people.set(name, current)
  }

  return Array.from(people.values())
    .map((person) => ({
      ...person,
      impact: person.totalScore + person.totalPicks,
      averageScore: person.submitted ? person.totalScore / person.submitted : 0,
      categories: Array.from(person.categories),
    }))
    .sort((a, b) => b.impact - a.impact || b.submitted - a.submitted || b.averageScore - a.averageScore)
}

export default function Leaderboard() {
  const allItems = categories.flatMap((category) => category.items.map((item) => ({ ...item, category: category.label })))
  const userRanking = getSubmitters(allItems)
  const contentRanking = ranked(allItems).slice(0, 8)
  const totalSubmitted = allItems.length
  const totalPicks = allItems.reduce((sum, item) => sum + Number(item.picks || 0), 0)
  const topSubmitter = userRanking[0]
  const topContent = contentRanking[0]

  return (
    <PageShell active="leaderboard">
      <section className="mb-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20 sm:p-8">
        <p className="text-xs uppercase tracking-[0.35em] text-neutral-500">Group stats</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">Leaderboard</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-400">Content and users are ranked separately so titles compete with titles, while submitters compete with other submitters.</p>
      </section>

      <section className="mb-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Top content</p>
          <h2 className="mt-2 truncate text-2xl font-black text-white">{topContent?.title || 'No content yet'}</h2>
          <p className="mt-1 text-sm text-neutral-400">{topContent ? `${topContent.category} · ${topContent.picks} picks · score ${topContent.score}` : 'Add picks to start the board.'}</p>
        </div>
        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Top user</p>
          <h2 className="mt-2 truncate text-2xl font-black text-white">{topSubmitter?.name || 'No one yet'}</h2>
          <p className="mt-1 text-sm text-neutral-400">{topSubmitter ? `${topSubmitter.submitted} submissions · ${topSubmitter.impact} impact` : 'Add submitters to start the board.'}</p>
        </div>
        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Submitted</p>
          <h2 className="mt-2 text-2xl font-black text-white">{totalSubmitted}</h2>
          <p className="mt-1 text-sm text-neutral-400">Across movies, series, games, and videos</p>
        </div>
        <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Group picks</p>
          <h2 className="mt-2 text-2xl font-black text-white">{totalPicks}</h2>
          <p className="mt-1 text-sm text-neutral-400">Total support across all content</p>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Content</p>
              <h2 className="mt-1 text-2xl font-bold text-white">Content ranking</h2>
            </div>
            <span className="text-sm text-neutral-500">Ranked by score, then picks</span>
          </div>

          <div className="space-y-3">
            {contentRanking.map((item, index) => (
              <div key={`${item.category}-${item.id}`} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900 p-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-sm font-black text-white">C{index + 1}</div>
                {item.poster ? <img src={item.poster} alt="" className="h-16 w-11 rounded-lg object-cover" /> : null}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-lg font-bold text-white">{item.title}</div>
                  <div className="mt-1 text-xs text-neutral-400">{item.category} · by {item.nominated_by || 'Unknown'}</div>
                </div>
                <div className="rounded-2xl border border-white/10 px-3 py-2 text-right">
                  <div className="text-lg font-black text-white">{item.score}</div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">Score</div>
                  <div className="mt-1 text-xs text-neutral-400">{item.picks} picks</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Users</p>
              <h2 className="mt-1 text-2xl font-bold text-white">User ranking</h2>
            </div>
            <span className="text-sm text-neutral-500">Impact = score + picks</span>
          </div>

          <div className="space-y-3">
            {userRanking.map((person, index) => (
              <div key={person.name} className="rounded-2xl border border-white/10 bg-neutral-900 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-neutral-950">U{index + 1}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-lg font-bold text-white">{person.name}</div>
                    <div className="mt-1 text-xs text-neutral-400">{person.submitted} submitted · {person.totalPicks} picks · {person.totalScore} score · avg {person.averageScore.toFixed(1)}</div>
                    <div className="mt-2 truncate text-xs text-neutral-500">{person.categories.join(' · ')}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 px-3 py-2 text-right">
                    <div className="text-lg font-black text-white">{person.impact}</div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">Impact</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PageShell>
  )
}
