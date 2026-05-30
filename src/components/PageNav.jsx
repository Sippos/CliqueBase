import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import AppIcon from './AppIcon.jsx'
import { getSavedHandle, saveSharedHandle } from '../lib/handle.js'
import {
  GROUPS_CHANGED_EVENT,
  createGroup as createLocalGroup,
  getActiveGroup,
  getActiveGroupId,
  getGroupInvitePath,
  getGroupInviteUrl,
  getGroupOpenPath,
  getGroups,
  joinGroup as joinLocalGroup,
  parseInviteCode,
  setActiveGroup,
} from '../lib/groups.js'
import {
  createRemoteGroup,
  getCurrentSession,
  getProfile,
  getRemoteGroups,
  hasSupabase,
  joinRemoteGroup,
  onAuthStateChanged,
  saveProfile,
  setGroupPublic,
  signInWithEmail,
  signOut,
  signUpWithEmail,
} from '../lib/supabaseClient.js'

const primaryLinks = [
  { key: 'explore', to: '/explore', label: 'Explore', icon: 'explore', description: 'Public discovery' },
  { key: 'library', to: '/dashboard', label: 'My Library', icon: 'dashboard', description: 'Private dashboard' },
  { key: 'groups', to: '/groups', label: 'Cliques', icon: 'users', description: 'Shared spaces' },
]

const mediaLinks = [
  { key: 'movies', to: '/movies', label: 'Movies', icon: 'movies' },
  { key: 'series', to: '/series', label: 'Series', icon: 'series' },
  { key: 'games', to: '/games', label: 'Games', icon: 'games' },
  { key: 'videos', to: '/videos', label: 'Videos', icon: 'videos' },
  { key: 'music', to: '/music', label: 'Music', icon: 'music' },
]

const activeMap = {
  home: 'library',
  dashboard: 'library',
  library: 'library',
  cliques: 'groups',
  groups: 'groups',
  leaderboard: 'explore',
  explore: 'explore',
}

function normalizeActiveKey(active) {
  return activeMap[active] || active || 'library'
}

function isPrimaryActive(linkKey, activeKey) {
  if (linkKey === activeKey) return true
  if (linkKey === 'library' && ['movies', 'series', 'games', 'videos', 'music'].includes(activeKey)) return true
  return false
}

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

function sessionName(session, profile, fallback = '') {
  return profile?.display_name || fallback || session?.user?.user_metadata?.display_name || session?.user?.email?.split('@')[0] || ''
}

function LogoMark() {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <img
        src="/cliquebase-logo-mark.png?v=3"
        alt=""
        aria-hidden="true"
        className="h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14"
      />
      <div className="min-w-0">
        <span className="block text-2xl font-black tracking-tight text-white sm:text-3xl">CliqueBase</span>
        <span className="block text-xs uppercase tracking-[0.28em] text-neutral-500">Find the next pick</span>
      </div>
    </div>
  )
}

export default function PageNav({ active = 'library' }) {
  const [handle, setHandle] = useState('')
  const [activeGroup, setActiveGroupState] = useState(null)
  const [groups, setGroups] = useState([])
  const [session, setSession] = useState(null)
  const [mainOpen, setMainOpen] = useState(false)
  const [mediaOpen, setMediaOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [groupDraft, setGroupDraft] = useState('')
  const [inviteDraft, setInviteDraft] = useState('')
  const [authMode, setAuthMode] = useState('sign-in')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authNotice, setAuthNotice] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const activeKey = normalizeActiveKey(active)
  const activePrimary = primaryLinks.find((link) => isPrimaryActive(link.key, activeKey)) || primaryLinks[1]
  const activeMedia = mediaLinks.find((link) => link.key === activeKey)
  const profileLabel = session?.user ? (handle || session.user.email?.split('@')[0] || 'Account') : 'Profile'
  const spaceLabel = activeGroup?.name || 'My Library'
  const usingRemoteGroups = hasSupabase && Boolean(session?.user)

  function flash(text) {
    setMessage(text)
    setTimeout(() => setMessage(''), 2500)
  }

  function closeMenus() {
    setMainOpen(false)
    setMediaOpen(false)
  }

  function clearSessionUi() {
    setSession(null)
    setHandle('')
    setDraft('')
    setGroups([])
    setActiveGroupState(null)
    setActiveGroup('')
  }

  async function refreshGroups() {
    if (hasSupabase) {
      try {
        const nextSession = await getCurrentSession()
        setSession(nextSession)
        if (!nextSession?.user) {
          clearSessionUi()
          return
        }

        const saved = getSavedHandle()
        const profile = await getProfile().catch(() => null)
        const displayName = sessionName(nextSession, profile, saved)
        if (displayName) {
          saveSharedHandle(displayName)
          setHandle(displayName)
          setDraft(displayName)
        }

        const remoteGroups = await getRemoteGroups().catch(() => [])
        setGroups(remoteGroups)
        const activeId = getActiveGroupId()
        const nextActive = activeId ? remoteGroups.find((group) => group.id === activeId) || null : null
        setActiveGroupState(nextActive)
        if (activeId && !nextActive) setActiveGroup('')
      } catch (error) {
        clearSessionUi()
        flash(error.message || 'Could not sync your account.')
      }
      return
    }

    const saved = getSavedHandle()
    setHandle(saved)
    setDraft((current) => current || saved)
    setSession(null)
    setGroups(getGroups())
    setActiveGroupState(getActiveGroup())
  }

  useEffect(() => {
    refreshGroups()
    function handleChange() { refreshGroups() }
    window.addEventListener(GROUPS_CHANGED_EVENT, handleChange)
    const unsubscribe = hasSupabase ? onAuthStateChanged((nextSession) => {
      if (!nextSession?.user) clearSessionUi()
      else refreshGroups()
    }) : () => {}
    return () => {
      window.removeEventListener(GROUPS_CHANGED_EVENT, handleChange)
      unsubscribe()
    }
  }, [])

  async function currentHandle() {
    const saved = saveSharedHandle(draft || handle)
    if (saved && session?.user) await saveProfile(saved).catch(() => null)
    if (saved) {
      setHandle(saved)
      setDraft(saved)
    }
    return saved || handle || 'anonymous'
  }

  function usePersonalLibrary() {
    setActiveGroup('')
    setActiveGroupState(null)
    closeMenus()
    flash('Viewing My Library.')
    refreshGroups()
  }

  function activateGroup(group) {
    setActiveGroup(group.id)
    setActiveGroupState(group)
    closeMenus()
    flash(`Viewing ${group.name}.`)
    refreshGroups()
  }

  async function handleCreateGroup(event) {
    event.preventDefault()
    setLoading(true)
    try {
      const creator = await currentHandle()
      const group = session?.user && hasSupabase
        ? await createRemoteGroup(groupDraft || `${creator}'s clique`, creator)
        : createLocalGroup(groupDraft || `${creator}'s clique`, creator)
      setGroupDraft('')
      setActiveGroup(group.id)
      setActiveGroupState(group)
      flash(`${group.name} created.`)
      refreshGroups()
    } catch (error) {
      flash(error.message || 'Could not create the clique.')
    } finally {
      setLoading(false)
    }
  }

  async function handleJoinGroup(event) {
    event.preventDefault()
    const code = parseInviteCode(inviteDraft)
    if (!code) {
      flash('Paste an invite code first.')
      return
    }
    setLoading(true)
    try {
      const joined = session?.user && hasSupabase
        ? await joinRemoteGroup(code, await currentHandle())
        : joinLocalGroup(code, await currentHandle())
      setInviteDraft('')
      setActiveGroup(joined.id)
      setActiveGroupState(joined)
      flash(`Joined ${joined.name}.`)
      refreshGroups()
    } catch (error) {
      flash(error.message || 'Could not join that clique.')
    } finally {
      setLoading(false)
    }
  }

  async function copyInvite(group) {
    const copied = await copyToClipboard(getGroupInviteUrl(group))
    flash(copied ? 'Invite link copied.' : `Invite: ${getGroupInvitePath(group)}`)
  }

  async function togglePublic(group) {
    if (!usingRemoteGroups) {
      flash('Public Explore visibility is available for signed-in cliques.')
      return
    }
    try {
      await setGroupPublic(group.id, !group.isPublic)
      flash(!group.isPublic ? `${group.name} is visible in Explore.` : `${group.name} is private again.`)
      refreshGroups()
    } catch (error) {
      flash(error.message || 'Could not update public visibility.')
    }
  }

  async function handleAuth(event) {
    event.preventDefault()
    setAuthNotice(null)
    if (!authEmail.trim() || !authPassword) {
      flash('Add an email and password first.')
      return
    }
    setLoading(true)
    try {
      const email = authEmail.trim()
      const displayName = (draft || email.split('@')[0]).trim()
      if (authMode === 'sign-up') {
        const result = await signUpWithEmail(email, authPassword, displayName)
        if (!result.session?.user) {
          setAuthNotice(`Check ${email} to confirm your account, then sign in.`)
        } else {
          saveSharedHandle(displayName)
          setHandle(displayName)
          setSession(result.session)
          flash('Account created.')
        }
      } else {
        const data = await signInWithEmail(email, authPassword)
        if (!data.session?.user) throw new Error('Confirm your email first, then try again.')
        setSession(data.session)
        const displayNameAfterLogin = data.session.user.user_metadata?.display_name || data.session.user.email?.split('@')[0] || ''
        if (displayNameAfterLogin) {
          saveSharedHandle(displayNameAfterLogin)
          setHandle(displayNameAfterLogin)
          setDraft(displayNameAfterLogin)
        }
        flash('Signed in.')
      }
      setAuthPassword('')
      refreshGroups()
    } catch (error) {
      flash(error.message || 'Authentication failed.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignOut() {
    setLoading(true)
    try {
      clearSessionUi()
      await signOut().catch(() => null)
      setAuthEmail('')
      setAuthPassword('')
      flash('Signed out.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <header className="sticky top-3 z-40 mb-5 rounded-[2rem] border border-white/10 bg-neutral-950/95 px-3 py-3 shadow-2xl shadow-black/30 backdrop-blur sm:px-4">
        <div className="grid gap-3 lg:grid-cols-[auto_1fr_auto] lg:items-center">
          <Link to="/explore" aria-label="CliqueBase Explore" className="w-fit rounded-[1.4rem] px-2 py-1 transition hover:opacity-80" onClick={closeMenus}>
            <LogoMark />
          </Link>

          <div className="relative flex min-w-0 flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <button type="button" onClick={() => { setMainOpen((value) => !value); setMediaOpen(false) }} className="flex w-full min-w-0 items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-neutral-950 shadow-lg shadow-white/5 transition hover:bg-neutral-200 sm:w-auto">
                <AppIcon name={activePrimary.icon} size={18} />
                <span className="truncate">{activePrimary.label}</span>
                <AppIcon name="chevronDown" size={16} className="text-neutral-500" />
              </button>

              {mainOpen ? (
                <div className="absolute left-1/2 top-full mt-3 w-[min(92vw,24rem)] -translate-x-1/2 rounded-[2rem] border border-white/10 bg-neutral-950 p-3 shadow-2xl shadow-black/50">
                  <div className="grid gap-2">
                    {primaryLinks.map((link) => (
                      <Link key={link.key} to={link.to} onClick={link.key === 'library' ? usePersonalLibrary : closeMenus} className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition ${isPrimaryActive(link.key, activeKey) ? 'bg-white font-bold text-neutral-950' : 'bg-white/[0.04] text-neutral-200 hover:bg-white/10 hover:text-white'}`}>
                        <AppIcon name={link.icon} size={18} />
                        <span><span className="block">{link.label}</span><span className="block text-xs font-normal opacity-60">{link.description}</span></span>
                      </Link>
                    ))}
                  </div>
                  <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs text-neutral-400">
                    <span className="block uppercase tracking-[0.2em] text-neutral-500">Current workspace</span>
                    <strong className="mt-1 block text-sm text-white">{spaceLabel}</strong>
                    {activeGroup ? <Link to={getGroupOpenPath(activeGroup)} onClick={closeMenus} className="mt-2 inline-flex font-semibold text-white underline underline-offset-4">Open clique dashboard</Link> : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="relative">
              <button type="button" onClick={() => { setMediaOpen((value) => !value); setMainOpen(false) }} className="flex w-full min-w-0 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-5 py-3 text-sm font-bold text-neutral-200 transition hover:bg-white/10 hover:text-white sm:w-auto">
                <AppIcon name={activeMedia?.icon || 'movies'} size={18} />
                <span className="truncate">{activeMedia?.label || 'Media'}</span>
                <AppIcon name="chevronDown" size={16} className="text-neutral-500" />
              </button>

              {mediaOpen ? (
                <div className="absolute left-1/2 top-full mt-3 w-[min(92vw,22rem)] -translate-x-1/2 rounded-[2rem] border border-white/10 bg-neutral-950 p-3 shadow-2xl shadow-black/50">
                  <div className="grid gap-2">
                    {mediaLinks.map((link) => (
                      <Link key={link.key} to={link.to} onClick={closeMenus} className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition ${activeKey === link.key ? 'bg-white font-bold text-neutral-950' : 'bg-white/[0.04] text-neutral-200 hover:bg-white/10 hover:text-white'}`}>
                        <AppIcon name={link.icon} size={18} />
                        <span>{link.label}</span>
                      </Link>
                    ))}
                  </div>
                  <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-neutral-400">New picks and ratings save to <strong className="text-white">{spaceLabel}</strong>.</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex justify-end">
            <button type="button" onClick={() => { closeMenus(); setAccountOpen(true) }} className="inline-flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:bg-white hover:text-black">
              <AppIcon name="user" size={18} />
              <span className="max-w-[7rem] truncate">{profileLabel}</span>
            </button>
          </div>
        </div>
      </header>

      {message ? <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950 shadow-2xl">{message}</div> : null}

      {accountOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-white/10 bg-neutral-950 p-5 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.25em] text-neutral-500">Account & cliques</div>
                <h2 className="mt-1 text-2xl font-black text-white">Setup</h2>
                <p className="mt-2 text-sm text-neutral-400">Sign in, set your name, and manage private or public clique spaces.</p>
              </div>
              <button type="button" onClick={() => setAccountOpen(false)} className="text-2xl text-neutral-400 hover:text-white">×</button>
            </div>

            <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Profile</p>
                  <h3 className="mt-1 text-xl font-bold text-white">{session?.user ? handle || 'Signed in' : 'Sign in or create account'}</h3>
                  <p className="mt-1 text-sm text-neutral-400">{session?.user?.email || (hasSupabase ? 'Use an account to sync libraries and cliques.' : 'Local profile mode')}</p>
                </div>
                {session?.user ? <button type="button" disabled={loading} onClick={handleSignOut} className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white hover:text-neutral-950">Sign out</button> : null}
              </div>

              <label className="mt-4 block text-sm font-semibold text-neutral-300">Profile name</label>
              <div className="mt-2 flex gap-2">
                <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="example: Sip" className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
                <button type="button" onClick={currentHandle} className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950">Save</button>
              </div>

              {hasSupabase && !session?.user ? (
                <form onSubmit={handleAuth} className="mt-4 grid gap-3">
                  <div className="flex rounded-2xl border border-white/10 bg-neutral-900 p-1">
                    <button type="button" onClick={() => setAuthMode('sign-in')} className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${authMode === 'sign-in' ? 'bg-white text-neutral-950' : 'text-neutral-300'}`}>Sign in</button>
                    <button type="button" onClick={() => setAuthMode('sign-up')} className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${authMode === 'sign-up' ? 'bg-white text-neutral-950' : 'text-neutral-300'}`}>Create account</button>
                  </div>
                  {authNotice ? <p className="rounded-2xl border border-yellow-300/30 bg-yellow-300/10 p-3 text-sm text-yellow-100">{authNotice}</p> : null}
                  <input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="Email" className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
                  <input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="Password" className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
                  <button disabled={loading} className="rounded-2xl bg-white px-5 py-3 font-semibold text-black disabled:opacity-60">{loading ? 'Working...' : authMode === 'sign-up' ? 'Create account' : 'Sign in'}</button>
                </form>
              ) : null}
            </section>

            <section className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Current workspace</p>
                  <h3 className="mt-1 text-xl font-bold text-white">{spaceLabel}</h3>
                  <p className="mt-1 text-sm text-neutral-400">My Library is private. Public cliques appear in Explore.</p>
                </div>
                <button type="button" onClick={usePersonalLibrary} className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white hover:text-neutral-950">Use My Library</button>
              </div>
            </section>

            {groups.length ? (
              <section className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Your cliques</p>
                <div className="mt-3 space-y-2">
                  {groups.map((group) => (
                    <div key={group.id} className={`rounded-2xl p-3 ${activeGroup?.id === group.id ? 'bg-white text-neutral-950' : 'bg-neutral-900 text-white'}`}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="truncate font-bold">{group.name}</div>
                          <div className="text-xs opacity-60">{group.members?.length || 1} members · {group.isPublic ? 'Visible in Explore' : 'Private clique'}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Link to={getGroupOpenPath(group)} onClick={() => { activateGroup(group); setAccountOpen(false) }} className={`rounded-xl px-3 py-2 text-xs font-semibold ${activeGroup?.id === group.id ? 'bg-neutral-950 text-white' : 'bg-white text-neutral-950'}`}>{activeGroup?.id === group.id ? 'Active' : 'Open'}</Link>
                          {usingRemoteGroups ? <button type="button" onClick={() => togglePublic(group)} className="rounded-xl border border-current/20 px-3 py-2 text-xs font-semibold">{group.isPublic ? 'Hide' : 'Make public'}</button> : null}
                          <button type="button" onClick={() => copyInvite(group)} className="rounded-xl border border-current/20 px-3 py-2 text-xs font-semibold">Invite</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <form onSubmit={handleCreateGroup} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Create clique</p>
                <input value={groupDraft} onChange={(event) => setGroupDraft(event.target.value)} placeholder="Clique name" className="mt-3 w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
                <button disabled={loading} className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950">Create</button>
              </form>

              <form onSubmit={handleJoinGroup} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Join clique</p>
                <input value={inviteDraft} onChange={(event) => setInviteDraft(event.target.value)} placeholder="Invite link or code" className="mt-3 w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
                <button disabled={loading} className="mt-3 w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white hover:text-neutral-950">Join</button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
