import { useEffect, useMemo, useState } from 'react'
import AppIcon from './AppIcon.jsx'
import { getActiveGroupId } from '../lib/groups.js'
import { createCliquePoll, getCliquePolls, voteCliquePoll } from '../lib/cliquePolls.js'

function totalVotes(poll) {
  return (poll.options || []).reduce((sum, option) => sum + Number(option.votes || 0), 0)
}

function defaultQuestion(groupName) {
  return groupName ? `What should ${groupName} pick tonight?` : 'What should we pick tonight?'
}

function PollCard({ poll, onVote, voting }) {
  const votes = totalVotes(poll)
  return (
    <article className="rounded-[1.5rem] border border-white/10 bg-neutral-950/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">Tonight poll</p>
          <h3 className="mt-1 text-lg font-black leading-tight text-white">{poll.question}</h3>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400">{poll.status}</span>
      </div>
      <div className="mt-3 grid gap-2">
        {(poll.options || []).map((option) => {
          const selected = poll.myOptionId === option.id
          const pct = votes ? Math.round((Number(option.votes || 0) / votes) * 100) : 0
          return (
            <button
              type="button"
              disabled={voting || poll.status !== 'open'}
              key={option.id}
              onClick={() => onVote(poll, option)}
              className={`rounded-2xl border p-3 text-left transition disabled:opacity-60 ${selected ? 'border-white bg-white text-neutral-950' : 'border-white/10 bg-white/[0.03] text-white hover:bg-white/10'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-black">{option.label}</span>
                <span className="text-xs font-black opacity-70">{option.votes} · {pct}%</span>
              </div>
              <div className={`mt-2 h-1.5 overflow-hidden rounded-full ${selected ? 'bg-neutral-950/15' : 'bg-white/10'}`}>
                <div className={`h-full rounded-full ${selected ? 'bg-neutral-950' : 'bg-white'}`} style={{ width: `${pct}%` }} />
              </div>
            </button>
          )
        })}
      </div>
    </article>
  )
}

export default function TonightMode({ groups = [], signedIn = false, onFlash }) {
  const activeGroupId = getActiveGroupId()
  const [groupId, setGroupId] = useState(activeGroupId || groups[0]?.id || '')
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState('')
  const [polls, setPolls] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [votingKey, setVotingKey] = useState('')

  const selectedGroup = useMemo(() => groups.find((group) => group.id === groupId) || groups[0] || null, [groups, groupId])
  const canUse = signedIn && Boolean(selectedGroup?.id)

  useEffect(() => {
    if (!groupId && groups[0]?.id) setGroupId(groups[0].id)
  }, [groups, groupId])

  useEffect(() => {
    setQuestion((current) => current || defaultQuestion(selectedGroup?.name))
  }, [selectedGroup?.name])

  async function refresh() {
    if (!canUse) {
      setPolls([])
      return
    }
    setLoading(true)
    try {
      setPolls(await getCliquePolls(selectedGroup.id, 5))
    } catch (error) {
      onFlash?.(error.message || 'Could not load clique polls.')
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
      await createCliquePoll(selectedGroup.id, question || defaultQuestion(selectedGroup.name), options || 'Movie night\nGame night\nOne episode only')
      setQuestion(defaultQuestion(selectedGroup.name))
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

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-neutral-500"><AppIcon name="users" size={14} />Tonight Mode</p>
          <h2 className="mt-1 text-2xl font-black text-white">Let the clique decide</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-400">Create a fast poll for movie night, co-op sessions, binge picks, or anything else your group is deciding.</p>
        </div>
      </div>

      {!signedIn ? <p className="mt-4 rounded-2xl border border-white/10 bg-neutral-950 p-3 text-sm text-neutral-400">Sign in to create and vote on clique polls.</p> : null}
      {signedIn && !groups.length ? <p className="mt-4 rounded-2xl border border-white/10 bg-neutral-950 p-3 text-sm text-neutral-400">Create or join a clique to unlock Tonight Mode.</p> : null}

      {signedIn && groups.length ? (
        <form onSubmit={handleCreate} className="mt-4 grid gap-3">
          <select value={groupId} onChange={(event) => setGroupId(event.target.value)} className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none">
            {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
          <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={defaultQuestion(selectedGroup?.name)} className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none placeholder:text-neutral-600" />
          <textarea value={options} onChange={(event) => setOptions(event.target.value)} rows={3} placeholder={'One option per line\nThe movie pick\nThe game pick'} className="resize-none rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-white outline-none placeholder:text-neutral-600" />
          <button disabled={saving || !canUse} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white hover:text-neutral-950 disabled:opacity-50">{saving ? 'Creating…' : 'Start poll'}</button>
        </form>
      ) : null}

      <div className="mt-4 grid gap-3">
        {loading ? <p className="rounded-2xl border border-white/10 bg-neutral-950 p-3 text-sm text-neutral-400">Loading polls…</p> : polls.length ? polls.map((poll) => <PollCard key={poll.id} poll={poll} onVote={handleVote} voting={Boolean(votingKey)} />) : canUse ? <p className="rounded-2xl border border-dashed border-white/10 bg-neutral-950/60 p-4 text-sm text-neutral-500">No polls yet. Start one for your clique.</p> : null}
      </div>
    </section>
  )
}
