import { Link, useLocation } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
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
  supabase,
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
const activeMap = { home: 'library', dashboard: 'library', library: 'library', cliques: 'groups', groups: 'groups', leaderboard: 'explore', explore: 'explore', community: 'community' }
function normalizeActiveKey(active) { return activeMap[active] || active || 'library' }
function isPrimaryActive(linkKey, activeKey, scopedCliqueId = '') { if (linkKey === 'groups' && scopedCliqueId && mediaKeys.includes(activeKey)) return true; if (linkKey === activeKey) return true; if (linkKey === 'library' && !scopedCliqueId && mediaKeys.includes(activeKey)) return true; return false }
async function copyToClipboard(value) { if (!value) return false; if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) { try { await navigator.clipboard.writeText(value); return true } catch { return false } } return false }
function cleanName(value) { return String(value || '').trim() }
function sessionName(session, profile, fallback = '') { const candidates = [profile?.display_name, fallback, session?.user?.user_metadata?.display_name]; return candidates.map(cleanName).find(Boolean) || '' }

function LogoMark() { return <div className="flex min-w-0 items-center gap-2.5"><svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className="h-9 w-9 shrink-0 text-white sm:h-10 sm:w-10"><path d="M13 29c0-9.5 7.7-17.2 17.2-17.2h18.6" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /><path d="M13 35v8c0 8 6.5 14.5 14.5 14.5h13.2c8 0 14.5-6.5 14.5-14.5 0-7.4-5.6-13.5-12.8-14.4" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /><path d="M17 36c8.7-3.5 18.7-3.5 30 0 5.2 1.6 7.9 4.2 7.9 7.4 0 4.8-6.6 8.8-20.2 8.8-14.3 0-21.7-4-21.7-10.8V29" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /><circle cx="24" cy="25" r="4" fill="currentColor" /><circle cx="34" cy="22" r="4.5" fill="currentColor" /><circle cx="45" cy="25" r="4" fill="currentColor" /><path d="M33 37l2.2 5.2L40 44l-4.8 1.8L33 51l-2.2-5.2L26 44l4.8-1.8L33 37Z" fill="currentColor" /></svg><span className="block text-xl font-black tracking-tight text-white sm:text-2xl">CliqueBase</span></div> }
function PersonRow({ person, onAdd, onRemove, onClose }) { return <div className="rounded-3xl border border-white/10 bg-neutral-900 p-3 text-white"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><Link to={`/members/${person.id}`} onClick={onClose} className="min-w-0 flex-1 transition hover:opacity-80"><div className="truncate font-black">{person.displayName}</div><div className="mt-1 text-xs text-neutral-500">{person.libraryCount || 0} library items · {person.isFriend ? 'Friend' : 'CliqueBase member'}</div></Link><div className="flex shrink-0 flex-wrap gap-2"><Link to={`/members/${person.id}`} onClick={onClose} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white hover:text-neutral-950">View library</Link>{person.isFriend ? <button type="button" onClick={() => onRemove(person)} className="rounded-xl border border-red-300/30 px-3 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500 hover:text-white">Remove</button> : <button type="button" onClick={() => onAdd(person)} className="rounded-xl bg-white px-3 py-2 text-xs font-black text-neutral-950 transition hover:bg-neutral-200">Add friend</button>}</div></div></div> }

export default function PageNav({ active = 'library' }) {
  const location = useLocation()
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
  const [authNotice, setAuthNotice] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const activeKey = normalizeActiveKey(active)
  const queryParams = new URLSearchParams(location.search)
  const queryMedia = queryParams.get('media')
  const scopedCliqueId = queryParams.get('clique') || activeGroup?.id || getActiveGroupId()
  const activePrimary = primaryLinks.find((link) => isPrimaryActive(link.key, activeKey, scopedCliqueId)) || primaryLinks[2]
  const activeMedia = mediaLinks.find((link) => link.key === activeKey) || mediaLinks.find((link) => link.key === queryMedia)
  const activeMediaKey = activeMedia?.key || null
  const profileName = cleanName(handle)
  const profileLabel = profileName || 'Profile'
  const navProfileLabel = profileName || 'Profile'
  const spaceLabel = activeGroup?.name || 'My Library'
  const usingRemoteGroups = hasSupabase && Boolean(session?.user)
  const accountStatus = session?.user ? 'Signed in' : hasSupabase ? 'Ready to sync' : 'Local profile'
  const visibleGroups = useMemo(() => { const query = cliqueSearch.trim().toLowerCase(); if (!query) return groups; return groups.filter((group) => String(group.name || '').toLowerCase().includes(query)) }, [groups, cliqueSearch])
  function flash(text) { setMessage(text); setTimeout(() => setMessage(''), 2500) }
  function closeMenus() { setMediaOpen(false) }
  function closeProfileModal() { setAccountOpen(false); setProfileToolsOpen(false) }
  function clearSessionUi() { setSession(null); setHandle(''); setDraft(''); setEmailDraft(''); setGroups([]); setFriends([]); setActiveGroupState(null); setProfileToolsOpen(false); setActiveGroup('') }
  function sectionRoot() { if (activePrimary.key === 'community') return '/community'; if (activePrimary.key === 'explore') return '/explore'; if (activePrimary.key === 'groups') return '/groups'; return '/dashboard' }
  function mediaHref(key) { if (key === 'all') return sectionRoot(); const mediaLink = mediaLinks.find((link) => link.key === key); if (activePrimary.key === 'explore') return `/explore?media=${key}`; if (activePrimary.key === 'groups') { if (scopedCliqueId && mediaLink?.to) return `${mediaLink.to}?clique=${encodeURIComponent(scopedCliqueId)}`; return `/groups?media=${key}` } return mediaLink?.to || '/dashboard' }
  function handlePrimaryClick(link) { if (link.key === 'library') { usePersonalLibrary(); return } closeMenus() }

  async function refreshGroups() {
    if (hasSupabase) {
      try {
        const nextSession = await getCurrentSession()
        setSession(nextSession)
        if (!nextSession?.user) { clearSessionUi(); return }
        const saved = getSavedHandle()
        const profile = await getProfile().catch(() => null)
        const displayName = sessionName(nextSession, profile, saved)
        setEmailDraft(nextSession.user.email || '')
        if (displayName) { saveSharedHandle(displayName); setHandle(displayName); setDraft(displayName) } else { setHandle(''); setDraft('') }
        const [remoteGroups, nextFriends] = await Promise.all([getRemoteGroups().catch(() => []), getFriendsList().catch(() => [])])
        setGroups(remoteGroups); setFriends(nextFriends)
        const activeId = getActiveGroupId()
        const nextActive = activeId ? remoteGroups.find((group) => group.id === activeId) || null : null
        setActiveGroupState(nextActive)
        if (activeId && !nextActive) setActiveGroup('')
        return
      } catch (error) { console.warn('Remote group load failed:', error); clearSessionUi() }
    }
    const localHandle = getSavedHandle(); setHandle(localHandle); setDraft(localHandle); const localGroups = getGroups(); setGroups(localGroups); const activeId = getActiveGroupId(); setActiveGroupState(activeId ? localGroups.find((group) => group.id === activeId) || null : null)
  }
  useEffect(() => { refreshGroups(); const off = onAuthStateChanged(refreshGroups); window.addEventListener(GROUPS_CHANGED_EVENT, refreshGroups); return () => { off?.(); window.removeEventListener(GROUPS_CHANGED_EVENT, refreshGroups) } }, [])
  async function saveHandle(event) { event?.preventDefault?.(); const next = cleanName(draft); saveSharedHandle(next); setHandle(next); flash(next ? `Profile saved as ${next}.` : 'Profile cleared.') }
  async function handleAuth(event) { event.preventDefault(); if (!hasSupabase) return flash('Supabase is not configured.'); setLoading(true); setAuthNotice(null); try { if (authMode === 'sign-up') await signUpWithEmail(authEmail, authPassword, draft || handle); else await signInWithEmail(authEmail, authPassword); setAuthNotice({ type: 'success', text: authMode === 'sign-up' ? 'Account created. Check email if confirmation is enabled.' : 'Signed in.' }); await refreshGroups() } catch (error) { setAuthNotice({ type: 'error', text: error.message || 'Authentication failed.' }) } finally { setLoading(false) } }
  async function handleSignOut() { setLoading(true); try { await signOut(); clearSessionUi(); flash('Signed out.') } catch (error) { flash(error.message || 'Could not sign out.') } finally { setLoading(false) } }
  async function createGroup(event) { event.preventDefault(); const name = cleanName(groupDraft); if (!name) return flash('Name your clique first.'); setLoading(true); try { const group = usingRemoteGroups ? await createRemoteGroup(name, handle || draft || 'Member') : createLocalGroup(name, handle || draft || 'Member'); setGroupDraft(''); await refreshGroups(); setActiveGroup(group.id); flash(`${group.name} created.`) } catch (error) { flash(error.message || 'Could not create clique.') } finally { setLoading(false) } }
  async function joinGroup(event) { event.preventDefault(); const code = parseInviteCode(inviteDraft); if (!code) return flash('Paste an invite link or code.'); setLoading(true); try { const group = usingRemoteGroups ? await joinRemoteGroup(code, handle || draft || 'Member') : joinLocalGroup(code, handle || draft || 'Member'); setInviteDraft(''); await refreshGroups(); if (group?.id) setActiveGroup(group.id); flash(group ? `Joined ${group.name}.` : 'Invite not found.') } catch (error) { flash(error.message || 'Could not join clique.') } finally { setLoading(false) } }
  function usePersonalLibrary() { setActiveGroup(''); setActiveGroupState(null); closeMenus() }
  function useGroup(group) { setActiveGroup(group.id); setActiveGroupState(group); closeMenus(); closeProfileModal() }
  async function copyInvite(group) { const copied = await copyToClipboard(getGroupInviteUrl(group)); flash(copied ? 'Invite link copied.' : getGroupInviteUrl(group)) }
  async function togglePublic(group) { if (!group?.id) return; setLoading(true); try { if (!usingRemoteGroups) return flash('Public/private sync needs sign in.'); await setGroupPublic(group.id, !group.isPublic); await refreshGroups(); flash(!group.isPublic ? 'Clique is public.' : 'Clique is private.') } catch (error) { flash(error.message || 'Could not update clique visibility.') } finally { setLoading(false) } }
  async function handlePeopleSearch(value) { setPeopleSearch(value); if (!usingRemoteGroups || value.trim().length < 2) { setPeopleResults([]); return } setPeopleSearching(true); try { setPeopleResults(await searchMembersByProfileName(value)) } catch (error) { flash(error.message || 'Could not search members.') } finally { setPeopleSearching(false) } }
  async function handleAddFriend(person) { try { await addFriend(person.id); flash(`Friend request sent to ${person.displayName}.`); await refreshGroups() } catch (error) { flash(error.message || 'Could not add friend.') } }
  async function handleRemoveFriend(person) { try { await removeFriend(person.id); flash(`${person.displayName} removed.`); await refreshGroups() } catch (error) { flash(error.message || 'Could not remove friend.') } }

  return <header className="sticky top-0 z-40 border-b border-white/10 bg-neutral-950/92 text-white shadow-2xl shadow-black/20 backdrop-blur-xl"><div className="mx-auto max-w-6xl px-4 py-3"><div className="flex items-center justify-between gap-3"><Link to="/community" onClick={closeMenus} className="min-w-0"><LogoMark /></Link><nav className="hidden items-center gap-2 lg:flex">{primaryLinks.map((link) => <Link key={link.key} to={link.to} onClick={() => handlePrimaryClick(link)} className={`rounded-2xl px-3 py-2 text-sm font-black transition ${isPrimaryActive(link.key, activeKey, scopedCliqueId) ? 'bg-white text-neutral-950' : 'text-neutral-300 hover:bg-white hover:text-neutral-950'}`}>{link.label}</Link>)}</nav><div className="flex min-w-0 items-center gap-2"><button type="button" onClick={() => setMediaOpen((value) => !value)} className="inline-flex max-w-[9.5rem] items-center gap-2 truncate rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-black text-white hover:bg-white hover:text-neutral-950"><AppIcon name={activeMedia?.icon || 'dashboard'} size={16} />{activeMedia?.label || spaceLabel}<AppIcon name="chevronDown" size={13} /></button><button type="button" onClick={() => setAccountOpen(true)} className="rounded-2xl bg-white px-3 py-2 text-sm font-black text-neutral-950">{navProfileLabel}</button></div></div>{mediaOpen ? <div className="mt-3 grid gap-2 rounded-3xl border border-white/10 bg-neutral-900 p-3 shadow-2xl lg:grid-cols-[13rem_1fr]"><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Space</p><Link to={sectionRoot()} onClick={closeMenus} className="mt-2 flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm font-black text-neutral-950"><AppIcon name={allMediaOption.icon} size={15} />{allMediaOption.label}</Link></div><div><p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Categories</p><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">{mediaLinks.map((link) => <Link key={link.key} to={mediaHref(link.key)} onClick={closeMenus} className={`flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-black transition ${activeMediaKey === link.key ? 'border-white bg-white text-neutral-950' : 'border-white/10 bg-neutral-950 text-neutral-200 hover:bg-white hover:text-neutral-950'}`}><AppIcon name={link.icon} size={15} />{link.label}</Link>)}</div></div></div> : null}</div>{accountOpen ? <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-20 backdrop-blur-sm"><div className="w-full max-w-3xl rounded-[2rem] border border-white/10 bg-neutral-950 p-5 text-white shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Profile</p><h2 className="mt-1 text-2xl font-black">{profileLabel}</h2><p className="mt-1 text-sm text-neutral-500">{accountStatus}</p></div><button type="button" onClick={closeProfileModal} className="text-2xl text-neutral-400 hover:text-white">×</button></div><form onSubmit={saveHandle} className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto]"><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Display name" className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" /><button className="rounded-2xl bg-white px-4 py-3 font-black text-neutral-950">Save name</button></form><div className="mt-5 grid gap-4 lg:grid-cols-2"><section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4"><div className="flex items-center justify-between"><h3 className="font-black">Account</h3><button type="button" onClick={() => setProfileToolsOpen((value) => !value)} className="text-xs font-bold text-neutral-400 hover:text-white">{profileToolsOpen ? 'Hide' : 'Open'}</button></div>{profileToolsOpen ? <form onSubmit={handleAuth} className="mt-3 grid gap-2"><select value={authMode} onChange={(event) => setAuthMode(event.target.value)} className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white"><option value="sign-in">Sign in</option><option value="sign-up">Create account</option></select><input value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} placeholder="Email" className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" /><input value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="Password" type="password" className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" /><button disabled={loading} className="rounded-2xl bg-white px-4 py-3 font-black text-neutral-950 disabled:opacity-50">{loading ? 'Working…' : authMode === 'sign-up' ? 'Create account' : 'Sign in'}</button>{session?.user ? <button type="button" onClick={handleSignOut} className="rounded-2xl border border-white/10 px-4 py-3 font-black text-white hover:bg-white hover:text-neutral-950">Sign out</button> : null}{authNotice ? <p className={`rounded-2xl p-3 text-sm ${authNotice.type === 'error' ? 'bg-red-600' : 'bg-emerald-700'}`}>{authNotice.text}</p> : null}</form> : null}</section><section className="rounded-3xl border border-white/10 bg-white/[0.03] p-4"><h3 className="font-black">Cliques</h3><form onSubmit={createGroup} className="mt-3 flex gap-2"><input value={groupDraft} onChange={(event) => setGroupDraft(event.target.value)} placeholder="New clique" className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-neutral-900 px-3 py-2 text-white outline-none" /><button disabled={loading} className="rounded-2xl bg-white px-3 py-2 text-sm font-black text-neutral-950">Create</button></form><form onSubmit={joinGroup} className="mt-2 flex gap-2"><input value={inviteDraft} onChange={(event) => setInviteDraft(event.target.value)} placeholder="Invite code/link" className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-neutral-900 px-3 py-2 text-white outline-none" /><button disabled={loading} className="rounded-2xl border border-white/10 px-3 py-2 text-sm font-black text-white">Join</button></form><input value={cliqueSearch} onChange={(event) => setCliqueSearch(event.target.value)} placeholder="Search cliques" className="mt-3 w-full rounded-2xl border border-white/10 bg-neutral-900 px-3 py-2 text-white outline-none" /><div className="mt-3 grid max-h-64 gap-2 overflow-y-auto">{visibleGroups.map((group) => <div key={group.id} className="rounded-2xl border border-white/10 bg-neutral-900 p-3"><div className="flex items-center justify-between gap-2"><button type="button" onClick={() => useGroup(group)} className="min-w-0 text-left"><p className="truncate font-black">{group.name}</p><p className="text-xs text-neutral-500">{group.members?.length || 1} members · {group.isPublic ? 'Public' : 'Private'}</p></button><div className="flex gap-1"><Link to={getGroupOpenPath(group)} onClick={closeProfileModal} className="rounded-xl border border-white/10 px-2 py-1 text-xs">Open</Link><button type="button" onClick={() => copyInvite(group)} className="rounded-xl border border-white/10 px-2 py-1 text-xs">Invite</button>{usingRemoteGroups ? <button type="button" onClick={() => togglePublic(group)} className="rounded-xl border border-white/10 px-2 py-1 text-xs">{group.isPublic ? 'Private' : 'Public'}</button> : null}</div></div></div>))}</div></section></div><section className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4"><h3 className="font-black">Friends</h3><input value={peopleSearch} onChange={(event) => handlePeopleSearch(event.target.value)} placeholder="Search people by profile name" className="mt-3 w-full rounded-2xl border border-white/10 bg-neutral-900 px-3 py-2 text-white outline-none" />{peopleSearching ? <p className="mt-2 text-sm text-neutral-400">Searching…</p> : null}<div className="mt-3 grid gap-2">{peopleResults.map((person) => <PersonRow key={person.id} person={person} onAdd={handleAddFriend} onRemove={handleRemoveFriend} onClose={closeProfileModal} />)}{!peopleResults.length && friends.map((person) => <PersonRow key={person.id} person={person} onAdd={handleAddFriend} onRemove={handleRemoveFriend} onClose={closeProfileModal} />)}</div></section></div></div> : null}{message ? <div className="fixed bottom-5 left-1/2 z-[90] -translate-x-1/2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950 shadow-2xl">{message}</div> : null}</header>
}
