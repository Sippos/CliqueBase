import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PageShell from '../components/PageShell.jsx'
import { PageHero, StatusMessage } from '../components/MediaBlocks.jsx'
import { getSavedHandle, saveSharedHandle } from '../lib/handle.js'
import { createGroup, getActiveGroup, getGroupInvitePath, getGroupInviteUrl, getGroupOpenPath, getGroups, joinGroup, setActiveGroup } from '../lib/groups.js'

function copyToClipboard(value) {
  if (!value) return Promise.resolve(false)
  if (navigator?.clipboard?.writeText) {
    return navigator.clipboard.writeText(value).then(() => true).catch(() => false)
  }
  return Promise.resolve(false)
}

function GroupCard({ group, active, onActivate, onCopy }) {
  return (
    <article className={`rounded-[2rem] border p-4 ${active ? 'border-white bg-white text-neutral-950' : 'border-white/10 bg-white/[0.03] text-white'}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className={`text-xs uppercase tracking-[0.3em] ${active ? 'text-neutral-500' : 'text-neutral-500'}`}>Invite group</p>
          <h2 className="mt-2 text-2xl font-black">{group.name}</h2>
          <p className={`mt-2 text-sm ${active ? 'text-neutral-600' : 'text-neutral-400'}`}>{group.members.length || 1} members · code {group.inviteCode}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onActivate(group)} className={`rounded-2xl px-4 py-2 text-sm font-semibold ${active ? 'bg-neutral-950 text-white' : 'bg-white text-neutral-950'}`}>
            {active ? 'Active' : 'Use group'}
          </button>
          <button type="button" onClick={() => onCopy(group)} className={`rounded-2xl px-4 py-2 text-sm font-semibold ${active ? 'border border-neutral-300 text-neutral-950' : 'border border-white/10 text-white'}`}>
            Copy invite
          </button>
          <Link to={getGroupOpenPath(group)} className={`rounded-2xl px-4 py-2 text-sm font-semibold ${active ? 'border border-neutral-300 text-neutral-950' : 'border border-white/10 text-white'}`}>
            Open
          </Link>
        </div>
      </div>
      <div className={`mt-4 rounded-2xl p-3 text-sm ${active ? 'bg-neutral-100 text-neutral-700' : 'bg-neutral-900 text-neutral-300'}`}>
        {group.members.length ? group.members.join(' · ') : 'No members yet'}
      </div>
    </article>
  )
}

export default function Groups({ inviteMode = false }) {
  const { code, groupId } = useParams()
  const [groups, setGroups] = useState([])
  const [activeGroup, setActiveGroupState] = useState(null)
  const [handle, setHandle] = useState('')
  const [draftHandle, setDraftHandle] = useState('')
  const [draftGroup, setDraftGroup] = useState('')
  const [message, setMessage] = useState(null)

  useEffect(() => {
    const savedHandle = getSavedHandle()
    setHandle(savedHandle)
    setDraftHandle(savedHandle)
    setGroups(getGroups())
    setActiveGroupState(getActiveGroup())
  }, [])

  useEffect(() => {
    if (!groupId) return
    const group = setActiveGroup(groupId)
    setGroups(getGroups())
    setActiveGroupState(group)
  }, [groupId])

  const inviteGroup = useMemo(() => {
    if (!code) return null
    return groups.find((group) => group.inviteCode === code || group.id === code) || null
  }, [code, groups])

  function showMessage(text, tone = 'ok') {
    setMessage({ text, tone })
    setTimeout(() => setMessage(null), 2200)
  }

  function saveHandle(event) {
    event.preventDefault()
    const saved = saveSharedHandle(draftHandle)
    if (!saved) {
      showMessage('Add a profile name first.', 'warn')
      return
    }
    setHandle(saved)
    showMessage(`Continuing as ${saved}.`)
  }

  function handleCreate(event) {
    event.preventDefault()
    const activeHandle = handle || saveSharedHandle(draftHandle) || 'anonymous'
    const created = createGroup(draftGroup || `${activeHandle}'s clique`, activeHandle)
    setGroups(getGroups())
    setActiveGroupState(created)
    setDraftGroup('')
    setHandle(activeHandle)
    showMessage(`${created.name} is ready to share.`)
  }

  function handleJoin(event) {
    event.preventDefault()
    const activeHandle = handle || saveSharedHandle(draftHandle) || 'anonymous'
    const joined = joinGroup(code, activeHandle)
    setGroups(getGroups())
    setActiveGroupState(joined)
    setHandle(activeHandle)
    showMessage(`Joined ${joined.name}.`)
  }

  function activate(group) {
    const next = setActiveGroup(group.id)
    setActiveGroupState(next)
    showMessage(`${group.name} is now active.`)
  }

  async function copyInvite(group) {
    const copied = await copyToClipboard(getGroupInviteUrl(group))
    showMessage(copied ? 'Invite link copied.' : `Invite path: ${getGroupInvitePath(group)}`)
  }

  const title = inviteMode ? 'Join a clique' : groupId && activeGroup ? activeGroup.name : 'Create private cliques'
  const copy = inviteMode
    ? 'Open the invite, choose a profile name, and the group becomes your active voting space.'
    : 'Create a group, copy an invite link, and send CliqueBase to friends without mixing every vote into one global pile.'

  return (
    <PageShell active="groups">
      <PageHero eyebrow="Groups & invites" title={title} copy={copy}>
        <div className="grid gap-3 sm:grid-cols-2">
          <form onSubmit={saveHandle} className="rounded-3xl border border-white/10 bg-neutral-950/80 p-3">
            <label className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">Your name</label>
            <div className="mt-2 flex gap-2">
              <input value={draftHandle} onChange={(event) => setDraftHandle(event.target.value)} placeholder="example: Sip" className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
              <button className="rounded-2xl bg-white px-4 py-3 font-semibold text-neutral-950">Save</button>
            </div>
          </form>

          {inviteMode ? (
            <form onSubmit={handleJoin} className="rounded-3xl border border-white/10 bg-neutral-950/80 p-3">
              <label className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">Invite code</label>
              <div className="mt-2 flex gap-2">
                <input value={code || ''} readOnly className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
                <button className="rounded-2xl bg-white px-4 py-3 font-semibold text-neutral-950">Join</button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleCreate} className="rounded-3xl border border-white/10 bg-neutral-950/80 p-3">
              <label className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">Group name</label>
              <div className="mt-2 flex gap-2">
                <input value={draftGroup} onChange={(event) => setDraftGroup(event.target.value)} placeholder="Friday movie crew" className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
                <button className="rounded-2xl bg-white px-4 py-3 font-semibold text-neutral-950">Create</button>
              </div>
            </form>
          )}
        </div>
      </PageHero>

      <StatusMessage message={message} />

      {inviteMode && inviteGroup ? (
        <section className="mb-5 rounded-[2rem] border border-emerald-500/30 bg-emerald-500/10 p-5 text-emerald-100">
          Invite found for <strong>{inviteGroup.name}</strong>. Save your name, then join.
        </section>
      ) : null}

      {activeGroup ? (
        <section className="mb-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Active group</p>
              <h2 className="mt-1 text-3xl font-black text-white">{activeGroup.name}</h2>
              <p className="mt-2 text-sm text-neutral-400">New votes and music links can use this as the current clique context.</p>
            </div>
            <button type="button" onClick={() => copyInvite(activeGroup)} className="rounded-2xl bg-white px-5 py-3 font-semibold text-neutral-950">Copy active invite</button>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        {groups.length ? groups.map((group) => (
          <GroupCard key={group.id} group={group} active={activeGroup?.id === group.id} onActivate={activate} onCopy={copyInvite} />
        )) : (
          <div className="rounded-[2rem] border border-dashed border-white/15 bg-white/[0.03] p-8 text-center text-neutral-400">
            Create your first group and share the invite link with friends.
          </div>
        )}
      </section>
    </PageShell>
  )
}
