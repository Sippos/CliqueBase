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
function memberName(member) { return String(member?.displayName || member?.display_name || member?.name || member || '').trim() || 'Member' }
function memberInitial(member) { return memberName(member)[0]?.toUpperCase() || '?' }
function memberLibraryPath(member) { return `/users/${encodeURIComponent(member?.id || memberName(member))}` }

const GROUP_TINTS = [
  { card: 'border-sky-300/15 bg-gradient-to-br from-sky-400/[0.12] via-white/[0.035] to-neutral-950/70 hover:border-sky-200/30 hover:from-sky-400/[0.16]', rail: 'from-sky-300/70 via-cyan-200/40 to-transparent', glow: 'bg-sky-400/10', label: 'text-sky-100' },
  { card: 'border-violet-300/15 bg-gradient-to-br from-violet-400/[0.12] via-white/[0.035] to-neutral-950/70 hover:border-violet-200/30 hover:from-violet-400/[0.16]', rail: 'from-violet-300/70 via-fuchsia-200/40 to-transparent', glow: 'bg-violet-400/10', label: 'text-violet-100' },
  { card: 'border-emerald-300/15 bg-gradient-to-br from-emerald-400/[0.11] via-white/[0.035] to-neutral-950/70 hover:border-emerald-200/30 hover:from-emerald-400/[0.15]', rail: 'from-emerald-300/70 via-teal-200/40 to-transparent', glow: 'bg-emerald-400/10', label: 'text-emerald-100' },
  { card: 'border-amber-300/15 bg-gradient-to-br from-amber-400/[0.11] via-white/[0.035] to-neutral-950/70 hover:border-amber-200/30 hover:from-amber-400/[0.15]', rail: 'from-amber-300/70 via-orange-200/40 to-transparent', glow: 'bg-amber-400/10', label: 'text-amber-100' },
  { card: 'border-rose-300/15 bg-gradient-to-br from-rose-400/[0.11] via-white/[0.035] to-neutral-950/70 hover:border-rose-200/30 hover:from-rose-400/[0.15]', rail: 'from-rose-300/70 via-pink-200/40 to-transparent', glow: 'bg-rose-400/10', label: 'text-rose-100' },
  { card: 'border-indigo-300/15 bg-gradient-to-br from-indigo-400/[0.12] via-white/[0.035] to-neutral-950/70 hover:border-indigo-200/30 hover:from-indigo-400/[0.16]', rail: 'from-indigo-300/70 via-blue-200/40 to-transparent', glow: 'bg-indigo-400/10', label: 'text-indigo-100' },
]

function stableTintIndex(value = '') {
  const source = String(value || '')
  return source.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % GROUP_TINTS.length
}

function groupTint(group) {
  return GROUP_TINTS[stableTintIndex(group?.id || group?.name || 'clique')]
}

function MemberAvatars({ members = [] }) {
  const list = members.length ? members : ['?']
  return (
    <div className="flex min-w-0 flex-nowrap items-center gap-1.5 sm:flex-wrap sm:items-end sm:gap-2">
      {list.slice(0, 4).map((member, index) => {
        const name = memberName(member)
        const interactive = name !== '?'
        const content = <><span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white text-[10px] font-black text-neutral-950 shadow-md shadow-black/20">{memberInitial(member)}</span><span className="hidden max-w-full truncate text-[10px] font-bold leading-none text-neutral-300 sm:block">{name}</span></>
        const sharedClass = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-center shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.07] sm:h-auto sm:w-auto sm:max-w-[4.75rem] sm:flex-col sm:gap-1 sm:rounded-2xl sm:px-2 sm:py-1.5'
        return interactive ? (
          <Link key={`${name}-${index}`} to={memberLibraryPath(member)} title={`Open ${name}'s library`} className={sharedClass}>
            {content}
          </Link>
        ) : (
          <span key={`${name}-${index}`} title={name} className={sharedClass}>{content}</span>
        )
      })}
      {list.length > 4 ? <span className="inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] px-2 text-[10px] font-black text-neutral-300 sm:h-[3.65rem] sm:min-w-[3.25rem] sm:flex-col">+{list.length - 4}</span> : null}
    </div>
  )
}

function MetricBox({ value, label, icon }) {
  return <div className="flex min-w-0 items-center gap-1.5 rounded-2xl border border-white/10 bg-neutral-950/65 px-2 py-1.5 sm:gap-2 sm:px-3 sm:py-2"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-neutral-300 sm:h-7 sm:w-7"><AppIcon name={icon} size={13} /></span><span className="min-w-0"><span className="block text-base font-black leading-none text-white sm:text-lg">{value}</span><span className="block text-[8px] font-bold uppercase tracking-[0.14em] text-neutral-500 sm:text-[9px] sm:tracking-[0.16em]">{label}</span></span></div>
}

function TopContentTile({ group, category, onOpenItem, onOpenList }) {
  const item = category.top
  const image = item?.backdrop || item?.poster
  if (!item) return <button type="button" onClick={() => onOpenList(group, category)} className="min-h-[6.15rem] rounded-[1rem] border border-dashed border-white/10 bg-neutral-950/45 p-2.5 text-left transition hover:border-white/25 hover:bg-neutral-900 sm:min-h-[7.25rem] sm:rounded-[1.25rem] sm:p-3"><div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-neutral-300 sm:px-2.5 sm:py-1 sm:text-[10px]"><AppIcon name={category.icon} size={12} />{category.title}</div><p className="mt-2 text-[11px] text-neutral-500 sm:mt-3 sm:text-xs">No {category.title.toLowerCase()} yet.</p></button>
  return <article className="group relative min-h-[6.15rem] overflow-hidden rounded-[1rem] border border-white/10 bg-neutral-950/75 transition hover:border-white/25 hover:bg-neutral-900 sm:min-h-[7.25rem] sm:rounded-[1.25rem]"><button type="button" onClick={() => onOpenItem({ ...item, category: category.singular, icon: category.icon })} className="block h-full min-h-[6.15rem] w-full text-left sm:min-h-[7.25rem]" aria-label={`Open ${item.title} details`}>{image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-68 transition group-hover:scale-105" /> : null}<div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10" /><span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.1em] text-neutral-950 sm:left-3 sm:top-3 sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[9px] sm:tracking-[0.12em]"><AppIcon name={category.icon} size={11} strokeWidth={2.5} />Top {category.singular}</span><span className="absolute right-2 top-2 rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-black text-white backdrop-blur sm:right-3 sm:top-3 sm:px-2 sm:py-1 sm:text-[10px]">{category.count}</span><div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3"><h3 className="line-clamp-1 text-sm font-black leading-tight text-white sm:text-base">{item.title}</h3><p className="mt-0.5 line-clamp-1 text-[10px] font-semibold text-neutral-400 sm:mt-1 sm:text-[11px]">Score {item.score || 0} · {item.picks || 0} picks{item.rating ? ` · ★ ${Number(item.rating).toFixed(1)}` : ''}</p></div></button></article>
}

function GroupContentOverview({ group, summary, loading, onOpenItem, onOpenList }) {
  if (loading) return <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-[1rem] bg-white/[0.06] sm:h-28 sm:rounded-[1.25rem]" />)}</div>
  const safeSummary = summary || emptyGroupSummary()
  return <div className="mt-3 border-t border-white/10 pt-3 sm:mt-4 sm:pt-4"><div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between"><p className="text-[9px] font-black uppercase tracking-[0.22em] text-neutral-500 sm:text-[10px] sm:tracking-[0.24em]">Content overview</p><div className="grid grid-cols-3 gap-1.5 sm:min-w-[16rem] sm:gap-2"><MetricBox value={safeSummary.items} label="Items" icon="dashboard" /><MetricBox value={safeSummary.score} label="Score" icon="explore" /><MetricBox value={safeSummary.done} label="Done" icon="info" /></div></div><div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-2 xl:grid-cols-4">{safeSummary.categories.map((category) => <TopContentTile key={category.title} group={group} category={category} onOpenItem={onOpenItem} onOpenList={onOpenList} />)}</div></div>
}

function GroupCard({ group, summary, summaryLoading, onCopy, onOpen, onOpenItem, onOpenList }) {
  const memberCount = group.members?.length || 1
  const tint = groupTint(group)
  return <article className={`relative overflow-hidden rounded-[1.35rem] border p-3 text-white shadow-xl shadow-black/10 backdrop-blur transition sm:rounded-[1.65rem] sm:p-4 ${tint.card}`}><span aria-hidden="true" className={`pointer-events-none absolute inset-y-4 left-0 w-1 rounded-r-full bg-gradient-to-b ${tint.rail}`} /><span aria-hidden="true" className={`pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full blur-3xl ${tint.glow}`} /><div className="relative z-10"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><p className={`text-[9px] font-black uppercase tracking-[0.22em] sm:text-[10px] sm:tracking-[0.24em] ${tint.label}`}>{group.isPublic ? 'Public clique' : 'Private clique'}</p><h2 className="mt-1 truncate text-xl font-black leading-tight sm:text-2xl">{group.name}</h2><div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-400 lg:hidden"><MemberAvatars members={group.members || []} /><span className="rounded-full border border-white/10 bg-black/10 px-2.5 py-1 text-[11px] font-bold backdrop-blur">{memberCount} {memberCount === 1 ? 'member' : 'members'}</span><button type="button" onClick={() => onCopy(group)} aria-label={`Copy invite for ${group.name}`} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/10 text-white backdrop-blur transition hover:bg-white hover:text-neutral-950"><AppIcon name="link" size={15} /></button><Link to={getGroupOpenPath(group)} onClick={() => onOpen(group)} aria-label={`Open ${group.name}`} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-black text-neutral-950 transition hover:bg-neutral-200"><AppIcon name="explore" size={15} />Open</Link></div><div className="mt-3 hidden flex-wrap items-end gap-3 text-xs text-neutral-400 lg:flex"><MemberAvatars members={group.members || []} /><span className="mb-1 rounded-full border border-white/10 bg-black/10 px-2.5 py-1 font-bold backdrop-blur">{memberCount} {memberCount === 1 ? 'member' : 'members'}</span></div></div><div className="hidden shrink-0 flex-wrap gap-2 lg:flex"><button type="button" onClick={() => onCopy(group)} aria-label={`Copy invite for ${group.name}`} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/10 text-white backdrop-blur transition hover:bg-white hover:text-neutral-950"><AppIcon name="link" size={16} /></button><Link to={getGroupOpenPath(group)} onClick={() => onOpen(group)} aria-label={`Open ${group.name}`} className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-black text-neutral-950 transition hover:bg-neutral-200"><AppIcon name="explore" size={16} />Open</Link></div></div><GroupContentOverview group={group} summary={summary} loading={summaryLoading} onOpenItem={onOpenItem} onOpenList={onOpenList} /></div></article>
}

function MobileCliquePickerCard({ group, summary, active, onSelect, index, total }) {
  const memberCount = group.members?.length || 1
  const tint = groupTint(group)
  const safeSummary = summary || emptyGroupSummary()
  return (
    <button type="button" onClick={() => onSelect(group.id)} className={`relative h-28 w-[9.75rem] shrink-0 snap-start overflow-hidden rounded-[1.2rem] border p-3 text-left shadow-lg shadow-black/10 backdrop-blur transition ${tint.card} ${active ? 'scale-[1.02] ring-1 ring-white/35' : 'opacity-75 hover:opacity-100'}`}>
      <span aria-hidden="true" className={`pointer-events-none absolute inset-y-3 left-0 w-1 rounded-r-full bg-gradient-to-b ${tint.rail}`} />
      <span aria-hidden="true" className={`pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full blur-2xl ${tint.glow}`} />
      <span className={`relative block text-[8px] font-black uppercase tracking-[0.18em] ${tint.label}`}>{group.isPublic ? 'Public' : 'Private'}</span>
      <span className="relative mt-1 block truncate text-sm font-black leading-tight text-white">{group.name}</span>
      <span className="relative mt-3 flex items-center gap-1.5 text-[10px] font-bold text-neutral-300"><span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white text-[8px] font-black text-neutral-950">{memberInitial(group.members?.[0] || group.name)}</span>{memberCount} {memberCount === 1 ? 'member' : 'members'}</span>
      <span className="relative mt-2 inline-flex rounded-full border border-white/10 bg-black/15 px-2 py-0.5 text-[10px] font-bold text-neutral-300">{safeSummary.items} items</span>
      <span className="absolute bottom-3 right-3 text-[10px] font-black text-white/45">{index + 1}/{total}</span>
    </button>
  )
}

function MobileCliqueBrowser({ groups, activeGroupId, setActiveGroupId, groupSummaries, summariesLoading, onCopy, onOpen, onOpenItem, onOpenList }) {
  const activeGroup = groups.find((group) => group.id === activeGroupId) || groups[0]
  if (!groups.length) return <div className="rounded-[1.65rem] border border-dashed border-white/15 bg-white/[0.03] p-8 text-center text-neutral-400">No cliques match your search.</div>
  return (
    <div className="lg:hidden">
      <div className="-mx-3 overflow-x-auto px-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex snap-x snap-mandatory gap-2.5">
          {groups.map((group, index) => <MobileCliquePickerCard key={group.id} group={group} summary={groupSummaries[group.id]} active={(activeGroup?.id || '') === group.id} onSelect={setActiveGroupId} index={index} total={groups.length} />)}
        </div>
      </div>
      <p className="mt-1 px-1 text-[11px] font-bold text-neutral-500">Swipe cliques above, then use the selected clique below.</p>
      {activeGroup ? <div className="mt-3"><GroupCard group={activeGroup} summary={groupSummaries[activeGroup.id]} summaryLoading={summariesLoading} onCopy={onCopy} onOpen={onOpen} onOpenItem={onOpenItem} onOpenList={onOpenList} /></div> : null}
    </div>
  )
}

function CompactCreateForm({ draftGroup, setDraftGroup, loading, onCreate }) {
  return <form onSubmit={onCreate} className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-white/10 bg-neutral-950/70 p-1.5"><span className="ml-3 hidden text-neutral-500 sm:inline-flex"><AppIcon name="users" size={18} /></span><input value={draftGroup} onChange={(event) => setDraftGroup(event.target.value)} placeholder="New clique name" className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-500" /><button disabled={loading} aria-label="Create clique" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-lg font-black text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-60">+</button></form>
}

function CompactInviteForm({ value, setValue, loading, onJoin, readOnly = false }) {
  return <div className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-white/10 bg-neutral-950/70 p-1.5"><span className="ml-3 hidden text-neutral-500 sm:inline-flex"><AppIcon name="link" size={18} /></span><input value={value} onChange={(event) => setValue?.(event.target.value)} readOnly={readOnly} placeholder="Invite link or code" className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-500" /><button type="button" disabled={loading} onClick={onJoin} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-white/10 px-4 text-sm font-black text-white transition hover:bg-white hover:text-neutral-950 disabled:opacity-60">Join</button></div>
}

function CliqueMobileTools({ inviteMode, inviteCode, groupsCount, visibleCount, toolsOpen, setToolsOpen, cliqueSearch, setCliqueSearch, draftGroup, setDraftGroup, manualInvite, setManualInvite, loading, handleCreate, joinInvite }) {
  return (
    <section className="mb-3 lg:hidden">
      <button type="button" onClick={() => setToolsOpen((open) => !open)} className="flex w-full items-center justify-between rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-left text-white shadow-xl shadow-black/15 backdrop-blur">
        <span className="inline-flex items-center gap-2 text-sm font-black"><AppIcon name="users" size={16} />{inviteMode ? 'Join invite' : 'Cliques'}</span>
        <span className="inline-flex items-center gap-2 text-xs font-bold text-neutral-400"><span className="rounded-full border border-white/10 px-2 py-0.5">{groupsCount}</span><AppIcon name="chevronDown" size={15} className={`transition ${toolsOpen ? 'rotate-180' : ''}`} /></span>
      </button>
      {toolsOpen ? (
        <div className="mt-2 space-y-2 rounded-[1.25rem] border border-white/10 bg-white/[0.035] p-2.5 shadow-xl shadow-black/15 backdrop-blur">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-neutral-950/70 px-3 py-2">
            <input value={cliqueSearch} onChange={(event) => setCliqueSearch(event.target.value)} placeholder="Search cliques..." className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-neutral-500" />
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] font-bold text-neutral-300">{visibleCount}/{groupsCount}</span>
          </div>
          {inviteMode ? <CompactInviteForm value={inviteCode || ''} readOnly loading={loading} onJoin={() => joinInvite(inviteCode)} /> : <><CompactCreateForm draftGroup={draftGroup} setDraftGroup={setDraftGroup} loading={loading} onCreate={handleCreate} /><CompactInviteForm value={manualInvite} setValue={setManualInvite} loading={loading} onJoin={() => joinInvite(manualInvite)} /></>}
        </div>
      ) : null}
    </section>
  )
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
  const [toolsOpen, setToolsOpen] = useState(inviteMode)
  const [activeMobileGroupId, setActiveMobileGroupId] = useState('')
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
      } catch (error) { if (!cancelled) { setGroupSummaries(Object.fromEntries(groups.map((group) => [group.id, emptyGroupSummary()]))); showMessage(error.message || 'Could not load clique overviews.', 'error') } }
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
  useEffect(() => {
    if (!visibleGroups.length) { if (activeMobileGroupId) setActiveMobileGroupId(''); return }
    if (!visibleGroups.some((group) => group.id === activeMobileGroupId)) setActiveMobileGroupId(visibleGroups[0].id)
  }, [visibleGroups, activeMobileGroupId])
  function showMessage(text, type = 'success') { setMessage({ text, type }); setTimeout(() => setMessage(null), 2600) }
  function activateGroup(group) { setActiveGroup(group.id); if (typeof window !== 'undefined') window.localStorage.setItem(ACTIVE_GROUP_STORAGE_KEY, group.id) }

  async function handleCreate(event) {
    event.preventDefault()
    const activeHandle = handle || getSavedHandle() || 'anonymous'
    setLoading(true)
    try { const created = session?.user && hasSupabase ? await createRemoteGroup(draftGroup || `${activeHandle}'s clique`, activeHandle) : createLocalGroup(draftGroup || `${activeHandle}'s clique`, activeHandle); activateGroup(created); setDraftGroup(''); setActiveMobileGroupId(created.id); await refresh(); showMessage(`${created.name} is ready to share.`) }
    catch (error) { showMessage(error.message || 'Could not create clique.', 'error') }
    finally { setLoading(false) }
  }

  async function joinInvite(codeToJoin = inviteCode || manualInvite) {
    const parsed = parseInviteCode(codeToJoin)
    if (!parsed) { showMessage('Paste an invite link or code first.', 'error'); return }
    if (hasSupabase && !session?.user) { showMessage('Sign in from Profile first, then use this invite link again.', 'error'); return }
    const activeHandle = handle || getSavedHandle() || 'anonymous'
    setLoading(true)
    try { const joined = session?.user && hasSupabase ? await joinRemoteGroup(parsed, activeHandle) : joinLocalGroup(parsed, activeHandle); if (!joined) throw new Error('Could not join that invite.'); activateGroup(joined); setManualInvite(''); setActiveMobileGroupId(joined.id); await refresh(); showMessage(`Joined ${joined.name}.`) }
    catch (error) { showMessage(error.message || 'Could not join that invite.', 'error') }
    finally { setLoading(false) }
  }

  function openList(group, category) { activateGroup(group); if (category?.to && typeof window !== 'undefined') window.location.href = scopeMediaPath(group, category) }
  async function copyInvite(group) { const copied = await copyToClipboard(getGroupInviteUrl(group)); showMessage(copied ? 'Invite link copied.' : `Invite path: ${getGroupInvitePath(group)}`) }

  return <PageShell active="groups"><CliqueMobileTools inviteMode={inviteMode} inviteCode={inviteCode} groupsCount={groups.length} visibleCount={visibleGroups.length} toolsOpen={toolsOpen} setToolsOpen={setToolsOpen} cliqueSearch={cliqueSearch} setCliqueSearch={setCliqueSearch} draftGroup={draftGroup} setDraftGroup={setDraftGroup} manualInvite={manualInvite} setManualInvite={setManualInvite} loading={loading} handleCreate={handleCreate} joinInvite={joinInvite} /><section className="mb-4 hidden rounded-[1.65rem] border border-white/10 bg-white/[0.03] p-3 shadow-xl shadow-black/15 backdrop-blur lg:block"><div className="flex flex-col gap-2 lg:flex-row lg:items-center"><div className="flex shrink-0 items-center justify-between gap-3 rounded-full border border-white/10 bg-neutral-950/70 px-4 py-3 text-sm font-black text-white lg:w-auto"><span className="inline-flex items-center gap-2"><AppIcon name="users" size={17} />{inviteMode ? 'Join invite' : 'Cliques'}</span><span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-neutral-400">{groups.length}</span></div><div className="flex min-w-0 flex-1 flex-col gap-2 lg:flex-row">{inviteMode ? <CompactInviteForm value={inviteCode || ''} readOnly loading={loading} onJoin={() => joinInvite(inviteCode)} /> : <><CompactCreateForm draftGroup={draftGroup} setDraftGroup={setDraftGroup} loading={loading} onCreate={handleCreate} /><CompactInviteForm value={manualInvite} setValue={setManualInvite} loading={loading} onJoin={() => joinInvite(manualInvite)} /></>}</div></div></section><StatusMessage message={message} />{inviteMode ? <section className="mb-4 rounded-[1.65rem] border border-white/10 bg-white/[0.03] p-5 text-neutral-300">{hasSupabase && !session?.user ? <>This invite is ready. Sign in from <strong className="text-white">Profile</strong>, then come back to this link and press Join.</> : inviteGroup ? <>Invite found for <strong className="text-white">{inviteGroup.name}</strong>. Press Join to add it to your cliques.</> : <>Press Join to accept this invite. The clique will be added to your cliques.</>}</section> : null}<section className="space-y-3"><div className="flex items-center justify-between gap-3 px-1 lg:items-center"><div><h2 className="text-xl font-black text-white sm:text-2xl">Joined cliques</h2><p className="mt-0.5 text-xs font-bold text-neutral-500 lg:hidden">{visibleGroups.length}/{groups.length} shown</p></div><div className="hidden min-w-0 flex-col gap-2 sm:flex-row sm:items-center lg:flex"><input value={cliqueSearch} onChange={(event) => setCliqueSearch(event.target.value)} placeholder="Search cliques..." className="min-w-0 rounded-2xl border border-white/10 bg-neutral-950 px-4 py-2.5 text-sm text-white outline-none" /><span className="w-fit rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-neutral-300">{visibleGroups.length}/{groups.length}</span></div></div>{visibleGroups.length ? <><MobileCliqueBrowser groups={visibleGroups} activeGroupId={activeMobileGroupId} setActiveGroupId={setActiveMobileGroupId} groupSummaries={groupSummaries} summariesLoading={summariesLoading} onCopy={copyInvite} onOpen={activateGroup} onOpenItem={setSelectedItem} onOpenList={openList} /><div className="hidden space-y-3 lg:block">{visibleGroups.map((group) => <GroupCard key={group.id} group={group} summary={groupSummaries[group.id]} summaryLoading={summariesLoading} onCopy={copyInvite} onOpen={activateGroup} onOpenItem={setSelectedItem} onOpenList={openList} />)}</div></> : <div className="rounded-[1.65rem] border border-dashed border-white/15 bg-white/[0.03] p-8 text-center text-neutral-400">No cliques match your search.</div>}</section><InfoModal item={selectedItem} onClose={() => setSelectedItem(null)} year={displayYear(selectedItem?.released || selectedItem?.year)} backdrop={selectedItem?.backdrop || selectedItem?.poster}><div className="mt-4 flex flex-wrap gap-2"><DetailPill>{selectedItem?.category}</DetailPill><DetailPill>Score {selectedItem?.score || 0}</DetailPill><DetailPill>{selectedItem?.picks || 0} picks</DetailPill>{selectedItem?.rating ? <DetailPill>Rating ★ {Number(selectedItem.rating).toFixed(1)}</DetailPill> : null}{selectedItem?.runtime ? <DetailPill>{selectedItem.runtime} min</DetailPill> : null}{selectedItem?.seasons ? <DetailPill>{selectedItem.seasons} seasons</DetailPill> : null}{selectedItem?.episodes ? <DetailPill>{selectedItem.episodes} episodes</DetailPill> : null}{selectedItem?.platform ? <DetailPill>{selectedItem.platform}</DetailPill> : null}{selectedItem?.genres?.map((genre) => <DetailPill key={genre}>{genre}</DetailPill>)}{selectedItem?.platforms?.map((platform) => <DetailPill key={platform}>{platform}</DetailPill>)}</div><p className="mt-5 text-sm leading-7 text-neutral-300">{selectedItem?.overview || selectedItem?.description || 'No description available yet.'}</p>{selectedItem?.url ? <a href={selectedItem.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-neutral-200">Open video</a> : null}</InfoModal></PageShell>
}
