import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import AppIcon from '../components/AppIcon.jsx'
import BlockedMembersPanel from '../components/BlockedMembersPanel.jsx'
import MemberShareModal from '../components/MemberShareModal.jsx'
import PageShell from '../components/PageShell.jsx'
import TonightMode from '../components/TonightMode.jsx'
import { getActiveGroupId } from '../lib/groups.js'
import { addMediaComment, createRecommendationNote, getSocialActivity } from '../lib/communityActivity.js'
import { getFriendsList } from '../lib/communityShare.js'
import { getCurrentSession, getGames, getMovies, getRemoteGroups, getSeries, hasSupabase } from '../lib/supabaseClient.js'
import { getMusicItems } from '../lib/musicLibrary.js'
import { getBookItems } from '../lib/bookLibrary.js'
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
  movie: { label: 'Movies', singular: 'movie', icon: 'movies' },
  series: { label: 'Series', singular: 'series', icon: 'series' },
  game: { label: 'Games', singular: 'game', icon: 'games' },
  video: { label: 'Videos', singular: 'video', icon: 'videos' },
  music: { label: 'Music', singular: 'song', icon: 'music' },
  book: { label: 'Books', singular: 'book', icon: 'books' },
  other: { label: 'Other', singular: 'pick', icon: 'explore' },
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

function getScrollTop() {
  if (typeof window === 'undefined') return 0
  return window.scrollY || document.documentElement?.scrollTop || document.body?.scrollTop || 0
}

function activityVerb(activity) {
  if (activity.type === 'recommendation_note') return 'suggested'
  if (activity.type === 'media_comment') return 'commented on'
  if (activity.type === 'media_share') return 'shared'
  if (activity.type === 'library_add') return activity.groupId ? 'added to a clique' : 'saved'
  if (activity.type === 'completed') return 'finished'
  if (activity.type === 'clique_join') return 'joined'
  if (activity.type === 'friend_accept') return 'became friends with'
  if (activity.type === 'rating') return 'rated'
  if (activity.type === 'vote') return activity.payload?.vote === 'pass' ? 'passed on' : 'voted for'
  if (activity.payload?.kind === 'poll_created') return 'started a vote'
  return 'updated'
}

function payloadText(activity) {
  const payload = activity.payload || {}
  if (activity.type === 'recommendation_note') return payload.note || ''
  if (activity.type === 'media_comment') return payload.body || ''
  if (activity.type === 'rating' && payload.rating) return `${payload.rating}/10`
  if (activity.type === 'vote') return payload.vote === 'pass' ? 'Passed in their library.' : `Ranked it up${payload.score !== undefined && payload.score !== null ? ` · score ${payload.score}` : ''}.`
  if (activity.type === 'friend_accept') return payload.friendName ? `Now friends with ${payload.friendName}.` : ''
  if (activity.type === 'library_add') {
    if (activity.itemType === 'music') return [payload.artist, payload.album, payload.source].filter(Boolean).join(' · ') || (activity.groupId ? 'Added a song to the shared clique library.' : 'Saved a song to personal library.')
    if (activity.itemType === 'book') return [Array.isArray(payload.authors) ? payload.authors.join(', ') : payload.author, payload.year, payload.readingStatus].filter(Boolean).join(' · ') || (activity.groupId ? 'Added a book to the shared clique library.' : 'Saved a book to personal library.')
    return activity.groupId ? 'Added to the shared clique library.' : 'Saved to personal library.'
  }
  if (activity.type === 'completed') return activity.itemType === 'book' ? 'Finished reading.' : payload.rating ? `Done · ${payload.rating}/10` : 'Marked done.'
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

function normalizeLibraryItems(movies = [], series = [], games = [], music = [], books = []) {
  return [
    ...movies.map((item) => ({ ...item, itemType: 'movie', label: 'Movie' })),
    ...series.map((item) => ({ ...item, itemType: 'series', label: 'Series' })),
    ...games.map((item) => ({ ...item, itemType: 'game', label: 'Game' })),
    ...music.map((item) => ({ ...item, itemType: 'music', label: 'Music' })),
    ...books.map((item) => ({ ...item, itemType: 'book', label: 'Book' })),
  ]
    .filter((item) => item.id && item.title)
    .sort((a, b) => String(a.title).localeCompare(String(b.title)))
}

function itemArtwork(item) {
  return item.poster || item.backdrop || item.image || item.cover || ''
}

function shareableType(activity) {
  const type = String(activity?.itemType || activity?.payload?.itemType || '').toLowerCase()
  return ['movie', 'series', 'game', 'video', 'music', 'book'].includes(type) ? type : ''
}

function contentHref(activity) {
  const type = shareableType(activity)
  if (!type || !activity?.itemId) return ''
  return `/share/${encodeURIComponent(type)}/${encodeURIComponent(activity.itemId)}`
}

function shareItemFromActivity(activity) {
  if (!activity) return null
  const payload = activity.payload || {}
  const type = shareableType(activity)
  return {
    id: activity.itemId || activity.id,
    type,
    category: type,
    title: activity.title || 'CliqueBase pick',
    poster: payload.poster || null,
    backdrop: payload.backdrop || null,
    overview: payload.overview || payloadText(activity),
    url: payload.url || '',
    groupId: activity.groupId || null,
    groupName: activity.groupName || '',
    artist: payload.artist || '',
    album: payload.album || '',
    source: payload.source || '',
    sourceId: payload.sourceId || '',
    itemType: payload.itemType || type,
    previewUrl: payload.previewUrl || '',
    authors: payload.authors || [],
    author: payload.author || (Array.isArray(payload.authors) ? payload.authors.join(', ') : ''),
    isbn: payload.isbn || '',
    subjects: payload.subjects || [],
    readingStatus: payload.readingStatus || '',
    ageBand: payload.ageBand || 'unknown',
  }
}

function feedImage(activity) {
  const payload = activity.payload || {}
  return payload.poster || payload.backdrop || ''
}

function IconBadge({ name }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.08] text-cyan-100 shadow-inner shadow-white/5">
      <AppIcon name={name} size={17} />
    </span>
  )
}

function EmptyCommunity({ signedIn, filter, onSuggest }) {
  const copy = filter === 'friends'
    ? 'Add friends or accept requests to fill this tab.'
    : filter === 'cliques'
      ? 'Join or create a clique to see shared-room activity here.'
      : filter === 'mine'
        ? 'Your own suggestions, saves, ratings, votes, and shares will show here.'
        : signedIn ? 'Save, vote, rate, suggest, or add friends to start the feed.' : 'Sign in to see friend activity.'
  return (
    <section className="rounded-[1.5rem] border border-dashed border-cyan-200/15 bg-gradient-to-br from-cyan-400/10 via-white/[0.04] to-fuchsia-500/10 p-5 text-center shadow-2xl shadow-cyan-950/25 backdrop-blur-2xl ring-1 ring-white/10">
      <h2 className="text-lg font-black text-white">No posts yet</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-neutral-400">{copy}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={onSuggest} className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-neutral-950 lg:hidden">Send a card</button>
        <a href="#recommend" className="hidden rounded-2xl bg-white px-4 py-2 text-sm font-black text-neutral-950 lg:inline-flex">Suggest a pick</a>
        <a href="#people" className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-black text-white">Find people</a>
        <Link to="/groups" className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-black text-white">Cliques</Link>
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
      <input value={body} onChange={(event) => setBody(event.target.value)} placeholder={signedIn ? 'Reply…' : 'Sign in to reply'} className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-xs text-white outline-none placeholder:text-neutral-500" />
      <button disabled={saving || !body.trim() || !signedIn} className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-black text-neutral-300 transition hover:bg-white hover:text-neutral-950 disabled:opacity-45">{saving ? '…' : 'Reply'}</button>
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
  const actorName = activity.actorDisplayName || 'Unknown'
  const actor = activity.actorId ? <Link to={`/members/${activity.actorId}`} className="font-black text-white hover:underline">{actorName}</Link> : <span className="font-black text-white">{actorName}</span>
  const avatarText = typeof actorName === 'string' && actorName.length > 0 ? actorName.charAt(0).toUpperCase() : '?'
  
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
        {(activity.payload?.tags || []).map((tag) => <span key={tag} className="rounded-full border border-white/10 bg-neutral-900/50 px-3 py-1 text-[11px] font-black text-neutral-300">{tag}</span>)}
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

function RecommendationComposer({ sectionId = 'recommend', defaultExpanded = false, groups, friends, libraryItems, signedIn, onCreated, onFlash }) {
  const activeGroupId = getActiveGroupId()
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [selectedLibraryKey, setSelectedLibraryKey] = useState('')
  const [title, setTitle] = useState('')
  const [itemType, setItemType] = useState('movie')
  const [itemId, setItemId] = useState('')
  const [note, setNote] = useState('')
  const [priority, setPriority] = useState('maybe')
  const [audience, setAudience] = useState(activeGroupId ? `group:${activeGroupId}` : 'feed')
  const [saving, setSaving] = useState(false)
  const availableLibraryItems = useMemo(() => libraryItems.filter((item) => item.itemType === itemType), [libraryItems, itemType])
  const previewItems = useMemo(() => availableLibraryItems.slice(0, 6), [availableLibraryItems])

  function handleItemTypeChange(value) {
    setItemType(value)
    setSelectedLibraryKey('')
    setItemId('')
  }

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
      onFlash('Sign in to post suggestions.')
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
      onFlash(error.message || 'Could not post suggestion.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section id={sectionId} className="scroll-mt-24 rounded-[1.5rem] border border-emerald-200/15 bg-gradient-to-br from-emerald-400/10 via-white/[0.055] to-cyan-500/10 p-4 text-white shadow-2xl shadow-emerald-950/25 backdrop-blur-2xl ring-1 ring-white/10">
      <button type="button" onClick={() => setExpanded((value) => !value)} className="flex w-full items-center justify-between gap-3 text-left">
        <span className="flex min-w-0 items-start gap-3">
          <IconBadge name="share" />
          <span className="min-w-0">
            <span className="block text-lg font-black">Suggest or send a pick</span>
            <span className="mt-1 block text-xs leading-5 text-neutral-300/85">Send a 1-vs-1 swipe card to a friend, or drop it into a clique pile.</span>
          </span>
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-xs font-black text-neutral-100">{expanded ? 'Hide' : 'Open'}</span>
      </button>

      {expanded ? (
        <form onSubmit={handleSubmit} className="mt-4 grid gap-3">
          <div className="grid gap-2">
            <label className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">1. Content type</label>
            <select value={itemType} onChange={(event) => handleItemTypeChange(event.target.value)} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none">
              {Object.entries(contentTypeMeta).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
            </select>
          </div>

          {previewItems.length ? (
            <div className="grid gap-2">
              <label className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">2. Pick from your {contentTypeMeta[itemType]?.singular || 'library'}</label>
              <div className="grid grid-cols-2 gap-2">
                {previewItems.map((item) => {
                  const key = `${item.itemType}:${item.id}`
                  const selected = key === selectedLibraryKey
                  return (
                    <button key={key} type="button" onClick={() => handleLibrarySelect(key)} className={`flex items-center gap-2 rounded-2xl border p-2 text-left transition ${selected ? 'border-white bg-white text-neutral-950' : 'border-white/10 bg-black/25 text-white hover:bg-white/10'}`}>
                      {itemArtwork(item) ? <img src={itemArtwork(item)} alt="" className="h-12 w-9 shrink-0 rounded-lg object-cover" /> : <IconBadge name={contentTypeMeta[item.itemType]?.icon || 'explore'} />}
                      <span className="min-w-0"><span className="block truncate text-xs font-black">{item.title}</span><span className="text-[10px] uppercase tracking-[0.14em] opacity-60">{item.label}</span></span>
                    </button>
                  )
                })}
              </div>
              <select value={selectedLibraryKey} onChange={(event) => handleLibrarySelect(event.target.value)} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none">
                <option value="">More from this library…</option>
                {availableLibraryItems.map((item) => <option key={`${item.itemType}:${item.id}`} value={`${item.itemType}:${item.id}`}>{item.title}</option>)}
              </select>
            </div>
          ) : null}

          <input value={title} onChange={(event) => { setTitle(event.target.value); setSelectedLibraryKey(''); setItemId('') }} placeholder="Or type a title" className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-500" />
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Why should they swipe yes?" rows={3} className="resize-none rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-500" />
          <div className="grid gap-3 sm:grid-cols-2">
            <select value={audience} onChange={(event) => setAudience(event.target.value)} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none">
              <option value="feed">Post to feed</option>
              {groups.map((group) => <option key={group.id} value={`group:${group.id}`}>Clique · {group.name}</option>)}
              {friends.map((friend) => <option key={friend.id} value={`friend:${friend.id}`}>Friend · {friend.displayName}</option>)}
            </select>
            <select value={priority} onChange={(event) => setPriority(event.target.value)} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none">{priorities.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          </div>
          <button disabled={saving || !title.trim()} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-50">{saving ? 'Posting…' : 'Post suggestion'}</button>
        </form>
      ) : null}
    </section>
  )
}

function MobileSwipeSheet({ open, onClose, ...props }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[80] bg-black/70 p-3 backdrop-blur-sm lg:hidden">
      <div className="max-h-full overflow-y-auto rounded-[1.5rem] border border-white/10 bg-neutral-950 p-3 shadow-2xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-black text-white">Send a card</p>
          <button type="button" onClick={onClose} className="rounded-full border border-white/10 px-3 py-1 text-sm text-neutral-300">Close</button>
        </div>
        <RecommendationComposer defaultExpanded {...props} />
      </div>
    </div>
  )
}

export default function Community() {
  const [signedIn, setSignedIn] = useState(false)
  const [loading, setLoading] = useState(hasSupabase)
  const [message, setMessage] = useState('')
  const [activity, setActivity] = useState([])
  const [groups, setGroups] = useState([])
  const activeGroup = groups.find((g) => g.id === getActiveGroupId()) || null
  const [friends, setFriends] = useState([])
  const [libraryItems, setLibraryItems] = useState([])
  const [feedFilter, setFeedFilter] = useState('all')
  const [feedLimit, setFeedLimit] = useState(80)
  const [pullDistance, setPullDistance] = useState(0)
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false)
  const [sharingActivity, setSharingActivity] = useState(null)
  const touchStartY = useRef(0)
  const pullActive = useRef(false)

  const visibleActivity = useMemo(() => {
    const collapsed = collapseActivity(activity)
    if (feedFilter === 'friends') return collapsed.filter((item) => !item.groupId && item.actorId)
    if (feedFilter === 'cliques') return collapsed.filter((item) => item.groupId)
    if (feedFilter === 'mine') return collapsed.filter((item) => item.payload?.scope === 'library' || item.payload?.isMine)
    return collapsed
  }, [activity, feedFilter])

  function flash(text) {
    setMessage(text)
    setTimeout(() => setMessage(''), 2600)
  }

  async function refresh(limit = feedLimit) {
    setLoading(true)
    try {
      if (!hasSupabase) {
        setSignedIn(false)
        setActivity([])
        return
      }
      const session = await getCurrentSession().catch(() => null)
      setSignedIn(Boolean(session?.user))
      if (!session?.user) {
        setActivity([])
        return
      }
      const [nextGroups, nextActivity, nextFriends, movies, series, games, musicResult, bookResult] = await Promise.all([
        getRemoteGroups().catch(() => []),
        getSocialActivity({ limit, includePublic: true }).catch(() => []),
        getFriendsList().catch(() => []),
        getMovies(null).catch(() => []),
        getSeries(null).catch(() => []),
        getGames(null).catch(() => []),
        getMusicItems(null).catch(() => ({ tracks: [] })),
        getBookItems(null).catch(() => ({ books: [] })),
      ])
      setGroups(nextGroups)
      setActivity(nextActivity)
      setFriends(nextFriends)
      setLibraryItems(normalizeLibraryItems(movies, series, games, musicResult.tracks || [], bookResult.books || []))
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

  function handleTouchStart(event) {
    if (loading || getScrollTop() > 2) {
      pullActive.current = false
      return
    }
    pullActive.current = true
    touchStartY.current = event.touches?.[0]?.clientY || 0
  }

  function handleTouchMove(event) {
    if (!pullActive.current) return
    const currentY = event.touches?.[0]?.clientY || 0
    const delta = currentY - touchStartY.current
    if (delta <= 0) {
      setPullDistance(0)
      return
    }
    setPullDistance(Math.min(86, Math.round(delta * 0.55)))
  }

  function handleTouchEnd() {
    const shouldRefresh = pullActive.current && pullDistance > 62 && !loading
    pullActive.current = false
    setPullDistance(0)
    if (shouldRefresh) refresh().then(() => flash('Feed refreshed.'))
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
            <div className="community-feed-tabs mt-4 flex gap-2 overflow-x-auto pb-1">
              {feedFilters.map((filter) => <button key={filter.key} type="button" onClick={() => setFeedFilter(filter.key)} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black transition ${feedFilter === filter.key ? 'border-white bg-white text-neutral-950' : 'border-white/10 bg-white/[0.04] text-neutral-300 hover:bg-white hover:text-neutral-950'}`}>{filter.label}</button>)}
            </div>
          </section>
          <div className="grid gap-3">{loading ? <p className="rounded-[1.5rem] border border-cyan-200/15 bg-gradient-to-br from-cyan-400/10 via-white/[0.04] to-violet-500/10 p-4 text-sm text-neutral-300 shadow-2xl shadow-cyan-950/20 backdrop-blur-2xl ring-1 ring-white/10">Loading feed…</p> : visibleActivity.length ? visibleActivity.map((item) => <ActivityCard key={item.id} activity={item} signedIn={signedIn} onCommented={() => refresh()} onFlash={flash} onShare={setSharingActivity} />) : <EmptyCommunity signedIn={signedIn} filter={feedFilter} onSuggest={() => setMobileActionsOpen(true)} />}</div>
          {signedIn && activity.length >= feedLimit ? <button type="button" onClick={loadMore} className="mt-4 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black text-neutral-300 transition hover:bg-white hover:text-neutral-950">Load more</button> : null}
        </main>
        <aside className="hidden gap-4 lg:sticky lg:top-28 lg:grid">
          <div id="people" className="scroll-mt-24"><BlockedMembersPanel signedIn={signedIn} defaultOpen onFlash={flash} onChanged={() => refresh()} /></div>
          <RecommendationComposer sectionId="recommend" groups={groups} friends={friends} libraryItems={libraryItems} signedIn={signedIn} onCreated={() => refresh()} onFlash={flash} />
          <div id="tonight" className="scroll-mt-24"><TonightMode groups={groups} libraryItems={libraryItems} signedIn={signedIn} onFlash={flash} /></div>
        </aside>
      </div>
      <MobileSwipeSheet open={mobileActionsOpen} onClose={() => setMobileActionsOpen(false)} groups={groups} friends={friends} libraryItems={libraryItems} signedIn={signedIn} onCreated={() => { refresh(); setMobileActionsOpen(false) }} onFlash={flash} />
      <MemberShareModal item={sharingActivity ? shareItemFromActivity(sharingActivity) : null} type={sharingActivity ? shareableType(sharingActivity) : ''} onClose={() => setSharingActivity(null)} onMessage={flash} />
      {message ? <div className="fixed bottom-5 left-1/2 z-[90] -translate-x-1/2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950 shadow-2xl">{message}</div> : null}
    </PageShell>
  )
}
