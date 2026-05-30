import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import PageShell from '../components/PageShell.jsx'
import { PageHero, StatusMessage } from '../components/MediaBlocks.jsx'
import { getSavedHandle, saveSharedHandle } from '../lib/handle.js'
import { createGroup as createLocalGroup, getActiveGroup, getGroupInvitePath, getGroupInviteUrl, getGroupOpenPath, getGroups, joinGroup as joinLocalGroup, parseInviteCode, setActiveGroup } from '../lib/groups.js'
import { createRemoteGroup, getCurrentSession, getProfile, getRemoteGroups, hasSupabase, joinRemoteGroup, saveProfile } from '../lib/supabaseClient.js'

function copyToClipboard(value) {
  if (!value) return Promise.resolve(false)
  if (navigator?.clipboard?.writeText) {
    return navigator.clipboard.writeText(value).then(() => true).catch(() => false)
  }
  return Promise.resolve(false)
}

function getProfileName(session, profile, fallback = '') {
  return profile?.display_name || fallback || session?.user?.user_metadata?.display_name || session?.user?.email?.split('@')[0] || ''
}

function GroupCard({ group, active, onActivate, onCopy }) {
  return (
    <article className={`rounded-[2rem] border p-4 ${active ? 'border-white bg-white text-neutral-950' : 'border-white/10 bg-white/[0.03] text-white'}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className={`text-xs uppercase tracking-[0.3em] ${active ? 'text-neutral-500' : 'text-neutral-500'}`}>{group.isPublic ? 'Public group' : 'Private group'}</p>
          <h2 className="mt-2 text-2xl font-black">{group.name}</h2>
          <p className={`mt-2 text-sm ${active ? 'text-neutral-600' : 'text-neutral-400'}`}>{group.members?.length || 1} members</p>
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
        {group.members?.length ? group.members.join(' · ') : 'Members appear here after people join.'}
      </div>
    </article>
  )
}

export default function Groups({ inviteMode = false }) {
  const { code, groupId } = useParams()
  const inviteCode = parseInviteCode(code || '')
  const [groups, setGroups] = useState([])
  const [activeGroup, setActiveGroupState] = useState(null)
  const [session, setSession] = useState(null)
  const [handle, setHandle] = useState('')
  const [draftHandle, setDraftHandle] = useState('')
  const [draftGroup, setDraftGroup] = useState('')
  const [manualInvite, setManualInvite] = useState('')
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    if (!groupId) return
    const group = setActiveGroup(groupId)
    refresh(group)
  }, [groupId])

  async function refresh(nextActive = null) {
    const savedHandle = getSavedHandle()
    setHandle(savedHandle)
    setDraftHandle((current) => current || savedHandle)

    if (hasSupabase) {
      try {
        const nextSession = await getCurrentSession()
        setSession(nextSession)

        if (nextSession?.user) {
          const profile = await getProfile().catch(() => null)
          const displayName = getProfileName(nextSession, profile, savedHandle)
          if (displayName) {
            saveSharedHandle(displayName)
            setHandle(displayName)
            setDraftHandle(displayName)
          }
          const remoteGroups = await getRemoteGroups().catch(() => [])
          setGroups(remoteGroups)
          const active = nextActive || getActiveGroup() || remoteGroups.find((group) => group.id === groupId) || null
          setActiveGroupState(active)
          return
        }

        setGroups([])
        setActiveGroupState(null)
        return
      } catch (error) {
        showMessage(error.message || 'Could not load groups.', 'error')
      }
    }

    setGroups(getGroups())
    setActiveGroupState(nextActive || getActiveGroup())
  }

  const inviteGroup = useMemo(() => {
    if (!inviteCode) return null
    return groups.find((group) => group.inviteCode === inviteCode || group.id === inviteCode) || null
  }, [inviteCode, groups])

  function showMessage(text, type = 'success') {
    setMessage({ text, type })
    setTimeout(() => setMessage(null), 2600)
  }

  async function saveHandle(event) {
    event?.preventDefault?.()
    const saved = saveSharedHandle(draftHandle)
    if (!saved) {
      showMessage('Add a profile name first.', 'error')
      return ''
    }
    try {
      if (session?.user && hasSupabase) await saveProfile(saved)
      setHandle(saved)
      setDraftHandle(saved)
      showMessage(`Continuing as ${saved}.`)
      return saved
    } catch (error) {
      showMessage(error.message || 'Could not save profile name.', 'error')
      return saved
    }
  }

  async function handleCreate(event) {
    event.preventDefault()
    const activeHandle = handle || await saveHandle() || 'anonymous'
    setLoading(true)
    try {
      const created = session?.user && hasSupabase
        ? await createRemoteGroup(draftGroup || `${activeHandle}'s group`, activeHandle)
        : createLocalGroup(draftGroup || `${activeHandle}'s group`, activeHandle)
      setActiveGroup(created.id)
      setActiveGroupState(created)
      setDraftGroup('')
      await refresh(created)
      showMessage(`${created.name} is ready to share.`)
    } catch (error) {
      showMessage(error.message || 'Could not create group.', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function joinInvite(codeToJoin = inviteCode || manualInvite) {
    const parsed = parseInviteCode(codeToJoin)
    if (!parsed) {
      showMessage('Paste an invite link or code first.', 'error')
      return
    }
    const activeHandle = handle || await saveHandle() || 'anonymous'

    if (hasSupabase && !session?.user) {
      showMessage('Sign in from Profile first, then use this invite link again.', 'error')
      return
    }

    setLoading(true)
    try {
      const joined = session?.user && hasSupabase
        ? await joinRemoteGroup(parsed, activeHandle)
        : joinLocalGroup(parsed, activeHandle)

      if (!joined) throw new Error('Could not join that invite.')
      setActiveGroup(joined.id)
      setActiveGroupState(joined)
      setManualInvite('')
      await refresh(joined)
      showMessage(`Joined ${joined.name}.`)
    } catch (error) {
      showMessage(error.message || 'Could not join that invite.', 'error')
    } finally {
      setLoading(false)
    }
  }

  function activate(group) {
    const next = setActiveGroup(group.id)
    setActiveGroupState(next || group)
    showMessage(`${group.name} is now active.`)
  }

  async function copyInvite(group) {
    const copied = await copyToClipboard(getGroupInviteUrl(group))
    showMessage(copied ? 'Invite link copied.' : `Invite path: ${getGroupInvitePath(group)}`)
  }

  const title = inviteMode ? 'Join a group' : groupId && activeGroup ? activeGroup.name : 'Groups and invites'
  const copy = inviteMode
    ? 'Open an invite link, sign in if needed, and join the shared voting space.'
    : 'Create a group, paste an invite code, or switch between your shared voting spaces.'

  return (
    <PageShell active="groups">
      <PageHero eyebrow="Groups" title={title} description={copy}>
        <div className="grid gap-3 sm:grid-cols-2">
          <form onSubmit={saveHandle} className="rounded-3xl border border-white/10 bg-neutral-950/80 p-3">
            <label className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">Display name</label>
            <div className="mt-2 flex gap-2">
              <input value={draftHandle} onChange={(event) => setDraftHandle(event.target.value)} placeholder="example: Sip" className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
              <button className="rounded-2xl bg-white px-4 py-3 font-semibold text-neutral-950">Save</button>
            </div>
          </form>

          {inviteMode ? (
            <div className="rounded-3xl border border-white/10 bg-neutral-950/80 p-3">
              <label className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">Invite</label>
              <div className="mt-2 flex gap-2">
                <input value={inviteCode || ''} readOnly className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
                <button type="button" disabled={loading} onClick={() => joinInvite(inviteCode)} className="rounded-2xl bg-white px-4 py-3 font-semibold text-neutral-950 disabled:opacity-60">Join</button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="rounded-3xl border border-white/10 bg-neutral-950/80 p-3">
              <label className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">Create group</label>
              <div className="mt-2 flex gap-2">
                <input value={draftGroup} onChange={(event) => setDraftGroup(event.target.value)} placeholder="Friday movie crew" className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
                <button disabled={loading} className="rounded-2xl bg-white px-4 py-3 font-semibold text-neutral-950 disabled:opacity-60">Create</button>
              </div>
            </form>
          )}
        </div>

        {!inviteMode ? (
          <div className="mt-3 rounded-3xl border border-white/10 bg-neutral-950/80 p-3">
            <label className="text-xs font-semibold uppercase tracking-[0.25em] text-neutral-500">Paste invite link or code</label>
            <div className="mt-2 flex gap-2">
              <input value={manualInvite} onChange={(event) => setManualInvite(event.target.value)} placeholder="Paste invite link or code" className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none" />
              <button type="button" disabled={loading} onClick={() => joinInvite(manualInvite)} className="rounded-2xl border border-white/10 px-4 py-3 font-semibold text-white hover:bg-white hover:text-neutral-950 disabled:opacity-60">Join</button>
            </div>
          </div>
        ) : null}
      </PageHero>

      <StatusMessage message={message} />

      {inviteMode ? (
        <section className="mb-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 text-neutral-300">
          {hasSupabase && !session?.user ? (
            <>This invite is ready. Sign in from <strong className="text-white">Profile</strong>, then come back to this link and press Join.</>
          ) : inviteGroup ? (
            <>Invite found for <strong className="text-white">{inviteGroup.name}</strong>. Press Join to activate it.</>
          ) : (
            <>Press Join to accept this invite. The group will become your active context.</>
          )}
        </section>
      ) : null}

      {activeGroup ? (
        <section className="mb-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Active group</p>
              <h2 className="mt-1 text-3xl font-black text-white">{activeGroup.name}</h2>
              <p className="mt-2 text-sm text-neutral-400">Shared votes and saved content use this group when selected.</p>
            </div>
            <button type="button" onClick={() => copyInvite(activeGroup)} className="rounded-2xl bg-white px-5 py-3 font-semibold text-neutral-950">Copy invite link</button>
          </div>
        </section>
      ) : null}

      <section className="space-y-3">
        {groups.length ? groups.map((group) => (
          <GroupCard key={group.id} group={group} active={activeGroup?.id === group.id} onActivate={activate} onCopy={copyInvite} />
        )) : (
          <div className="rounded-[2rem] border border-dashed border-white/15 bg-white/[0.03] p-8 text-center text-neutral-400">
            Create your first group or join a friend’s invite link.
          </div>
        )}
      </section>
    </PageShell>
  )
}
