import { Link, useLocation } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import NotificationCenter from './NotificationCenter.jsx'
import AppIcon from './AppIcon.jsx'
import { getSavedHandle, saveSharedHandle } from '../lib/handle.js'
import {
  GROUPS_CHANGED_EVENT,
  createGroup as createLocalGroup,
  getActiveGroup,
  getActiveGroupId,
  getGroupInviteUrl,
  getGroupOpenPath,
  getGroups,
  joinGroup as joinLocalGroup,
  parseInviteCode,
  setActiveGroup,
} from '../lib/groups.js'
import { addFriend, getFriendsList, removeFriend, searchMembersByProfileName } from '../lib/communityShare.js'
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
  { key: 'community', to: '/community', label: 'Community', icon: 'users', description: 'Feed, friends, polls' },
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
  { key: 'books', to: '/books', label: 'Books', icon: 'books' },
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
  community: 'community',
  books: 'books',
}

function normalizeActiveKey(active) {
  return activeMap[active] || active || 'library'
}

function isPrimaryActive(linkKey, activeKey, scopedCliqueId = '') {
  if (linkKey === 'groups' && scopedCliqueId && mediaKeys.includes(activeKey)) return true
  if (linkKey === activeKey) return true
  if (linkKey === 'library' && !scopedCliqueId && mediaKeys.includes(activeKey)) return true
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

function cleanName(value) {
  return String(value || '').trim()
}

function sessionName(session, profile, fallback = '') {
  const candidates = [profile?.display_name, fallback, session?.user?.user_metadata?.display_name]
  return candidates.map(cleanName).find(Boolean) || ''
}

function LogoMark({ scrolled }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className="h-9 w-9 shrink-0 text-white sm:h-10 sm:w-10">
        <path d="M13 29c0-9.5 7.7-17.2 17.2-17.2h18.6" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        <path d="M13 35v8c0 8 6.5 14.5 14.5 14.5h13.2c8 0 14.5-6.5 14.5-14.5 0-7.4-5.6-13.5-12.8-14.4" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M17 36c8.7-3.5 18.7-3.5 30 0 5.2 1.6 7.9 4.2 7.9 7.4 0 4.8-6.6 8.8-20.2 8.8-14.3 0-21.7-4-21.7-10.8V29" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="24" cy="25" r="4" fill="currentColor" />
        <circle cx="34" cy="22" r="4.5" fill="currentColor" />
        <circle cx="45" cy="25" r="4" fill="currentColor" />
        <path d="M33 37l2.2 5.2L40 44l-4.8 1.8L33 51l-2.2-5.2L26 44l4.8-1.8L33 37Z" fill="currentColor" />
      </svg>
      <span className={`block text-xl font-black tracking-tight text-white sm:text-2xl transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${scrolled ? 'max-w-0 opacity-0 overflow-hidden' : 'max-w-[200px] opacity-100'}`}>CliqueBase</span>
    </div>
  )
}

function PersonRow({ person, onAdd, onRemove, onClose }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-neutral-900 p-3 text-white">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link to={`/members/${person.id}`} onClick={onClose} className="min-w-0 flex-1 transition hover:opacity-80">
          <div className="truncate font-black">{person.displayName}</div>
          <div className="mt-1 text-xs text-neutral-500">{person.libraryCount || 0} library items · {person.isFriend ? 'Friend' : 'CliqueBase member'}</div>
        </Link>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link to={`/members/${person.id}`} onClick={onClose} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white hover:text-neutral-950">View library</Link>
          {person.isFriend ? (
            <button type="button" onClick={() => onRemove(person)} className="rounded-xl border border-red-300/30 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500 hover:text-white">Remove</button>
          ) : (
            <button type="button" onClick={() => onAdd(person)} className="rounded-xl bg-white px-3 py-2 text-xs font-black text-neutral-950 transition hover:bg-neutral-200">Add friend</button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function PageNav({ active = 'library' }) {
  const location = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const [handle, setHandle] = useState('')
  const [activeGroup, setActiveGroupState] = useState(null)
  const [groups, setGroups] = useState([])
  const [friends, setFriends] = useState([])
  const [session, setSession] = useState(null)
  const [mediaOpen, setMediaOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const [profileToolsOpen, setProfileToolsOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [emailDraft, setEmailDraft] = useState('')
  const [groupDraft, setGroupDraft] = useState('')
  const [inviteDraft, setInviteDraft] = useState('')
  const [cliqueSearch, setCliqueSearch] = useState('')
  const [peopleSearch, setPeopleSearch] = useState('')
  const [peopleResults, setPeopleResults] = useState([])
  const [peopleSearching, setPeopleSearching] = useState(false)
  const [authMode, setAuthMode] = useState('sign-in')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)

  const activeKey = normalizeActiveKey(active)
  const queryParams = new URLSearchParams(location.search)
  const queryMedia = queryParams.get('media')
  const scopedCliqueId = queryParams.get('clique') || activeGroup?.id || getActiveGroupId()
  const activeMedia = mediaLinks.find((link) => link.key === activeKey) || mediaLinks.find((link) => link.key === queryMedia)
  const activeMediaKey = activeMedia?.key || null
  const profileName = cleanName(handle)
  const profileLabel = profileName || 'Profile'
  const navProfileLabel = profileName || 'Profile'
  const spaceLabel = activeGroup?.name || 'My Library'
  const usingRemoteGroups = hasSupabase && Boolean(session?.user)
  const accountStatus = session?.user ? 'Signed in' : hasSupabase ? 'Ready to sync' : 'Local profile'
  const visibleGroups = useMemo(() => {
    const query = cliqueSearch.trim().toLowerCase()
    if (!query) return groups
    return groups.filter((group) => String(group.name || '').toLowerCase().includes(query))
  }, [groups, cliqueSearch])

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
    setFriends([])
    setActiveGroupState(null)
    setProfileToolsOpen(false)
    setActiveGroup('')
  }

  function sectionRoot() {
    if (activeKey === 'community') return '/community'
    if (activeKey === 'explore') return '/explore'
    if (activeKey === 'groups') return '/groups'
    return scopedCliqueId ? `/cliques/${encodeURIComponent(scopedCliqueId)}` : '/dashboard'
  }

  function mediaHref(key) {
    if (key === 'all') return sectionRoot()
    const mediaLink = mediaLinks.find((link) => link.key === key)
    if (activeKey === 'explore') return `/explore?media=${key}`
    if (scopedCliqueId && mediaLink?.to) return `${mediaLink.to}?clique=${encodeURIComponent(scopedCliqueId)}`
    return mediaLink?.to || '/dashboard'
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
        const [remoteGroups, nextFriends] = await Promise.all([
          getRemoteGroups().catch(() => []),
          getFriendsList().catch(() => []),
        ])
        setGroups(remoteGroups)
        setFriends(nextFriends)
        const activeId = getActiveGroupId()
        const nextActive = activeId ? remoteGroups.find((group) => group.id === activeId) || null : null
        setActiveGroupState(nextActive)
        return
      } catch (error) {
        clearSessionUi()
        flash(error.message || 'Could not sync your account.')
      }
    }
    const saved = getSavedHandle()
    setHandle(saved)
    setDraft((current) => current || saved)
    setEmailDraft('')
    setSession(null)
    setGroups(getGroups())
    setFriends([])
    setActiveGroupState(getActiveGroup())
  }

  useEffect(() => {
    refreshGroups()
    function handleChange() {
      refreshGroups()
    }
    window.addEventListener(GROUPS_CHANGED_EVENT, handleChange)
    const unsubscribe = hasSupabase ? onAuthStateChanged((nextSession) => {
      if (!nextSession?.user) clearSessionUi()
      else refreshGroups()
    }) : () => {}

    function handleScroll() {
      setScrolled(window.scrollY > 30)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener(GROUPS_CHANGED_EVENT, handleChange)
      unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!accountOpen || !usingRemoteGroups || peopleSearch.trim().length < 2) {
      setPeopleResults([])
      setPeopleSearching(false)
      return undefined
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setPeopleSearching(true)
      try {
        const results = await searchMembersByProfileName(peopleSearch, 8)
        if (!cancelled) setPeopleResults(results)
      } catch (error) {
        if (!cancelled) {
          setPeopleResults([])
          flash(error.message || 'Could not search people.')
        }
      } finally {
        if (!cancelled) setPeopleSearching(false)
      }
    }, 260)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [accountOpen, usingRemoteGroups, peopleSearch])

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
    if (!draft.trim()) return flash('Add a profile name first.')
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

  async function handleAuth(event) {
    event.preventDefault()
    setAuthNotice('')
    if (!authEmail.trim() || !authPassword) return flash('Add an email and password first.')
    setLoading(true)
    try {
      const email = authEmail.trim()
      const displayName = draft.trim()
      if (authMode === 'sign-up') {
        const result = await signUpWithEmail(email, authPassword, displayName)
        if (!result.session?.user) setAuthNotice(`Check ${email} to confirm your account, then sign in.`)
        else setSession(result.session)
      } else {
        const data = await signInWithEmail(email, authPassword)
        if (!data.session?.user) throw new Error('Confirm your email first, then try again.')
        setSession(data.session)
      }
      setAuthPassword('')
      refreshGroups()
      flash(authMode === 'sign-up' ? 'Account created.' : 'Signed in.')
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

  function usePersonalLibrary() {
    setActiveGroup('')
    setActiveGroupState(null)
    closeMenus()
  }

  function activateGroup(group) {
    setActiveGroup(group.id)
    setActiveGroupState(group)
    closeMenus()
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
    if (!code) return flash('Paste an invite code first.')
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
    flash(copied ? 'Invite link copied.' : getGroupInviteUrl(group))
  }

  async function togglePublic(group) {
    if (!usingRemoteGroups) return flash('Public Explore visibility is available for signed-in cliques.')
    try {
      await setGroupPublic(group.id, !group.isPublic)
      flash(!group.isPublic ? `${group.name} is visible in Explore.` : `${group.name} is private again.`)
      refreshGroups()
    } catch (error) {
      flash(error.message || 'Could not update public visibility.')
    }
  }

  async function handleAddFriend(person) {
    setLoading(true)
    try {
      const friend = await addFriend(person.id)
      setFriends((current) => [friend, ...current.filter((item) => item.id !== friend.id)])
      setPeopleResults((current) => current.map((item) => item.id === person.id ? { ...item, isFriend: true } : item))
      flash(`${friend.displayName} added to friends.`)
    } catch (error) {
      flash(error.message || 'Could not add friend.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRemoveFriend(person) {
    setLoading(true)
    try {
      await removeFriend(person.id)
      setFriends((current) => current.filter((item) => item.id !== person.id))
      setPeopleResults((current) => current.map((item) => item.id === person.id ? { ...item, isFriend: false } : item))
      flash(`${person.displayName} removed from friends.`)
    } catch (error) {
      flash(error.message || 'Could not remove friend.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-[80] flex items-center justify-between px-3 py-2 bg-neutral-950/80 backdrop-blur-lg border-b border-white/10 md:hidden">
        <Link to="/community" aria-label="CliqueBase Community" className="w-fit rounded-[1.4rem] transition hover:opacity-80" onClick={closeMenus}>
          <LogoMark scrolled={false} />
        </Link>
        <div className="flex items-center gap-2">
          <NotificationCenter />
          <button type="button" aria-label={`Open profile for ${profileLabel}`} onClick={() => { closeMenus(); setProfileToolsOpen(false); setAccountOpen(true) }} className="flex h-[2.35rem] w-[2.35rem] shrink-0 items-center justify-center rounded-full border border-white/10 bg-neutral-950/95 text-white shadow-2xl shadow-black/30 backdrop-blur transition-all duration-300 hover:bg-white hover:text-black">
            <AppIcon name="user" size={15} />
          </button>
        </div>
      </div>
      <div className="fixed top-3 left-3 right-3 sm:left-4 sm:right-4 md:left-6 md:right-6 z-[80] pointer-events-none hidden md:flex justify-center">
        <header className={`pointer-events-auto w-full max-w-6xl rounded-[2rem] border border-white/10 bg-neutral-950/95 px-3 py-3 shadow-2xl shadow-black/30 backdrop-blur transition-all duration-300 sm:px-4 ${scrolled ? 'py-2 shadow-black/50' : 'py-3'}`}>
        <div className="grid gap-3 xl:grid-cols-[auto_1fr_auto] xl:items-center">
          <Link to="/community" aria-label="CliqueBase Community" className={`w-fit rounded-[1.4rem] px-2 py-1 transition hover:opacity-80 ${searchFocused ? 'hidden lg:block' : ''}`} onClick={closeMenus}><LogoMark scrolled={scrolled} /></Link>
          <div className="flex min-w-0 flex-col items-stretch justify-center gap-2 lg:flex-row lg:items-center">
            <nav aria-label="Primary navigation" className={`grid min-w-0 grid-cols-2 gap-1 rounded-[1.6rem] border border-white/10 bg-white/[0.035] p-1 sm:rounded-full ${searchFocused ? 'hidden lg:hidden' : 'sm:flex lg:flex'}`}>
              {primaryLinks.map((link) => {
                const selected = isPrimaryActive(link.key, activeKey, scopedCliqueId)
                return (
                  <Link key={link.key} to={link.to} onClick={() => handlePrimaryClick(link)} aria-current={selected ? 'page' : undefined} title={link.description} className={`inline-flex min-w-0 items-center justify-center gap-2 rounded-full px-3 py-2.5 text-xs font-black transition sm:flex-1 xl:flex-none ${selected ? 'bg-white text-neutral-950 shadow-lg shadow-white/5' : 'text-neutral-300 hover:bg-white/10 hover:text-white'}`}>
                    <AppIcon name={link.icon} size={15} />
                    <span className="truncate">{link.label}</span>
                  </Link>
                )
              })}
            </nav>
            <div className={`relative hidden w-full lg:block transition-all duration-300 ${searchFocused ? 'flex-1' : 'xl:w-[240px]'}`}>
              <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.035] px-4 py-2.5 text-sm text-neutral-200 transition focus-within:border-white/30 focus-within:bg-white/[0.06]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-neutral-500 shrink-0"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input type="text" placeholder="Search topics, books, youtube..." className="w-full bg-transparent outline-none placeholder:text-neutral-500 font-bold" onFocus={() => setSearchFocused(true)} onBlur={() => setSearchFocused(false)} />
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="button" aria-label={`Open profile for ${profileLabel}`} onClick={() => { closeMenus(); setProfileToolsOpen(false); setAccountOpen(true) }} className="inline-flex h-11 max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-white transition hover:bg-white hover:text-black">
              <AppIcon name="user" size={16} />
              <span className="hidden min-w-0 truncate sm:inline">{navProfileLabel}</span>
            </button>
          </div>
        </div>
        </header>
      </div>
      <div className="hidden md:block h-[4.5rem] mb-5 sm:h-[5.5rem]" aria-hidden="true" />

      {message ? <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950 shadow-2xl">{message}</div> : null}

      {accountOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[2rem] border border-white/10 bg-neutral-950 p-4 shadow-2xl shadow-black/40 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.25em] text-neutral-500">Profile settings</div>
                <h2 className="mt-1 truncate text-2xl font-black text-white">{navProfileLabel}</h2>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" aria-label="Edit profile details" onClick={() => setProfileToolsOpen((value) => !value)} className={`flex h-11 w-11 items-center justify-center rounded-full border border-white/10 transition ${profileToolsOpen ? 'bg-white text-neutral-950' : 'bg-white/[0.04] text-white hover:bg-white hover:text-neutral-950'}`}><AppIcon name="settings" size={18} /></button>
                <button type="button" aria-label="Close profile" onClick={closeProfileModal} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-2xl text-neutral-400 transition hover:bg-white hover:text-neutral-950">×</button>
              </div>
            </div>

            <section className="mt-5 rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.2rem] border border-white/10 bg-white/[0.06] text-white"><AppIcon name="user" size={21} strokeWidth={1.8} /></div>
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
                    <p className="text-xs uppercase tracking-[0.22em] text-neutral-500">Name</p>
                    <h4 className="mt-1 font-bold text-white">Display name</h4>
                    <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="example: Sip" className="mt-4 w-full rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none" />
                    <button disabled={loading} className="mt-3 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950 disabled:opacity-60">{loading ? 'Saving...' : 'Save name'}</button>
                  </form>
                </div>
              ) : null}

              {hasSupabase && !session?.user ? (
                <form onSubmit={handleAuth} className="mt-4 grid gap-3 border-t border-white/10 pt-4">
                  <div className="flex rounded-2xl border border-white/10 bg-neutral-900 p-1">
                    <button type="button" onClick={() => { setAuthMode('sign-in'); setAuthNotice('') }} className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${authMode === 'sign-in' ? 'bg-white text-neutral-950' : 'text-neutral-300'}`}>Sign in</button>
                    <button type="button" onClick={() => { setAuthMode('sign-up'); setAuthNotice('') }} className={`flex-1 rounded-xl px-3 py-2 text-sm font-semibold ${authMode === 'sign-up' ? 'bg-white text-neutral-950' : 'text-neutral-300'}`}>Create account</button>
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
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Friends list</p><h3 className="mt-1 text-xl font-black text-white">Your friends</h3></div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-neutral-300">{friends.length} friends</span>
              </div>
              <div className="mt-3 grid gap-2">
                {!usingRemoteGroups ? <p className="rounded-3xl border border-white/10 bg-neutral-900 p-4 text-sm text-neutral-400">Sign in to manage your friends list.</p> : friends.length ? friends.map((friend) => <PersonRow key={friend.id} person={friend} onAdd={handleAddFriend} onRemove={handleRemoveFriend} onClose={closeProfileModal} />) : <p className="rounded-3xl border border-white/10 bg-neutral-900 p-4 text-sm leading-6 text-neutral-400">No friends yet. Search people below and add them to keep their libraries one tap away.</p>}
              </div>
            </section>

            <section className="mt-4 rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Discover</p>
              <h3 className="mt-1 text-xl font-black text-white">Find people and add friends</h3>
              <input value={peopleSearch} onChange={(event) => setPeopleSearch(event.target.value)} placeholder="Search profile name..." className="mt-4 w-full rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none" />
              <div className="mt-3 grid gap-2">
                {!usingRemoteGroups ? <p className="rounded-3xl border border-white/10 bg-neutral-900 p-4 text-sm text-neutral-400">Sign in to search other CliqueBase users.</p> : peopleSearching ? <p className="rounded-3xl border border-white/10 bg-neutral-900 p-4 text-sm text-neutral-400">Searching people...</p> : peopleSearch.trim().length < 2 ? <p className="rounded-3xl border border-white/10 bg-neutral-900 p-4 text-sm text-neutral-400">Type at least 2 letters to find profiles.</p> : peopleResults.length ? peopleResults.map((person) => <PersonRow key={person.id} person={person} onAdd={handleAddFriend} onRemove={handleRemoveFriend} onClose={closeProfileModal} />) : <p className="rounded-3xl border border-white/10 bg-neutral-900 p-4 text-sm text-neutral-400">No people found.</p>}
              </div>
            </section>

            <section className="mt-4 rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div><p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Library settings</p><h3 className="mt-1 text-xl font-black text-white">Current space: {spaceLabel}</h3></div>
                <span className="w-fit rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-neutral-300">{groups.length} cliques</span>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Link to="/dashboard" onClick={() => { usePersonalLibrary(); closeProfileModal() }} className={`rounded-3xl border p-4 transition ${!activeGroup ? 'border-white bg-white text-neutral-950' : 'border-white/10 bg-neutral-900 text-white hover:bg-white/10'}`}>My Library</Link>
                <Link to="/groups" onClick={() => { closeMenus(); closeProfileModal() }} className={`rounded-3xl border p-4 transition ${activeGroup ? 'border-white bg-white text-neutral-950' : 'border-white/10 bg-neutral-900 text-white hover:bg-white/10'}`}>Cliques</Link>
              </div>
            </section>

            <section className="mt-4 rounded-[1.75rem] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <div><p className="text-xs uppercase tracking-[0.25em] text-neutral-500">Your cliques</p><h3 className="mt-1 text-xl font-black text-white">Manage shared libraries</h3></div>
                <Link to="/groups" onClick={closeProfileModal} className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-neutral-950">Open all</Link>
              </div>
              <input value={cliqueSearch} onChange={(event) => setCliqueSearch(event.target.value)} placeholder="Search your cliques..." className="mt-4 w-full rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none" />
              {visibleGroups.length ? (
                <div className="mt-4 grid gap-2">
                  {visibleGroups.map((group) => {
                    const selected = activeGroup?.id === group.id
                    return (
                      <div key={group.id} className={`rounded-3xl border p-3 ${selected ? 'border-white bg-white text-neutral-950' : 'border-white/10 bg-neutral-900 text-white'}`}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0"><div className="truncate font-black">{group.name}</div><div className="text-xs opacity-60">{group.members?.length || 1} members · {group.isPublic ? 'Visible in Explore' : 'Private clique'}</div></div>
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
              ) : <p className="mt-4 rounded-3xl border border-white/10 bg-neutral-900 p-4 text-sm leading-6 text-neutral-400">No matching cliques.</p>}
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
