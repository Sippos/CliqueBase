import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import AppIcon from './AppIcon.jsx'
import { getActiveGroupId } from '../lib/groups.js'
import { getCurrentSession, hasSupabase } from '../lib/supabaseClient.js'
import { getGroupManagementSummary } from '../lib/socialGovernance.js'

function groupIdFromLocation(location) {
  const params = new URLSearchParams(location.search)
  const scoped = params.get('clique') || params.get('group') || params.get('scope')
  if (scoped) return scoped
  const match = location.pathname.match(/^\/(?:g|cliques)\/([^/?#]+)/)
  return match?.[1] || ''
}

function roleLabel(role) {
  if (!role) return 'Member'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function isCliqueSurface(active) {
  return active === 'cliques' || active === 'groups'
}

export default function CliqueGovernanceBar({ active = '' }) {
  const location = useLocation()
  const groupId = useMemo(() => groupIdFromLocation(location) || getActiveGroupId(), [location.pathname, location.search])
  const [summary, setSummary] = useState(null)
  const [signedIn, setSignedIn] = useState(false)
  const [loading, setLoading] = useState(false)
  const onCliqueSurface = isCliqueSurface(active)

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!groupId || !onCliqueSurface || !hasSupabase) {
        setSummary(null)
        setSignedIn(false)
        return
      }
      setLoading(true)
      try {
        const session = await getCurrentSession().catch(() => null)
        if (cancelled) return
        setSignedIn(Boolean(session?.user))
        if (!session?.user) {
          setSummary(null)
          return
        }
        const nextSummary = await getGroupManagementSummary(groupId)
        if (!cancelled) setSummary(nextSummary)
      } catch {
        if (!cancelled) setSummary(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [onCliqueSurface, groupId])

  if (!groupId || !onCliqueSurface) return null

  const permissions = summary?.permissions || {}
  const members = summary?.members || []
  const role = permissions.role || (signedIn ? 'member' : '')
  const canManage = Boolean(permissions.canManageMembers || permissions.canUpdateSettings)

  return (
    <section className="clique-governance-bar mb-5 rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-3 text-white shadow-xl shadow-black/10">
      <div className="hidden flex-col gap-3 sm:flex sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-neutral-200"><AppIcon name="settings" size={16} /></span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-neutral-500">Members & permissions</p>
            <h2 className="truncate text-base font-black text-white">
              {signedIn ? `${roleLabel(role)} access` : 'Sign in to manage this clique'}
              {members.length ? <span className="ml-2 text-sm font-semibold text-neutral-500">· {members.length} members</span> : null}
              {loading ? <span className="ml-2 text-sm font-semibold text-neutral-500">· syncing</span> : null}
            </h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {role ? <span className="rounded-full border border-white/10 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-neutral-300">{roleLabel(role)}</span> : null}
          {canManage ? <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-2 text-xs font-black text-emerald-100">Admin tools enabled</span> : null}
          <Link to={`/cliques/${encodeURIComponent(groupId)}/settings`} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-neutral-950 transition hover:bg-neutral-200"><AppIcon name="users" size={15} />Manage</Link>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 sm:hidden">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-500">Permissions</p>
          <p className="truncate text-xs font-bold text-neutral-300">{signedIn ? roleLabel(role) : 'Sign in'}{members.length ? ` · ${members.length} members` : ''}{loading ? ' · syncing' : ''}</p>
        </div>
        <Link to={`/cliques/${encodeURIComponent(groupId)}/settings`} aria-label="Clique settings" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white transition hover:bg-white hover:text-neutral-950"><AppIcon name="settings" size={15} /></Link>
      </div>
    </section>
  )
}
