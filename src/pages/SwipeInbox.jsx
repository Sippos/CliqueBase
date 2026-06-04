import { useEffect, useMemo, useState } from 'react'
import AppIcon from '../components/AppIcon.jsx'
import PageShell from '../components/PageShell.jsx'
import { getMediaShareInbox, respondMediaShare } from '../lib/communityShare.js'
import { buildShareUrl, mediaTypeLabel } from '../lib/share.js'
import { getCurrentSession, hasSupabase } from '../lib/supabaseClient.js'

const filters = [
  { key: 'pending', label: 'Inbox' },
  { key: 'answered', label: 'Answered' },
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
  return `${Math.round(hours / 24)}d ago`
}

function artwork(item = {}) {
  return item.poster || item.backdrop || ''
}

function SwipeDeckCard({ share, active, busy, onRespond }) {
  const item = share.item || {}
  const image = artwork(item)
  const shareUrl = buildShareUrl(share.itemType, item)

  return (
    <article className={`overflow-hidden rounded-[2rem] border shadow-2xl ring-1 ring-white/10 transition ${active ? 'border-cyan-100/25 bg-gradient-to-br from-cyan-400/14 via-white/[0.07] to-fuchsia-500/14 shadow-cyan-950/30' : 'border-white/10 bg-white/[0.045] shadow-black/20'}`}>
      <div className="relative min-h-[18rem] bg-neutral-900">
        {image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-85" /> : <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20"><AppIcon name="movies" size={46} /></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/35 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-100/80">{mediaTypeLabel(share.itemType)} from {share.senderDisplayName}</p>
          <h2 className="mt-2 text-3xl font-black leading-none text-white">{item.title}</h2>
          <p className="mt-2 text-sm font-semibold text-neutral-300">{relativeTime(share.createdAt)}</p>
        </div>
      </div>
      <div className="p-4">
        {item.overview ? <p className="line-clamp-3 text-sm leading-6 text-neutral-300">{item.overview}</p> : <p className="text-sm text-neutral-500">No description. Open the pick to see more.</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={shareUrl} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-black text-neutral-200 transition hover:bg-white hover:text-neutral-950">Open pick</a>
          {share.response ? <span className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-black text-neutral-300">{share.response === 'want' ? 'Wanted' : 'Passed'}</span> : null}
        </div>
        {!share.response ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" disabled={busy} onClick={() => onRespond(share, 'pass')} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-neutral-200 transition hover:bg-white/10 disabled:opacity-50">Pass</button>
            <button type="button" disabled={busy} onClick={() => onRespond(share, 'want')} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-50">Want</button>
          </div>
        ) : null}
      </div>
    </article>
  )
}

function MiniPile({ title, count, icon }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-4 ring-1 ring-white/10">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-white">{title}</p>
          <p className="mt-1 text-xs text-neutral-500">{count} cards</p>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-white/[0.06]"><AppIcon name={icon} size={17} /></span>
      </div>
    </div>
  )
}

export default function SwipeInbox() {
  const [session, setSession] = useState(null)
  const [cards, setCards] = useState([])
  const [filter, setFilter] = useState('pending')
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState('')
  const [message, setMessage] = useState('')

  const pendingCards = useMemo(() => cards.filter((card) => !card.response), [cards])
  const answeredCards = useMemo(() => cards.filter((card) => card.response), [cards])
  const visibleCards = filter === 'answered' ? answeredCards : pendingCards
  const activeCard = visibleCards[0] || null
  const counts = useMemo(() => ({
    movie: cards.filter((card) => card.itemType === 'movie').length,
    series: cards.filter((card) => card.itemType === 'series').length,
    game: cards.filter((card) => card.itemType === 'game').length,
  }), [cards])

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
        setCards([])
        return
      }
      const nextCards = await getMediaShareInbox({ limit: 50, includeAnswered: true })
      setCards(nextCards)
    } catch (error) {
      flash(error.message || 'Could not load swipe inbox.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRespond(card, response) {
    setBusyKey(card.id)
    try {
      await respondMediaShare(card.id, response)
      flash(response === 'want' ? `Matched on ${card.item.title}.` : 'Card passed.')
      refresh()
    } catch (error) {
      flash(error.message || 'Could not answer that card.')
    } finally {
      setBusyKey('')
    }
  }

  useEffect(() => { refresh() }, [])

  return (
    <PageShell active="library">
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <main className="min-w-0">
          <section className="rounded-[1.6rem] border border-cyan-200/15 bg-gradient-to-br from-cyan-400/10 via-white/[0.055] to-fuchsia-500/10 p-4 text-white shadow-2xl shadow-cyan-950/25 ring-1 ring-white/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">My Library</p>
                <h1 className="mt-1 text-2xl font-black tracking-tight">Swipe inbox</h1>
                <p className="mt-1 text-sm text-neutral-400">Cards friends sent you. Pass or Want to build your watch/play pile.</p>
              </div>
              <button type="button" onClick={refresh} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-black text-neutral-300 transition hover:bg-white hover:text-neutral-950">Refresh</button>
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{filters.map((item) => <button key={item.key} type="button" onClick={() => setFilter(item.key)} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-black transition ${filter === item.key ? 'border-white bg-white text-neutral-950' : 'border-white/10 bg-white/[0.04] text-neutral-300 hover:bg-white hover:text-neutral-950'}`}>{item.label}</button>)}</div>
          </section>

          <div className="mt-4 grid gap-3">
            {!hasSupabase || !session?.user ? <p className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5 text-sm text-neutral-400">Sign in to receive swipe cards from friends.</p> : null}
            {loading && session?.user ? <p className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5 text-sm text-neutral-400">Loading cards…</p> : null}
            {!loading && session?.user && !visibleCards.length ? <p className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.04] p-5 text-center text-sm text-neutral-500">No {filter === 'answered' ? 'answered' : 'pending'} cards yet.</p> : null}
            {activeCard ? <SwipeDeckCard share={activeCard} active busy={busyKey === activeCard.id} onRespond={handleRespond} /> : null}
            {visibleCards.slice(1).map((card) => <SwipeDeckCard key={card.id} share={card} busy={busyKey === card.id} onRespond={handleRespond} />)}
          </div>
        </main>
        <aside className="grid gap-3 lg:sticky lg:top-28">
          <MiniPile title="Movie pile" count={counts.movie} icon="movies" />
          <MiniPile title="Series pile" count={counts.series} icon="series" />
          <MiniPile title="Game pile" count={counts.game} icon="games" />
          <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-4 text-sm leading-6 text-neutral-400 ring-1 ring-white/10">This is the missing pile view: every card from the inbox lives here, grouped by media type. The first card acts like the active swipe card.</div>
        </aside>
      </div>
      {message ? <div className="fixed bottom-5 left-1/2 z-[90] -translate-x-1/2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950 shadow-2xl">{message}</div> : null}
    </PageShell>
  )
}
