import { useEffect, useMemo, useState } from 'react'
import AppIcon from './AppIcon.jsx'
import { getActiveGroupId } from '../lib/groups.js'
import { closeCliquePoll, createCliquePoll, getCliquePollsWithPendingDecisions, voteCliquePoll } from '../lib/cliquePolls.js'
import { getCliqueDecisions, markDecisionDone } from '../lib/decisions.js'
import {
  formatStructuredDecisionOption,
  isPollExpired,
  isPollOpen,
  leadingPollOptions,
  pollOptionStats,
  totalPollVotes,
} from '../lib/decisionLoop.js'

const typeMeta = {
  movie: { label: 'Movies', singular: 'movie', icon: 'movies', verb: 'watch' },
  series: { label: 'Series', singular: 'series', icon: 'series', verb: 'watch' },
  game: { label: 'Games', singular: 'game', icon: 'games', verb: 'play' },
}

function formatPollTiming(poll) {
  if (!poll?.closesAt) return ''
  const closesAt = new Date(poll.closesAt).getTime()
  if (!Number.isFinite(closesAt)) return ''
  const remainingMs = closesAt - Date.now()
  if (remainingMs <= 0) return 'Closed automatically'
  const minutes = Math.ceil(remainingMs / 60000)
  if (minutes < 60) return `${minutes}m left`
  const hours = Math.ceil(minutes / 60)
  if (hours < 24) return `${hours}h left`
  return `${Math.ceil(hours / 24)}d left`
}

function itemArtwork(item) {
  return item.poster || item.backdrop || item.image || item.cover || ''
}

function cleanPollLabel(label = '') {
  return String(label).replace(/^\[[^\]]+\]\s*/, '').replace(/^Want to (watch|play)\s+/i, '').replace(/^Pass on\s+/i, '')
}

function voteAction(option) {
  const label = String(option?.label || '').toLowerCase()
  if (label.startsWith('pass')) return 'pass'
  return 'want'
}

function pollPickTitle(poll) {
  const option = (poll?.options || []).find((entry) => voteAction(entry) === 'want') || poll?.options?.[0]
  return cleanPollLabel(option?.label || poll?.question || '')
}

function IconBadge({ name }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.08] text-amber-100 shadow-inner shadow-white/5">
      <AppIcon name={name} size={17} />
    </span>
  )
}

function PollCard({ poll, onVote, onClose, voting, closing, lockedDecision = false }) {
  const votes = totalPollVotes(poll)
  const optionStats = pollOptionStats(poll)
  const wantOption = optionStats.find((option) => voteAction(option) === 'want') || optionStats[0]
  const passOption = optionStats.find((option) => voteAction(option) === 'pass') || optionStats[1]
  const leaders = leadingPollOptions(poll)
  const leaderAction = leaders.length === 1 ? voteAction(leaders[0]) : ''
  const open = isPollOpen(poll)
  const expired = isPollExpired(poll)
  const timingLabel = formatPollTiming(poll)
  const canLock = !lockedDecision && (open || expired) && optionStats.length > 0
  const statusLabel = lockedDecision ? 'locked' : expired ? 'closed' : poll.status
  const pickTitle = pollPickTitle(poll)

  return (
    <article className="overflow-hidden rounded-[1.5rem] border border-amber-200/15 bg-gradient-to-br from-amber-300/12 via-white/[0.06] to-orange-500/10 shadow-2xl shadow-amber-950/20 backdrop-blur-2xl ring-1 ring-white/10">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100/65">Clique vote</p>
            <h3 className="mt-1 text-lg font-black leading-tight text-white">{pickTitle}</h3>
            <p className="mt-1 text-xs font-semibold text-neutral-400">{votes ? `${votes} vote${votes === 1 ? '' : 's'} so far${leaderAction ? ` · ${leaderAction === 'want' ? 'Want' : 'Pass'} leads` : ''}.` : 'Waiting for the clique to vote.'}</p>
            {timingLabel ? <p className="mt-1 text-[11px] font-semibold text-neutral-500">{timingLabel}</p> : null}
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-200">{statusLabel}</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {passOption ? (
            <button type="button" disabled={voting || !open} onClick={() => onVote(poll, passOption)} className={`rounded-2xl border px-4 py-3 text-left transition disabled:opacity-60 ${passOption.selected ? 'border-white bg-white text-neutral-950' : 'border-white/10 bg-black/25 text-white hover:bg-white/10'}`}>
              <span className="block text-sm font-black">Pass</span>
              <span className="mt-1 block text-xs opacity-70">{passOption.votes} · {passOption.percent}%</span>
            </button>
          ) : null}
          {wantOption ? (
            <button type="button" disabled={voting || !open} onClick={() => onVote(poll, wantOption)} className={`rounded-2xl border px-4 py-3 text-left transition disabled:opacity-60 ${wantOption.selected ? 'border-white bg-white text-neutral-950' : 'border-white/10 bg-black/25 text-white hover:bg-white/10'}`}>
              <span className="block text-sm font-black">Want</span>
              <span className="mt-1 block text-xs opacity-70">{wantOption.votes} · {wantOption.percent}%</span>
            </button>
          ) : null}
        </div>
      </div>
      {canLock ? <button type="button" disabled={closing} onClick={() => onClose(poll)} className="w-full border-t border-white/10 bg-white/[0.06] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-neutral-100 transition hover:bg-white hover:text-neutral-950 disabled:opacity-50">{closing ? 'Closing…' : 'Lock result'}</button> : null}
    </article>
  )
}

function DecisionCard({ decision, onDone, saving }) {
  const [rating, setRating] = useState(decision.rating ?? '')
  const [notes, setNotes] = useState(decision.notes || '')
  const done = decision.status === 'done' || decision.status === 'rated'

  function submit(event) {
    event.preventDefault()
    onDone(decision, rating, notes)
  }

  return (
    <article className="rounded-[1.25rem] border border-amber-200/15 bg-white/[0.06] p-3 backdrop-blur-xl ring-1 ring-white/10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">Chosen by clique</p>
          <h3 className="mt-1 text-base font-black text-white">{cleanPollLabel(decision.selectedLabel)}</h3>
          <p className="mt-1 text-xs text-neutral-400">Selected by {decision.selectedByDisplayName}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-300">{decision.status}</span>
      </div>

      {done ? (
        <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-neutral-200">
          <p className="font-bold text-white">Done{decision.rating !== null ? ` · ${decision.rating}/10` : ''}</p>
          {decision.notes ? <p className="mt-1 text-neutral-300/80">{decision.notes}</p> : null}
          {decision.completedByDisplayName ? <p className="mt-2 text-xs text-neutral-500">Marked by {decision.completedByDisplayName}</p> : null}
        </div>
      ) : (
        <form onSubmit={submit} className="mt-3 grid gap-2">
          <div className="grid gap-2 sm:grid-cols-[8rem_1fr]">
            <input value={rating} onChange={(event) => setRating(event.target.value)} inputMode="decimal" placeholder="0-10" className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-500" />
            <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional verdict after watching/playing" className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-500" />
          </div>
          <button disabled={saving} className="rounded-2xl bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-50">{saving ? 'Saving…' : 'Mark done'}</button>
        </form>
      )}
    </article>
  )
}

export default function TonightMode({ groups = [], libraryItems = [], signedIn = false, onFlash }) {
  const activeGroupId = getActiveGroupId()
  const [expanded, setExpanded] = useState(false)
  const [groupId, setGroupId] = useState(activeGroupId || groups[0]?.id || '')
  const [itemType, setItemType] = useState('movie')
  const [selectedLibraryKey, setSelectedLibraryKey] = useState('')
  const [title, setTitle] = useState('')
  const [itemId, setItemId] = useState('')
  const [polls, setPolls] = useState([])
  const [decisions, setDecisions] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [votingKey, setVotingKey] = useState('')
  const [closingKey, setClosingKey] = useState('')
  const [doneKey, setDoneKey] = useState('')

  const selectedGroup = useMemo(() => groups.find((group) => group.id === groupId) || groups[0] || null, [groups, groupId])
  const canUse = signedIn && Boolean(selectedGroup?.id)
  const lockedPollIds = useMemo(() => new Set(decisions.map((decision) => decision.pollId).filter(Boolean)), [decisions])
  const activeCount = polls.length + decisions.length
  const availableItems = useMemo(() => libraryItems.filter((item) => item.itemType === itemType), [libraryItems, itemType])
  const previewItems = useMemo(() => availableItems.slice(0, 4), [availableItems])
  const activeMeta = typeMeta[itemType] || typeMeta.movie

  useEffect(() => {
    if (!groupId && groups[0]?.id) setGroupId(groups[0].id)
  }, [groups, groupId])

  async function refresh() {
    if (!canUse) {
      setPolls([])
      setDecisions([])
      return
    }
    setLoading(true)
    try {
      const [nextPolls, nextDecisions] = await Promise.all([
        getCliquePollsWithPendingDecisions(selectedGroup.id, 5),
        getCliqueDecisions(selectedGroup.id, 5),
      ])
      setPolls(nextPolls)
      setDecisions(nextDecisions)
    } catch (error) {
      onFlash?.(error.message || 'Could not load clique votes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [selectedGroup?.id, signedIn])

  function handleTypeChange(value) {
    setItemType(value)
    setSelectedLibraryKey('')
    setTitle('')
    setItemId('')
  }

  function handleLibraryPick(value) {
    setSelectedLibraryKey(value)
    const item = libraryItems.find((entry) => `${entry.itemType}:${entry.id}` === value)
    if (!item) return
    setItemType(item.itemType)
    setTitle(item.title)
    setItemId(String(item.id))
  }

  async function handleCreate(event) {
    event.preventDefault()
    if (!canUse) {
      onFlash?.('Join or create a clique first.')
      return
    }
    if (!title.trim()) {
      onFlash?.('Choose or type one pick first.')
      return
    }
    const verb = activeMeta.verb || 'watch'
    const cleanTitle = title.trim()
    const wantLabel = itemId ? formatStructuredDecisionOption(itemType, itemId, `Want to ${verb} ${cleanTitle}`) : `Want to ${verb} ${cleanTitle}`
    const passLabel = `Pass on ${cleanTitle}`
    setSaving(true)
    try {
      await createCliquePoll(selectedGroup.id, `Should ${selectedGroup.name} ${verb} ${cleanTitle}?`, [wantLabel, passLabel])
      setSelectedLibraryKey('')
      setTitle('')
      setItemId('')
      onFlash?.('Clique vote started.')
      refresh()
    } catch (error) {
      onFlash?.(error.message || 'Could not start vote.')
    } finally {
      setSaving(false)
    }
  }

  async function handleVote(poll, option) {
    setVotingKey(`${poll.id}:${option.id}`)
    try {
      await voteCliquePoll(poll.id, option.id)
      onFlash?.('Vote saved.')
      refresh()
    } catch (error) {
      onFlash?.(error.message || 'Could not vote.')
    } finally {
      setVotingKey('')
    }
  }

  async function handleClose(poll) {
    setClosingKey(poll.id)
    try {
      await closeCliquePoll(poll.id)
      const leaders = leadingPollOptions(poll)
      const label = leaders.length === 1 ? ` Result: ${cleanPollLabel(leaders[0].label)}.` : ''
      onFlash?.(`Vote closed.${label}`)
      refresh()
    } catch (error) {
      onFlash?.(error.message || 'Could not close vote.')
    } finally {
      setClosingKey('')
    }
  }

  async function handleDone(decision, rating, notes) {
    setDoneKey(decision.id)
    try {
      await markDecisionDone(decision.id, rating, notes)
      onFlash?.('Decision marked done.')
      refresh()
    } catch (error) {
      onFlash?.(error.message || 'Could not mark decision done.')
    } finally {
      setDoneKey('')
    }
  }

  return (
    <section className="rounded-2xl border border-white/15 bg-white/[0.12] p-4 text-white shadow-xl shadow-black/20">
      <button type="button" onClick={() => setExpanded((value) => !value)} className="flex w-full items-start justify-between gap-3 text-left">
        <span className="flex min-w-0 items-start gap-3">
          <IconBadge name="users" />
          <span className="min-w-0">
            <span className="block text-lg font-black">Clique votes</span>
            <span className="mt-1 block text-xs leading-5 text-neutral-300/85">Suggest one pick. The clique answers Want or Pass.</span>
          </span>
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-100">{expanded ? 'Hide' : activeCount ? `${activeCount} active` : 'Open'}</span>
      </button>

      {expanded ? (
        <>
          {!signedIn ? <p className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-neutral-300">Sign in to suggest and vote with cliques.</p> : null}
          {signedIn && !groups.length ? <p className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-neutral-300">Create or join a clique to start votes.</p> : null}

          {signedIn && groups.length ? (
            <form onSubmit={handleCreate} className="mt-4 grid gap-3">
              <div className="grid gap-2">
                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">1. Clique</label>
                <select value={groupId} onChange={(event) => setGroupId(event.target.value)} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none">
                  {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                </select>
              </div>

              <div className="grid gap-2">
                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">2. What do you suggest?</label>
                <select value={itemType} onChange={(event) => handleTypeChange(event.target.value)} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none">
                  {Object.entries(typeMeta).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
                </select>
              </div>

              {previewItems.length ? (
                <div className="grid gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    {previewItems.map((item) => {
                      const key = `${item.itemType}:${item.id}`
                      const selected = key === selectedLibraryKey
                      return (
                        <button key={key} type="button" onClick={() => handleLibraryPick(key)} className={`flex items-center gap-2 rounded-2xl border p-2 text-left transition ${selected ? 'border-white bg-white text-neutral-950' : 'border-white/10 bg-black/25 text-white hover:bg-white/10'}`}>
                          {itemArtwork(item) ? <img src={itemArtwork(item)} alt="" className="h-12 w-9 shrink-0 rounded-lg object-cover" /> : <IconBadge name={typeMeta[item.itemType]?.icon || 'explore'} />}
                          <span className="min-w-0"><span className="block truncate text-xs font-black">{item.title}</span><span className="text-[10px] uppercase tracking-[0.14em] opacity-60">{selected ? 'Selected' : 'Select'}</span></span>
                        </button>
                      )
                    })}
                  </div>
                  <select value={selectedLibraryKey} onChange={(event) => handleLibraryPick(event.target.value)} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none">
                    <option value="">More {activeMeta.label.toLowerCase()}…</option>
                    {availableItems.map((item) => <option key={`${item.itemType}:${item.id}`} value={`${item.itemType}:${item.id}`}>{item.title}</option>)}
                  </select>
                </div>
              ) : null}

              <input value={title} onChange={(event) => { setTitle(event.target.value); setSelectedLibraryKey(''); setItemId('') }} placeholder={`Or type a ${activeMeta.singular}`} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-500" />

              <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-neutral-300">
                <p className="font-bold text-white">What happens next?</p>
                <p className="mt-1 text-xs leading-5 text-neutral-400">This creates one swipe-style clique card. Everyone votes <span className="font-bold text-neutral-200">Want</span> or <span className="font-bold text-neutral-200">Pass</span>; when the result is locked, it becomes the clique decision.</p>
              </div>

              <button disabled={saving || !canUse || !title.trim()} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-50">{saving ? 'Starting…' : 'Ask clique to vote'}</button>
            </form>
          ) : null}

          <div className="mt-4 grid gap-3">
            {loading ? <p className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-neutral-300">Loading clique votes…</p> : polls.length ? polls.map((poll) => <PollCard key={poll.id} poll={poll} onVote={handleVote} onClose={handleClose} voting={Boolean(votingKey)} closing={closingKey === poll.id} lockedDecision={lockedPollIds.has(poll.id)} />) : canUse ? <p className="rounded-2xl border border-dashed border-white/10 bg-black/15 p-4 text-sm text-neutral-400">No active clique votes yet.</p> : null}
          </div>

          {canUse && decisions.length ? (
            <div className="mt-5 grid gap-3">
              <div className="flex items-center justify-between gap-3 px-1"><h3 className="text-sm font-black uppercase tracking-[0.18em] text-neutral-400">Chosen picks</h3></div>
              {decisions.map((decision) => <DecisionCard key={decision.id} decision={decision} onDone={handleDone} saving={doneKey === decision.id} />)}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
