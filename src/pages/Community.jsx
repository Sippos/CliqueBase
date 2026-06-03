import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import BlockedMembersPanel from '../components/BlockedMembersPanel.jsx'
import MemberShareModal from '../components/MemberShareModal.jsx'
import PageShell from '../components/PageShell.jsx'
import TonightMode from '../components/TonightMode.jsx'
import { getActiveGroupId } from '../lib/groups.js'
import { addMediaComment, createRecommendationNote, getSocialActivity } from '../lib/communityActivity.js'
import { getFriendsList } from '../lib/communityShare.js'
import { getCurrentSession, getGames, getMovies, getRemoteGroups, getSeries, hasSupabase } from '../lib/supabaseClient.js'
import { blockUser, reportContent } from '../lib/safety.js'

const priorities = [
  { value: 'must', label: 'Must try' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'later', label: 'Later' },
]

const feedFilters = [
  { key: 'all', label: 'All' },
  { key: 'friends', label: 'Friends' },
  { key: 'cliques', label: 'Cliques' },
  { key: 'mine', label: 'Mine' },
]

const reportReasons = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'spoiler', label: 'Spoiler' },
  { value: 'unsafe', label: 'Unsafe' },
  { value: 'other', label: 'Other' },
]

const contentTypeMeta = {
  movie: { label: 'Movies', icon: '🎬' },
  series: { label: 'Series', icon: '📺' },
  game: { label: 'Games', icon: '🎮' },
  video: { label: 'Videos', icon: '▶️' },
  music: { label: 'Music', icon: '🎧' },
  other: { label: 'Other', icon: '✨' },
}

function relativeTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const diff = Date.now() - date.getTime()
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

function activityVerb(activity) {
  if (activity.type === 'recommendation_note') return 'recommended'
  if (activity.type === 'media_comment') return 'commented on'
  if (activity.type === 'media_share') return 'shared'
  if (activity.type === 'library_add') return activity.groupId ? 'added to a clique' : 'saved'
  if (activity.type === 'completed') return 'finished'
  if (activity.type === 'clique_join') return 'joined'
  if (activity.type === 'friend_accept') return 'became friends with'
  if (activity.type === 'rating') return 'rated'
  if (activity.type === 'vote') return activity.payload?.vote === 'pass' ? 'passed on' : 'voted for'
  if (activity.payload?.kind === 'poll_created') return 'started a poll'
  return 'updated'
}

function payloadText(activity) {
  const payload = activity.payload || {}
  if (activity.type === 'recommendation_note') return payload.note || ''
  if (activity.type === 'media_comment') return payload.body || ''
  if (activity.type === 'rating' && payload.rating) return `${payload.rating}/10`
  if (activity.type === 'vote') return payload.vote === 'pass' ? 'Passed in their library.' : `Ranked it up${payload.score !== undefined && payload.score !== null ? ` · score ${payload.score}` : ''}.`
  if (activity.type === 'friend_accept') return payload.friendName ? `Now friends with ${payload.friendName}.` : ''
  if (activity.type === 'library_add') return activity.groupId ? 'Added to the shared clique library.' : 'Saved to personal library.'
  if (activity.type === 'completed') return payload.rating ? `Done · ${payload.rating}/10` : 'Marked done.'
  return payload.message || ''
}

function activityRank(type) {
  if (type === 'rating') return 7
  if (type === 'completed') return 6
  if (type === 'vote') return 5
  if (type === 'recommendation_note') return 4
  if (type === 'library_add') return 3
  return 1
}

function activityKey(activity) {
  if (!activity?.itemId || !activity?.actorId || activity.itemType === 'profile') return activity?.id
  return [activity.actorId, activity.groupId || 'personal', activity.itemType || 'item', activity.itemId].join(':')
}

function collapseActivity(items) {
  const byKey = new Map()
  items.forEach((item) => {
    const key = activityKey(item)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, item)
      return
    }
    const itemTime = new Date(item.createdAt || 0).getTime() || 0
    const existingTime = new Date(existing.createdAt || 0).getTime() || 0
    const itemScore = activityRank(item.type) * 10000000000000 + itemTime
    const existingScore = activityRank(existing.type) * 10000000000000 + existingTime
    if (itemScore > existingScore) byKey.set(key, item)
  })
  return Array.from(byKey.values()).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
}

function normalizeLibraryItems(movies = [], series = [], games = []) {
  return [
    ...movies.map((item) => ({ ...item, itemType: 'movie', label: 'Movie' })),
    ...series.map((item) => ({ ...item, itemType: 'series', label: 'Series' })),
    ...games.map((item) => ({ ...item, itemType: 'game', label: 'Game' })),
  ]
    .filter((item) => item.id && item.title)
    .sort((a, b) => String(a.title).localeCompare(String(b.title)))
}

function groupedLibraryItems(libraryItems = []) {
  return ['movie', 'series', 'game'].map((type) => ({
    type,
    ...contentTypeMeta[type],
    items: libraryItems.filter((item) => item.itemType === type),
  })).filter((group) => group.items.length)
}

function itemArtwork(item) {
  return item.poster || item.backdrop || item.image || item.cover || ''
}

function shareableType(activity) {
  const type = String(activity?.itemType || activity?.payload?.itemType || '').toLowerCase()
  return ['movie', 'series', 'game', 'video'].includes(type) ? type : ''
}

function shareItemFromActivity(activity) {
  if (!activity) return null
  const payload = activity.payload || {}
  return {
    id: activity.itemId || activity.id,
    type: shareableType(activity),
    category: shareableType(activity),
    title: activity.title || 'CliqueBase pick',
    poster: payload.poster || null,
    backdrop: payload.backdrop || null,
    overview: payload.overview || payloadText(activity),
    url: payload.url || '',
    groupId: activity.groupId || null,
    groupName: activity.groupName || '',
  }
}

function feedImage(activity) {
  const payload = activity.payload || {}
  return payload.poster || payload.backdrop || ''
}

function EmptyCommunity({ signedIn, filter }) {
  const copy = filter === 'friends'
    ? 'Add friends or accept requests to fill this tab.'
    : filter === 'cliques'
      ? 'Join or create a clique to see shared-room activity here.'
      : filter === 'mine'
        ? 'Your own recommendations, saves, ratings, votes, and shares will show here.'
        : signedIn ? 'Save, vote, rate, recommend, or add friends to start the feed.' : 'Sign in to see friend activity.'
  return (
    <section className="rounded-[1.25rem] border border-dashed border-white/10 bg-white/[0.025] p-5 text-center">
      <h2 className="text-lg font-black text-white">No posts yet</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-neutral-500">{copy}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <a href="#recommend" className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-neutral-950">Recommend something</a>
        <a href="#people" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-black text-white">Find people</a>
        <Link to="/groups" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-black text-white">Cliques</Link>
      </div>
    </section>
  )
}

function ActivityCommentForm({ activity, signedIn, onCommented, onFlash }) {
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!signedIn) {
      onFlash('Sign in to comment.')
      return
    }
    setSaving(true)
    try {
      await addMediaComment({ itemType: activity.itemType || 'other', itemId: activity.itemId || `${activity.type}:${activity.id}`, title: activity.title, body, groupId: activity.groupId || null })
      setBody('')
      onCommented?.()
    } catch (error) {
      onFlash(error.message || 'Could not post comment.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex gap-2 border-t border-white/10 pt-3">
      <input value={body} onChange={(event) => setBody(event.target.value)} placeholder={signedIn ? 'Reply…' : 'Sign in to reply'} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-xs text-white outline-none placeholder:text-neutral-600" />
      <button disabled={saving || !body.trim() || !signedIn} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-neutral-300 transition hover:bg-white hover:text-neutral-950 disabled:opacity-45">{saving ? '…' : 'Reply'}</button>
    </form>
  )
}

function ActivityReportForm({ activity, signedIn, onFlash, onBlocked }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('spam')
  const [details, setDetails] = useState('')
  const [saving, setSaving] = useState(false)
  const [blocking, setBlocking] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!signedIn) {
      onFlash('Sign in to report content.')
      return
    }
    setSaving(true)
    try {
      await reportContent({ actorId: activity.actorId || null, groupId: activity.groupId || null, itemType: 'activity', itemId: activity.id || activity.itemId || '', reason, details })
      setOpen(false)
      setDetails('')
      setReason('spam')
      onFlash('Report sent.')
    } catch (error) {
      onFlash(error.message || 'Could not submit report.')
    } finally {
      setSaving(false)
    }
  }

  async function handleBlock() {
    if (!signedIn) {
      onFlash('Sign in to block members.')
      return
    }
    if (!activity.actorId) {
      onFlash('No member to block.')
      return
    }
    setBlocking(true)
    try {
      await blockUser(activity.actorId)
      setOpen(false)
      onFlash(`${activity.actorDisplayName || 'Member'} blocked.`)
      onBlocked?.()
    } catch (error) {
      onFlash(error.message || 'Could not block member.')
    } finally {
      setBlocking(false)
    }
  }

  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen((value) => !value)} className="text-[11px] font-bold text-neutral-600 transition hover:text-neutral-300">{open ? 'Cancel' : 'Report / block'}</button>
      {open ? (
        <div className="mt-3 grid gap-2 rounded-2xl border border-white/10 bg-neutral-950/75 p-3">
          <form onSubmit={handleSubmit} className="grid gap-2">
            <div className="grid gap-2 sm:grid-cols-[9rem_1fr]">
              <select value={reason} onChange={(event) => setReason(event.target.value)} className="rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-white outline-none">{reportReasons.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
              <input value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Optional note" className="rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-600" />
            </div>
            <button disabled={saving || !signedIn} className="rounded-xl border border-red-300/20 px-3 py-2 text-xs font-black text-red-100 transition hover:bg-red-500 hover:text-white disabled:opacity-50">{saving ? 'Sending…' : 'Submit report'}</button>
          </form>
          <button type="button" disabled={blocking || !signedIn || !activity.actorId} onClick={handleBlock} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-neutral-300 transition hover:bg-white hover:text-neutral-950 disabled:opacity-50">{blocking ? 'Blocking…' : `Block ${activity.actorDisplayName || 'member'}`}</button>
        </div>
      ) : null}
    </div>
  )
}

function ActivityCard({ activity, signedIn, onCommented, onFlash, onShare }) {
  const text = payloadText(activity)
  const image = feedImage(activity)
  const canShare = Boolean(shareableType(activity))
  const actor = activity.actorId ? <Link to={`/members/${activity.actorId}`} className="font-black text-white hover:underline">{activity.actorDisplayName}</Link> : <span className="font-black text-white">{activity.actorDisplayName}</span>
  const friendTarget = activity.type === 'friend_accept' ? activity.title : ''

  return (
    <article className="rounded-[1.15rem] border border-white/10 bg-white/[0.025] p-3 transition hover:border-white/20 hover:bg-white/[0.04]">
      <div className="flex gap-3">
        {image && activity.type !== 'friend_accept' ? <img src={image} alt="" className="h-20 w-14 shrink-0 rounded-xl object-cover sm:h-24 sm:w-16" /> : null}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-400">
            {actor}
            <span>{activityVerb(activity)}</span>
            {friendTarget ? <span className="font-black text-white">{friendTarget}</span> : null}
            {activity.groupName ? <Link to={`/cliques/${encodeURIComponent(activity.groupId)}`} className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold text-neutral-300 hover:bg-white hover:text-neutral-950">{activity.groupName}</Link> : null}
            <span className="text-[11px] text-neutral-600">{relativeTime(activity.createdAt)}</span>
          </div>
          {activity.type !== 'friend_accept' ? <h3 className="mt-1 text-base font-black leading-tight text-white sm:text-lg">{activity.title}</h3> : null}
          {text ? <p className="mt-2 rounded-xl border border-white/10 bg-neutral-950/45 p-2 text-xs leading-5 text-neutral-300 sm:text-sm">{text}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {canShare ? <button type="button" onClick={() => onShare(activity)} className="rounded-xl border border-white/10 px-3 py-1.5 text-xs font-black text-neutral-300 transition hover:bg-white hover:text-neutral-950">Share</button> : null}
            {activity.actorId ? <Link to={`/members/${activity.actorId}`} className="rounded-xl border border-white/10 px-3 py-1.5 text-xs font-black text-neutral-300 transition hover:bg-white hover:text-neutral-950">Profile</Link> : null}
          </div>
        </div>
      </div>
      <ActivityCommentForm activity={activity} signedIn={signedIn} onCommented={onCommented} onFlash={onFlash} />
      <ActivityReportForm activity={activity} signedIn={signedIn} onFlash={onFlash} onBlocked={onCommented} />
    </article>
  )
}

function RecommendationComposer({ groups, friends, libraryItems, signedIn, onCreated, onFlash }) {
  const activeGroupId = getActiveGroupId()
  const [expanded, setExpanded] = useState(false)
  const [selectedLibraryKey, setSelectedLibraryKey] = useState('')
  const [title, setTitle] = useState('')
  const [itemType, setItemType] = useState('movie')
  const [itemId, setItemId] = useState('')
  const [note, setNote] = useState('')
  const [priority, setPriority] = useState('maybe')
  const [audience, setAudience] = useState(activeGroupId ? `group:${activeGroupId}` : 'feed')
  const [saving, setSaving] = useState(false)
  const groupsByType = useMemo(() => groupedLibraryItems(libraryItems), [libraryItems])

  function handleLibrarySelect(value) {
    setSelectedLibraryKey(value)
    if (!value) return
    const item = libraryItems.find((entry) => `${entry.itemType}:${entry.id}` === value)
    if (!item) return
    setTitle(item.title)
    setItemType(item.itemType)
    setItemId(String(item.id))
  }

  function audienceTarget() {
    if (audience.startsWith('group:')) return { groupId: audience.slice(6), recommendedTo: null }
    if (audience.startsWith('friend:')) return { groupId: null, recommendedTo: audience.slice(7) }
    return { groupId: null, recommendedTo: null }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!signedIn) {
      onFlash('Sign in to post recommendations.')
      return
    }
    setSaving(true)
    try {
      const target = audienceTarget()
      await createRecommendationNote({ title, itemType, itemId, note, moodTags: [], priority, groupId: target.groupId, recommendedTo: target.recommendedTo })
      setSelectedLibraryKey('')
      setTitle('')
      setItemId('')
      setNote('')
      onCreated?.()
    } catch (error) {
      onFlash(error.message || 'Could not post recommendation.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section id="recommend" className="scroll-mt-24 rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-4 text-white">
      <button type="button" onClick={() => setExpanded((value) => !value)} className="flex w-full items-center justify-between gap-3 text-left">
        <span>
          <span className="block text-lg font-black">Recommend</span>
          <span className="mt-1 block text-xs text-neutral-400">Post to the feed, a clique, or a friend.</span>
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-black text-neutral-100">{expanded ? 'Hide' : 'Open'}</span>
      </button>

      {expanded ? (
        <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
          {groupsByType.length ? (
            <div className="grid gap-2">
              <select value={selectedLibraryKey} onChange={(event) => handleLibrarySelect(event.target.value)} className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-sm text-white outline-none">
                <option value="">Choose from your library…</option>
                {groupsByType.map((group) => (
                  <optgroup key={group.type} label={`${group.icon} ${group.label}`}>
                    {group.items.map((item) => <option key={`${item.itemType}:${item.id}`} value={`${item.itemType}:${item.id}`}>{item.title}</option>)}
                  </optgroup>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                {groupsByType.flatMap((group) => group.items.slice(0, 3)).slice(0, 6).map((item) => {
                  const key = `${item.itemType}:${item.id}`
                  const selected = key === selectedLibraryKey
                  return (
                    <button key={key} type="button" onClick={() => handleLibrarySelect(key)} className={`flex items-center gap-2 rounded-2xl border p-2 text-left transition ${selected ? 'border-white bg-white text-neutral-950' : 'border-white/10 bg-black/20 text-white hover:bg-white/10'}`}>
                      {itemArtwork(item) ? <img src={itemArtwork(item)} alt="" className="h-12 w-9 shrink-0 rounded-lg object-cover" /> : <span className="grid h-12 w-9 shrink-0 place-items-center rounded-lg bg-white/10 text-lg">{contentTypeMeta[item.itemType]?.icon || '✨'}</span>}
                      <span className="min-w-0"><span className="block truncate text-xs font-black">{item.title}</span><span className="text-[10px] uppercase tracking-[0.14em] opacity-60">{item.label}</span></span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}
          <input value={title} onChange={(event) => { setTitle(event.target.value); setSelectedLibraryKey('') }} placeholder="Or type a title" className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-600" />
          <div className="grid gap-3 sm:grid-cols-2">
            <select value={itemType} onChange={(event) => setItemType(event.target.value)} className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-sm text-white outline-none">
              {Object.entries(contentTypeMeta).map(([value, meta]) => <option key={value} value={value}>{meta.icon} {meta.label}</option>)}
            </select>
            <select value={priority} onChange={(event) => setPriority(event.target.value)} className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-sm text-white outline-none">{priorities.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          </div>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Why is it worth it?" rows={3} className="resize-none rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-600" />
          <select value={audience} onChange={(event) => setAudience(event.target.value)} className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-sm text-white outline-none">
            <option value="feed">Post to feed</option>
            {groups.length ? <optgroup label="Cliques">{groups.map((group) => <option key={group.id} value={`group:${group.id}`}>{group.name}</option>)}</optgroup> : null}
            {friends.length ? <optgroup label="Friends">{friends.map((friend) => <option key={friend.id} value={`friend:${friend.id}`}>{friend.displayName}</option>)}</optgroup> : null}
          </select>
          <button disabled={saving || !signedIn || !title.trim()} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-50">{saving ? 'Posting…' : signedIn ? 'Post recommendation' : 'Sign in to post'}</button>
        </form>
      ) : null}
    </section>
  )
}

export default function Community() {
  const [session, setSession] = useState(null)
  const [groups, setGroups] = useState([])
  const [activity, setActivity] = useState([])
  const [friends, setFriends] = useState([])
  const [libraryItems, setLibraryItems] = useState([])
  const [feedFilter, setFeedFilter] = useState('all')
  const [feedLimit, setFeedLimit] = useState(80)
  const [sharingActivity, setSharingActivity] = useState(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const signedIn = hasSupabase && Boolean(session?.user)
  const friendIds = useMemo(() => new Set(friends.map((friend) => friend.id).filter(Boolean)), [friends])
  const currentUserId = session?.user?.id || ''
  const filteredActivity = useMemo(() => activity.filter((item) => {
    if (feedFilter === 'friends') return friendIds.has(item.actorId) || item.payload?.recommendedTo === currentUserId
    if (feedFilter === 'cliques') return Boolean(item.groupId)
    if (feedFilter === 'mine') return item.actorId && item.actorId === currentUserId
    return true
  }), [activity, feedFilter, friendIds, currentUserId])
  const visibleActivity = useMemo(() => collapseActivity(filteredActivity), [filteredActivity])

  function flash(text) {
    setMessage(text)
    setTimeout(() => setMessage(''), 2600)
  }

  async function refresh(limit = feedLimit) {
    setLoading(true)
    try {
      const nextSession = hasSupabase ? await getCurrentSession().catch(() => null) : null
      setSession(nextSession)
      if (!nextSession?.user) {
        setActivity([])
        setGroups([])
        setFriends([])
        setLibraryItems([])
        return
      }
      const [nextGroups, nextActivity, nextFriends, movies, series, games] = await Promise.all([
        getRemoteGroups().catch(() => []),
        getSocialActivity({ limit, includePublic: true }).catch(() => []),
        getFriendsList().catch(() => []),
        getMovies(null).catch(() => []),
        getSeries(null).catch(() => []),
        getGames(null).catch(() => []),
      ])
      setGroups(nextGroups)
      setActivity(nextActivity)
      setFriends(nextFriends)
      setLibraryItems(normalizeLibraryItems(movies, series, games))
    } catch (error) {
      flash(error.message || 'Could not load feed.')
    } finally {
      setLoading(false)
    }
  }

  function loadMore() {
    const nextLimit = feedLimit + 40
    setFeedLimit(nextLimit)
    refresh(nextLimit)
  }

  useEffect(() => { refresh() }, [])

  return (
    <PageShell active="community">
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
        <main className="min-w-0">
          <section className="mb-3 rounded-[1.25rem] border border-white/10 bg-white/[0.025] p-4 text-white">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-xl font-black tracking-tight sm:text-2xl">Feed from cliques and friends</p><p className="mt-1 text-sm text-neutral-500">What friends saved, rated, recommended, and shared.</p></div>
              <button type="button" onClick={() => refresh()} className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-black text-neutral-300 transition hover:bg-white hover:text-neutral-950">Refresh</button>
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{feedFilters.map((filter) => <button key={filter.key} type="button" onClick={() => setFeedFilter(filter.key)} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black transition ${feedFilter === filter.key ? 'border-white bg-white text-neutral-950' : 'border-white/10 text-neutral-400 hover:bg-white hover:text-neutral-950'}`}>{filter.label}</button>)}</div>
          </section>
          <div className="grid gap-2">{loading ? <p className="rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4 text-sm text-neutral-400">Loading feed…</p> : visibleActivity.length ? visibleActivity.map((item) => <ActivityCard key={item.id} activity={item} signedIn={signedIn} onCommented={() => refresh()} onFlash={flash} onShare={setSharingActivity} />) : <EmptyCommunity signedIn={signedIn} filter={feedFilter} />}</div>
          {signedIn && activity.length >= feedLimit ? <button type="button" onClick={loadMore} className="mt-4 w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-neutral-300 transition hover:bg-white hover:text-neutral-950">Load more</button> : null}
        </main>
        <aside className="grid gap-4 lg:sticky lg:top-28">
          <div id="people" className="scroll-mt-24"><BlockedMembersPanel signedIn={signedIn} defaultOpen onFlash={flash} onChanged={() => refresh()} /></div>
          <RecommendationComposer groups={groups} friends={friends} libraryItems={libraryItems} signedIn={signedIn} onCreated={() => refresh()} onFlash={flash} />
          <div id="tonight" className="scroll-mt-24"><TonightMode groups={groups} libraryItems={libraryItems} signedIn={signedIn} onFlash={flash} /></div>
        </aside>
      </div>
      <MemberShareModal item={sharingActivity ? shareItemFromActivity(sharingActivity) : null} type={sharingActivity ? shareableType(sharingActivity) : ''} onClose={() => setSharingActivity(null)} onMessage={flash} />
      {message ? <div className="fixed bottom-5 left-1/2 z-[90] -translate-x-1/2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950 shadow-2xl">{message}</div> : null}
    </PageShell>
  )
}
