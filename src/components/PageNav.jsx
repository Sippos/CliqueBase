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

const links = [
  { key: 'home', to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { key: 'movies', to: '/movies', label: 'Movies', icon: 'movies' },
  { key: 'series', to: '/series', label: 'Series', icon: 'series' },
  { key: 'games', to: '/games', label: 'Games', icon: 'games' },
  { key: 'videos', to: '/videos', label: 'Videos', icon: 'videos' },
  { key: 'music', to: '/music', label: 'Music', icon: 'music' },
  { key: 'leaderboard', to: '/explore', label: 'Explore', icon: 'explore' },
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

function getSessionName(session, profile, fallback = '') {
  return profile?.display_name || fallback || session?.user?.user_metadata?.display_name || session?.user?.email?.split('@')[0] || ''
}

function LogoMark() {
  return (
    <div className="min-w-0">
      <span className="block text-2xl font-black tracking-tight text-white sm:text-3xl">CliqueBase</span>
      <span className="block text-xs uppercase tracking-[0.28em] text-neutral-500">Find the next pick</span>
    </div>
  )
}

export default function PageNav({ active = 'home' }) {
  const [handle, setHandle] = useState('')
  const [activeGroup, setActiveGroupState] = useState(null)
  const [groups, setGroups] = useState([])
  const [session, setSession] = useState(null)
  const [navOpen, setNavOpen] = useState(false)
  const [groupsOpen, setGroupsOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [profileEditOpen, setProfileEditOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [groupDraft, setGroupDraft] = useState('')
  const [inviteDraft, setInviteDraft] = useState('')
  const [savedMessage, setSavedMessage] = useState('')
  const [authNotice, setAuthNotice] = useState(null)
  const [authMode, setAuthMode] = useState('sign-in')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [signOutLoading, setSignOutLoading] = useState(false)

  const activeLink = links.find((link) => link.key === active) || links[0]
  const usingRemoteGroups = hasSupabase && Boolean(session?.user)
  const profileLabel = session?.user ? (handle || session.user.email?.split('@')[0] || 'Account') : (hasSupabase ? 'Profile' : (handle || 'Profile'))
  const groupLabel = activeGroup?.name || 'Personal'

  function flash(message) {
    setSavedMessage(message)
    setTimeout(() => setSavedMessage(''), 2400)
  }

  function closeSwitchers() {
    setNavOpen(false)
    setGroupsOpen(false)
  }

  function clearSupabaseSessionUi() {
    setSession(null)
    setHandle('')
    setDraft('')
    setGroups([])
    setActiveGroupState(null)
    setActiveGroup('')
    setProfileEditOpen(false)
  }

  async function refreshGroups() {
    if (hasSupabase) {
      try {
        const nextSession = await getCurrentSession()
        setSession(nextSession)

        if (!nextSession?.user) {
          clearSupabaseSessionUi()
          return
        }

        setAuthNotice(null)
        const saved = getSavedHandle()
        const profile = await getProfile().catch(() => null)
        const displayName = getSessionName(nextSession, profile, saved)
        if (displayName) {
          saveSharedHandle(displayName)
          setHandle(displayName)
          setDraft(displayName)
        }

        const remoteGroups = await getRemoteGroups().catch(() => [])
        setGroups(remoteGroups)

        const activeId = getActiveGroupId()
        const nextActive = remoteGroups.find((group) => group.id === activeId) || remoteGroups[0] || null
        setActiveGroupState(nextActive)

        if (nextActive && activeId !== nextActive.id) setActiveGroup(nextActive.id)
        else if (!nextActive && activeId) setActiveGroup('')
        return
      } catch (error) {
        clearSupabaseSessionUi()
        flash(error.message || 'Could not sync your account.')
        return
      }
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

    function handleGroupsChanged() {
      refreshGroups()
    }

    window.addEventListener(GROUPS_CHANGED_EVENT, handleGroupsChanged)
    const unsubscribe = hasSupabase ? onAuthStateChanged((nextSession) => {
      if (!nextSession?.user) clearSupabaseSessionUi()
      else refreshGroups()
    }) : () => {}

    return () => {
      window.removeEventListener(GROUPS_CHANGED_EVENT, handleGroupsChanged)
      unsubscribe()
    }
  }, [])

  async function saveHandle() {
    const saved = saveSharedHandle(draft)
    if (!saved) {
      flash('Add a profile name first.')
      return ''
    }

    try {
      if (session?.user) await saveProfile(saved)
      setHandle(saved)
      setDraft(saved)
      setProfileEditOpen(false)
      flash(`Profile updated to ${saved}`)
      refreshGroups()
      return saved
    } catch (error) {
      flash(error.message || 'Could not save your profile.')
      return saved
    }
  }

  async function currentHandle() {
    return handle || await saveHandle() || 'anonymous'
  }

  async function handleCreateGroup(event) {
    event.preventDefault()
    const creator = await currentHandle()

    try {
      const group = session?.user && hasSupabase
        ? await createRemoteGroup(groupDraft || `${creator}'s clique`, creator)
        : createLocalGroup(groupDraft || `${creator}'s clique`, creator)

      setActiveGroup(group.id)
      setGroupDraft('')
      refreshGroups()
      flash(`${group.name} created and active.`)
    } catch (error) {
      flash(error.message || 'Could not create the group.')
    }
  }

  async function handleJoinGroup(event) {
    event.preventDefault()
    const code = parseInviteCode(inviteDraft)
    if (!code) {
      flash('Paste an invite code first.')
      return
    }

    try {
      const joined = session?.user && hasSupabase
        ? await joinRemoteGroup(code, await currentHandle())
        : joinLocalGroup(code, await currentHandle())

      setActiveGroup(joined.id)
      setInviteDraft('')
      refreshGroups()
      flash(`Joined ${joined.name}.`)
    } catch (error) {
      flash(error.message || 'Could not join that group.')
    }
  }

  function activateGroup(group) {
    setActiveGroup(group.id)
    closeSwitchers()
    refreshGroups()
    flash(`${group.name} is active.`)
  }

  async function copyInvite(group) {
    const copied = await copyToClipboard(getGroupInviteUrl(group))
    flash(copied ? 'Invite link copied.' : `Invite: ${getGroupInvitePath(group)}`)
  }

  async function handleTogglePublic(group) {
    if (!session?.user || !hasSupabase) {
      flash('Public discovery is available for signed-in Supabase groups.')
      return
    }

    try {
      await setGroupPublic(group.id, !group.isPublic)
      refreshGroups()
      flash(!group.isPublic ? `${group.name} is now visible in Explore.` : `${group.name} is private again.`)
    } catch (error) {
      flash(error.message || 'Could not update public discovery.')
    }
  }

  async function handleAuthSubmit(event) {
    event.preventDefault()
    setAuthNotice(null)

    if (!authEmail.trim() || !authPassword) {
      flash('Add an email and password first.')
      return
    }

    if (authMode === 'sign-up' && !draft.trim()) {
      flash('Add a profile name for your account.')
      return
    }

    setAuthLoading(true)
    try {
      const email = authEmail.trim()
      const displayName = (draft || email.split('@')[0]).trim()
      if (authMode === 'sign-up') {
        const result = await signUpWithEmail(email, authPassword, displayName)
        if (result.session?.user) {
          setSession(result.session)
          saveSharedHandle(displayName)
          setHandle(displayName)
          setDraft(displayName)
          setAuthPassword('')
          setAuthNotice(null)
          flash('Account created and signed in.')
          refreshGroups()
        } else {
          setAuthNotice({
            title: 'Confirm your email',
            text: `We sent a confirmation link to ${email}. Open the email, confirm your account, then come back here and sign in.`,
          })
          setAuthPassword('')
          flash('Check your email to finish creating the account.')
        }
      } else {
        const data = await signInWithEmail(email, authPassword)
        if (!data.session?.user) throw new Error('Sign in did not return a session. Confirm your email first, then try again.')
        setSession(data.session)
        const displayNameAfterLogin = data.session.user.user_metadata?.display_name || data.session.user.email?.split('@')[0] || ''
        if (displayNameAfterLogin) {
          saveSharedHandle(displayNameAfterLogin)
          setHandle(displayNameAfterLogin)
          setDraft(displayNameAfterLogin)
        }
        setAuthPassword('')
        setAuthNotice(null)
        flash('Signed in.')
        refreshGroups()
      }
    } catch (error) {
      flash(error.message || 'Authentication failed.')
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleSignOut() {
    setSignOutLoading(true)
    try {
      clearSupabaseSessionUi()
      await signOut().catch(() => null)
      setAuthNotice(null)
      setAuthEmail('')
      setAuthPassword('')
      flash('Signed out.')
    } finally {
      setSignOutLoading(false)
    }
  }

  return (
    <>
      <header className="relative z-40 mb-5 rounded-[2rem] border border-white/10 bg-neutral-950/95 px-3 py-3 shadow-2xl shadow-black/30 backdrop-blur sm:px-4">
        <div className="grid gap-3 md:grid-cols-[auto_1fr_auto] md:items-center">
          <Link to="/" aria-label="CliqueBase global Explore" className="min-w-0 rounded-[1.4rem] px-2 py-1 transition hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-white/30" onClick={closeSwitchers}>
            <LogoMark />
          </Link>

          <div className="relative flex min-w-0 justify-center">
            <div className="flex w-full min-w-0 max-w-xl flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
              <button type="button" onClick={() => { setNavOpen((value) => !value); setGroupsOpen(false) }} className="flex min-w-0 items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-black text-neutral-950 shadow-lg shadow-white/5 transition hover:bg-neutral-200">
                <AppIcon name={activeLink.icon} size={18} />
                <span className="truncate">{activeLink.label}</span>
                <AppIcon name="chevronDown" size={16} className="text-neutral-500" />
              </button>
              <button type="button" onClick={() => { setGroupsOpen((value) => !value); setNavOpen(false) }} className="flex min-w-0 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-4 py-2.5 text-xs font-semibold text-neutral-300 transition hover:bg-white/10 hover:text-white">
                <span className={`h-2 w-2 shrink-0 rounded-full ${activeGroup ? 'bg-emerald-400' : 'bg-neutral-500'}`}></span>
                <span className="truncate">{groupLabel}</span>
                <AppIcon name="chevronDown" size={14} className="text-neutral-500" />
              </button>
            </div>

            {navOpen ? (
              <div className="absolute left-1/2 top-full mt-3 w-[min(92vw,22rem)] -translate-x-1/2 rounded-[2rem] border border-white/10 bg-neutral-950 p-3 shadow-2xl shadow-black/50">
                <div className="grid gap-2">
                  {links.map((link) => (
                    <Link key={link.key} to={link.to} onClick={closeSwitchers} className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition ${active === link.key ? 'bg-white font-bold text-neutral-950' : 'bg-white/[0.04] text-neutral-200 hover:bg-white/10 hover:text-white'}`}>
                      <AppIcon name={link.icon} size={18} />
                      <span>{link.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            {groupsOpen ? (
              <div className="absolute left-1/2 top-full mt-3 w-[min(92vw,32rem)] -translate-x-1/2 rounded-[2rem] border border-white/10 bg-neutral-950 p-3 shadow-2xl shadow-black/50">
                <div className="flex items-center justify-between gap-3 px-2">
                  <div>
                    <div className="text-xs uppercase tracking-[0.3em] text-neutral-500">Library context</div>
                    <h3 className="mt-1 text-lg font-black text-white">{groupLabel}</h3>
                  </div>
                  <button type="button" onClick={() => { closeSwitchers(); setEditing(true) }} className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950">Manage</button>
                </div>

                <div className="mt-3 space-y-2">
                  <button type="button" onClick={() => { setActiveGroup(''); setActiveGroupState(null); closeSwitchers(); flash('Using personal library.') }} className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition ${!activeGroup ? 'bg-white text-neutral-950' : 'bg-white/[0.04] text-white hover:bg-white/10'}`}>
                    <span><strong>Personal library</strong><span className="block text-xs opacity-60">Private picks without a group</span></span>
                    {!activeGroup ? <span>Active</span> : <span>Use</span>}
                  </button>
                  {groups.map((group) => (
                    <div key={group.id} className={`rounded-2xl p-3 ${activeGroup?.id === group.id ? 'bg-white text-neutral-950' : 'bg-white/[0.04] text-white'}`}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <div className="truncate font-bold">{group.name}</div>
                          <div className="text-xs opacity-60">{group.members?.length || 1} members · {group.isPublic ? 'Visible in Explore' : 'Private'}</div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => activateGroup(group)} className={`rounded-xl px-3 py-2 text-xs font-semibold ${activeGroup?.id === group.id ? 'bg-neutral-950 text-white' : 'bg-white text-neutral-950'}`}>{activeGroup?.id === group.id ? 'Active' : 'Use'}</button>
                          {usingRemoteGroups ? <button type="button" onClick={() => handleTogglePublic(group)} className="rounded-xl border border-current/20 px-3 py-2 text-xs font-semibold">{group.isPublic ? 'Hide' : 'Publish'}</button> : null}
                          <button type="button" onClick={() => copyInvite(group)} className="rounded-xl border border-current/20 px-3 py-2 text-xs font-semibold">Invite</button>
                        </div>
                      </div>
                    </div>
                  ))}
                  {!groups.length ? <p className="rounded-2xl border border-dashed border-white/15 p-4 text-sm text-neutral-500">Create a group or join an invite from Manage.</p> : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 justify-end">
            <button type="button" onClick={() => { refreshGroups(); closeSwitchers(); setEditing(true) }} aria-label="Open profile and groups" className="flex h-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-white transition hover:bg-white hover:text-black sm:px-4">
              <AppIcon name="user" size={18} className="sm:mr-1.5" />
              <span className="hidden max-w-[6rem] truncate sm:inline">{profileLabel}</span>
            </button>
          </div>
        </div>
      </header>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-white/10 bg-neutral-950 p-5 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-neutral-500">Account & groups</div>
                <h2 className="mt-1 text-2xl font-bold text-white">Your CliqueBase setup</h2>
                <p className="mt-2 text-sm text-neutral-400">Manage your account, personal library, and shared groups.</p>
              </div>
              <button type="button" onClick={() => setEditing(false)} className="text-2xl text-neutral-400 hover:text-white">×</button>
            </div>

            {savedMessage ? <p className="mt-4 rounded-2xl bg-emerald-700 p-3 text-sm text-white">{savedMessage}</p> : null}

            <section className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-neutral-950"><AppIcon name="user" size={22} /></div>
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-[0.3em] text-neutral-500">Account</div>
                    <h3 className="mt-1 truncate text-xl font-bold text-white">{session?.user ? handle || 'Signed in' : 'Sign in or create account'}</h3>
                    <p className="mt-1 truncate text-sm text-neutral-400">{session?.user?.email || (hasSupabase ? 'Use an account to sync your personal library and groups.' : 'Local profile mode')}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {(session?.user || !hasSupabase) ? <button type="button" onClick={() => setProfileEditOpen((value) => !value)} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white hover:text-neutral-950" aria-label="Edit profile name"><AppIcon name="settings" size={18} /></button> : null}
                  {session?.user ? <button type="button" disabled={signOutLoading} onClick={handleSignOut} className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white hover:text-neutral-950 disabled:opacity-60">{signOutLoading ? 'Signing out...' : 'Sign out'}</button> : null}
                </div>
              </div>

              {profileEditOpen && (session?.user || !hasSupabase) ? (
                <div className="mt-4 rounded-2xl bg-neutral-900 p-3">
                  <label className="block text-sm font-semibold text-neutral-300">Profile name</label>
                  <div className="mt-2 flex gap-2">
                    <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="example: Sip" className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none" />
                    <button type="button" onClick={saveHandle} className="rounded-2xl bg-white px-5 py-3 font-semibold text-black">Save</button>
                  </div>
                  <p className="mt-2 text-xs text-neutral-500">This name appears on picks, groups, and your personal library.</p>
                </div>
              ) : null}

              {authNotice ? <div className="mt-4 rounded-2xl border border-yellow-300/30 bg-yellow-300/10 p-4 text-sm text-yellow-100"><div className="font-bold">{authNotice.title}</div><p className="mt-1 leading-6 text-yellow-100/90">{authNotice.text}</p></div> : null}

              {hasSupabase && !session?.user ? (
                <form onSubmit={handleAuthSubmit} className="mt-4 grid gap-3">
                  <div className="flex rounded-2xl border border-white/10 bg-neutral-900 p-1">
                    <button type="button" onClick={() => { setAuthMode('sign-in'); setAuthNotice(null) }} className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${authMode === 'sign-in' ? 'bg-white text-neutral-950' : 'text-neutral-300'}`}>Sign in</button>
                    <button type="button" onClick={() => { setAuthMode('sign-up'); setAuthNotice(null) }} className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${authMode === 'sign-up' ? 'bg-white text-neutral-950' : 'text-neutral-300'}`}>Create account</button>
                  </div>
                  {authMode === 'sign-up' ? <label className="grid gap-1 text-sm font-semibold text-neutral-300">Profile name<input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="example: Sip" className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" /></label> : null}
                  <label className="grid gap-1 text-sm font-semibold text-neutral-300">Email<input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="you@example.com" className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" /></label>
                  <label className="grid gap-1 text-sm font-semibold text-neutral-300">Password<input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="Password" className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" /></label>
                  <button disabled={authLoading} className="rounded-2xl bg-white px-5 py-3 font-semibold text-black disabled:opacity-60">{authLoading ? 'Working...' : authMode === 'sign-up' ? 'Create account' : 'Sign in'}</button>
                </form>
              ) : null}
            </section>

            <section className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-neutral-500">Active group</div>
                  <h3 className="mt-1 text-xl font-bold text-white">{activeGroup?.name || 'No group selected'}</h3>
                  <p className="mt-1 text-sm text-neutral-400">Use groups for shared voting. Personal library works without a group.</p>
                </div>
                {activeGroup ? <button type="button" onClick={() => copyInvite(activeGroup)} className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950">Copy invite</button> : null}
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
          </div>
        </div>
      ) : null}
    </>
  )
}
