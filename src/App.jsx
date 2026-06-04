import { useEffect } from 'react'
import { Route, Routes } from 'react-router-dom'
import Community from './pages/Community.jsx'
import Home from './pages/Home.jsx'
import Movies from './pages/Movies.jsx'
import Series from './pages/Series.jsx'
import Games from './pages/Games.jsx'
import Videos from './pages/Videos.jsx'
import Music from './pages/Music.jsx'
import Groups from './pages/Groups.jsx'
import CliqueDetail from './pages/CliqueDetail.jsx'
import CliqueSettings from './pages/CliqueSettings.jsx'
import Leaderboard from './pages/Leaderboard.jsx'
import Share from './pages/Share.jsx'
import MemberLibrary from './pages/MemberLibrary.jsx'
import SwipeInbox from './pages/SwipeInbox.jsx'
import {
  ACTIVE_GROUP_STORAGE_KEY,
  PENDING_GROUP_INVITE_STORAGE_KEY,
  joinGroup as joinLocalGroup,
  parseInviteCode,
  setActiveGroup,
} from './lib/groups.js'
import { getCurrentSession, hasSupabase, joinRemoteGroup, onAuthStateChanged } from './lib/supabaseClient.js'

function getAppPathname() {
  if (typeof window === 'undefined') return '/'
  const pathname = window.location.pathname || '/'
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '')
  if (base && base !== '/' && pathname.startsWith(`${base}/`)) return pathname.slice(base.length) || '/'
  return pathname
}

function getAppBasePath() {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')
  return base.startsWith('/') ? base : `/${base}`
}

function getInviteCodeFromPath(pathname) {
  const parts = String(pathname || '').split('/').filter(Boolean)
  if (parts[0] !== 'invite' || !parts[1]) return ''
  return parseInviteCode(parts[1])
}

function getPendingInvite() {
  if (typeof window === 'undefined') return ''
  return parseInviteCode(window.localStorage.getItem(PENDING_GROUP_INVITE_STORAGE_KEY) || '')
}

function clearPendingInvite(code) {
  if (typeof window === 'undefined') return
  const pending = getPendingInvite()
  if (!code || pending === parseInviteCode(code)) window.localStorage.removeItem(PENDING_GROUP_INVITE_STORAGE_KEY)
}

function syncPendingInviteFromUrl() {
  if (typeof window === 'undefined') return
  const pathname = getAppPathname()
  const inviteCode = getInviteCodeFromPath(pathname)
  if (inviteCode) {
    window.localStorage.setItem(PENDING_GROUP_INVITE_STORAGE_KEY, inviteCode)
    return
  }
  const pendingInvite = getPendingInvite()
  if (!pendingInvite) return
  const resumablePaths = ['/', '/community', '/explore', '/leaderboard', '/dashboard', '/library', '/library/inbox']
  if (!resumablePaths.includes(pathname)) return
  const base = getAppBasePath()
  const nextPath = `${base}invite/${encodeURIComponent(pendingInvite)}${window.location.search || ''}${window.location.hash || ''}`
  window.location.replace(nextPath)
}

function isPersonalLibraryPath(pathname) {
  return ['/dashboard', '/library', '/library/inbox', '/library/movies', '/library/series', '/library/games', '/movies', '/series', '/games', '/videos', '/music'].includes(pathname)
}

function syncCliqueScopeFromUrl() {
  if (typeof window === 'undefined') return
  const pathname = getAppPathname()
  const params = new URLSearchParams(window.location.search)
  const cliqueId = params.get('clique') || params.get('group') || params.get('scope')
  if (cliqueId) window.localStorage.setItem(ACTIVE_GROUP_STORAGE_KEY, cliqueId)
  else if (isPersonalLibraryPath(pathname)) window.localStorage.removeItem(ACTIVE_GROUP_STORAGE_KEY)
}

async function acceptPendingInvite(session = null) {
  const pendingInvite = getPendingInvite()
  if (!pendingInvite) return null
  if (hasSupabase) {
    const activeSession = session || await getCurrentSession().catch(() => null)
    if (!activeSession?.user) return null
    const displayName = activeSession.user.user_metadata?.display_name || activeSession.user.email?.split('@')[0] || 'Member'
    const joined = await joinRemoteGroup(pendingInvite, displayName)
    setActiveGroup(joined.id)
    clearPendingInvite(pendingInvite)
    return joined
  }
  const joined = joinLocalGroup(pendingInvite, 'Member')
  if (joined?.id) {
    setActiveGroup(joined.id)
    clearPendingInvite(pendingInvite)
  }
  return joined
}

export default function App() {
  syncPendingInviteFromUrl()
  syncCliqueScopeFromUrl()

  useEffect(() => {
    acceptPendingInvite().catch((error) => console.warn('Pending invite join failed:', error))
    if (!hasSupabase) return undefined
    return onAuthStateChanged((nextSession) => {
      if (nextSession?.user) acceptPendingInvite(nextSession).catch((error) => console.warn('Pending invite join failed:', error))
    })
  }, [])

  return (
    <Routes>
      <Route path="/" element={<Community />} />
      <Route path="/community" element={<Community />} />
      <Route path="/explore" element={<Leaderboard />} />
      <Route path="/leaderboard" element={<Leaderboard />} />
      <Route path="/dashboard" element={<Home scope="personal" />} />
      <Route path="/library" element={<Home scope="personal" />} />
      <Route path="/library/inbox" element={<SwipeInbox />} />
      <Route path="/library/swipe" element={<SwipeInbox />} />
      <Route path="/library/movies" element={<Movies />} />
      <Route path="/library/series" element={<Series />} />
      <Route path="/library/games" element={<Games />} />
      <Route path="/movies" element={<Movies />} />
      <Route path="/series" element={<Series />} />
      <Route path="/games" element={<Games />} />
      <Route path="/videos" element={<Videos />} />
      <Route path="/music" element={<Music />} />
      <Route path="/share/:type/:id" element={<Share />} />
      <Route path="/members/:memberId" element={<MemberLibrary />} />
      <Route path="/users/:memberId" element={<MemberLibrary />} />
      <Route path="/groups" element={<Groups />} />
      <Route path="/cliques" element={<Groups />} />
      <Route path="/g/:groupId" element={<CliqueDetail />} />
      <Route path="/cliques/:groupId" element={<CliqueDetail />} />
      <Route path="/g/:groupId/settings" element={<CliqueSettings />} />
      <Route path="/cliques/:groupId/settings" element={<CliqueSettings />} />
      <Route path="/invite/:code" element={<Groups inviteMode />} />
    </Routes>
  )
}
