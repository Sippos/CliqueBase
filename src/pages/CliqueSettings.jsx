import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AppIcon from '../components/AppIcon.jsx'
import PageShell from '../components/PageShell.jsx'
import { StatusMessage } from '../components/MediaBlocks.jsx'
import ModerationInbox from '../components/ModerationInbox.jsx'
import { getCurrentSession, getRemoteGroups, hasSupabase } from '../lib/supabaseClient.js'
import {
  deleteGroup,
  getGroupManagementSummary,
  leaveGroup,
  removeGroupMember,
  transferGroupOwnership,
  updateGroupMemberRole,
  updateGroupSettings,
} from '../lib/socialGovernance.js'

const roleOptions = ['admin', 'moderator', 'member']
const roleRank = { owner: 100, admin: 80, moderator: 60, member: 10 }

function roleLabel(role = 'member') {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

function roleDescription(role = 'member') {
  if (role === 'owner') return 'Full control, delete clique, transfer ownership.'
  if (role === 'admin') return 'Can edit settings and manage members below admin.'
  if (role === 'moderator') return 'Can moderate content and keep the clique clean.'
  return 'Can view, add, vote, and share content.'
}

function roleBadgeClass(role) {
  if (role === 'owner') return 'border-yellow-300/30 bg-yellow-300/10 text-yellow-100'
  if (role === 'admin') return 'border-emerald-300/30 bg-emerald-300/10 text-emerald-100'
  if (role === 'moderator') return 'border-sky-300/30 bg-sky-300/10 text-sky-100'
  return 'border-white/10 bg-white/[0.045] text-neutral-200'
}

function canEditTarget(permissions, target) {
  if (!permissions?.canManageMembers) return false
  if (!target || target.role === 'owner') return false
  if (permissions.userId === target.userId) return false
  return (roleRank[permissions.role] || 0) > (roleRank[target.role] || 0)
}

function MemberCard({ member, permissions, busyKey, onRole, onRemove, onTransfer }) {
  const editable = canEditTarget(permissions, member)
  const canTransfer = permissions?.canTransferOwnership && member.role !== 'owner' && permissions.userId !== member.userId
  const busy = busyKey === member.userId
  return (
    <article className="rounded-[1.5rem] border border-white/10 bg-neutral-900/70 p-4 text-white">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg font-black">{member.displayName}</h3>
            <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${roleBadgeClass(member.role)}`}>{roleLabel(member.role)}</span>
            {permissions?.userId === member.userId ? <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">You</span> : null}
          </div>
          <p className="mt-2 text-sm leading-6 text-neutral-400">{roleDescription(member.role)}</p>
          {member.joinedAt ? <p className="mt-2 text-xs text-neutral-500">Joined {new Date(member.joinedAt).toLocaleDateString()}</p> : null}
        </div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap lg:justify-end">
          {editable ? (
            <select value={member.role} disabled={busy} onChange={(event) => onRole(member, event.target.value)} className="rounded-2xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm font-bold text-white outline-none disabled:opacity-50">
              {roleOptions.map((role) => {
                const allowed = permissions.role === 'owner' || role !== 'admin'
                return <option key={role} value={role} disabled={!allowed}>{roleLabel(role)}</option>
              })}
            </select>
          ) : null}
          {canTransfer ? <button type="button" disabled={busy} onClick={() => onTransfer(member)} className="rounded-2xl border border-yellow-300/30 px-3 py-2 text-sm font-bold text-yellow-100 transition hover:bg-yellow-300 hover:text-neutral-950 disabled:opacity-50">Make owner</button> : null}
          {editable ? <button type="button" disabled={busy} onClick={() => onRemove(member)} className="rounded-2xl border border-red-300/30 px-3 py-2 text-sm font-bold text-red-100 transition hover:bg-red-500 hover:text-white disabled:opacity-50">Remove</button> : null}
        </div>
      </div>
    </article>
  )
}

export default function CliqueSettings() {
  const { groupId = '' } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [group, setGroup] = useState(null)
  const [summary, setSummary] = useState({ permissions: {}, members: [] })
  const [nameDraft, setNameDraft] = useState('')
  const [publicDraft, setPublicDraft] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState('')
  const [message, setMessage] = useState(null)

  const permissions = summary.permissions || {}
  const members = summary.members || []
  const owners = members.filter((member) => member.role === 'owner').length
  const admins = members.filter((member) => member.role === 'admin').length
  const moderators = members.filter((member) => member.role === 'moderator').length
  const regularMembers = members.filter((member) => member.role === 'member').length

  const orderedMembers = useMemo(() => members.slice().sort((a, b) => (roleRank[b.role] || 0) - (roleRank[a.role] || 0) || String(a.displayName).localeCompare(String(b.displayName))), [members])

  function showMessage(text, type = 'success') {
    setMessage({ text, type })
    window.setTimeout(() => setMessage(null), 2800)
  }

  async function refresh() {
    setLoading(true)
    try {
      if (!hasSupabase) throw new Error('Clique roles need Supabase enabled.')
      const nextSession = await getCurrentSession().catch(() => null)
      setSession(nextSession)
      if (!nextSession?.user) throw new Error('Sign in to manage clique roles.')
      const [groups, nextSummary] = await Promise.all([
        getRemoteGroups().catch(() => []),
        getGroupManagementSummary(groupId),
      ])
      const currentGroup = groups.find((item) => item.id === groupId) || null
      setGroup(currentGroup)
      setSummary(nextSummary)
      setNameDraft(currentGroup?.name || '')
      setPublicDraft(Boolean(currentGroup?.isPublic))
    } catch (error) {
      showMessage(error.message || 'Could not load clique settings.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [groupId])

  async function saveSettings(event) {
    event.preventDefault()
    setBusyKey('settings')
    try {
      await updateGroupSettings(groupId, { name: nameDraft, isPublic: publicDraft })
      showMessage('Clique settings updated.')
      await refresh()
    } catch (error) {
      showMessage(error.message || 'Could not update settings.', 'error')
    } finally {
      setBusyKey('')
    }
  }

  async function changeRole(member, role) {
    setBusyKey(member.userId)
    try {
      await updateGroupMemberRole(groupId, member.userId, role)
      showMessage(`${member.displayName} is now ${roleLabel(role)}.`)
      await refresh()
    } catch (error) {
      showMessage(error.message || 'Could not change role.', 'error')
    } finally {
      setBusyKey('')
    }
  }

  async function removeMember(member) {
    setBusyKey(member.userId)
    try {
      await removeGroupMember(groupId, member.userId)
      showMessage(`${member.displayName} removed from this clique.`)
      await refresh()
    } catch (error) {
      showMessage(error.message || 'Could not remove member.', 'error')
    } finally {
      setBusyKey('')
    }
  }

  async function transferOwner(member) {
    setBusyKey(member.userId)
    try {
      await transferGroupOwnership(groupId, member.userId)
      showMessage(`${member.displayName} is now the owner.`)
      await refresh()
    } catch (error) {
      showMessage(error.message || 'Could not transfer ownership.', 'error')
    } finally {
      setBusyKey('')
    }
  }

  async function leaveClique() {
    setBusyKey('leave')
    try {
      await leaveGroup(groupId)
      showMessage('You left this clique.')
      navigate('/groups')
    } catch (error) {
      showMessage(error.message || 'Could not leave clique.', 'error')
    } finally {
      setBusyKey('')
    }
  }

  async function deleteClique() {
    setBusyKey('delete')
    try {
      await deleteGroup(groupId)
      showMessage('Clique deleted.')
      navigate('/groups')
    } catch (error) {
      showMessage(error.message || 'Could not delete clique.', 'error')
    } finally {
      setBusyKey('')
    }
  }

  return (
    <PageShell active="cliques">
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 text-white shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-neutral-500">Clique admin</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight">Members & permissions</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">Manage who can change settings, moderate content, invite people, or own this clique. Permissions are enforced by Supabase, not only hidden in the UI.</p>
          </div>
          <Link to={`/cliques/${encodeURIComponent(groupId)}`} className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white hover:text-neutral-950"><AppIcon name="chevronLeft" size={16} />Back to clique</Link>
        </div>
      </section>

      <StatusMessage message={message} />

      <section className="mt-5 grid gap-3 sm:grid-cols-4">
        {[["Owners", owners], ["Admins", admins], ["Moderators", moderators], ["Members", regularMembers]].map(([label, value]) => <div key={label} className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-4 text-white"><div className="text-3xl font-black">{value}</div><div className="mt-1 text-xs font-black uppercase tracking-[0.2em] text-neutral-500">{label}</div></div>)}
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[0.88fr_1.12fr]">
        <div className="space-y-5">
          <form onSubmit={saveSettings} className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 text-white">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-neutral-500">Settings</p>
            <h2 className="mt-1 text-2xl font-black">Clique details</h2>
            <label className="mt-5 block text-sm font-bold text-neutral-300">Name</label>
            <input value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} disabled={!permissions.canUpdateSettings} className="mt-2 w-full rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none disabled:opacity-50" />
            <label className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-neutral-950 p-4">
              <span><span className="block text-sm font-black text-white">Public discovery</span><span className="mt-1 block text-xs leading-5 text-neutral-500">Show this clique in Explore and allow public join where supported.</span></span>
              <input type="checkbox" checked={publicDraft} disabled={!permissions.canUpdateSettings} onChange={(event) => setPublicDraft(event.target.checked)} className="h-5 w-5" />
            </label>
            <button disabled={!permissions.canUpdateSettings || busyKey === 'settings'} className="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-50">{busyKey === 'settings' ? 'Saving...' : 'Save settings'}</button>
          </form>

          <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 text-white">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-neutral-500">Your access</p>
            <h2 className="mt-1 text-2xl font-black">{roleLabel(permissions.role || 'member')}</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-400">{roleDescription(permissions.role || 'member')}</p>
            <div className="mt-4 grid gap-2 text-sm text-neutral-300">
              <span>{permissions.canUpdateSettings ? '✓' : '–'} Update settings</span>
              <span>{permissions.canManageMembers ? '✓' : '–'} Manage members</span>
              <span>{permissions.canModerateContent ? '✓' : '–'} Moderate content</span>
              <span>{permissions.canDeleteGroup ? '✓' : '–'} Delete clique</span>
            </div>
          </section>

          <ModerationInbox groupId={groupId} canModerate={Boolean(permissions.canModerateContent)} onMessage={showMessage} />

          <section className="rounded-[2rem] border border-red-300/20 bg-red-500/5 p-5 text-white">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-red-200/70">Danger zone</p>
            <div className="mt-4 grid gap-2">
              <button type="button" disabled={busyKey === 'leave' || permissions.role === 'owner'} onClick={leaveClique} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white hover:text-neutral-950 disabled:opacity-50">Leave clique</button>
              <button type="button" disabled={!permissions.canDeleteGroup || busyKey === 'delete'} onClick={deleteClique} className="rounded-2xl border border-red-300/30 px-4 py-3 text-sm font-black text-red-100 transition hover:bg-red-500 hover:text-white disabled:opacity-50">Delete clique</button>
            </div>
          </section>
        </div>

        <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 text-white">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-xs font-black uppercase tracking-[0.28em] text-neutral-500">Members</p><h2 className="mt-1 text-2xl font-black">Role ladder</h2></div>
            <span className="w-fit rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-neutral-300">{members.length} total</span>
          </div>
          {loading ? <div className="mt-5 h-64 animate-pulse rounded-[1.5rem] bg-white/[0.06]" /> : orderedMembers.length ? <div className="mt-5 grid gap-3">{orderedMembers.map((member) => <MemberCard key={member.userId} member={member} permissions={permissions} busyKey={busyKey} onRole={changeRole} onRemove={removeMember} onTransfer={transferOwner} />)}</div> : <p className="mt-5 rounded-3xl border border-dashed border-white/10 p-6 text-sm leading-6 text-neutral-400">No members loaded. Make sure the social governance migration has run and you are signed in.</p>}
        </section>
      </section>
    </PageShell>
  )
}
