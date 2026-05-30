import { Link } from 'react-router-dom'
import PageShell from '../components/PageShell.jsx'
import { getActiveGroup } from '../lib/groups.js'

const sections = [
  { title: 'Movies', to: '/movies', icon: '🎬', description: 'Search a movie, save it to your personal library or group, then vote with friends.' },
  { title: 'Series', to: '/series', icon: '📺', description: 'Build the first binge list from scratch instead of starting with demo picks.' },
  { title: 'Games', to: '/games', icon: '🎮', description: 'Search the games API and add real suggestions to your library or group.' },
  { title: 'Videos', to: '/videos', icon: '📹', description: 'Drop links into a fresh group feed when you are ready.' },
  { title: 'Music', to: '/music', icon: '🎵', description: 'Paste song links into a simple fresh feed.' },
  { title: 'Board', to: '/leaderboard', icon: '🏆', description: 'Community rankings will fill up once public groups start rating content.' },
]

function StartCard({ section }) {
  return (
    <Link to={section.to} className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 transition hover:-translate-y-0.5 hover:bg-white/[0.06]">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl text-neutral-950">{section.icon}</div>
        <div className="min-w-0">
          <h2 className="text-2xl font-black text-white">{section.title}</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-400">{section.description}</p>
          <span className="mt-4 inline-flex rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-neutral-200">Open {section.title}</span>
        </div>
      </div>
    </Link>
  )
}

export default function Home() {
  const activeGroup = getActiveGroup()

  return (
    <PageShell active="home">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] shadow-2xl shadow-black/20">
        <div className="grid gap-0 md:grid-cols-[1.15fr_0.85fr]">
          <div className="p-5 sm:p-8">
            <p className="text-xs uppercase tracking-[0.35em] text-neutral-500">CliqueBase</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-6xl">
              Start your own recommendation database.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-400 sm:text-lg">
              Create a group, invite friends, and build the first movie, series, game, video, and music lists from zero.
            </p>
            {activeGroup ? (
              <p className="mt-4 inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100">
                Active group: <strong className="ml-1 text-white">{activeGroup.name}</strong>
              </p>
            ) : (
              <p className="mt-4 inline-flex rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-neutral-300">
                Use Personal library first, or open Profile to create your first group.
              </p>
            )}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link to="/movies" className="rounded-2xl bg-white px-5 py-3 text-center font-semibold text-neutral-950 transition hover:bg-neutral-200">
                Add first pick
              </Link>
              <button type="button" className="rounded-2xl border border-white/10 px-5 py-3 text-center font-semibold text-white transition hover:bg-white hover:text-neutral-950">
                Open Profile to create group
              </button>
            </div>
          </div>

          <div className="relative flex min-h-[320px] items-end bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.16),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,0,0,0.4))] p-5">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">Fresh start</p>
              <h2 className="mt-2 text-3xl font-black text-white">No global demo picks</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-neutral-300">Your dashboard fills up only with content you or your groups actually add.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        {sections.map((section) => <StartCard key={section.title} section={section} />)}
      </section>
    </PageShell>
  )
}
