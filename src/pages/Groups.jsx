import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AppIcon from '../components/AppIcon.jsx'
import PageShell from '../components/PageShell.jsx'
import { StatusMessage } from '../components/MediaBlocks.jsx'
import { getSavedHandle, saveSharedHandle } from '../lib/handle.js'
import { createGroup as createLocalGroup, getActiveGroup, getActiveGroupId, getGroupInvitePath, getGroupInviteUrl, getGroupOpenPath, getGroups, joinGroup as joinLocalGroup, parseInviteCode, setActiveGroup } from '../lib/groups.js'
import { createRemoteGroup, getCurrentSession, getGames, getMovies, getProfile, getRemoteGroups, getSeries, hasSupabase, joinRemoteGroup } from '../lib/supabaseClient.js'

const mediaShortcuts = [
  { to: '/movies', label: 'Movies', icon: 'movies' },
  { to: '/series', label: 'Series', icon: 'series' },
  { to: '/games', label: 'Games', icon: 'games' },
  { to: '/videos', label: 'Videos', icon: 'videos' },
  { to: '/music', label: 'Music', icon: 'music' },
]

function copyToClipboard(value) {
  if (!value) return Promise.resolve(false)
  if (navigator?.clipboard?.writeText) {
    return navigator.clipboard.writeText(value).then(() => true).catch(() => false)
  }
  return Promise.resolve(false)
}

function getProfileName(session, profile, fallback = '') {
  return profile?.display_name || fallback || session?.user?.user_metadata?.display_name || ''
}

function toCliqueItem(item, category, icon, doneKey, doneLabel) {
  return {
    ...item,
    category,
    icon,
    done: Boolean(item?.[doneKey]),
    doneLabel,
    rating: item?.rating ?? null,
    score: Number(item?.score || 0),
    picks: Number(item?.picks || 0),
  }
}

function sortCliqueItems(items) {
  return items.slice().sort((a, b) => (
    (b.rating || 0) - (a.rating || 0)
    || (b.score || 0) - (a.score || 0)
    || (b.picks || 0) - (a.picks || 0)
    || String(a.title || '').localeCompare(String(b.title || ''))
  ))
}

function GroupCard({ group, active, onActivate, onCopy }) {
  return (
    <article className={`rounded-[1.6rem] border p-4 transition ${active ? 'border-white bg-white text-neutral-950 shadow-2xl shadow-white/10' : 'border-white/10 bg-white/[0.03] text-white hover:border-white/20 hover:bg-white/[0.045]'}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className={`text-[10px] font-black uppercase tracking-[0.26em] ${active ? 'text-neutral-500' : 'text-neutral-500'}`}>{group.isPublic ? 'Public clique' : 'Private clique'}</p>
          <h2 className="mt-1 truncate text-2xl font-black">{group.name}</h2>
          <p className={`mt-1 text-sm ${active ? 'text-neutral-600' : 'text-neutral-400'}`}>{group.members?.length || 1} members</p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onActivate(group)}
            className={`inline-flex h-11 items-center gap-2 rounded-2xl px-4 text-sm font-black transition ${active ? 'bg-neutral-950 text-white' : 'bg-white text-neutral-950 hover:bg-neutral-200'}`}
          >
            <AppIcon name="users" size={16} />
            {active ? 'Active' : 'Use'}
          </button>
          <button
            type="button"
            onClick={() => onCopy(group)}
            aria-label={`Copy invite for ${group.name}`}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition ${active ? 'border-neutral-300 text-neutral-950 hover:bg-neutral-100' : 'border-white/10 text-white hover:bg-white hover:text-neutral-950'}`}
          >
            <AppIcon name="link" size={17} />
          </button>
          <Link
            to={getGroupOpenPath(group)}
            aria-label={`Open ${group.name}`}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl border transition ${active ? 'border-neutral-300 text-neutral-950 hover:bg-neutral-100' : 'border-white/10 text-white hover:bg-white hover:text-neutral-950'}`}
          >
            <AppIcon name="explore" size={17} />
          </Link>
        </div>
      </div>

      <div className={`mt-4 flex flex-wrap gap-2 rounded-2xl p-3 text-sm ${active ? 'bg-neutral-100 text-neutral-700' : 'bg-neutral-900 text-neutral-300'}`}>
        {group.members?.length ? group.members.map((member) => (
          <span key={member} className={`rounded-full px-3 py-1 text-xs font-semibold ${active ? 'bg-white text-neutral-700' : 'bg-white/[0.06] text-neutral-300'}`}>{member}</span>
        )) : <span>Members appear here after people join.</span>}
      </div>
    </article>
  )
}

function CompactCreateForm({ draftGroup, setDraftGroup, loading, onCreate }) {
  return (
    <form onSubmit={onCreate} className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-white/10 bg-neutral-950/70 p-1.5">
      <span className="ml-3 hidden text-neutral-500 sm:inline-flex"><AppIcon name="users" size={18} /></span>
      <input value={draftGroup} onChange={(event) => setDraftGroup(event.target.value)} placeholder="New clique name" className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-500" />
      <button disabled={loading} aria-label="Create clique" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-lg font-black text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-60">+</button>
    </form>
  )
}

function CompactInviteForm({ value, setValue, loading, onJoin, readOnly = false }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-white/10 bg-neutral-950/70 p-1.5">
      <span className="ml-3 hidden text-neutral-500 sm:inline-flex"><AppIcon name="link" size={18} /></span>
      <input value={value} onChange={(event) => setValue?.(event.target.value)} readOnly={readOnly} placeholder="Invite link or code" className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-500" />
      <button type="button" disabled={loading} onClick={onJoin} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-white/10 px-4 text-sm font-black text-white transition hover:bg-white hover:text-neutral-950 disabled:opacity-60">
        Join
      </button>
    </div>
  )
}

function CliquePickTile({ item }) {
  return (
    <article className="group min-w-[10.5rem] overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/75 transition hover:border-white/25 hover:bg-neutral-900 sm:min-w-0">
      <div className="relative h-36 overflow-hidden bg-neutral-900">
        {item.poster ? (
          <img src={item.poster} alt="" className="h-full w-full object-cover opacity-90 transition group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-neutral-400">
            <AppIcon name={item.icon} size={34} strokeWidth={1.7} />
          </div>
        )}
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/70 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white backdrop-blur">
          <AppIcon name={item.icon} size={12} />
          {item.category}
        </span>
      </div>
      <div className="p-3">
        <h3 className="line-clamp-2 min-h-[2.25rem] text-sm font-black leading-tight text-white">{item.title}</h3>
        <p className="mt-1 truncate text-xs text-neutral-500">Added by {item.nominated_by || 'Someone'}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-bold text-neutral-300">Score {item.score || 0}</span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-bold text-neutral-300">{item.picks || 0} picks</span>
          {item.rating ? <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-bold text-neutral-300">Rating {Number(item.rating).toFixed(1)}</span> : null}
          {item.done ? <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-neutral-950">{item.doneLabel}</span> : null}
        </div>
      </div>
    </article>
  )
}

function CliqueOverview({ group, groupCount, items, itemsLoading, onCopy }) {
  const topItems = sortCliqueItems(items).slice(0, 8)
  const totalScore = items.reduce((sum, item) => sum + Number(item.score || 0), 0)
  const completedCount = items.filter((item) => item.done).length

  return (
    <section className="mb-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 shadow-2xl shadow-black/20 backdrop-blur sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-neutral-500">Clique overview</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h2 className="truncate text-3xl font-black text-white">{group?.name || 'No active clique'}</h2>
            {group ? (
              <Link to={getGroupOpenPath(group)} className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs font-black text-neutral-200 transition hover:bg-white hover:text-neutral-950">
                <AppIcon name="explore" size={14} />
                Open clique page
              </Link>
            ) : null}
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
            {group ? 'See what this clique has actually picked, voted for, and rated.' : 'Choose a clique below or create one to see its shared picks here.'}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:min-w-[20rem]">
          <div className="rounded-2xl border border-white/10 bg-neutral-950/70 p-3 text-center">
            <div className="text-2xl font-black text-white">{items.length}</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">Picks</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-neutral-950/70 p-3 text-center">
            <div className="text-2xl font-black text-white">{totalScore}</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">Score</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-neutral-950/70 p-3 text-center">
            <div className="text-2xl font-black text-white">{completedCount}</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">Done</div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {mediaShortcuts.map((shortcut) => (
            <Link key={shortcut.to} to={shortcut.to} className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-neutral-950/70 px-3 py-2 text-sm font-bold text-neutral-200 transition hover:bg-white hover:text-neutral-950">
              <AppIcon name={shortcut.icon} size={16} />
              {shortcut.label}
            </Link>
          ))}
        </div>

        {group ? (
          <div className="flex flex-wrap gap-2">
            <Link to={getGroupOpenPath(group)} className="inline-flex w-fit items-center gap-2 rounded-2xl border border-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white hover:text-neutral-950">
              <AppIcon name="explore" size={16} />
              Open
            </Link>
            <button type="button" onClick={() => onCopy(group)} className="inline-flex w-fit items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-black text-neutral-950 transition hover:bg-neutral-200">
              <AppIcon name="link" size={16} />
              Copy invite
            </button>
          </div>
        ) : <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-neutral-300">{groupCount} cliques total</span>}
      </div>

      <div className="mt-5 border-t border-white/10 pt-5">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.26em] text-neutral-500">Shared picks</p>
            <h3 className="mt-1 text-xl font-black text-white">What the clique voted for</h3>
          </div>
          {itemsLoading && !topItems.length ? <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-neutral-400">Loading…</span> : null}
        </div>

        {topItems.length ? (
          <div className="grid grid-flow-col auto-cols-[10.5rem] gap-3 overflow-x-auto pb-1 sm:grid-flow-row sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {topItems.map((item) => <CliquePickTile key={`${item.category}-${item.id}`} item={item} />)}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-white/10 bg-neutral-950/50 p-5 text-sm leading-6 text-neutral-400">
            {group ? 'No shared picks in this clique yet. Open Movies, Series, or Games above and add the first pick.' : 'Select a clique below to show its voted movies, series, and games.'}
          </div>
        )}
      </div>
    </section>
  )
}

export default function Groups({ inviteMode = false }) {
  const { code, groupId } = useParams()
  const inviteCode = parseInviteCode(code || '')
  const [groups, setGroups] = useState([])
  const [activeGroup, setActiveGroupState] = useState(null)
  const [session, setSession] = useState(null)
  const [handle, setHandle] = useState('')
  const [draftGroup, setDraftGroup] = useState('')
  const [manualInvite, setManualInvite] = useState('')
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [cliqueItems, setCliqueItems] = useState([])
  const [cliqueItemsLoading, setCliqueItemsLoading] = useState(false)
  const loadedItemsKeyRef = useRef('')

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    if (!groupId) return
    const group = setActiveGroup(groupId)
    loadedItemsKeyRef.current = ''
    refresh(group)
  }, [groupId])

  useEffect(() => {
    let cancelled = false
    const activeGroupId = activeGroup?.id || ''
    const sessionUserId = session?.user?.id || ''
    const cacheKey = `${sessionUserId}:${activeGroupId}`

    async function loadCliqueItems() {
      if (!activeGroupId || !hasSupabase || !sessionUserId) {
        setCliqueItems([])
        setCliqueItemsLoading(false)
        loadedItemsKeyRef.current = ''
        return
      }

      if (loadedItemsKeyRef.current === cacheKey) return
      loadedItemsKeyRef.current = cacheKey
      setCliqueItemsLoading(true)

      try {
        const [movies, series, games] = await Promise.all([
          getMovies(activeGroupId),
          getSeries(activeGroupId),
          getGames(activeGroupId),
        ])
        if (cancelled) return
        setCliqueItems(sortCliqueItems([
          ...movies.map((movie) => toCliqueItem(movie, 'Movie', 'movies', 'watched', 'Watched')),
          ...series.map((seriesItem) => toCliqueItem(seriesItem, 'Series', 'series', 'finished', 'Finished')),
          ...games.map((game) => toCliqueItem(game, 'Game', 'games', 'played', 'Played')),
        ]))
      } catch (error) {
        if (!cancelled) {
          loadedItemsKeyRef.current = ''
          setCliqueItems([])
          showMessage(error.message || 'Could not load clique picks.', 'error')
        }
      } finally {
        if (!cancelled) setCliqueItemsLoading(false)
      }
    }

    loadCliqueItems()
    return () => { cancelled = true }
  }, [activeGroup?.id, session?.user?.id])

  async function refresh(nextActive = null) {
    const savedHandle = getSavedHandle()
    setHandle(savedHandle)

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
          }
          const remoteGroups = await getRemoteGroups().catch(() => [])
          setGroups(remoteGroups)
          const activeId = nextActive?.id || groupId || getActiveGroupId()
          const active = activeId ? remoteGroups.find((group) => group.id === activeId) || null : null
          setActiveGroupState(active)
          if (activeId && !active) setActiveGroup('')
          return
        }

        setGroups([])
        setActiveGroupState(null)
        return
      } catch (error) {
        showMessage(error.message || 'Could not load cliques.', 'error')
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

  async function handleCreate(event) {
    event.preventDefault()
    const activeHandle = handle || getSavedHandle() || 'anonymous'
    setLoading(true)
    try {
      const created = session?.user && hasSupabase
        ? await createRemoteGroup(draftGroup || `${activeHandle}'s clique`, activeHandle)
        : createLocalGroup(draftGroup || `${activeHandle}'s clique`, activeHandle)
      loadedItemsKeyRef.current = ''
      setCliqueItems([])
      setActiveGroup(created.id)
      setActiveGroupState(created)
      setDraftGroup('')
      await refresh(created)
      showMessage(`${created.name} is ready to share.`)
    } catch (error) {
      showMessage(error.message || 'Could not create clique.', 'error')
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
    const activeHandle = handle || getSavedHandle() || 'anonymous'

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
      loadedItemsKeyRef.current = ''
      setCliqueItems([])
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
    loadedItemsKeyRef.current = ''
    setCliqueItems([])
    const next = setActiveGroup(group.id)
    setActiveGroupState(next || group)
    showMessage(`${group.name} is now active.`)
  }

  async function copyInvite(group) {
    const copied = await copyToClipboard(getGroupInviteUrl(group))
    showMessage(copied ? 'Invite link copied.' : `Invite path: ${getGroupInvitePath(group)}`)
  }

  return (
    <PageShell active="groups">
      <section className="mb-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-3 shadow-2xl shadow-black/20 backdrop-blur">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="flex shrink-0 items-center justify-between gap-3 rounded-full border border-white/10 bg-neutral-950/70 px-4 py-3 text-sm font-black text-white lg:w-auto">
            <span className="inline-flex items-center gap-2">
              <AppIcon name="users" size={17} />
              {inviteMode ? 'Join invite' : 'Cliques'}
            </span>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-neutral-400">{groups.length}</span>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row">
            {inviteMode ? (
              <CompactInviteForm value={inviteCode || ''} readOnly loading={loading} onJoin={() => joinInvite(inviteCode)} />
            ) : (
              <>
                <CompactCreateForm draftGroup={draftGroup} setDraftGroup={setDraftGroup} loading={loading} onCreate={handleCreate} />
                <CompactInviteForm value={manualInvite} setValue={setManualInvite} loading={loading} onJoin={() => joinInvite(manualInvite)} />
              </>
            )}
          </div>
        </div>
      </section>

      <StatusMessage message={message} />

      {inviteMode ? (
        <section className="mb-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 text-neutral-300">
          {hasSupabase && !session?.user ? (
            <>This invite is ready. Sign in from <strong className="text-white">Profile</strong>, then come back to this link and press Join.</>
          ) : inviteGroup ? (
            <>Invite found for <strong className="text-white">{inviteGroup.name}</strong>. Press Join to activate it.</>
          ) : (
            <>Press Join to accept this invite. The clique will become your active context.</>
          )}
        </section>
      ) : null}

      <CliqueOverview group={activeGroup} groupCount={groups.length} items={cliqueItems} itemsLoading={cliqueItemsLoading} onCopy={copyInvite} />

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3 px-1">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-neutral-500">Your cliques</p>
            <h2 className="mt-1 text-2xl font-black text-white">Switch space</h2>
          </div>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-neutral-300">{groups.length} total</span>
        </div>

        {groups.length ? groups.map((group) => (
          <GroupCard key={group.id} group={group} active={activeGroup?.id === group.id} onActivate={activate} onCopy={copyInvite} />
        )) : (
          <div className="rounded-[2rem] border border-dashed border-white/15 bg-white/[0.03] p-8 text-center text-neutral-400">
            Create your first clique or join a friend’s invite link.
          </div>
        )}
      </section>
    </PageShell>
  )
}
