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
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

function activityVerb(activity) {
  if (activity.type === 'recommendation_note') return 'recommended'
  if (activity.type === 'media_comment') return 'commented on'
  if (activity.type === 'media_share') return 'shared'
  if (activity.type === 'clique_join') return 'joined'
  if (activity.type === 'friend_accept') return 'became friends with someone'
  if (activity.type === 'rating') return 'rated'
  return 'updated'
}

function payloadText(activity) {
  const payload = activity.payload || {}
  if (activity.type === 'recommendation_note') return payload.note || ''
  if (activity.type === 'media_comment') return payload.body || ''
  return payload.message || ''
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

function shareableType(activity) {
  const type = String(activity?.itemType || activity?.payload?.itemType || '').toLowerCase()
  return ['movie', 'series', 'game'].includes(type) ? type : ''
}

function shareItemFromActivity(activity) {
  if (!activity) return null
  return {
    id: activity.itemId || activity.id,
    type: shareableType(activity),
    category: shareableType(activity),
    title: activity.title || 'CliqueBase pick',
    overview: payloadText(activity),
    groupId: activity.groupId || null,
    groupName: activity.groupName || '',
  }
}

function EmptyCommunity({ signedIn, filter }) {
  const copy = filter === 'friends'
    ? 'Add friends or accept requests to fill this tab.'
    : filter === 'cliques'
      ? 'Join or create a clique to see shared-room activity here.'
      : filter === 'mine'
        ? 'Your own recommendations and shares will show here.'
        : signedIn ? 'Share something from your library or invite friends to start the feed.' : 'Sign in to see friend activity.'
  return (
    <section className="rounded-[1.5rem] border border-dashed border-white/15 bg-white/[0.025] p-6 text-center">
      <h2 className="text-xl font-black text-white">No posts yet</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-neutral-500">{copy}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <a href="#recommend" className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-neutral-950">Recommend</a>
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
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row">
      <input value={body} onChange={(event) => setBody(event.target.value)} placeholder={signedIn ? 'Reply…' : 'Sign in to reply'} className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-600" />
      <button disabled={saving || !body.trim() || !signedIn} className="rounded-2xl border border-white/10 px-4 py-3 text-xs font-black text-neutral-300 transition hover:bg-white hover:text-neutral-950 disabled:opacity-45">{saving ? 'Posting…' : 'Reply'}</button>
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
    <div className="mt-3">
      <button type="button" onClick={() => setOpen((value) => !value)} className="text-xs font-bold text-neutral-600 transition hover:text-neutral-300">{open ? 'Cancel' : 'Report / block'}</button>
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
  const tags = Array.isArray(activity.payload?.moodTags) ? activity.payload.moodTags : []
  const canShare = Boolean(shareableType(activity))
  const actor = activity.actorId ? <Link to={`/members/${activity.actorId}`} className="font-black text-white hover:underline">{activity.actorDisplayName}</Link> : <span className="font-black text-white">{activity.actorDisplayName}</span>
  const avatarText = activity.actorDisplayName ? activity.actorDisplayName.charAt(0).toUpperCase() : '?'
  
  return (
    <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5 shadow-sm transition hover:border-white/20 hover:bg-white/[0.045]">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-sm font-bold text-white shadow-md">
          {avatarText}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="flex items-center gap-1.5 text-[0.9rem] text-neutral-400">
            {actor}
            <span>{activityVerb(activity)}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 text-[0.75rem] text-neutral-500">
            <span>{relativeTime(activity.createdAt)}</span>
            {activity.groupName ? (
              <>
                <span>•</span>
                <Link to={`/cliques/${encodeURIComponent(activity.groupId)}`} className="font-semibold text-neutral-400 hover:text-white">{activity.groupName}</Link>
              </>
            ) : null}
          </div>
        </div>
      </div>
      <h3 className="mt-2 text-xl font-black leading-tight text-white">{activity.title}</h3>
      {text ? <p className="mt-3 rounded-2xl bg-neutral-950/40 p-3.5 text-[0.95rem] leading-relaxed text-neutral-300">{text}</p> : null}
      <div className="mt-3.5 flex flex-wrap gap-2">
        {activity.itemType ? <span className="rounded-full border border-white/10 bg-neutral-900/50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-neutral-400">{activity.itemType}</span> : null}
        {activity.payload?.priority ? <span className="rounded-full border border-white/10 bg-neutral-900/50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-neutral-400">{activity.payload.priority}</span> : null}
        {tags.map((tag) => <span key={tag} className="rounded-full border border-white/10 bg-neutral-900/50 px-3 py-1 text-[11px] font-black text-neutral-300">{tag}</span>)}
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-white/5 pt-4">
        {canShare ? (
          <button type="button" onClick={() => onShare(activity)} className="flex items-center gap-1.5 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-xs font-bold text-neutral-300 transition hover:bg-white/10 hover:text-white">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
            Share
          </button>
        ) : null}
        {activity.actorId ? <Link to={`/members/${activity.actorId}`} className="flex items-center gap-1.5 rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-xs font-bold text-neutral-300 transition hover:bg-white/10 hover:text-white">Profile</Link> : null}
      </div>
      <ActivityCommentForm activity={activity} signedIn={signedIn} onCommented={onCommented} onFlash={onFlash} />
      <ActivityReportForm activity={activity} signedIn={signedIn} onFlash={onFlash} onBlocked={onCommented} />
    </article>
  )
}

function RecommendationComposer({ groups, libraryItems, signedIn, onCreated, onFlash }) {
  const activeGroupId = getActiveGroupId()
  const [selectedLibraryKey, setSelectedLibraryKey] = useState('')
  const [title, setTitle] = useState('')
  const [itemType, setItemType] = useState('movie')
  const [itemId, setItemId] = useState('')
  const [note, setNote] = useState('')
  const [tags, setTags] = useState('')
  const [priority, setPriority] = useState('maybe')
  const [groupId, setGroupId] = useState(activeGroupId || '')
  const [saving, setSaving] = useState(false)

  function handleLibrarySelect(value) {
    setSelectedLibraryKey(value)
    if (!value) return
    const item = libraryItems.find((entry) => `${entry.itemType}:${entry.id}` === value)
    if (!item) return
    setTitle(item.title)
    setItemType(item.itemType)
    setItemId(String(item.id))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (!signedIn) {
      onFlash('Sign in to post recommendations.')
      return
    }
    setSaving(true)
    try {
      await createRecommendationNote({ title, itemType, itemId, note, moodTags: tags, priority, groupId: groupId || null })
      setSelectedLibraryKey('')
      setTitle('')
      setItemId('')
      setNote('')
      setTags('')
      onCreated?.()
    } catch (error) {
      onFlash(error.message || 'Could not post recommendation.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form id="recommend" onSubmit={handleSubmit} className="scroll-mt-24 rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black text-white">Recommend</h2><span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">Post</span></div>
      <div className="mt-4 grid gap-3">
        <select value={selectedLibraryKey} onChange={(event) => handleLibrarySelect(event.target.value)} className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none"><option value="">Choose from your library…</option>{libraryItems.map((item) => <option key={`${item.itemType}:${item.id}`} value={`${item.itemType}:${item.id}`}>{item.label}: {item.title}</option>)}</select>
        <input value={title} onChange={(event) => { setTitle(event.target.value); setSelectedLibraryKey('') }} placeholder="Or type a title" className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none placeholder:text-neutral-600" />
        <div className="grid gap-3 sm:grid-cols-2">
          <select value={itemType} onChange={(event) => setItemType(event.target.value)} className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none"><option value="movie">Movie</option><option value="series">Series</option><option value="game">Game</option><option value="video">Video</option><option value="music">Music</option><option value="other">Other</option></select>
          <select value={priority} onChange={(event) => setPriority(event.target.value)} className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none">{priorities.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        </div>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Why is it worth it?" rows={3} className="resize-none rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none placeholder:text-neutral-600" />
        <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Tags: cozy, co-op, tense" className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none placeholder:text-neutral-600" />
        {groups.length ? <select value={groupId} onChange={(event) => setGroupId(event.target.value)} className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none"><option value="">Post to feed</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select> : null}
        <button disabled={saving || !signedIn || !title.trim()} className="rounded-2xl bg-white px-5 py-3 font-black text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-50">{saving ? 'Posting…' : signedIn ? 'Post recommendation' : 'Sign in to post'}</button>
      </div>
    </form>
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
  const activeGroupId = getActiveGroupId()
  const activeGroup = useMemo(() => groups.find((group) => group.id === activeGroupId) || groups[0] || null, [groups, activeGroupId])
  const friendIds = useMemo(() => new Set(friends.map((friend) => friend.id).filter(Boolean)), [friends])
  const currentUserId = session?.user?.id || ''
  const filteredActivity = useMemo(() => activity.filter((item) => {
    if (feedFilter === 'friends') return friendIds.has(item.actorId)
    if (feedFilter === 'cliques') return Boolean(item.groupId)
    if (feedFilter === 'mine') return item.actorId && item.actorId === currentUserId
    return true
  }), [activity, feedFilter, friendIds, currentUserId])
  const filterCounts = useMemo(() => ({
    all: activity.length,
    friends: activity.filter((item) => friendIds.has(item.actorId)).length,
    cliques: activity.filter((item) => item.groupId).length,
    mine: activity.filter((item) => item.actorId && item.actorId === currentUserId).length,
  }), [activity, friendIds, currentUserId])

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
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <main className="mx-auto w-full max-w-[640px] min-w-0">
          <section className="mb-4 rounded-[1.5rem] border border-white/10 bg-white/[0.025] p-4 text-white">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><h1 className="text-3xl font-black tracking-tight sm:text-4xl">Friend feed</h1><p className="mt-1 text-sm text-neutral-500">{activeGroup?.name ? `${activeGroup.name} and friends` : 'Recommendations, shares, comments, and clique updates.'}</p></div>
              <div className="flex gap-2"><a href="#recommend" className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-neutral-950">Recommend</a><button type="button" onClick={() => refresh()} className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-black text-neutral-300 transition hover:bg-white hover:text-neutral-950">Refresh</button></div>
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {feedFilters.map((filter) => <button key={filter.key} type="button" onClick={() => setFeedFilter(filter.key)} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black transition ${feedFilter === filter.key ? 'border-white bg-white text-neutral-950' : 'border-white/10 text-neutral-400 hover:bg-white hover:text-neutral-950'}`}>{filter.label} <span className="opacity-60">{filterCounts[filter.key] || 0}</span></button>)}
            </div>
          </section>

          <div className="grid gap-3">
            {loading ? <p className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5 text-sm text-neutral-400">Loading feed…</p> : filteredActivity.length ? filteredActivity.map((item) => <ActivityCard key={item.id} activity={item} signedIn={signedIn} onCommented={() => refresh()} onFlash={flash} onShare={setSharingActivity} />) : <EmptyCommunity signedIn={signedIn} filter={feedFilter} />}
          </div>
          {signedIn && activity.length >= feedLimit ? <button type="button" onClick={loadMore} className="mt-4 w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-neutral-300 transition hover:bg-white hover:text-neutral-950">Load more</button> : null}
        </main>

        <aside className="grid gap-4 lg:sticky lg:top-28">
          <div id="people" className="scroll-mt-24"><BlockedMembersPanel signedIn={signedIn} defaultOpen onFlash={flash} onChanged={() => refresh()} /></div>
          <RecommendationComposer groups={groups} libraryItems={libraryItems} signedIn={signedIn} onCreated={() => refresh()} onFlash={flash} />
          <div id="tonight" className="scroll-mt-24"><TonightMode groups={groups} signedIn={signedIn} onFlash={flash} /></div>
        </aside>
      </div>
      <MemberShareModal item={sharingActivity ? shareItemFromActivity(sharingActivity) : null} type={sharingActivity ? shareableType(sharingActivity) : ''} onClose={() => setSharingActivity(null)} onMessage={flash} />
      {message ? <div className="fixed bottom-5 left-1/2 z-[90] -translate-x-1/2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950 shadow-2xl">{message}</div> : null}
    </PageShell>
  )
}
