import { Link } from 'react-router-dom'
import PageShell from '../components/PageShell.jsx'

const features = [
  {
    title: 'Movie picks',
    description: 'Search, nominate, swipe, and rank what the group should watch next.',
    to: '/movies',
  },
  {
    title: 'Series, games, and links',
    description: 'Keep the same reusable flow for other group recommendations.',
    to: '/series',
  },
  {
    title: 'Safe by default',
    description: 'API keys will stay behind serverless endpoints instead of being shipped to the browser.',
    to: '/leaderboard',
  },
]

export default function Home() {
  return (
    <PageShell active="home">
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20 sm:p-8">
        <p className="text-xs uppercase tracking-[0.35em] text-neutral-500">Group recommendations</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-6xl">
          CliqueBase
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-400 sm:text-lg">
          A clean rebuild of the friend-group picker. Start with the reusable UI, then add secure API proxies and locked-down Supabase policies before going public.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link to="/movies" className="rounded-2xl bg-white px-5 py-3 text-center font-semibold text-neutral-950 transition hover:bg-neutral-200">
            Open movie picker
          </Link>
          <a href="https://github.com/Sippos/CliqueBase" target="_blank" rel="noreferrer" className="rounded-2xl border border-white/10 px-5 py-3 text-center font-semibold text-neutral-200 transition hover:bg-white hover:text-neutral-950">
            View repo
          </a>
        </div>
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-3">
        {features.map((feature) => (
          <Link key={feature.title} to={feature.to} className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5 transition hover:-translate-y-0.5 hover:bg-white/[0.06]">
            <h2 className="text-xl font-bold text-white">{feature.title}</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-400">{feature.description}</p>
          </Link>
        ))}
      </section>
    </PageShell>
  )
}
