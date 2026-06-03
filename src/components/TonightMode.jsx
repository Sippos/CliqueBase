import { useEffect, useMemo, useState } from 'react'
import { getActiveGroupId } from '../lib/groups.js'
import { closeCliquePoll, createCliquePoll, getCliquePollsWithPendingDecisions, voteCliquePoll } from '../lib/cliquePolls.js'
import { getDecisionBacklogOptions } from '../lib/decisionBacklog.js'
import { getCliqueDecisions, markDecisionDone } from '../lib/decisions.js'
import {
  decisionOptionsOrFallback,
  defaultDecisionQuestion,
  isPollExpired,
  isPollOpen,
  leadingPollOptions,
  pollOptionStats,
  totalPollVotes,
} from '../lib/decisionLoop.js'

const typeMeta = {
  movie: { label: 'Movies', icon: '🎬' },
  series: { label: 'Series', icon: '📺' },
  game: { label: 'Games', icon: '🎮' },
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

function pollOptionLine(item) {
  if (!item?.id || !item?.title) return ''
  const type = item.itemType || item.type || 'other'
  return `[${type}:${item.id}] ${item.title}`
}

function itemArtwork(item) {
  return item.poster || item.backdrop || item.image || item.cover || ''
}

function groupedLibraryItems(libraryItems = []) {
  return ['movie', 'series', 'game'].map((type) => ({
    type,
    ...typeMeta[type],
    items: libraryItems.filter((item) => item.itemType === type),
  })).filter((group) => group.items.length)
}

function PollCard({ poll, onVote, onClose, voting, closing, lockedDecision = false }) {
  const votes = totalPollVotes(poll)
  const optionStats = pollOptionStats(poll)
  const leaders = leadingPollOptions(poll)
  const leaderLabel = leaders.length === 1 ? leaders[0].label : leaders.length > 1 ? 'Tie' : 'Waiting for votes'
  const open = isPollOpen(poll)
  const expired = isPollExpired(poll)
  const timingLabel = formatPollTiming(poll)
  const canLock = !lockedDecision && (open || expired) && optionStats.length > 0
  const statusLabel = lockedDecision ? 'locked' : expired ? 'closed' : poll.status

  return (
    <article className="rounded-[1.25rem] border border-white/10 bg-white/[0.045] p-3 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">Clique poll</p>
          <h3 className="mt-1 text-base font-black leading-tight text-white">{poll.question}</h3>
          <p className="mt-1 text-xs font-semibold text-neutral-400">{votes ? `${leaderLabel} leading with ${votes} vote${votes === 1 ? '' : 's'}.` : 'No votes yet.'}</p>
          {timingLabel ? <p className="mt-1 text-[11px] font-semibold text-neutral-500">{timingLabel}</p> : null}
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-300">{statusLabel}</span>
      </div>
      <div className="mt-3 grid gap-2">
        {optionStats.map((option) => (
          <button type="button" disabled={voting || !open} key={option.id} onClick={() => onVote(poll, option)} className={`rounded-2xl border p-3 text-left transition disabled:opacity-60 ${option.selected ? 'border-white bg-white text-neutral-950' : 'border-white/10 bg-black/20 text-white hover:bg-white/10'}`}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-black">{option.label}{option.leading ? <span className="ml-2 text-[10px] uppercase tracking-[0.14em] opacity-60">Leading</span> : null}</span>
              <span className="text-xs font-black opacity-70">{option.votes} · {option.percent}%</span>
            </div>
            <div className={`mt-2 h-1.5 overflow-hidden rounded-full ${option.selected ? 'bg-neutral-950/15' : 'bg-white/10'}`}>
              <div className={`h-full rounded-full ${option.selected ? 'bg-neutral-950' : 'bg-white'}`} style={{ width: `${option.percent}%` }} />
            </div>
          </button>
        ))}
      </div>
      {canLock ? <button type="button" disabled={closing} onClick={() => onClose(poll)} className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-neutral-100 transition hover:bg-white hover:text-neutral-950 disabled:opacity-50">{closing ? 'Closing…' : expired && !open ? 'Lock expired result' : 'Lock decision'}</button> : null}
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
    <article className="rounded-[1.25rem] border border-white/10 bg-white/[0.045] p-3 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">Locked decision</p>
          <h3 className="mt-1 text-base font-black text-white">{decision.selectedLabel}</h3>
          <p className="mt-1 text-xs text-neutral-400">Selected by {decision.selectedByDisplayName}</p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-300">{decision.status}</span>
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
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState('')
  const [polls, setPolls] = useState([])
  const [decisions, setDecisions] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [votingKey, setVotingKey] = useState('')
  const [closingKey, setClosingKey] = useState('')
  const [doneKey, setDoneKey] = useState('')

  const selectedGroup = useMemo(() => groups.find((group) => group.id === groupId) || groups[0] || null, [groups, groupId])
  const canUse = signedIn && Boolean(selectedGroup?.id)
  const lockedPollIds = useMemo(() => new Set(decisions.map((decision) => decision.pollId).filter(Boolean)), [decisions])
  const pollOptions = useMemo(() => options.split('\n').map((line) => line.trim()).filter(Boolean), [options])
  const activeCount = polls.length + decisions.length
  const libraryGroups = useMemo(() => groupedLibraryItems(libraryItems), [libraryItems])

  useEffect(() => {
    if (!groupId && groups[0]?.id) setGroupId(groups[0].id)
  }, [groups, groupId])

  useEffect(() => {
    setQuestion((current) => current || defaultDecisionQuestion(selectedGroup?.name))
  }, [selectedGroup?.name])

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
      onFlash?.(error.message || 'Could not load group polls.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [selectedGroup?.id, signedIn])

  function addOptionLine(line) {
    const cleanLine = String(line || '').trim()
    if (!cleanLine) return
    const current = options.split('\n').map((item) => item.trim()).filter(Boolean)
    if (current.some((item) => item === cleanLine)) return
    setOptions([...current, cleanLine].slice(0, 8).join('\n'))
  }

  function handleLibraryPick(item) {
    addOptionLine(pollOptionLine(item))
  }

  async function handleSeedBacklog() {
    if (!canUse) {
      onFlash?.('Join or create a clique first.')
      return
    }
    setSeeding(true)
    try {
      const backlogOptions = await getDecisionBacklogOptions(selectedGroup.id, 6)
      if (backlogOptions.length < 2) {
        onFlash?.('Add at least two unfinished clique picks first.')
        return
      }
      setOptions(backlogOptions.join('\n'))
      setQuestion(defaultDecisionQuestion(selectedGroup.name))
      onFlash?.('Loaded top unfinished clique picks.')
    } catch (error) {
      onFlash?.(error.message || 'Could not load clique backlog.')
    } finally {
      setSeeding(false)
    }
  }

  async function handleCreate(event) {
    event.preventDefault()
    if (!canUse) {
      onFlash?.('Join or create a clique first.')
      return
    }
    if (pollOptions.length < 2) {
      onFlash?.('Choose at least two options or use the clique backlog.')
      return
    }
    setSaving(true)
    try {
      await createCliquePoll(selectedGroup.id, question || defaultDecisionQuestion(selectedGroup.name), decisionOptionsOrFallback(options))
      setQuestion(defaultDecisionQuestion(selectedGroup.name))
      setOptions('')
      onFlash?.('Group poll created.')
      refresh()
    } catch (error) {
      onFlash?.(error.message || 'Could not create poll.')
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
      const label = leaders.length === 1 ? ` Decision locked: ${leaders[0].label}.` : ''
      onFlash?.(`Poll closed.${label}`)
      refresh()
    } catch (error) {
      onFlash?.(error.message || 'Could not close poll.')
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
    <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-4 text-white backdrop-blur-xl">
      <button type="button" onClick={() => setExpanded((value) => !value)} className="flex w-full items-start justify-between gap-3 text-left">
        <span>
          <span className="block text-lg font-black">Clique backlog</span>
          <span className="mt-1 block text-xs leading-5 text-neutral-400">Turn unfinished clique picks into a quick group decision.</span>
        </span>
        <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-100">{expanded ? 'Hide' : activeCount ? `${activeCount} active` : 'Open'}</span>
      </button>

      {expanded ? (
        <>
          {!signedIn ? <p className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-neutral-300">Sign in to create and vote on group polls.</p> : null}
          {signedIn && !groups.length ? <p className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-neutral-300">Create or join a clique to unlock group decisions.</p> : null}

          {signedIn && groups.length ? (
            <form onSubmit={handleCreate} className="mt-4 grid gap-3">
              <select value={groupId} onChange={(event) => setGroupId(event.target.value)} className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none">
                {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
              </select>
              <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={defaultDecisionQuestion(selectedGroup?.name)} className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-500" />
              <button type="button" disabled={seeding || !canUse} onClick={handleSeedBacklog} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-neutral-100 transition hover:bg-white hover:text-neutral-950 disabled:opacity-50">{seeding ? 'Loading backlog…' : 'Use clique backlog'}</button>

              {libraryGroups.length ? (
                <div className="grid gap-3">
                  {libraryGroups.map((group) => (
                    <div key={group.type} className="grid gap-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">{group.icon} {group.label}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {group.items.slice(0, 4).map((item) => {
                          const line = pollOptionLine(item)
                          const selected = pollOptions.includes(line)
                          return (
                            <button key={`${item.itemType}:${item.id}`} type="button" onClick={() => handleLibraryPick(item)} className={`flex items-center gap-2 rounded-2xl border p-2 text-left transition ${selected ? 'border-white bg-white text-neutral-950' : 'border-white/10 bg-black/20 text-white hover:bg-white/10'}`}>
                              {itemArtwork(item) ? <img src={itemArtwork(item)} alt="" className="h-12 w-9 shrink-0 rounded-lg object-cover" /> : <span className="grid h-12 w-9 shrink-0 place-items-center rounded-lg bg-white/10 text-lg">{group.icon}</span>}
                              <span className="min-w-0"><span className="block truncate text-xs font-black">{item.title}</span><span className="text-[10px] uppercase tracking-[0.14em] opacity-60">{selected ? 'Added' : 'Add'}</span></span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-neutral-400">Options</p>
                  <span className="text-xs font-bold text-neutral-500">{pollOptions.length}/8</span>
                </div>
                {pollOptions.length ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {pollOptions.map((option) => <span key={option} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-bold text-neutral-200">{option.replace(/^\[[^\]]+\]\s*/, '')}</span>)}
                  </div>
                ) : <p className="mt-2 text-sm text-neutral-500">Use clique backlog or tap at least two picks above.</p>}
              </div>

              <button disabled={saving || !canUse || pollOptions.length < 2} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-50">{saving ? 'Creating…' : 'Start poll'}</button>
            </form>
          ) : null}

          <div className="mt-4 grid gap-3">
            {loading ? <p className="rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-neutral-300">Loading polls…</p> : polls.length ? polls.map((poll) => <PollCard key={poll.id} poll={poll} onVote={handleVote} onClose={handleClose} voting={Boolean(votingKey)} closing={closingKey === poll.id} lockedDecision={lockedPollIds.has(poll.id)} />) : canUse ? <p className="rounded-2xl border border-dashed border-white/10 bg-black/15 p-4 text-sm text-neutral-400">No active polls yet.</p> : null}
          </div>

          {canUse && decisions.length ? (
            <div className="mt-5 grid gap-3">
              <div className="flex items-center justify-between gap-3 px-1"><h3 className="text-sm font-black uppercase tracking-[0.18em] text-neutral-400">Recent decisions</h3></div>
              {decisions.map((decision) => <DecisionCard key={decision.id} decision={decision} onDone={handleDone} saving={doneKey === decision.id} />)}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
