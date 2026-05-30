import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getSavedHandle, saveSharedHandle } from '../lib/handle.js'
import { createGroup, getActiveGroup, getGroupInvitePath, getGroupInviteUrl, getGroups, joinGroup, setActiveGroup } from '../lib/groups.js'

const links = [
  { key: 'home', to: '/', label: 'Home', icon: '⌂' },
  { key: 'movies', to: '/movies', label: 'Movies', icon: '🎬' },
  { key: 'series', to: '/series', label: 'Series', icon: '📺' },
  { key: 'games', to: '/games', label: 'Games', icon: '🎮' },
  { key: 'videos', to: '/videos', label: 'Videos', icon: '📹' },
  { key: 'music', to: '/music', label: 'Music', icon: '🎵' },
  { key: 'leaderboard', to: '/leaderboard', label: 'Board', icon: '🏆' },
]

async function copyToClipboard(value) {
  if (!value) return false
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return true
    } catch {
      return false
    }
  }
  return false
}

export default function PageNav({ active = 'home' }) {
  const [handle, setHandle] = useState('')
  const [activeGroup, setActiveGroupState] = useState(null)
  const [groups, setGroups] = useState([])
  const [menuOpen, setMenuOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [groupDraft, setGroupDraft] = useState('')
  const [inviteDraft, setInviteDraft] = useState('')
  const [savedMessage, setSavedMessage] = useState('')

  function refreshGroups() {
    setGroups(getGroups())
    setActiveGroupState(getActiveGroup())
  }

  useEffect(() => {
    const saved = getSavedHandle()
    setHandle(saved)
    setDraft(saved)
    refreshGroups()
  }, [])

  function flash(message) {
    setSavedMessage(message)
    setTimeout(() => setSavedMessage(''), 1800)
  }

  function saveHandle() {
    const saved = saveSharedHandle(draft)
    if (!saved) {
      flash('Add a profile name first.')
      return ''
    }

    setHandle(saved)
    setDraft(saved)
    flash(`Continuing as ${saved}`)
    return saved
  }

  function currentHandle() {
    return handle || saveHandle() || 'anonymous'
  }

  function handleCreateGroup(event) {
    event.preventDefault()
    const creator = currentHandle()
    const group = createGroup(groupDraft || `${creator}'s clique`, creator)
    setGroupDraft('')
    refreshGroups()
    flash(`${group.name} created and active.`)
  }

  function handleJoinGroup(event) {
    event.preventDefault()
    if (!inviteDraft.trim()) {
      flash('Paste an invite code first.')
      return
    }

    const joined = joinGroup(inviteDraft.trim().replace(/^.*\/invite\//, ''), currentHandle())
    setInviteDraft('')
    refreshGroups()
    flash(`Joined ${joined.name}.`)
  }

  function activateGroup(group) {
    setActiveGroup(group.id)
    refreshGroups()
    flash(`${group.name} is active.`)
  }

  async function copyInvite(group) {
    const copied = await copyToClipboard(getGroupInviteUrl(group))
    flash(copied ? 'Invite link copied.' : `Invite: ${getGroupInvitePath(group)}`)
  }

  const activeLink = links.find((link) => link.key === active)

  return (
    <>
      <header className="mb-5 rounded-[2rem] border border-white/10 bg-neutral-950/95 px-3 py-3 shadow-2xl shadow-black/30 backdrop-blur sm:rounded-full sm:px-4">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="min-w-0 rounded-full px-2 py-1 transition hover:bg-white/10">
            <div className="text-xs uppercase tracking-[0.3em] text-neutral-500">CliqueBase</div>
            <div className="truncate text-lg font-black text-white sm:text-xl">{activeLink?.icon} {activeLink?.label || 'Home'}</div>
          </Link>

          <div className="hidden min-w-0 flex-1 justify-center px-4 md:flex">
            <div className="truncate rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-neutral-300">
              {activeGroup ? <>Group: <strong className="text-white">{activeGroup.name}</strong></> : 'No group selected'}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => setMenuOpen(true)} className="rounded-full bg-white px-4 py-3 text-sm font-bold text-neutral-950 transition hover:bg-neutral-200" aria-label="Open menu">
              ☰ <span className="hidden sm:inline">Menu</span>
            </button>
            <button type="button" onClick={() => { refreshGroups(); setEditing(true) }} aria-label="Profile" className="flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-white transition hover:bg-white hover:text-black sm:px-4">
              <span className="sm:mr-1.5">👤</span>
              <span className="hidden max-w-[5.5rem] truncate sm:inline">{handle || 'Profile'}</span>
            </button>
          </div>
        </div>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 bg-black/70 p-4 backdrop-blur-sm">
          <div className="ml-auto flex h-full w-full max-w-sm flex-col rounded-[2rem] border border-white/10 bg-neutral-950 p-5 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-neutral-500">Navigation</div>
                <h2 className="mt-1 text-3xl font-black text-white">Menu</h2>
              </div>
              <button type="button" onClick={() => setMenuOpen(false)} className="text-3xl text-neutral-400 hover:text-white" aria-label="Close menu">×</button>
            </div>

            <nav className="mt-6 space-y-2">
              {links.map((link) => (
                <Link key={link.key} to={link.to} onClick={() => setMenuOpen(false)} className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition ${active === link.key ? 'bg-white font-bold text-neutral-950' : 'bg-white/[0.04] text-neutral-200 hover:bg-white/10 hover:text-white'}`}>
                  <span className="text-xl">{link.icon}</span>
                  <span>{link.label}</span>
                </Link>
              ))}
            </nav>

            <div className="mt-auto rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Profile</p>
              <p className="mt-2 text-sm text-neutral-300">{handle || 'No profile name yet'}</p>
              <p className="mt-1 text-sm text-neutral-500">{activeGroup ? `Active group: ${activeGroup.name}` : 'Create a group in Profile'}</p>
              <button type="button" onClick={() => { setMenuOpen(false); refreshGroups(); setEditing(true) }} className="mt-4 w-full rounded-2xl bg-white px-4 py-3 font-semibold text-neutral-950">Open profile</button>
            </div>
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-white/10 bg-neutral-950 p-5 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-neutral-500">Profile & groups</div>
                <h2 className="mt-1 text-2xl font-bold text-white">Your clique setup</h2>
                <p className="mt-2 text-sm text-neutral-400">Manage your local profile, active group, and invite links from one place.</p>
              </div>
              <button type="button" onClick={() => setEditing(false)} className="text-2xl text-neutral-400 hover:text-white">×</button>
            </div>

            {savedMessage ? <p className="mt-4 rounded-2xl bg-emerald-700 p-3 text-sm text-white">{savedMessage}</p> : null}

            <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <label className="block text-sm font-semibold text-neutral-300">Profile name</label>
              <div className="mt-2 flex gap-2">
                <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="example: Sip" className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
                <button type="button" onClick={saveHandle} className="rounded-2xl bg-white px-5 py-3 font-semibold text-black">Save</button>
              </div>
            </section>

            <section className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-neutral-500">Active group</div>
                  <h3 className="mt-1 text-xl font-bold text-white">{activeGroup?.name || 'No group selected'}</h3>
                  <p className="mt-1 text-sm text-neutral-400">New music links and future votes use this group context.</p>
                </div>
                {activeGroup ? (
                  <button type="button" onClick={() => copyInvite(activeGroup)} className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950">Copy invite</button>
                ) : null}
              </div>
            </section>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <form onSubmit={handleCreateGroup} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <label className="text-sm font-semibold text-neutral-300">Create group</label>
                <input value={groupDraft} onChange={(event) => setGroupDraft(event.target.value)} placeholder="Friday movie crew" className="mt-2 w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
                <button className="mt-3 w-full rounded-2xl bg-white px-5 py-3 font-semibold text-neutral-950">Create & activate</button>
              </form>

              <form onSubmit={handleJoinGroup} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <label className="text-sm font-semibold text-neutral-300">Join with invite</label>
                <input value={inviteDraft} onChange={(event) => setInviteDraft(event.target.value)} placeholder="Paste code or invite link" className="mt-2 w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
                <button className="mt-3 w-full rounded-2xl border border-white/10 px-5 py-3 font-semibold text-white hover:bg-white hover:text-neutral-950">Join group</button>
              </form>
            </div>

            <section className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-neutral-500">Your groups</div>
                  <h3 className="mt-1 text-xl font-bold text-white">Switch context</h3>
                </div>
                <span className="text-sm text-neutral-500">{groups.length} group{groups.length === 1 ? '' : 's'}</span>
              </div>

              <div className="mt-3 space-y-2">
                {groups.length ? groups.map((group) => (
                  <div key={group.id} className={`rounded-2xl border p-3 ${activeGroup?.id === group.id ? 'border-white bg-white text-neutral-950' : 'border-white/10 bg-neutral-900 text-white'}`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{group.name}</div>
                        <div className={`mt-1 text-xs ${activeGroup?.id === group.id ? 'text-neutral-600' : 'text-neutral-500'}`}>{group.members.length || 1} members · {group.inviteCode}</div>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => activateGroup(group)} className={`rounded-xl px-3 py-2 text-xs font-semibold ${activeGroup?.id === group.id ? 'bg-neutral-950 text-white' : 'bg-white text-neutral-950'}`}>{activeGroup?.id === group.id ? 'Active' : 'Use'}</button>
                        <button type="button" onClick={() => copyInvite(group)} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${activeGroup?.id === group.id ? 'border-neutral-300 text-neutral-950' : 'border-white/10 text-white'}`}>Invite</button>
                      </div>
                    </div>
                  </div>
                )) : <p className="rounded-2xl border border-dashed border-white/15 p-4 text-center text-sm text-neutral-500">Create the first group here, then share its invite link.</p>}
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </>
  )
}
