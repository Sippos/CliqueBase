import { Link, useLocation } from 'react-router-dom'
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
  supabase,
} from '../lib/supabaseClient.js'

const primaryLinks = [
  { key: 'explore', to: '/explore', label: 'Explore', icon: 'explore', description: 'Global rankings' },
  { key: 'library', to: '/dashboard', label: 'My Library', icon: 'dashboard', description: 'Your private picks' },
  { key: 'groups', to: '/groups', label: 'Cliques', icon: 'users', description: 'Shared spaces' },
]

const mediaLinks = [
  { key: 'movies', to: '/movies', label: 'Movies', icon: 'movies' },
  { key: 'series', to: '/series', label: 'Series', icon: 'series' },
  { key: 'games', to: '/games', label: 'Games', icon: 'games' },
  { key: 'videos', to: '/videos', label: 'Videos', icon: 'videos' },
  { key: 'music', to: '/music', label: 'Music', icon: 'music' },
]

const allMediaOption = { key: 'all', label: 'All media', icon: 'explore' }
const mediaKeys = mediaLinks.map((link) => link.key)

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
  if (linkKey === 'library' && mediaKeys.includes(activeKey)) return true
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
      <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className="h-10 w-10 shrink-0 text-white sm:h-11 sm:w-11">
        <path d="M13 29c0-9.5 7.7-17.2 17.2-17.2h18.6" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <path d="M13 35v8c0 8 6.5 14.5 14.5 14.5h13.2c8 0 14.5-6.5 14.5-14.5 0-7.4-5.6-13.5-12.8-14.4" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M17 36c8.7-3.5 18.7-3.5 30 0 5.2 1.6 7.9 4.2 7.9 7.4 0 4.8-6.6 8.8-20.2 8.8-14.3 0-21.7-4-21.7-10.8V29" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="24" cy="25" r="4" fill="currentColor" />
        <circle cx="34" cy="22" r="4.5" fill="currentColor" />
        <circle cx="45" cy="25" r="4" fill="currentColor" />
        <path d="M33 37l2.2 5.2L40 44l-4.8 1.8L33 51l-2.2-5.2L26 44l4.8-1.8L33 37Z" fill="currentColor" />
      </svg>
      <span className="block text-2xl font-black tracking-tight text-white sm:text-3xl">CliqueBase</span>
    </div>
  )
}

export default function PageNav({ active = 'library' }) {
  const location = useLocation()
  const [handle, setHandle] = useState('')
  const [activeGroup, setActiveGroupState] = useState(null)
  const [groups, setGroups] = useState([])
  const [session, setSession] = useState(null)
  const [mediaOpen, setMediaOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [profileToolsOpen, setProfileToolsOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [emailDraft, setEmailDraft] = useState('')
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
  const queryMedia = new URLSearchParams(location.search).get('media')
  const activeMedia = mediaLinks.find((link) => link.key === activeKey) || mediaLinks.find((link) => link.key === queryMedia)
  const activeMediaKey = activeMedia?.key || null
  const profileLabel = session?.user ? (handle || session.user.email?.split('@')[0] || 'Account') : (handle || 'Profile')
  const profileInitial = (profileLabel || 'P').slice(0, 1).toUpperCase()
  const navProfileLabel = profileLabel === 'Profile' ? 'Profile' : `Profile (${profileLabel})`
  const spaceLabel = activeGroup?.name || 'My Library'
  const usingRemoteGroups = hasSupabase && Boolean(session?.user)
  const accountStatus = session?.user ? 'Signed in' : hasSupabase ? 'Ready to sync' : 'Local profile'
  const mediaSummary = activePrimary.key === 'explore'
    ? 'Explore starts on All media. Pick a type to narrow global rankings.'
    : activePrimary.key === 'groups'
      ? 'Cliques start on All media. Pick a type when you only want matching shared spaces.'
      : `Library filters apply to ${spaceLabel}. All media returns to your dashboard.`

  function flash(text) {
    setMessage(text)
    setTimeout(() => setMessage(''), 2500)
  }

  function closeMenus() {
    setMediaOpen(false)
  }

  function closeProfileModal() {
    setAccountOpen(false)
    setProfileToolsOpen(false)
  }

  function clearSessionUi() {
    setSession(null)
    setHandle('')
    setDraft('')
    setEmailDraft('')
    setGroups([])
    setActiveGroupState(null)
    setProfileToolsOpen(false)
    setActiveGroup('')
  }

  function sectionRoot() {
    if (activePrimary.key === 'explore') return '/explore'
    if (activePrimary.key === 'groups') return '/groups'
    return '/dashboard'
  }

  function mediaHref(key) {
    if (key === 'all') return sectionRoot()
    if (activePrimary.key === 'explore') return `/explore?media=${key}`
    if (activePrimary.key === 'groups') return `/groups?media=${key}`
    return mediaLinks.find((link) => link.key === key)?.to || '/dashboard'
  }

  function handlePrimaryClick(link) {
    if (link.key === 'library') {
      usePersonalLibrary()
      return
    }
    closeMenus()
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
        setEmailDraft(nextSession.user.email || '')
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
    setEmailDraft('')
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

  async function handleProfileNameSubmit(event) {
    event.preventDefault()
    if (!draft.trim()) {
      flash('Add a profile name first.')
      return
    }
    setLoading(true)
    try {
      await currentHandle()
      flash('Profile name updated.')
    } catch (error) {
      flash(error.message || 'Could not update your profile name.')
    } finally {
      setLoading(false)
    }
  }

  async function handleEmailSubmit(event) {
    event.preventDefault()
    const nextEmail = emailDraft.trim()
    if (!session?.user) {
      flash('Sign in to change your email.')
      return
    }
    if (!nextEmail) {
      flash('Add an email first.')
      return
    }
    if (nextEmail === session.user.email) {
      flash('That email is already on this profile.')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ email: nextEmail })
      if (error) throw error
      flash('Check your new email to confirm the change.')
      refreshGroups()
    } catch (error) {
      flash(error.message || 'Could not update your email.')
    } finally {
      setLoading(false)
    }
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
          setEmailDraft(result.session.user.email || email)
          flash('Account created.')
        }
      } else {
        const data = await signInWithEmail(email, authPassword)
        if (!data.session?.user) throw new Error('Confirm your email first, then try again.')
        setSession(data.session)
        setEmailDraft(data.session.user.email || email)
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

          <div className="flex min-w-0 flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
            <nav aria-label="Primary navigation" className="flex min-w-0 rounded-full border border-white/10 bg-white/[0.035] p-1">
              {primaryLinks.map((link) => {
                const selected = isPrimaryActive(link.key, activeKey)
                return (
                  <Link
                    key={link.key}
                    to={link.to}
                    onClick={() => handlePrimaryClick(link)}
                    aria-current={selected ? 'page' : undefined}
                    title={link.description}
                    className={`inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-black transition sm:flex-none ${selected ? 'bg-white text-neutral-950 shadow-lg shadow-white/5' : 'text-neutral-300 hover:bg-white/10 hover:text-white'}`}
                  >
                    <AppIcon name={link.icon} size={17} />
                    <span className="truncate">{link.label}</span>
                  </Link>
                )
              })}
            </nav>

            <div className="relative">
              <button type="button" onClick={() => setMediaOpen((value) => !value)} className="flex w-full min-w-0 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-5 py-3 text-sm font-bold text-neutral-200 transition hover:bg-white/10 hover:text-white sm:w-auto">
                <AppIcon name={activeMedia?.icon || allMediaOption.icon} size={18} />
                <span className="truncate">{activeMedia?.label || allMediaOption.label}</span>
                <AppIcon name="chevronDown" size={16} className="text-neutral-500" />
              </button>

              {mediaOpen ? (
                <div className="absolute left-1/2 top-full mt-3 w-[min(92vw,22rem)] -translate-x-1/2 rounded-[2rem] border border-white/10 bg-neutral-950 p-3 shadow-2xl shadow-black/50">
                  <div className="grid gap-2">
                    {[allMediaOption, ...mediaLinks].map((link) => {
                      const selected = link.key === 'all' ? !activeMediaKey : activeMediaKey === link.key
                      return (
                        <Link key={link.key} to={mediaHref(link.key)} onClick={closeMenus} className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition ${selected ? 'bg-white font-bold text-neutral-950' : 'bg-white/[0.04] text-neutral-200 hover:bg-white/10 hover:text-white'}`}>
                          <AppIcon name={link.icon} size={18} />
                          <span>{link.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                  <p className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-neutral-400">{mediaSummary}</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex justify-end">
            <button type="button" aria-label={`Open profile for ${profileLabel}`} onClick={() => { closeMenus(); setProfileToolsOpen(false); setAccountOpen(true) }} className="inline-flex h-11 max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2 pr-4 text-sm font-semibold text-white transition hover:bg-white hover:text-black">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-neutral-950">{profileInitial}</span>
              <span className="hidden min-w-0 truncate sm:inline">{navProfileLabel}</span>
            </button>
          </div>
        </div>
      </header>

      {message ? <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950 shadow-2xl">{message}</div> : null}

      {accountOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] border border-white/10 bg-neutral-950 p-4 shadow-2xl shadow-black/40 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.25em] text-neutral-500">Profile</div>
                <h2 className="mt-1 truncate text-2xl font-black text-white">Profile ({profileLabel})</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">Use the gear for account details. Library controls now stay grouped below your profile so switching between private picks and cliques is clearer.</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" aria-label="Edit profile details" onClick={() => setProfileToolsOpen((value) => !value)} className={`flex h-11 w-11 items-center justify-center rounded-full border border-white/10 transition ${profileToolsOpen ? 'bg-white text-neutral-950' : 'bg-white/[0.04] text-white hover:bg-white hover:text-neutral-950'}`}>
                  <AppIcon name="settings" size={19} />
                </button>
                <button type="button" aria-label="Close profile" onClick={closeProfileModal} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-2xl text-neutral-400 transition hover:bg-white hover:text-neutral-950">×</button>
              </div>
            </div>

            <section className="mt-5 rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.5rem] bg-white text-2xl font-black text-neutral-950">{profileInitial}</div>
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-[0.25em] text-neutral-500">{accountStatus}</div>
                    <h3 className="mt-1 truncate text-2xl font-black text-white">{profileLabel}</h3>
                    <p className="mt-1 truncate text-sm text-neutral-400">{session?.user?.email || (hasSupabase ? 'Not signed in yet' : 'Stored on this device')}</p>
                  </div>
                </div>
                {session?.user ? <button type="button" disabled={loading} onClick={handleSignOut} className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white hover:text-neutral-950 disabled:opacity-60">Sign out</button> : null}
              </div>

              {profileToolsOpen ? (
                <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 lg:grid-cols-2">
                  <form onSubmit={handleProfileNameSubmit} className="rounded-3xl border border-white/10 bg-neutral-900/70 p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-neutral-950"><AppIcon name="user" size={18} /></span>
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">Name</p>
                        <h4 className="font-bold text-white">Display name</h4>
                      </div>
                    </div>
                    <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="example: Sip" className="mt-4 w-full rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none" />
                    <button disabled={loading} className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950 disabled:opacity-60">{loading ? 'Saving...' : 'Save name'}</button>
                  </form>

                  {session?.user ? (
                    <form onSubmit={handleEmailSubmit} className="rounded-3xl border border-white/10 bg-neutral-900/70 p-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-neutral-950"><AppIcon name="settings" size={18} /></span>
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">Email</p>
                          <h4 className="font-bold text-white">Account email</h4>
                        </div>
                      </div>
                      <input type="email" value={emailDraft} onChange={(event) => setEmailDraft(event.target.value)} placeholder="name@example.com" className="mt-4 w-full rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none" />
                      <button disabled={loading} className="mt-3 w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white hover:text-neutral-950 disabled:opacity-60">{loading ? 'Sending...' : 'Change email'}</button>
                      <p className="mt-3 text-xs leading-5 text-neutral-500">You may need to confirm the new address before it replaces the current email.</p>
                    </form>
                  ) : (
                    <div className="rounded-3xl border border-white/10 bg-neutral-900/70 p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">Email</p>
                      <h4 className="mt-1 font-bold text-white">Sign in to edit account email</h4>
                      <p className="mt-2 text-sm leading-6 text-neutral-400">Your local profile name still works for private device-only cliques.</p>
                    </div>
                  )}
                </div>
              ) : null}

              {hasSupabase && !session?.user ? (
                <form onSubmit={handleAuth} className="mt-4 grid gap-3 border-t border-white/10 pt-4">
                  <div className="flex rounded-2xl border border-white/10 bg-neutral-900 p-1">
                    <button type="button" onClick={() => { setAuthMode('sign-in'); setAuthNotice(null) }} className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${authMode === 'sign-in' ? 'bg-white text-neutral-950' : 'text-neutral-300'}`}>Sign in</button>
                    <button type="button" onClick={() => { setAuthMode('sign-up'); setAuthNotice(null) }} className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${authMode === 'sign-up' ? 'bg-white text-neutral-950' : 'text-neutral-300'}`}>Create account</button>
                  </div>
                  {authNotice ? <p className="rounded-2xl border border-yellow-300/30 bg-yellow-300/10 p-3 text-sm text-yellow-100">{authNotice}</p> : null}
                  {authMode === 'sign-up' ? <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Profile name" className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" /> : null}
                  <input type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="Email" className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
                  <input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="Password" className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
                  <button disabled={loading} className="rounded-2xl bg-white px-5 py-3 font-semibold text-black disabled:opacity-60">{loading ? 'Working...' : authMode === 'sign-up' ? 'Create account' : 'Sign in'}</button>
                </form>
              ) : null}
            </section>

            <section className="mt-4 rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Library settings</p>
                  <h3 className="mt-1 text-xl font-black text-white">Current space: {spaceLabel}</h3>
                  <p className="mt-1 text-sm leading-6 text-neutral-400">Pick where your saves and ratings should land. Personal library stays private; public cliques can appear in Explore.</p>
                </div>
                <span className="w-fit rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-neutral-300">{groups.length} cliques</span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Link to="/dashboard" onClick={() => { usePersonalLibrary(); closeProfileModal() }} className={`rounded-3xl border p-4 transition ${!activeGroup ? 'border-white bg-white text-neutral-950' : 'border-white/10 bg-neutral-900 text-white hover:bg-white/10'}`}>
                  <div className="flex items-center gap-3">
                    <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${!activeGroup ? 'bg-neutral-950 text-white' : 'bg-white text-neutral-950'}`}><AppIcon name="dashboard" size={18} /></span>
                    <div>
                      <div className="text-sm font-black">My Library</div>
                      <div className="text-xs opacity-60">Private picks only you can see</div>
                    </div>
                  </div>
                </Link>

                <Link to="/groups" onClick={() => { closeMenus(); closeProfileModal() }} className={`rounded-3xl border p-4 transition ${activeGroup ? 'border-white bg-white text-neutral-950' : 'border-white/10 bg-neutral-900 text-white hover:bg-white/10'}`}>
                  <div className="flex items-center gap-3">
                    <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${activeGroup ? 'bg-neutral-950 text-white' : 'bg-white text-neutral-950'}`}><AppIcon name="users" size={18} /></span>
                    <div>
                      <div className="text-sm font-black">Cliques</div>
                      <div className="text-xs opacity-60">Shared spaces with invite links</div>
                    </div>
                  </div>
                </Link>
              </div>
            </section>

            <section className="mt-4 rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Your cliques</p>
                  <h3 className="mt-1 text-xl font-black text-white">Manage shared libraries</h3>
                </div>
                <Link to="/groups" onClick={closeProfileModal} className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950">Open all</Link>
              </div>

              {groups.length ? (
                <div className="mt-4 grid gap-2">
                  {groups.map((group) => {
                    const selected = activeGroup?.id === group.id
                    return (
                      <div key={group.id} className={`rounded-3xl border p-3 ${selected ? 'border-white bg-white text-neutral-950' : 'border-white/10 bg-neutral-900 text-white'}`}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="truncate font-black">{group.name}</div>
                            <div className="text-xs opacity-60">{group.members?.length || 1} members · {group.isPublic ? 'Visible in Explore' : 'Private clique'}</div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Link to={getGroupOpenPath(group)} onClick={() => { activateGroup(group); closeProfileModal() }} className={`rounded-xl px-3 py-2 text-xs font-semibold ${selected ? 'bg-neutral-950 text-white' : 'bg-white text-neutral-950'}`}>{selected ? 'Active' : 'Use'}</Link>
                            {usingRemoteGroups ? <button type="button" onClick={() => togglePublic(group)} className="rounded-xl border border-current/20 px-3 py-2 text-xs font-semibold">{group.isPublic ? 'Hide' : 'Make public'}</button> : null}
                            <button type="button" onClick={() => copyInvite(group)} className="rounded-xl border border-current/20 px-3 py-2 text-xs font-semibold">Invite</button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="mt-4 rounded-3xl border border-white/10 bg-neutral-900 p-4 text-sm leading-6 text-neutral-400">No cliques yet. Create one for shared rankings, or join with an invite code.</p>
              )}
            </section>

            <section className="mt-4 rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Clique tools</p>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <form onSubmit={handleCreateGroup} className="rounded-3xl border border-white/10 bg-neutral-900/70 p-4">
                  <h4 className="font-black text-white">Create clique</h4>
                  <input value={groupDraft} onChange={(event) => setGroupDraft(event.target.value)} placeholder="Clique name" className="mt-3 w-full rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none" />
                  <button disabled={loading} className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950 disabled:opacity-60">Create</button>
                </form>

                <form onSubmit={handleJoinGroup} className="rounded-3xl border border-white/10 bg-neutral-900/70 p-4">
                  <h4 className="font-black text-white">Join clique</h4>
                  <input value={inviteDraft} onChange={(event) => setInviteDraft(event.target.value)} placeholder="Invite link or code" className="mt-3 w-full rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none" />
                  <button disabled={loading} className="mt-3 w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white hover:text-neutral-950 disabled:opacity-60">Join</button>
                </form>
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </>
  )
}
