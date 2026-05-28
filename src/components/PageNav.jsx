import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getSavedHandle, saveSharedHandle } from '../lib/handle'

const links = [
  { key: 'home', to: '/', label: 'Home', icon: '⌂' },
  { key: 'movies', to: '/movies', label: 'Movies', icon: '🎬' },
  { key: 'series', to: '/series', label: 'Series', icon: '📺' },
  { key: 'games', to: '/games', label: 'Games', icon: '🎮' },
  { key: 'videos', to: '/videos', label: 'Videos', icon: '📹' },
  { key: 'leaderboard', to: '/leaderboard', label: 'Board', icon: '🏆' },
]

export default function PageNav({ active = 'home' }) {
  const [handle, setHandle] = useState('')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [savedMessage, setSavedMessage] = useState('')

  useEffect(() => {
    const saved = getSavedHandle()
    setHandle(saved)
    setDraft(saved)
  }, [])

  function saveHandle() {
    const saved = saveSharedHandle(draft)
    if (!saved) return

    setHandle(saved)
    setDraft(saved)
    setSavedMessage(`Continuing as ${saved}`)

    setTimeout(() => {
      setSavedMessage('')
      setEditing(false)
    }, 900)
  }

  const linkClass = (name) =>
    `flex h-10 items-center justify-center rounded-full px-2 text-xs transition sm:h-11 sm:px-4 sm:text-sm ${
      active === name
        ? 'bg-white font-semibold text-neutral-950'
        : 'text-neutral-300 hover:bg-white/10 hover:text-white'
    }`

  return (
    <>
      <header className="mb-5 rounded-[2rem] border border-white/10 bg-neutral-950/95 px-2 py-2 shadow-2xl shadow-black/30 backdrop-blur sm:rounded-full sm:px-4 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <nav className="grid min-w-0 flex-1 grid-cols-6 gap-1 rounded-full bg-white/[0.04] p-1 text-center">
            {links.map((link) => (
              <Link key={link.key} to={link.to} aria-label={link.label} title={link.label} className={linkClass(link.key)}>
                <span className="text-base sm:hidden">{link.icon}</span>
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            ))}
          </nav>

          <button type="button" onClick={() => setEditing(true)} aria-label="Profile" className="flex h-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-2.5 text-sm font-semibold text-white transition hover:bg-white hover:text-black sm:px-4">
            <span className="sm:mr-1.5">👤</span>
            <span className="hidden max-w-[4.5rem] truncate sm:inline">{handle || 'Profile'}</span>
          </button>
        </div>
      </header>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-neutral-950 p-5 shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-neutral-500">Profile name</div>
                <h2 className="mt-1 text-2xl font-bold text-white">Continue as</h2>
              </div>
              <button type="button" onClick={() => setEditing(false)} className="text-2xl text-neutral-400 hover:text-white">×</button>
            </div>

            <p className="mt-3 text-sm text-neutral-400">
              This local profile name keeps the app usable while proper login and Supabase policies are added.
            </p>

            <label className="mt-5 block text-sm font-semibold text-neutral-300">Profile name</label>
            <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="example: Sip" className="mt-2 w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
            {savedMessage ? <p className="mt-3 rounded-2xl bg-emerald-700 p-3 text-sm text-white">{savedMessage}</p> : null}
            <button type="button" onClick={saveHandle} className="mt-4 w-full rounded-2xl bg-white px-5 py-3 font-semibold text-black">Use this profile name</button>
          </div>
        </div>
      ) : null}
    </>
  )
}
