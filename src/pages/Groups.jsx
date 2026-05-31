import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AppIcon from '../components/AppIcon.jsx'
import PageShell from '../components/PageShell.jsx'
import { DetailPill, InfoModal, StatusMessage, displayYear } from '../components/MediaBlocks.jsx'
import { getSavedHandle, saveSharedHandle } from '../lib/handle.js'
import { ACTIVE_GROUP_STORAGE_KEY, createGroup as createLocalGroup, getGroupInvitePath, getGroupInviteUrl, getGroupOpenPath, getGroups, joinGroup as joinLocalGroup, parseInviteCode, setActiveGroup } from '../lib/groups.js'
import { createRemoteGroup, getCurrentSession, getGames, getMovies, getProfile, getRemoteGroups, getSeries, hasSupabase, joinRemoteGroup } from '../lib/supabaseClient.js'

function copyToClipboard(value) {
  if (!value) return Promise.resolve(false)
  if (navigator?.clipboard?.writeText) return navigator.clipboard.writeText(value).then(() => true).catch(() => false)
  return Promise.resolve(false)
}

function getProfileName(session, profile, fallback = '') {
  return profile?.display_name || fallback || session?.user?.user_metadata?.display_name || ''
}

function rankedItems(items) {
  return items.slice().sort((a, b) => (
    (b.rating || 0) - (a.rating || 0)
    || (b.score || 0) - (a.score || 0)
    || (b.picks || 0) - (a.picks || 0)
    || String(a.title || '').localeCompare(String(b.title || ''))
  ))
}

function normalizeContentItem(item, category, icon, doneKey) {
  return {
    ...item,
    category,
    icon,
    done: Boolean(item?.[doneKey]),
    rating: item?.rating ?? null,
    score: Number(item?.score || 0),
    picks: Number(item?.picks || 0),
  }
}

function categorySummary(items, title, singular, icon, doneKey, to) {
  const normalized = rankedItems(items.map((item) => normalizeContentItem(item, singular, icon, doneKey)))
  return {
    title,
    singular,
    icon,
    to,
    items: normalized,
    top: normalized[0] || null,
    count: normalized.length,
    score: normalized.reduce((sum, item) => sum + Number(item.score || 0), 0),
    picks: normalized.reduce((sum, item) => sum + Number(item.picks || 0), 0),
    done: normalized.filter((item) => item.done).length,
    rated: normalized.filter((item) => item.rating).length,
  }
}

function buildGroupSummary(movies = [], series = [], games = []) {
  const categories = [
    categorySummary(movies, 'Movies', 'Movie', 'movies', 'watched', '/movies'),
    categorySummary(series, 'Series', 'Series', 'series', 'finished', '/series'),
    categorySummary(games, 'Games', 'Game', 'games', 'played', '/games'),
  ]
  return {
    categories,
    items: categories.reduce((sum, category) => sum + category.count, 0),
    score: categories.reduce((sum, category) => sum + category.score, 0),
    done: categories.reduce((sum, category) => sum + category.done, 0),
  }
}

function emptyGroupSummary() {
  return buildGroupSummary([], [], [])
}

function MetricBox({ value, label }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-950/70 px-4 py-3 text-center">
      <div className="text-2xl font-black text-white">{value}</div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-500">{label}</div>
    </div>
  )
}

function scopeMediaPath(group, category) {
  const query = `?clique=${encodeURIComponent(group.id)}`
  return `${category.to}${query}`
}

function TopContentTile({ group, category, onOpenItem, onOpenList }) {
  const item = category.top
  const image = item?.backdrop || item?.poster

  if (!item) {
    return (
      <button type="button" onClick={() => onOpenList(group, category)} className="rounded-[1.5rem] border border-dashed border-white/10 bg-neutral-950/50 p-4 text-left transition hover:border-white/25 hover:bg-neutral-900">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs font-black text-neutral-300">
          <AppIcon name={category.icon} size={14} />
          {category.title}
        </div>
        <p className="mt-4 text-sm text-neutral-500">No {category.title.toLowerCase()} yet. Open the list to add one.</p>
      </button>
    )
  }

  return (
    <article className="group relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-neutral-950/75 transition hover:border-white/25 hover:bg-neutral-900">
      <button type="button" onClick={() => onOpenItem({ ...item, category: category.singular, icon: category.icon })} className="block w-full text-left" aria-label={`Open ${item.title} details`}>
        <div className="relative h-32 overflow-hidden bg-neutral-900">
          {image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70 transition group-hover:scale-105" /> : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/10" />
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-950">
            <AppIcon name={category.icon} size={12} strokeWidth={2.5} />
            Top {category.singular}
          </span>
        </div>
        <div className="p-4">
          <h3 className="line-clamp-1 text-lg font-black text-white">{item.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm leading-5 text-neutral-400">{item.overview || `Leading ${category.singular.toLowerCase()} by score and picks in this clique.`}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-neutral-300">
            <span className="rounded-full border border-white/10 px-2.5 py-1">Score {item.score || 0}</span>
            <span className="rounded-full border border-white/10 px-2.5 py-1">{item.picks || 0} picks</span>
            {item.rating ? <span className="rounded-full border border-white/10 px-2.5 py-1">★ {Number(item.rating).toFixed(1)}</span> : null}
          </div>
        </div>
      </button>
      <a href={scopeMediaPath(group, category)} onClick={(event) => { event.stopPropagation(); onOpenList(group, category) }} aria-label={`Open ${category.title} list for ${group.name}`} className="absolute right-3 top-3 z-10 rounded-full bg-black/55 px-3 py-1.5 text-xs font-black text-white backdrop-blur transition hover:bg-white hover:text-neutral-950">
        {category.count}
      </a>
    </article>
  )
}

function GroupContentOverview({ group, summary, loading, onOpenItem, onOpenList }) {
  if (loading) return <div className="mt-5 grid gap-3 lg:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-56 animate-pulse rounded-[1.5rem] bg-white/[0.06]" />)}</div>
  const safeSummary = summary || emptyGroupSummary()
  return (
    <div className="mt-5 border-t border-white/10 pt-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.26em] text-neutral-500">Content overview</p>
          <h3 className="mt-1 text-xl font-black text-white">Category leaders in this clique</h3>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:min-w-[20rem]"><MetricBox value={safeSummary.items} label="Items" /><MetricBox value={safeSummary.score} label="Score" /><MetricBox value={safeSummary.done} label="Done" /></div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        {safeSummary.categories.map((category) => <TopContentTile key={category.title} group={group} category={category} onOpenItem={onOpenItem} onOpenList={onOpenList} />)}
      </div>
    </div>
  )
}

function GroupCard({ group, summary, summaryLoading, onCopy, onOpen, onOpenItem, onOpenList }) {
  return (
    <article className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 text-white shadow-2xl shadow-black/15 transition hover:border-white/20 hover:bg-white/[0.045] sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.26em] text-neutral-500">{group.isPublic ? 'Public clique' : 'Private clique'}</p>
          <h2 className="mt-1 truncate text-3xl font-black">{group.name}</h2>
          <p className="mt-2 text-sm text-neutral-400">{group.members?.length || 1} members</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" onClick={() => onCopy(group)} aria-label={`Copy invite for ${group.name}`} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 text-white transition hover:bg-white hover:text-neutral-950"><AppIcon name="link" size={17} /></button>
          <Link to={getGroupOpenPath(group)} onClick={() => onOpen(group)} aria-label={`Open ${group.name}`} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-neutral-950 transition hover:bg-neutral-200"><AppIcon name="explore" size={17} />Open</Link>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 rounded-2xl bg-neutral-900 p-3 text-sm text-neutral-300">{group.members?.length ? group.members.map((member) => <span key={member} className="rounded-full bg-white/[0.06] px-3 py-1 text-xs font-semibold text-neutral-300">{member}</span>) : <span>Members appear here after people join.</span>}</div>
      <GroupContentOverview group={group} summary={summary} loading={summaryLoading} onOpenItem={onOpenItem} onOpenList={onOpenList} />
    </article>
  )
}

function CompactCreateForm({ draftGroup, setDraftGroup, loading, onCreate }) {
  return <form onSubmit={onCreate} className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-white/10 bg-neutral-950/70 p-1.5"><span className="ml-3 hidden text-neutral-500 sm:inline-flex"><AppIcon name="users" size={18} /></span><input value={draftGroup} onChange={(event) => setDraftGroup(event.target.value)} placeholder="New clique name" className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-500" /><button disabled={loading} aria-label="Create clique" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-lg font-black text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-60">+</button></form>
}

function CompactInviteForm({ value, setValue, loading, onJoin, readOnly = false }) {
  return <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-white/10 bg-neutral-950/70 p-1.5"><span className="ml-3 hidden text-neutral-500 sm:inline-flex"><AppIcon name="link" size={18} /></span><input value={value} onChange={(event) => setValue?.(event.target.value)} readOnly={readOnly} placeholder="Invite link or code" className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-500" /><button type="button" disabled={loading} onClick={onJoin} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-white/10 px-4 text-sm font-black text-white transition hover:bg-white hover:text-neutral-950 disabled:opacity-60">Join</button></div>
}

export default function Groups({ inviteMode = false }) {
  const { code } = useParams()
  const inviteCode = parseInviteCode(code || '')
  const [groups, setGroups] = useState([])
  const [groupSummaries, setGroupSummaries] = useState({})
  const [summariesLoading, setSummariesLoading] = useState(false)
  const [session, setSession] = useState(null)
  const [handle, setHandle] = useState('')
  const [draftGroup, setDraftGroup] = useState('')
  const [manualInvite, setManualInvite] = useState('')
  const [cliqueSearch, setCliqueSearch] = useState('')
  const [message, setMessage] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { refresh() }, [])

  useEffect(() => {
    let cancelled = false
    async function loadGroupSummaries() {
      if (!groups.length) { setGroupSummaries({}); setSummariesLoading(false); return }
      if (!hasSupabase || !session?.user) { setGroupSummaries(Object.fromEntries(groups.map((group) => [group.id, emptyGroupSummary()]))); setSummariesLoading(false); return }
      setSummariesLoading(true)
      try {
        const entries = await Promise.all(groups.map(async (group) => {
          const [movies, series, games] = await Promise.all([getMovies(group.id), getSeries(group.id), getGames(group.id)])
          return [group.id, buildGroupSummary(movies, series, games)]
        }))
        if (!cancelled) setGroupSummaries(Object.fromEntries(entries))
      } catch (error) {
        if (!cancelled) { setGroupSummaries(Object.fromEntries(groups.map((group) => [group.id, emptyGroupSummary()]))); showMessage(error.message || 'Could not load clique overviews.', 'error') }
      } finally {
        if (!cancelled) setSummariesLoading(false)
      }
    }
    loadGroupSummaries()
    return () => { cancelled = true }
  }, [groups, session?.user?.id])

  async function refresh() {
    const savedHandle = getSavedHandle()
    setHandle(savedHandle)
    if (hasSupabase) {
      try {
        const nextSession = await getCurrentSession()
        setSession(nextSession)
        if (nextSession?.user) {
          const profile = await getProfile().catch(() => null)
          const displayName = getProfileName(nextSession, profile, savedHandle)
          if (displayName) { saveSharedHandle(displayName); setHandle(displayName) }
          setGroups(await getRemoteGroups().catch(() => []))
          return
        }
        setGroups([])
        return
      } catch (error) { showMessage(error.message || 'Could not load cliques.', 'error') }
    }
    setGroups(getGroups())
  }

  const visibleGroups = useMemo(() => {
    const query = cliqueSearch.trim().toLowerCase()
    if (!query) return groups
    return groups.filter((group) => String(group.name || '').toLowerCase().includes(query))
  }, [groups, cliqueSearch])

  const inviteGroup = useMemo(() => {
    if (!inviteCode) return null
    return groups.find((group) => group.inviteCode === inviteCode || group.id === inviteCode) || null
  }, [inviteCode, groups])

  function showMessage(text, type = 'success') { setMessage({ text, type }); setTimeout(() => setMessage(null), 2600) }
  function activateGroup(group) { setActiveGroup(group.id); if (typeof window !== 'undefined') window.localStorage.setItem(ACTIVE_GROUP_STORAGE_KEY, group.id) }

  async function handleCreate(event) {
    event.preventDefault()
    const activeHandle = handle || getSavedHandle() || 'anonymous'
    setLoading(true)
    try {
      const created = session?.user && hasSupabase ? await createRemoteGroup(draftGroup || `${activeHandle}'s clique`, activeHandle) : createLocalGroup(draftGroup || `${activeHandle}'s clique`, activeHandle)
      activateGroup(created); setDraftGroup(''); await refresh(); showMessage(`${created.name} is ready to share.`)
    } catch (error) { showMessage(error.message || 'Could not create clique.', 'error') } finally { setLoading(false) }
  }

  async function joinInvite(codeToJoin = inviteCode || manualInvite) {
    const parsed = parseInviteCode(codeToJoin)
    if (!parsed) { showMessage('Paste an invite link or code first.', 'error'); return }
    if (hasSupabase && !session?.user) { showMessage('Sign in from Profile first, then use this invite link again.', 'error'); return }
    const activeHandle = handle || getSavedHandle() || 'anonymous'
    setLoading(true)
    try {
      const joined = session?.user && hasSupabase ? await joinRemoteGroup(parsed, activeHandle) : joinLocalGroup(parsed, activeHandle)
      if (!joined) throw new Error('Could not join that invite.')
      activateGroup(joined); setManualInvite(''); await refresh(); showMessage(`Joined ${joined.name}.`)
    } catch (error) { showMessage(error.message || 'Could not join that invite.', 'error') } finally { setLoading(false) }
  }

  function openList(group, category) { activateGroup(group); if (category?.to && typeof window !== 'undefined') window.location.href = scopeMediaPath(group, category) }
  async function copyInvite(group) { const copied = await copyToClipboard(getGroupInviteUrl(group)); showMessage(copied ? 'Invite link copied.' : `Invite path: ${getGroupInvitePath(group)}`) }

  return (
    <PageShell active="groups">
      <section className="mb-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-3 shadow-2xl shadow-black/20 backdrop-blur">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="flex shrink-0 items-center justify-between gap-3 rounded-full border border-white/10 bg-neutral-950/70 px-4 py-3 text-sm font-black text-white lg:w-auto"><span className="inline-flex items-center gap-2"><AppIcon name="users" size={17} />{inviteMode ? 'Join invite' : 'Cliques'}</span><span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-neutral-400">{groups.length}</span></div>
          <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row">{inviteMode ? <CompactInviteForm value={inviteCode || ''} readOnly loading={loading} onJoin={() => joinInvite(inviteCode)} /> : <><CompactCreateForm draftGroup={draftGroup} setDraftGroup={setDraftGroup} loading={loading} onCreate={handleCreate} /><CompactInviteForm value={manualInvite} setValue={setManualInvite} loading={loading} onJoin={() => joinInvite(manualInvite)} /></>}</div>
        </div>
      </section>
      <StatusMessage message={message} />
      {inviteMode ? <section className="mb-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 text-neutral-300">{hasSupabase && !session?.user ? <>This invite is ready. Sign in from <strong className="text-white">Profile</strong>, then come back to this link and press Join.</> : inviteGroup ? <>Invite found for <strong className="text-white">{inviteGroup.name}</strong>. Press Join to add it to your cliques.</> : <>Press Join to accept this invite. The clique will be added to your cliques.</>}</section> : null}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 px-1 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[0.28em] text-neutral-500">Your cliques</p><h2 className="mt-1 text-3xl font-black text-white">Joined cliques</h2></div>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center"><input value={cliqueSearch} onChange={(event) => setCliqueSearch(event.target.value)} placeholder="Search cliques..." className="min-w-0 rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-sm text-white outline-none" /><span className="w-fit rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-neutral-300">{visibleGroups.length}/{groups.length}</span></div>
        </div>
        {visibleGroups.length ? visibleGroups.map((group) => <GroupCard key={group.id} group={group} summary={groupSummaries[group.id]} summaryLoading={summariesLoading} onCopy={copyInvite} onOpen={activateGroup} onOpenItem={setSelectedItem} onOpenList={openList} />) : <div className="rounded-[2rem] border border-dashed border-white/15 bg-white/[0.03] p-8 text-center text-neutral-400">No cliques match your search.</div>}
      </section>
      <InfoModal item={selectedItem} onClose={() => setSelectedItem(null)} year={displayYear(selectedItem?.released || selectedItem?.year)} backdrop={selectedItem?.backdrop || selectedItem?.poster}>
        <div className="mt-4 flex flex-wrap gap-2"><DetailPill>{selectedItem?.category}</DetailPill><DetailPill>Score {selectedItem?.score || 0}</DetailPill><DetailPill>{selectedItem?.picks || 0} picks</DetailPill>{selectedItem?.rating ? <DetailPill>Rating ★ {Number(selectedItem.rating).toFixed(1)}</DetailPill> : null}{selectedItem?.runtime ? <DetailPill>{selectedItem.runtime} min</DetailPill> : null}{selectedItem?.seasons ? <DetailPill>{selectedItem.seasons} seasons</DetailPill> : null}{selectedItem?.episodes ? <DetailPill>{selectedItem.episodes} episodes</DetailPill> : null}{selectedItem?.platform ? <DetailPill>{selectedItem.platform}</DetailPill> : null}{selectedItem?.genres?.map((genre) => <DetailPill key={genre}>{genre}</DetailPill>)}{selectedItem?.platforms?.map((platform) => <DetailPill key={platform}>{platform}</DetailPill>)}</div>
        <p className="mt-5 text-sm leading-7 text-neutral-300">{selectedItem?.overview || selectedItem?.description || 'No description available yet.'}</p>
      </InfoModal>
    </PageShell>
  )
}
