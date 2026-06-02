import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppIcon from '../components/AppIcon.jsx'
import BlockedMembersPanel from '../components/BlockedMembersPanel.jsx'
import PageShell from '../components/PageShell.jsx'
import TonightMode from '../components/TonightMode.jsx'
import { getActiveGroupId } from '../lib/groups.js'
import { addMediaComment, createRecommendationNote, getSocialActivity } from '../lib/communityActivity.js'
import { getCurrentSession, getRemoteGroups, hasSupabase } from '../lib/supabaseClient.js'
import { blockUser, reportContent } from '../lib/safety.js'

const itemTypes = [
  { value: 'movie', label: 'Movie' },
  { value: 'series', label: 'Series' },
  { value: 'game', label: 'Game' },
  { value: 'video', label: 'Video' },
  { value: 'music', label: 'Music' },
  { value: 'other', label: 'Other' },
]

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

function typeIcon(type) {
  if (type === 'movie') return 'movies'
  if (type === 'series') return 'series'
  if (type === 'game') return 'games'
  if (type === 'video') return 'videos'
  if (type === 'music') return 'music'
  return 'explore'
}

function activityVerb(activity) {
  if (activity.type === 'recommendation_note') return 'recommended'
  if (activity.type === 'media_comment') return 'commented on'
  if (activity.type === 'media_share') return 'shared'
  if (activity.type === 'clique_join') return 'joined a clique'
  if (activity.type === 'friend_accept') return 'made a new friend'
  if (activity.type === 'rating') return 'rated'
  return 'updated'
}

function payloadText(activity) {
  const payload = activity.payload || {}
  if (activity.type === 'recommendation_note') return payload.note || 'No reason added yet.'
  if (activity.type === 'media_comment') return payload.body || 'Commented on this pick.'
  return payload.message || ''
}

function EmptyCommunity({ signedIn }) {
  return (
    <section className="rounded-[2rem] border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-white text-neutral-950"><AppIcon name="users" size={28} /></div>
      <h2 className="mt-5 text-3xl font-black text-white">Your community feed starts here</h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
        {signedIn ? 'Create the first recommendation note, join a clique, or share a pick with a friend to start the activity stream.' : 'Sign in to see friend requests, recommendations, clique updates, and shared picks from people you trust.'}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to="/groups" className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-neutral-950">Create or join a clique</Link>
        <Link to="/dashboard" className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-black text-white">Build my library</Link>
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
      onFlash('Sign in to comment on recommendations.')
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
      onFlash('Comment posted.')
      onCommented?.()
    } catch (error) {
      onFlash(error.message || 'Could not post comment.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row">
      <input
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={signedIn ? 'Add a take, warning, or +1…' : 'Sign in to comment'}
        className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-600"
      />
      <button disabled={saving || !body.trim() || !signedIn} className="rounded-2xl border border-white/10 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-neutral-300 transition hover:bg-white hover:text-neutral-950 disabled:opacity-45">
        {saving ? 'Posting…' : 'Comment'}
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
      await reportContent({
        actorId: activity.actorId || null,
        groupId: activity.groupId || null,
        itemType: 'activity',
        itemId: activity.id || activity.itemId || '',
        reason,
        details,
      })
      setOpen(false)
      setDetails('')
      setReason('spam')
      onFlash('Report sent to moderators.')
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
      onFlash('This activity has no member to block.')
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
      <button type="button" onClick={() => setOpen((value) => !value)} className="text-xs font-bold text-neutral-500 transition hover:text-neutral-200">
        {open ? 'Cancel safety actions' : 'Report / block'}
      </button>
      {open ? (
        <div className="mt-3 grid gap-2 rounded-2xl border border-white/10 bg-neutral-950/75 p-3">
          <form onSubmit={handleSubmit} className="grid gap-2">
            <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
              <select value={reason} onChange={(event) => setReason(event.target.value)} className="rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-white outline-none">
                {reportReasons.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <input value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Optional details for moderators" className="rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-600" />
            </div>
            <button disabled={saving || !signedIn} className="rounded-xl border border-red-300/20 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-red-100 transition hover:bg-red-500 hover:text-white disabled:opacity-50">
              {saving ? 'Sending…' : 'Submit report'}
            </button>
          </form>
          <button type="button" disabled={blocking || !signedIn || !activity.actorId} onClick={handleBlock} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-neutral-300 transition hover:bg-white hover:text-neutral-950 disabled:opacity-50">
            {blocking ? 'Blocking…' : `Block ${activity.actorDisplayName || 'member'}`}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function ActivityCard({ activity, signedIn, onCommented, onFlash }) {
  const text = payloadText(activity)
  const tags = Array.isArray(activity.payload?.moodTags) ? activity.payload.moodTags : []
  return (
    <article className="rounded-[1.75rem] border border-white/10 bg-white/[0.035] p-4 shadow-xl shadow-black/15 transition hover:border-white/20 hover:bg-white/[0.05]">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-neutral-950"><AppIcon name={typeIcon(activity.itemType)} size={22} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-400">
            <span className="font-black text-white">{activity.actorDisplayName}</span>
            <span>{activityVerb(activity)}</span>
            {activity.groupName ? <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-bold text-neutral-300">{activity.groupName}</span> : null}
            <span className="text-xs text-neutral-600">{relativeTime(activity.createdAt)}</span>
          </div>
          <h3 className="mt-2 text-xl font-black leading-tight text-white">{activity.title}</h3>
          {text ? <p className="mt-2 rounded-2xl border border-white/10 bg-neutral-950/55 p-3 text-sm leading-6 text-neutral-300">{text}</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            {activity.itemType ? <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-neutral-400">{activity.itemType}</span> : null}
            {activity.payload?.priority ? <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-neutral-400">{activity.payload.priority}</span> : null}
            {tags.map((tag) => <span key={tag} className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-neutral-950">{tag}</span>)}
          </div>
          <ActivityCommentForm activity={activity} signedIn={signedIn} onCommented={onCommented} onFlash={onFlash} />
          <ActivityReportForm activity={activity} signedIn={signedIn} onFlash={onFlash} onBlocked={onCommented} />
        </div>
      </div>
    </article>
  )
}

function RecommendationComposer({ groups, signedIn, onCreated, onFlash }) {
  const activeGroupId = getActiveGroupId()
  const [title, setTitle] = useState('')
  const [itemType, setItemType] = useState('movie')
  const [note, setNote] = useState('')
  const [tags, setTags] = useState('')
  const [contextLabel, setContextLabel] = useState('')
  const [priority, setPriority] = useState('maybe')
  const [groupId, setGroupId] = useState(activeGroupId || '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!signedIn) {
      onFlash('Sign in to post recommendations.')
      return
    }
    setSaving(true)
    try {
      await createRecommendationNote({
        title,
        itemType,
        note,
        moodTags: tags,
        contextLabel,
        priority,
        groupId: groupId || null,
      })
      setTitle('')
      setNote('')
      setTags('')
      setContextLabel('')
      onFlash('Recommendation posted.')
      onCreated?.()
    } catch (error) {
      onFlash(error.message || 'Could not post recommendation.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-neutral-500">Outsource taste</p>
          <h2 className="mt-1 text-2xl font-black text-white">Recommend something</h2>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">Beta</span>
      </div>
      <div className="mt-4 grid gap-3">
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title, game, song, video, or anything worth trying" className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none placeholder:text-neutral-600" />
        <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Why should friends care? Keep it human." rows={4} className="resize-none rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none placeholder:text-neutral-600" />
        <div className="grid gap-3 sm:grid-cols-2">
          <select value={itemType} onChange={(event) => setItemType(event.target.value)} className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none">{itemTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
          <select value={priority} onChange={(event) => setPriority(event.target.value)} className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none">{priorities.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="Mood tags: cozy, co-op, chaotic" className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none placeholder:text-neutral-600" />
          <input value={contextLabel} onChange={(event) => setContextLabel(event.target.value)} placeholder="Context: date night, horror friday" className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none placeholder:text-neutral-600" />
        </div>
        {groups.length ? (
          <select value={groupId} onChange={(event) => setGroupId(event.target.value)} className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none">
            <option value="">Post to personal feed</option>
            {groups.map((group) => <option key={group.id} value={group.id}>Post to {group.name}</option>)}
          </select>
        ) : null}
        <button disabled={saving || !signedIn} className="rounded-2xl bg-white px-5 py-3 font-black text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-50">{saving ? 'Posting…' : signedIn ? 'Post recommendation' : 'Sign in to post'}</button>
      </div>
    </form>
  )
}

export default function Community() {
  const [session, setSession] = useState(null)
  const [groups, setGroups] = useState([])
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  const signedIn = hasSupabase && Boolean(session?.user)
  const stats = useMemo(() => ({
    posts: activity.length,
    cliques: groups.length,
    recommenders: new Set(activity.map((item) => item.actorId).filter(Boolean)).size,
  }), [activity, groups])

  function flash(text) {
    setMessage(text)
    setTimeout(() => setMessage(''), 2800)
  }

  async function refresh() {
    setLoading(true)
    try {
      const nextSession = hasSupabase ? await getCurrentSession().catch(() => null) : null
      setSession(nextSession)
      if (!nextSession?.user) {
        setActivity([])
        setGroups([])
        return
      }
      const [nextGroups, nextActivity] = await Promise.all([
        getRemoteGroups().catch(() => []),
        getSocialActivity({ limit: 60, includePublic: true }).catch(() => []),
      ])
      setGroups(nextGroups)
      setActivity(nextActivity)
    } catch (error) {
      flash(error.message || 'Could not load community feed.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])

  return (
    <PageShell active="community">
      <section className="overflow-hidden rounded-[2.4rem] border border-white/10 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.16),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5 shadow-2xl shadow-black/20 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.22em] text-neutral-300"><AppIcon name="users" size={14} />Community home</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[0.95] text-white sm:text-6xl">Let friends outsource your next obsession.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-neutral-300 sm:text-base">CliqueBase now centers on social recommendations: notes, mood tags, clique context, notifications, and a feed of what your people think is worth watching, playing, or sharing.</p>
            <div className="mt-6 flex flex-wrap gap-3"><Link to="/groups" className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-neutral-950">Find or create cliques</Link><Link to="/explore" className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-black text-white">Explore rankings</Link></div>
          </div>
          <div className="grid grid-cols-3 gap-2 rounded-[2rem] border border-white/10 bg-neutral-950/60 p-3">
            <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.04] p-3"><p className="text-2xl font-black text-white">{loading ? '…' : stats.posts}</p><p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">Feed posts</p></div>
            <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.04] p-3"><p className="text-2xl font-black text-white">{loading ? '…' : stats.cliques}</p><p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">Cliques</p></div>
            <div className="rounded-[1.3rem] border border-white/10 bg-white/[0.04] p-3"><p className="text-2xl font-black text-white">{loading ? '…' : stats.recommenders}</p><p className="mt-1 text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">People</p></div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div className="grid gap-6">
          <RecommendationComposer groups={groups} signedIn={signedIn} onCreated={refresh} onFlash={flash} />
          <TonightMode groups={groups} signedIn={signedIn} onFlash={flash} />
          <BlockedMembersPanel signedIn={signedIn} onFlash={flash} onChanged={refresh} />
        </div>
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.025] p-4">
          <div className="mb-4 flex items-center justify-between gap-3 px-1">
            <div><p className="text-[10px] font-black uppercase tracking-[0.24em] text-neutral-500">Live taste graph</p><h2 className="mt-1 text-2xl font-black text-white">Friend activity</h2></div>
            <button type="button" onClick={refresh} className="rounded-2xl border border-white/10 px-4 py-2 text-xs font-black text-neutral-300 transition hover:bg-white hover:text-neutral-950">Refresh</button>
          </div>
          <div className="grid gap-3">
            {loading ? <p className="rounded-3xl border border-white/10 bg-neutral-900 p-5 text-sm text-neutral-400">Loading social activity…</p> : activity.length ? activity.map((item) => <ActivityCard key={item.id} activity={item} signedIn={signedIn} onCommented={refresh} onFlash={flash} />) : <EmptyCommunity signedIn={signedIn} />}
          </div>
        </section>
      </div>
      {message ? <div className="fixed bottom-5 left-1/2 z-[90] -translate-x-1/2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950 shadow-2xl">{message}</div> : null}
    </PageShell>
  )
}
