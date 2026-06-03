import { useEffect, useMemo, useState } from 'react'
import AppIcon from './AppIcon.jsx'
import { getActiveGroupId } from '../lib/groups.js'
import { closeCliquePoll, createCliquePoll, getCliquePolls, voteCliquePoll } from '../lib/cliquePolls.js'
import { getCliqueDecisions, markDecisionDone } from '../lib/decisions.js'
import {
  decisionOptionsOrFallback,
  defaultDecisionQuestion,
  isPollOpen,
  leadingPollOptions,
  pollOptionStats,
  totalPollVotes,
} from '../lib/decisionLoop.js'

function PollCard({ poll, onVote, onClose, voting, closing }) {
  const votes = totalPollVotes(poll)
  const optionStats = pollOptionStats(poll)
  const leaders = leadingPollOptions(poll)
  const leaderLabel = leaders.length === 1 ? leaders[0].label : leaders.length > 1 ? 'Tie' : 'Waiting for votes'
  const open = isPollOpen(poll)

  return (
    <article className="rounded-[1.5rem] border border-white/10 bg-neutral-950/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Tonight poll</p>
          <h3 className="mt-1 text-lg font-black leading-tight text-white">{poll.question}</h3>
          <p className="mt-1 text-xs font-semibold text-neutral-500">{votes ? `${leaderLabel} leading with ${votes} total vote${votes === 1 ? '' : 's'}.` : 'No votes yet. Rally the clique.'}</p>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400">{poll.status}</span>
      </div>
      <div className="mt-3 grid gap-2">
        {optionStats.map((option) => (
          <button
            type="button"
            disabled={voting || !open}
            key={option.id}
            onClick={() => onVote(poll, option)}
            className={`rounded-2xl border p-3 text-left transition disabled:opacity-60 ${option.selected ? 'border-white bg-white text-neutral-950' : 'border-white/10 bg-white/[0.03] text-white hover:bg-white/10'}`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-black">{option.label}{option.leading ? <span className="ml-2 text-[10px] uppercase tracking-[0.14em] opacity-60">Leading</span> : null}</span>
              <span className="text-xs font-black opacity-70">{option.votes} · {option.percent}%</span>
            </div>
            <div className={`mt-2 h-1.5 overflow-hidden rounded-full ${option.selected ? 'bg-neutral-950/15' : 'bg-white/10'}`}>
              <div className={`h-full rounded-full ${option.selected ? 'bg-neutral-950' : 'bg-white'}`} style={{ width: `${option.percent}%` }} />
            </div>
          </button>
        ))}
      </div>
      {open ? (
        <button
          type="button"
          disabled={closing}
          onClick={() => onClose(poll)}
          className="mt-3 w-full rounded-2xl border border-white/10 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-neutral-300 transition hover:bg-white hover:text-neutral-950 disabled:opacity-50"
        >
          {closing ? 'Closing…' : 'Lock decision'}
        </button>
      ) : null}
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
    <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Locked decision</p>
          <h3 className="mt-1 text-lg font-black text-white">{decision.selectedLabel}</h3>
          <p className="mt-1 text-xs text-neutral-500">Selected by {decision.selectedByDisplayName}</p>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400">{decision.status}</span>
      </div>

      {done ? (
        <div className="mt-3 rounded-2xl border border-white/10 bg-neutral-950/70 p-3 text-sm text-neutral-300">
          <p className="font-bold text-white">Done{decision.rating !== null ? ` · ${decision.rating}/10` : ''}</p>
          {decision.notes ? <p className="mt-1 text-neutral-400">{decision.notes}</p> : null}
          {decision.completedByDisplayName ? <p className="mt-2 text-xs text-neutral-600">Marked by {decision.completedByDisplayName}</p> : null}
        </div>
      ) : (
        <form onSubmit={submit} className="mt-3 grid gap-2">
          <div className="grid gap-2 sm:grid-cols-[8rem_1fr]">
            <input
              value={rating}
              onChange={(event) => setRating(event.target.value)}
              inputMode="decimal"
              placeholder="0-10"
              className="rounded-2xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-600"
            />
            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional verdict after watching/playing"
              className="rounded-2xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-white outline-none placeholder:text-neutral-600"
            />
          </div>
          <button disabled={saving} className="rounded-2xl bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-50">
            {saving ? 'Saving…' : 'Mark done'}
          </button>
        </form>
      )}
    </article>
  )
}

export default function TonightMode({ groups = [], signedIn = false, onFlash }) {
  const activeGroupId = getActiveGroupId()
  const [groupId, setGroupId] = useState(activeGroupId || groups[0]?.id || '')
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState('')
  const [polls, setPolls] = useState([])
  const [decisions, setDecisions] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [votingKey, setVotingKey] = useState('')
  const [closingKey, setClosingKey] = useState('')
  const [doneKey, setDoneKey] = useState('')

  const selectedGroup = useMemo(() => groups.find((group) => group.id === groupId) || groups[0] || null, [groups, groupId])
  const canUse = signedIn && Boolean(selectedGroup?.id)

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
        getCliquePolls(selectedGroup.id, 5),
        getCliqueDecisions(selectedGroup.id, 5),
      ])
      setPolls(nextPolls)
      setDecisions(nextDecisions)
    } catch (error) {
      onFlash?.(error.message || 'Could not load Tonight Mode.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [selectedGroup?.id, signedIn])

  async function handleCreate(event) {
    event.preventDefault()
    if (!canUse) {
      onFlash?.('Join or create a clique first.')
      return
    }
    setSaving(true)
    try {
      await createCliquePoll(selectedGroup.id, question || defaultDecisionQuestion(selectedGroup.name), decisionOptionsOrFallback(options))
      setQuestion(defaultDecisionQuestion(selectedGroup.name))
      setOptions('')
      onFlash?.('Tonight poll created.')
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
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-neutral-500"><AppIcon name="users" size={14} />Tonight Mode</p>
          <h2 className="mt-1 text-2xl font-black text-white">Let the clique decide</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-400">Create a fast poll, lock the winner, then mark the decision done after the group tries it.</p>
        </div>
      </div>

      {!signedIn ? <p className="mt-4 rounded-2xl border border-white/10 bg-neutral-950 p-3 text-sm text-neutral-400">Sign in to create and vote on clique polls.</p> : null}
      {signedIn && !groups.length ? <p className="mt-4 rounded-2xl border border-white/10 bg-neutral-950 p-3 text-sm text-neutral-400">Create or join a clique to unlock Tonight Mode.</p> : null}

      {signedIn && groups.length ? (
        <form onSubmit={handleCreate} className="mt-4 grid gap-3">
          <select value={groupId} onChange={(event) => setGroupId(event.target.value)} className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none">
            {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
          <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={defaultDecisionQuestion(selectedGroup?.name)} className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none placeholder:text-neutral-600" />
          <textarea value={options} onChange={(event) => setOptions(event.target.value)} rows={3} placeholder={'One option per line\nThe movie pick\nThe game pick'} className="resize-none rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none placeholder:text-neutral-600" />
          <button disabled={saving || !canUse} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white hover:text-neutral-950 disabled:opacity-50">{saving ? 'Creating…' : 'Start poll'}</button>
        </form>
      ) : null}

      <div className="mt-4 grid gap-3">
        {loading ? <p className="rounded-2xl border border-white/10 bg-neutral-950 p-3 text-sm text-neutral-400">Loading Tonight Mode…</p> : polls.length ? polls.map((poll) => <PollCard key={poll.id} poll={poll} onVote={handleVote} onClose={handleClose} voting={Boolean(votingKey)} closing={closingKey === poll.id} />) : canUse ? <p className="rounded-2xl border border-dashed border-white/10 bg-neutral-950/60 p-4 text-sm text-neutral-500">No polls yet. Start one for your clique.</p> : null}
      </div>

      {canUse && decisions.length ? (
        <div className="mt-5 grid gap-3">
          <div className="flex items-center justify-between gap-3 px-1">
            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-neutral-500">Recent decisions</h3>
          </div>
          {decisions.map((decision) => <DecisionCard key={decision.id} decision={decision} onDone={handleDone} saving={doneKey === decision.id} />)}
        </div>
      ) : null}
    </section>
  )
}
