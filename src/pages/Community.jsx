import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import BlockedMembersPanel from '../components/BlockedMembersPanel.jsx'
import PageShell from '../components/PageShell.jsx'
import TonightMode from '../components/TonightMode.jsx'
import { getActiveGroupId } from '../lib/groups.js'
import { addMediaComment, createRecommendationNote, getSocialActivity } from '../lib/communityActivity.js'
import { getCurrentSession, getGames, getMovies, getRemoteGroups, getSeries, hasSupabase } from '../lib/supabaseClient.js'
import { blockUser, reportContent } from '../lib/safety.js'

const priorities = [
  { value: 'must', label: 'Must try' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'later', label: 'Later' },
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

function EmptyCommunity({ signedIn }) {
  return (
    <section className="rounded-[1.5rem] border border-dashed border-white/15 bg-white/[0.025] p-6 text-center">
      <h2 className="text-xl font-black text-white">No posts yet</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-neutral-500">
        {signedIn ? 'Share something from your library or invite friends to start the feed.' : 'Sign in to see friend activity.'}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <a href="#recommend" className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-neutral-950">Recommend</a>
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
      await addMediaComment({
        itemType: activity.itemType || 'other',
        itemId: activity.itemId || `${activity.type}:${activity.id}`,
        title: activity.title,
        body,
        groupId: activity.groupId || null,
      })
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
      <button disabled={saving || !body.trim() || !signedIn} className="rounded-2xl border border-white/10 px-4 py-3 text-xs font-black text-neutral-300 transition hover:bg-white hover:text-neutral-950 disabled:opacity-45">
        {saving ? 'Posting…' : 'Reply'}
      </button>
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
      <button type="button" onClick={() => setOpen((value) => !value)} className="text-xs font-bold text-neutral-600 transition hover:text-neutral-300">
        {open ? 'Cancel' : 'Report / block'}
      </button>
      {open ? (
        <div className="mt-3 grid gap-2 rounded-2xl border border-white/10 bg-neutral-950/75 p-3">
          <form onSubmit={handleSubmit} className="grid gap-2">
            <div className="grid gap-2 sm:grid-cols-[9rem_1fr]">
              <select value={reason} onChange={(event) => setReason(event.target.value)} className="rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-white outline-none">
                {reportReasons.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
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

function ActivityCard({ activity, signedIn, onCommented, onFlash }) {
  const text = payloadText(activity)
  const tags = Array.isArray(activity.payload?.moodTags) ? activity.payload.moodTags : []
  return (
    <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20 hover:bg-white/[0.045]">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-400">
        <span className="font-black text-white">{activity.actorDisplayName}</span>
        <span>{activityVerb(activity)}</span>
        {activity.groupName ? <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold text-neutral-300">{activity.groupName}</span> : null}
        <span className="text-xs text-neutral-600">{relativeTime(activity.createdAt)}</span>
      </div>
      <h3 className="mt-2 text-xl font-black leading-tight text-white">{activity.title}</h3>
      {text ? <p className="mt-2 rounded-2xl border border-white/10 bg-neutral-950/55 p-3 text-sm leading-6 text-neutral-300">{text}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {activity.itemType ? <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-neutral-500">{activity.itemType}</span> : null}
        {activity.payload?.priority ? <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-neutral-500">{activity.payload.priority}</span> : null}
        {tags.map((tag) => <span key={tag} className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-black text-neutral-300">{tag}</span>)}
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
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-black text-white">Recommend</h2>
        <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">Post</span>
      </div>
      <div className="mt-4 grid gap-3">
        <select value={selectedLibraryKey} onChange={(event) => handleLibrarySelect(event.target.value)} className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none">
          <option value="">Choose from your library…</option>
          {libraryItems.map((item) => <option key={`${item.itemType}:${item.id}`} value={`${item.itemType}:${item.id}`}>{item.label}: {item.title}</option>)}
        </select>
        <input value={title} onChange={(event) => { setTitle(event.target.value); setSelectedLibraryKey('') }} placeholder="Or type a title" className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none placeholder:text-neutral-600" />
        <div className="grid gap-3 sm:grid-cols-2">
          <select value={itemType} onChange={(event) => setItemType(event.target.value)} className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none">
            <option value="movie">Movie</option>
            <option value="series">Series</option>
            <option value="game">Game</option>
            <option value="video">Video</option>
            <option value="music">Music</option>
            <option value="other">Other</option>
          </select>
          <select value={priority} onChange={(event) => setPriority(event.target.value)} className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none">{priorities.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        </div>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Why is it worth it?" rows={3} className="resize-none rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none placeholder:text-neutral-600" />
        <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Tags: cozy, co-op, tense" className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none placeholder:text-neutral-600" />
        {groups.length ? (
          <select value={groupId} onChange={(event) => setGroupId(event.target.value)} className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none">
            <option value="">Post to feed</option>
            {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
        ) : null}
        <button disabled={saving || !signedIn || !title.trim()} className="rounded-2xl bg-white px-5 py-3 font-black text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-50">{saving ? 'Posting…' : signedIn ? 'Post recommendation' : 'Sign in to post'}</button>
      </div>
    </form>
  )
}

export default function Community() {
  const [session, setSession] = useState(null)
  const [groups, setGroups] = useState([])
  const [activity, setActivity] = useState([])
  const [libraryItems, setLibraryItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const signedIn = hasSupabase && Boolean(session?.user)
  const activeGroupId = getActiveGroupId()
  const activeGroup = useMemo(() => groups.find((group) => group.id === activeGroupId) || groups[0] || null, [groups, activeGroupId])

  function flash(text) {
    setMessage(text)
    setTimeout(() => setMessage(''), 2600)
  }

  async function refresh() {
    setLoading(true)
    try {
      const nextSession = hasSupabase ? await getCurrentSession().catch(() => null) : null
      setSession(nextSession)
      if (!nextSession?.user) {
        setActivity([])
        setGroups([])
        setLibraryItems([])
        return
      }
      const [nextGroups, nextActivity, movies, series, games] = await Promise.all([
        getRemoteGroups().catch(() => []),
        getSocialActivity({ limit: 80, includePublic: true }).catch(() => []),
        getMovies(null).catch(() => []),
        getSeries(null).catch(() => []),
        getGames(null).catch(() => []),
      ])
      setGroups(nextGroups)
      setActivity(nextActivity)
      setLibraryItems(normalizeLibraryItems(movies, series, games))
    } catch (error) {
      flash(error.message || 'Could not load feed.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  return (
    <PageShell active="community">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <main className="min-w-0">
          <section className="mb-4 flex flex-wrap items-end justify-between gap-3 rounded-[1.5rem] border border-white/10 bg-white/[0.025] p-4 text-white">
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Friend feed</h1>
              <p className="mt-1 text-sm text-neutral-500">{activeGroup?.name ? `Showing ${activeGroup.name} and friend activity.` : 'Recommendations, shares, comments, and clique updates.'}</p>
            </div>
            <div className="flex gap-2">
              <a href="#recommend" className="rounded-2xl bg-white px-4 py-2 text-sm font-black text-neutral-950">Recommend</a>
              <button type="button" onClick={refresh} className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-black text-neutral-300 transition hover:bg-white hover:text-neutral-950">Refresh</button>
            </div>
          </section>

          <div className="grid gap-3">
            {loading ? <p className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5 text-sm text-neutral-400">Loading feed…</p> : activity.length ? activity.map((item) => <ActivityCard key={item.id} activity={item} signedIn={signedIn} onCommented={refresh} onFlash={flash} />) : <EmptyCommunity signedIn={signedIn} />}
          </div>
        </main>

        <aside className="grid gap-4 lg:sticky lg:top-28">
          <RecommendationComposer groups={groups} libraryItems={libraryItems} signedIn={signedIn} onCreated={refresh} onFlash={flash} />
          <div id="friends" className="scroll-mt-24"><BlockedMembersPanel signedIn={signedIn} onFlash={flash} onChanged={refresh} /></div>
          <div id="tonight" className="scroll-mt-24"><TonightMode groups={groups} signedIn={signedIn} onFlash={flash} /></div>
        </aside>
      </div>
      {message ? <div className="fixed bottom-5 left-1/2 z-[90] -translate-x-1/2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950 shadow-2xl">{message}</div> : null}
    </PageShell>
  )
}
