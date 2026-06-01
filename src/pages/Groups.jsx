import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AppIcon from '../components/AppIcon.jsx'
import PageShell from '../components/PageShell.jsx'
import { DetailPill, InfoModal, StatusMessage, displayYear } from '../components/MediaBlocks.jsx'
import { getSavedHandle, saveSharedHandle } from '../lib/handle.js'
import { ACTIVE_GROUP_STORAGE_KEY, createGroup as createLocalGroup, getGroupInvitePath, getGroupInviteUrl, getGroupOpenPath, getGroups, joinGroup as joinLocalGroup, parseInviteCode, setActiveGroup } from '../lib/groups.js'
import { createRemoteGroup, getCurrentSession, getGames, getMovies, getProfile, getRemoteGroups, getSeries, hasSupabase, joinRemoteGroup } from '../lib/supabaseClient.js'
import { getVideos } from '../lib/videoLibrary.js'

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
  return { ...item, category, icon, done: doneKey === 'classic' ? Boolean(item?.classic) : Boolean(item?.[doneKey]), rating: item?.rating ?? null, score: Number(item?.score || 0), picks: Number(item?.picks || 0) }
}

function categorySummary(items, title, singular, icon, doneKey, to) {
  const normalized = rankedItems(items.map((item) => normalizeContentItem(item, singular, icon, doneKey)))
  return { title, singular, icon, to, items: normalized, top: normalized[0] || null, count: normalized.length, score: normalized.reduce((sum, item) => sum + Number(item.score || 0), 0), picks: normalized.reduce((sum, item) => sum + Number(item.picks || 0), 0), done: normalized.filter((item) => item.done).length, rated: normalized.filter((item) => item.rating).length }
}

function buildGroupSummary(movies = [], series = [], games = [], videos = []) {
  const categories = [
    categorySummary(movies, 'Movies', 'Movie', 'movies', 'watched', '/movies'),
    categorySummary(series, 'Series', 'Series', 'series', 'finished', '/series'),
    categorySummary(games, 'Games', 'Game', 'games', 'played', '/games'),
    categorySummary(videos, 'Videos', 'Video', 'videos', 'classic', '/videos'),
  ]
  return { categories, items: categories.reduce((sum, category) => sum + category.count, 0), score: categories.reduce((sum, category) => sum + category.score, 0), done: categories.reduce((sum, category) => sum + category.done, 0) }
}

function emptyGroupSummary() { return buildGroupSummary([], [], [], []) }
function scopeMediaPath(group, category) { return `${category.to}?clique=${encodeURIComponent(group.id)}` }

function memberInitial(member) {
  const value = String(member || '').trim()
  if (!value) return '?'
  return value[0].toUpperCase()
}

function MemberAvatars({ members = [] }) {
  const list = members.length ? members : ['?']
  return (
    <div className="flex min-w-0 flex-wrap items-end gap-2">
      {list.slice(0, 4).map((member, index) => (
        <span key={`${member}-${index}`} title={member} className="flex max-w-[4.75rem] flex-col items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.035] px-2 py-1.5 text-center shadow-lg shadow-black/10">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-white text-[10px] font-black text-neutral-950 shadow-md shadow-black/20">{memberInitial(member)}</span>
          <span className="max-w-full truncate text-[10px] font-bold leading-none text-neutral-300">{member}</span>
        </span>
      ))}
      {list.length > 4 ? <span className="flex h-[3.65rem] min-w-[3.25rem] flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.035] px-2 text-[10px] font-black text-neutral-300">+{list.length - 4}</span> : null}
    </div>
  )
}

function MetricBox({ value, label, icon }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-white/10 bg-neutral-950/65 px-3 py-2">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-neutral-300"><AppIcon name={icon} size={13} /></span>
      <span className="min-w-0"><span className="block text-lg font-black leading-none text-white">{value}</span><span className="block text-[9px] font-bold uppercase tracking-[0.16em] text-neutral-500">{label}</span></span>
    </div>
  )
}

function TopContentTile({ group, category, onOpenItem, onOpenList }) {
  const item = category.top
  const image = item?.backdrop || item?.poster
  if (!item) {
    return (
      <button type="button" onClick={() => onOpenList(group, category)} className="min-h-[7.25rem] rounded-[1.25rem] border border-dashed border-white/10 bg-neutral-950/45 p-3 text-left transition hover:border-white/25 hover:bg-neutral-900">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-300"><AppIcon name={category.icon} size={12} />{category.title}</div>
        <p className="mt-3 text-xs text-neutral-500">No {category.title.toLowerCase()} yet.</p>
      </button>
    )
  }
  return (
    <article className="group relative min-h-[7.25rem] overflow-hidden rounded-[1.25rem] border border-white/10 bg-neutral-950/75 transition hover:border-white/25 hover:bg-neutral-900">
      <button type="button" onClick={() => onOpenItem({ ...item, category: category.singular, icon: category.icon })} className="block h-full min-h-[7.25rem] w-full text-left" aria-label={`Open ${item.title} details`}>
        {image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-68 transition group-hover:scale-105" /> : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-neutral-950"><AppIcon name={category.icon} size={11} strokeWidth={2.5} />Top {category.singular}</span>
        <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2 py-1 text-[10px] font-black text-white backdrop-blur">{category.count}</span>
        <div className="absolute inset-x-0 bottom-0 p-3">
          <h3 className="line-clamp-1 text-base font-black leading-tight text-white">{item.title}</h3>
          <p className="mt-1 line-clamp-1 text-[11px] font-semibold text-neutral-400">Score {item.score || 0} · {item.picks || 0} picks{item.rating ? ` · ★ ${Number(item.rating).toFixed(1)}` : ''}</p>
        </div>
      </button>
    </article>
  )
}

function GroupContentOverview({ group, summary, loading, onOpenItem, onOpenList }) {
  if (loading) return <div className="mt-3 grid gap-2 lg:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-[1.25rem] bg-white/[0.06]" />)}</div>
  const safeSummary = summary || emptyGroupSummary()
  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-neutral-500">Content overview</p>
        <div className="grid grid-cols-3 gap-2 sm:min-w-[16rem]"><MetricBox value={safeSummary.items} label="Items" icon="dashboard" /><MetricBox value={safeSummary.score} label="Score" icon="explore" /><MetricBox value={safeSummary.done} label="Done" icon="info" /></div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">{safeSummary.categories.map((category) => <TopContentTile key={category.title} group={group} category={category} onOpenItem={onOpenItem} onOpenList={onOpenList} />)}</div>
    </div>
  )
}

function GroupCard({ group, summary, summaryLoading, onCopy, onOpen, onOpenItem, onOpenList }) {
  const memberCount = group.members?.length || 1
  return (
    <article className="rounded-[1.65rem] border border-white/10 bg-white/[0.028] p-4 text-white shadow-xl shadow-black/10 transition hover:border-white/20 hover:bg-white/[0.04]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-neutral-500">{group.isPublic ? 'Public clique' : 'Private clique'}</p>
          <h2 className="mt-1 truncate text-2xl font-black leading-tight">{group.name}</h2>
          <div className="mt-3 flex flex-wrap items-end gap-3 text-xs text-neutral-400"><MemberAvatars members={group.members || []} /><span className="mb-1 rounded-full border border-white/10 px-2.5 py-1 font-bold">{memberCount} {memberCount === 1 ? 'member' : 'members'}</span></div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" onClick={() => onCopy(group)} aria-label={`Copy invite for ${group.name}`} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white transition hover:bg-white hover:text-neutral-950"><AppIcon name="link" size={16} /></button>
          <Link to={getGroupOpenPath(group)} onClick={() => onOpen(group)} aria-label={`Open ${group.name}`} className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-black text-neutral-950 transition hover:bg-neutral-200"><AppIcon name="explore" size={16} />Open</Link>
        </div>
      </div>
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
        const entries = await Promise.all(groups.map(async (group) => { const [movies, series, games, videos] = await Promise.all([getMovies(group.id), getSeries(group.id), getGames(group.id), getVideos(group.id)]); return [group.id, buildGroupSummary(movies, series, games, videos)] }))
        if (!cancelled) setGroupSummaries(Object.fromEntries(entries))
      } catch (error) { if (!cancelled) { setGroupSummaries(Object.fromEntries(groups.map((group) => [group.id, emptyGroupSummary()] ))); showMessage(error.message || 'Could not load clique overviews.', 'error') } }
      finally { if (!cancelled) setSummariesLoading(false) }
    }
    loadGroupSummaries(); return () => { cancelled = true }
  }, [groups, session?.user?.id])

  async function refresh() {
    const savedHandle = getSavedHandle(); setHandle(savedHandle)
    if (hasSupabase) {
      try {
        const nextSession = await getCurrentSession(); setSession(nextSession)
        if (nextSession?.user) { const profile = await getProfile().catch(() => null); const displayName = getProfileName(nextSession, profile, savedHandle); if (displayName) { saveSharedHandle(displayName); setHandle(displayName) } setGroups(await getRemoteGroups().catch(() => [])); return }
        setGroups([]); return
      } catch (error) { showMessage(error.message || 'Could not load cliques.', 'error') }
    }
    setGroups(getGroups())
  }

  const visibleGroups = useMemo(() => { const query = cliqueSearch.trim().toLowerCase(); if (!query) return groups; return groups.filter((group) => String(group.name || '').toLowerCase().includes(query)) }, [groups, cliqueSearch])
  const inviteGroup = useMemo(() => { if (!inviteCode) return null; return groups.find((group) => group.inviteCode === inviteCode || group.id === inviteCode) || null }, [inviteCode, groups])
  function showMessage(text, type = 'success') { setMessage({ text, type }); setTimeout(() => setMessage(null), 2600) }
  function activateGroup(group) { setActiveGroup(group.id); if (typeof window !== 'undefined') window.localStorage.setItem(ACTIVE_GROUP_STORAGE_KEY, group.id) }

  async function handleCreate(event) {
    event.preventDefault()
    const activeHandle = handle || getSavedHandle() || 'anonymous'
    setLoading(true)
    try { const created = session?.user && hasSupabase ? await createRemoteGroup(draftGroup || `${activeHandle}'s clique`, activeHandle) : createLocalGroup(draftGroup || `${activeHandle}'s clique`, activeHandle); activateGroup(created); setDraftGroup(''); await refresh(); showMessage(`${created.name} is ready to share.`) }
    catch (error) { showMessage(error.message || 'Could not create clique.', 'error') }
    finally { setLoading(false) }
  }

  async function joinInvite(codeToJoin = inviteCode || manualInvite) {
    const parsed = parseInviteCode(codeToJoin)
    if (!parsed) { showMessage('Paste an invite link or code first.', 'error'); return }
    if (hasSupabase && !session?.user) { showMessage('Sign in from Profile first, then use this invite link again.', 'error'); return }
    const activeHandle = handle || getSavedHandle() || 'anonymous'
    setLoading(true)
    try { const joined = session?.user && hasSupabase ? await joinRemoteGroup(parsed, activeHandle) : joinLocalGroup(parsed, activeHandle); if (!joined) throw new Error('Could not join that invite.'); activateGroup(joined); setManualInvite(''); await refresh(); showMessage(`Joined ${joined.name}.`) }
    catch (error) { showMessage(error.message || 'Could not join that invite.', 'error') }
    finally { setLoading(false) }
  }

  function openList(group, category) { activateGroup(group); if (category?.to && typeof window !== 'undefined') window.location.href = scopeMediaPath(group, category) }
  async function copyInvite(group) { const copied = await copyToClipboard(getGroupInviteUrl(group)); showMessage(copied ? 'Invite link copied.' : `Invite path: ${getGroupInvitePath(group)}`) }

  return (
    <PageShell active="groups">
      <section className="mb-4 rounded-[1.65rem] border border-white/10 bg-white/[0.03] p-3 shadow-xl shadow-black/15 backdrop-blur">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="flex shrink-0 items-center justify-between gap-3 rounded-full border border-white/10 bg-neutral-950/70 px-4 py-3 text-sm font-black text-white lg:w-auto"><span className="inline-flex items-center gap-2"><AppIcon name="users" size={17} />{inviteMode ? 'Join invite' : 'Cliques'}</span><span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-neutral-400">{groups.length}</span></div>
          <div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row">{inviteMode ? <CompactInviteForm value={inviteCode || ''} readOnly loading={loading} onJoin={() => joinInvite(inviteCode)} /> : <><CompactCreateForm draftGroup={draftGroup} setDraftGroup={setDraftGroup} loading={loading} onCreate={handleCreate} /><CompactInviteForm value={manualInvite} setValue={setManualInvite} loading={loading} onJoin={() => joinInvite(manualInvite)} /></>}</div>
        </div>
      </section>
      <StatusMessage message={message} />
      {inviteMode ? <section className="mb-4 rounded-[1.65rem] border border-white/10 bg-white/[0.03] p-5 text-neutral-300">{hasSupabase && !session?.user ? <>This invite is ready. Sign in from <strong className="text-white">Profile</strong>, then come back to this link and press Join.</> : inviteGroup ? <>Invite found for <strong className="text-white">{inviteGroup.name}</strong>. Press Join to add it to your cliques.</> : <>Press Join to accept this invite. The clique will be added to your cliques.</>}</section> : null}
      <section className="space-y-3">
        <div className="flex flex-col gap-3 px-1 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-2xl font-black text-white">Joined cliques</h2>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center"><input value={cliqueSearch} onChange={(event) => setCliqueSearch(event.target.value)} placeholder="Search cliques..." className="min-w-0 rounded-2xl border border-white/10 bg-neutral-950 px-4 py-2.5 text-sm text-white outline-none" /><span className="w-fit rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-neutral-300">{visibleGroups.length}/{groups.length}</span></div>
        </div>
        {visibleGroups.length ? visibleGroups.map((group) => <GroupCard key={group.id} group={group} summary={groupSummaries[group.id]} summaryLoading={summariesLoading} onCopy={copyInvite} onOpen={activateGroup} onOpenItem={setSelectedItem} onOpenList={openList} />) : <div className="rounded-[1.65rem] border border-dashed border-white/15 bg-white/[0.03] p-8 text-center text-neutral-400">No cliques match your search.</div>}
      </section>
      <InfoModal item={selectedItem} onClose={() => setSelectedItem(null)} year={displayYear(selectedItem?.released || selectedItem?.year)} backdrop={selectedItem?.backdrop || selectedItem?.poster}>
        <div className="mt-4 flex flex-wrap gap-2"><DetailPill>{selectedItem?.category}</DetailPill><DetailPill>Score {selectedItem?.score || 0}</DetailPill><DetailPill>{selectedItem?.picks || 0} picks</DetailPill>{selectedItem?.rating ? <DetailPill>Rating ★ {Number(selectedItem.rating).toFixed(1)}</DetailPill> : null}{selectedItem?.runtime ? <DetailPill>{selectedItem.runtime} min</DetailPill> : null}{selectedItem?.seasons ? <DetailPill>{selectedItem.seasons} seasons</DetailPill> : null}{selectedItem?.episodes ? <DetailPill>{selectedItem.episodes} episodes</DetailPill> : null}{selectedItem?.platform ? <DetailPill>{selectedItem.platform}</DetailPill> : null}{selectedItem?.genres?.map((genre) => <DetailPill key={genre}>{genre}</DetailPill>)}{selectedItem?.platforms?.map((platform) => <DetailPill key={platform}>{platform}</DetailPill>)}</div>
        <p className="mt-5 text-sm leading-7 text-neutral-300">{selectedItem?.overview || selectedItem?.description || 'No description available yet.'}</p>
        {selectedItem?.url ? <a href={selectedItem.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-neutral-200">Open video</a> : null}
      </InfoModal>
    </PageShell>
  )
}
