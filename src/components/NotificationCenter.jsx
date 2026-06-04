import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppIcon from './AppIcon.jsx'
import { buildShareUrl, mediaTypeLabel } from '../lib/share.js'
import { getCurrentSession, hasSupabase } from '../lib/supabaseClient.js'
import { getMediaShareInbox, respondMediaShare } from '../lib/communityShare.js'
import {
  getFriendRequests,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  respondFriendRequest,
} from '../lib/socialGovernance.js'

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

function notificationText(notification) {
  const actor = notification.actorDisplayName || 'Someone'
  const payload = notification.payload || {}
  if (notification.type === 'friend_request') return `${actor} sent you a friend request.`
  if (notification.type === 'friend_accept') return `${actor} accepted your friend request.`
  if (notification.type === 'media_share') {
    if (payload.response === 'want') return `${actor} wants ${payload.title || 'your pick'} too. Match!`
    if (payload.response === 'pass') return `${actor} passed on ${payload.title || 'your pick'}.`
    return `${actor} sent you ${payload.title || 'a swipe card'}.`
  }
  if (notification.type === 'clique_invite') return `${actor} invited you to a clique.`
  if (notification.type === 'clique_join') return `${actor} joined your clique.`
  if (notification.type === 'member_removed') return `You were removed from a clique.`
  if (notification.type === 'role_changed') return `${actor} changed your clique role${payload.role ? ` to ${payload.role}` : ''}.`
  if (notification.type === 'clique_deleted') return `${payload.groupName || 'A clique'} was deleted.`
  return payload.message || 'New CliqueBase notification.'
}

function RequestCard({ request, onRespond, busy }) {
  return (
    <article className="rounded-3xl border border-white/10 bg-neutral-900/80 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-black text-white">{request.displayName}</p>
          <p className="mt-1 text-xs text-neutral-500">{request.direction === 'incoming' ? 'Wants to add you' : 'Request sent'} · {relativeTime(request.createdAt)}</p>
        </div>
        {request.direction === 'incoming' ? (
          <div className="flex shrink-0 gap-2">
            <button type="button" disabled={busy} onClick={() => onRespond(request, 'accepted')} className="rounded-xl bg-white px-3 py-2 text-xs font-black text-neutral-950 disabled:opacity-60">Accept</button>
            <button type="button" disabled={busy} onClick={() => onRespond(request, 'declined')} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-neutral-300 disabled:opacity-60">Decline</button>
          </div>
        ) : null}
      </div>
    </article>
  )
}

function SwipeCard({ share, busy, onRespond }) {
  const item = share.item || {}
  const image = item.poster || item.backdrop || ''
  const shareUrl = buildShareUrl(share.itemType, item)
  return (
    <article className="overflow-hidden rounded-[1.65rem] border border-cyan-200/15 bg-gradient-to-br from-cyan-400/10 via-white/[0.06] to-fuchsia-500/10 shadow-2xl shadow-cyan-950/20 ring-1 ring-white/10">
      <div className="flex gap-3 p-3">
        {image ? <img src={image} alt="" className="h-28 w-20 shrink-0 rounded-2xl object-cover ring-1 ring-white/15" /> : <div className="grid h-28 w-20 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.06]"><AppIcon name="movies" size={22} /></div>}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-100/70">Swipe card · {mediaTypeLabel(share.itemType)}</p>
          <h3 className="mt-1 line-clamp-2 text-lg font-black leading-tight text-white">{item.title}</h3>
          <p className="mt-1 text-xs text-neutral-500">From {share.senderDisplayName} · {relativeTime(share.createdAt)}</p>
          {item.overview ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-neutral-300">{item.overview}</p> : null}
          <a href={shareUrl} className="mt-2 inline-flex text-xs font-bold text-cyan-100 hover:underline">Open pick</a>
        </div>
      </div>
      <div className="grid grid-cols-2 border-t border-white/10">
        <button type="button" disabled={busy} onClick={() => onRespond(share, 'pass')} className="px-4 py-3 text-sm font-black text-neutral-300 transition hover:bg-white/10 disabled:opacity-50">Pass</button>
        <button type="button" disabled={busy} onClick={() => onRespond(share, 'want')} className="border-l border-white/10 bg-white px-4 py-3 text-sm font-black text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-50">Want</button>
      </div>
    </article>
  )
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [session, setSession] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [requests, setRequests] = useState([])
  const [shareCards, setShareCards] = useState([])
  const [loading, setLoading] = useState(false)
  const [busyKey, setBusyKey] = useState('')
  const [message, setMessage] = useState('')

  const unreadCount = useMemo(() => notifications.filter((item) => !item.readAt).length + requests.filter((item) => item.direction === 'incoming').length + shareCards.length, [notifications, requests, shareCards])

  function flash(text) {
    setMessage(text)
    setTimeout(() => setMessage(''), 2600)
  }

  async function refresh() {
    if (!hasSupabase) return
    setLoading(true)
    try {
      const nextSession = await getCurrentSession().catch(() => null)
      setSession(nextSession)
      if (!nextSession?.user) {
        setNotifications([])
        setRequests([])
        setShareCards([])
        return
      }
      const [nextNotifications, nextRequests, nextShareCards] = await Promise.all([
        getNotifications({ limit: 30, includeRead: false }).catch(() => []),
        getFriendRequests('pending').catch(() => []),
        getMediaShareInbox({ limit: 12, includeAnswered: false }).catch(() => []),
      ])
      setNotifications(nextNotifications)
      setRequests(nextRequests)
      setShareCards(nextShareCards)
    } catch (error) {
      flash(error.message || 'Could not load notifications.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [])
  useEffect(() => {
    if (!open) return undefined
    refresh()
    const timer = window.setInterval(refresh, 45000)
    return () => window.clearInterval(timer)
  }, [open])

  async function handleMarkRead(notification) {
    setBusyKey(notification.id)
    try {
      await markNotificationRead(notification.id)
      setNotifications((current) => current.filter((item) => item.id !== notification.id))
    } catch (error) {
      flash(error.message || 'Could not mark notification read.')
    } finally {
      setBusyKey('')
    }
  }

  async function handleMarkAll() {
    setBusyKey('all')
    try {
      await markAllNotificationsRead()
      setNotifications([])
      flash('Notifications cleared.')
    } catch (error) {
      flash(error.message || 'Could not clear notifications.')
    } finally {
      setBusyKey('')
    }
  }

  async function handleRespond(request, response) {
    setBusyKey(request.id)
    try {
      await respondFriendRequest(request.id, response)
      setRequests((current) => current.filter((item) => item.id !== request.id))
      flash(response === 'accepted' ? `${request.displayName} is now your friend.` : 'Friend request declined.')
    } catch (error) {
      flash(error.message || 'Could not respond to friend request.')
    } finally {
      setBusyKey('')
    }
  }

  async function handleShareResponse(share, response) {
    setBusyKey(share.id)
    try {
      await respondMediaShare(share.id, response)
      setShareCards((current) => current.filter((item) => item.id !== share.id))
      flash(response === 'want' ? `Matched on ${share.item.title}.` : 'Card passed.')
      refresh()
    } catch (error) {
      flash(error.message || 'Could not answer that card.')
    } finally {
      setBusyKey('')
    }
  }

  return (
    <div className="relative notification-center">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label="Open community inbox" className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white transition hover:bg-white hover:text-neutral-950">
        <AppIcon name="bell" size={18} />
        {unreadCount ? <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-black text-neutral-950">{unreadCount > 9 ? '9+' : unreadCount}</span> : null}
      </button>
      {open ? (
        <section className="notification-panel absolute right-0 top-full z-[80] mt-3 w-[min(92vw,28rem)] rounded-[2rem] border border-white/10 bg-neutral-950 p-4 shadow-2xl shadow-black/60">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-neutral-500">Community inbox</p>
              <h2 className="mt-1 text-xl font-black text-white">Cards & updates</h2>
            </div>
            <div className="flex gap-2">
              <Link to="/library/inbox" onClick={() => setOpen(false)} className="rounded-xl bg-white px-3 py-2 text-xs font-black text-neutral-950">Open library</Link>
              {notifications.length ? <button type="button" disabled={busyKey === 'all'} onClick={handleMarkAll} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-neutral-300 disabled:opacity-60">Clear</button> : null}
              <button type="button" onClick={() => setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-xl text-neutral-400 hover:bg-white hover:text-neutral-950">×</button>
            </div>
          </div>

          {!hasSupabase || !session?.user ? <p className="mt-4 rounded-3xl border border-white/10 bg-neutral-900 p-4 text-sm text-neutral-400">Sign in to receive friend requests, swipe cards, and clique updates.</p> : null}
          {loading && session?.user ? <p className="mt-4 rounded-3xl border border-white/10 bg-neutral-900 p-4 text-sm text-neutral-400">Loading community inbox…</p> : null}

          {session?.user ? (
            <div className="mt-4 grid max-h-[28rem] gap-3 overflow-y-auto pr-1">
              {shareCards.length ? <div className="grid gap-2"><div className="flex items-center justify-between gap-2 px-1"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Swipe cards</p><Link to="/library/inbox" onClick={() => setOpen(false)} className="text-xs font-black text-cyan-100 hover:underline">View pile</Link></div>{shareCards.slice(0, 2).map((share) => <SwipeCard key={share.id} share={share} busy={busyKey === share.id} onRespond={handleShareResponse} />)}</div> : null}
              {requests.length ? <div className="grid gap-2"><p className="px-1 text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Friend requests</p>{requests.map((request) => <RequestCard key={request.id} request={request} onRespond={handleRespond} busy={busyKey === request.id} />)}</div> : null}
              {notifications.length ? <div className="grid gap-2"><p className="px-1 text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Updates</p>{notifications.map((notification) => <article key={notification.id} className="rounded-3xl border border-white/10 bg-neutral-900/80 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-bold leading-5 text-white">{notificationText(notification)}</p><p className="mt-1 text-xs text-neutral-500">{relativeTime(notification.createdAt)}</p></div><button type="button" disabled={busyKey === notification.id} onClick={() => handleMarkRead(notification)} className="shrink-0 rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-neutral-300 disabled:opacity-60">Read</button></div></article>)}</div> : null}
              {!shareCards.length && !requests.length && !notifications.length && !loading ? <p className="rounded-3xl border border-dashed border-white/10 bg-neutral-900/60 p-5 text-center text-sm text-neutral-500">No new cards or updates yet.</p> : null}
            </div>
          ) : null}
        </section>
      ) : null}
      {message ? <div className="fixed bottom-5 left-1/2 z-[130] -translate-x-1/2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950 shadow-2xl">{message}</div> : null}
    </div>
  )
}
