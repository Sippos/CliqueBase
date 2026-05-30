import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PageShell from '../components/PageShell.jsx'
import { getActiveGroup, parseInviteCode } from '../lib/groups.js'

const sections = [
  { title: 'Movies', to: '/movies', code: 'MOV', description: 'Search a movie, save it to your personal library or group, then vote with friends.' },
  { title: 'Series', to: '/series', code: 'SER', description: 'Build the first binge list from scratch instead of starting with demo picks.' },
  { title: 'Games', to: '/games', code: 'GAM', description: 'Search the games API and add real suggestions to your library or group.' },
  { title: 'Videos', to: '/videos', code: 'VID', description: 'Drop links into a fresh group feed when you are ready.' },
  { title: 'Music', to: '/music', code: 'MUS', description: 'Paste song links into a simple fresh feed.' },
  { title: 'Board', to: '/leaderboard', code: 'BRD', description: 'Community rankings fill up once public groups start rating content.' },
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

export default function Home() {
  const activeGroup = getActiveGroup()
  const navigate = useNavigate()
  const [inviteDraft, setInviteDraft] = useState('')
  const [inviteError, setInviteError] = useState('')

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
        <div className="grid gap-0 md:grid-cols-[1.15fr_0.85fr]">
          <div className="p-5 sm:p-8">
            <p className="text-xs uppercase tracking-[0.35em] text-neutral-500">CliqueBase</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-6xl">
              Start your own recommendation database.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-400 sm:text-lg">
              Create a group, join a friend, or keep a personal library first. The database starts empty and fills only with real picks.
            </p>
            {activeGroup ? (
              <p className="mt-4 inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100">
                Active group: <strong className="ml-1 text-white">{activeGroup.name}</strong>
              </p>
            ) : (
              <p className="mt-4 inline-flex rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm text-neutral-300">
                Use Personal library first, join an invite, or create a group from Profile.
              </p>
            )}
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link to="/movies" className="rounded-2xl bg-white px-5 py-3 text-center font-semibold text-neutral-950 transition hover:bg-neutral-200">
                Add first pick
              </Link>
              <Link to="/groups" className="rounded-2xl border border-white/10 px-5 py-3 text-center font-semibold text-white transition hover:bg-white hover:text-neutral-950">
                Create group
              </Link>
            </div>
          </div>

          <div className="relative flex min-h-[320px] items-end bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.16),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,0,0,0.4))] p-5">
            <div className="w-full">
              <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">Fresh start</p>
              <h2 className="mt-2 text-3xl font-black text-white">Join by invite</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-neutral-300">A friend can send an invite link. You can open it directly, or paste the code here.</p>
              <form onSubmit={openInvite} className="mt-5 rounded-3xl border border-white/10 bg-black/25 p-3 backdrop-blur">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input value={inviteDraft} onChange={(event) => { setInviteDraft(event.target.value); setInviteError('') }} placeholder="Paste invite link or code" className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-neutral-950/80 px-4 py-3 text-white outline-none" />
                  <button className="rounded-2xl bg-white px-5 py-3 font-semibold text-neutral-950 hover:bg-neutral-200">Open invite</button>
                </div>
                {inviteError ? <p className="mt-2 text-sm text-rose-200">{inviteError}</p> : null}
              </form>
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
