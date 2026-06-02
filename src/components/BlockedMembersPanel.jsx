import { useEffect, useState } from 'react'
import { getBlockedUsers, unblockUser } from '../lib/safety.js'

export default function BlockedMembersPanel({ signedIn = false, onFlash, onChanged }) {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [busyKey, setBusyKey] = useState('')

  async function refresh() {
    if (!signedIn) {
      setMembers([])
      return
    }
    setLoading(true)
    try {
      setMembers(await getBlockedUsers())
    } catch (error) {
      onFlash?.(error.message || 'Could not load blocked members.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [signedIn])

  async function handleUnblock(member) {
    setBusyKey(member.id)
    try {
      await unblockUser(member.id)
      setMembers((current) => current.filter((item) => item.id !== member.id))
      onFlash?.(`${member.displayName} unblocked.`)
      onChanged?.()
    } catch (error) {
      onFlash?.(error.message || 'Could not unblock member.')
    } finally {
      setBusyKey('')
    }
  }

  if (!signedIn) return null

  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-4 text-white">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between gap-3 text-left">
        <span>
          <span className="block text-[10px] font-black uppercase tracking-[0.24em] text-neutral-500">Safety</span>
          <span className="mt-1 block text-xl font-black">Blocked members</span>
        </span>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-black text-neutral-300">{loading ? '…' : members.length}</span>
      </button>
      {open ? (
        <div className="mt-4 grid gap-2">
          <button type="button" onClick={refresh} className="w-fit rounded-2xl border border-white/10 px-3 py-2 text-xs font-black text-neutral-300 transition hover:bg-white hover:text-neutral-950">Refresh</button>
          {loading ? <p className="rounded-2xl border border-white/10 bg-neutral-950 p-3 text-sm text-neutral-400">Loading blocked members…</p> : members.length ? members.map((member) => (
            <article key={member.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-neutral-950/75 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-white">{member.displayName}</p>
                {member.blockedAt ? <p className="mt-1 text-xs text-neutral-500">Blocked {new Date(member.blockedAt).toLocaleDateString()}</p> : null}
              </div>
              <button type="button" disabled={busyKey === member.id} onClick={() => handleUnblock(member)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-neutral-300 transition hover:bg-white hover:text-neutral-950 disabled:opacity-50">{busyKey === member.id ? 'Unblocking…' : 'Unblock'}</button>
            </article>
          )) : <p className="rounded-2xl border border-dashed border-white/10 bg-neutral-950/60 p-4 text-sm text-neutral-500">No blocked members.</p>}
        </div>
      ) : null}
    </section>
  )
}
