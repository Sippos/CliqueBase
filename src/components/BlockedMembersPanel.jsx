import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { addFriend, getFriendsList, removeFriend, searchMembersByProfileName } from '../lib/communityShare.js'
import { getBlockedUsers, unblockUser } from '../lib/safety.js'

function PersonCard({ person, action, actionLabel, busy, onClose }) {
  return (
    <article className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-neutral-950/75 p-3">
      <Link to={`/members/${person.id}`} onClick={onClose} className="min-w-0 flex-1 transition hover:opacity-80">
        <p className="truncate text-sm font-black text-white">{person.displayName}</p>
        <p className="mt-1 text-xs text-neutral-500">{person.libraryCount || 0} public picks{person.friendSince ? ` · Friends since ${new Date(person.friendSince).toLocaleDateString()}` : ''}</p>
      </Link>
      {action ? (
        <button type="button" disabled={busy} onClick={() => action(person)} className="shrink-0 rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-neutral-300 transition hover:bg-white hover:text-neutral-950 disabled:opacity-50">
          {busy ? 'Working…' : actionLabel}
        </button>
      ) : null}
    </article>
  )
}

export default function BlockedMembersPanel({ signedIn = false, onFlash, onChanged }) {
  const [blockedMembers, setBlockedMembers] = useState([])
  const [friends, setFriends] = useState([])
  const [peopleSearch, setPeopleSearch] = useState('')
  const [peopleResults, setPeopleResults] = useState([])
  const [peopleSearching, setPeopleSearching] = useState(false)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [busyKey, setBusyKey] = useState('')

  async function refresh() {
    if (!signedIn) {
      setBlockedMembers([])
      setFriends([])
      setPeopleResults([])
      return
    }
    setLoading(true)
    try {
      const [nextBlocked, nextFriends] = await Promise.all([
        getBlockedUsers().catch((error) => {
          onFlash?.(error.message || 'Could not load blocked members.')
          return []
        }),
        getFriendsList().catch((error) => {
          onFlash?.(error.message || 'Could not load friends.')
          return []
        }),
      ])
      setBlockedMembers(nextBlocked)
      setFriends(nextFriends)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [signedIn])

  useEffect(() => {
    if (!open || !signedIn || peopleSearch.trim().length < 2) {
      setPeopleResults([])
      setPeopleSearching(false)
      return undefined
    }
    let cancelled = false
    const timer = window.setTimeout(async () => {
      setPeopleSearching(true)
      try {
        const results = await searchMembersByProfileName(peopleSearch, 8)
        if (!cancelled) setPeopleResults(results)
      } catch (error) {
        if (!cancelled) {
          setPeopleResults([])
          onFlash?.(error.message || 'Could not search people.')
        }
      } finally {
        if (!cancelled) setPeopleSearching(false)
      }
    }, 260)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [open, signedIn, peopleSearch])

  async function handleAddFriend(person) {
    setBusyKey(`add:${person.id}`)
    try {
      await addFriend(person.id)
      setPeopleResults((current) => current.map((item) => item.id === person.id ? { ...item, isFriend: true } : item))
      onFlash?.('Friend request sent.')
      await refresh()
      onChanged?.()
    } catch (error) {
      onFlash?.(error.message || 'Could not send friend request.')
    } finally {
      setBusyKey('')
    }
  }

  async function handleRemoveFriend(person) {
    setBusyKey(`remove:${person.id}`)
    try {
      await removeFriend(person.id)
      setFriends((current) => current.filter((item) => item.id !== person.id))
      setPeopleResults((current) => current.map((item) => item.id === person.id ? { ...item, isFriend: false } : item))
      onFlash?.(`${person.displayName} removed from friends.`)
      onChanged?.()
    } catch (error) {
      onFlash?.(error.message || 'Could not remove friend.')
    } finally {
      setBusyKey('')
    }
  }

  async function handleUnblock(member) {
    setBusyKey(`unblock:${member.id}`)
    try {
      await unblockUser(member.id)
      setBlockedMembers((current) => current.filter((item) => item.id !== member.id))
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
          <span className="block text-[10px] font-black uppercase tracking-[0.24em] text-neutral-500">Friends & safety</span>
          <span className="mt-1 block text-xl font-black">People controls</span>
          <span className="mt-1 block text-xs text-neutral-500">Search members, manage friends, and unblock people.</span>
        </span>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-black text-neutral-300">{loading ? '…' : `${friends.length}/${blockedMembers.length}`}</span>
      </button>

      {open ? (
        <div className="mt-4 grid gap-4">
          <div className="rounded-3xl border border-white/10 bg-neutral-900/60 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Find people</p>
                <h3 className="mt-1 text-lg font-black text-white">Add friends</h3>
              </div>
              <button type="button" onClick={refresh} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-neutral-300 transition hover:bg-white hover:text-neutral-950">Refresh</button>
            </div>
            <input value={peopleSearch} onChange={(event) => setPeopleSearch(event.target.value)} placeholder="Search profile name…" className="mt-3 w-full rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-600" />
            <div className="mt-3 grid gap-2">
              {peopleSearching ? <p className="rounded-2xl border border-white/10 bg-neutral-950 p-3 text-sm text-neutral-400">Searching people…</p> : null}
              {!peopleSearching && peopleSearch.trim().length < 2 ? <p className="rounded-2xl border border-dashed border-white/10 bg-neutral-950/60 p-3 text-sm text-neutral-500">Type at least 2 letters to find CliqueBase members.</p> : null}
              {!peopleSearching && peopleSearch.trim().length >= 2 && !peopleResults.length ? <p className="rounded-2xl border border-dashed border-white/10 bg-neutral-950/60 p-3 text-sm text-neutral-500">No matching members found.</p> : null}
              {peopleResults.map((person) => (
                <PersonCard
                  key={person.id}
                  person={person}
                  action={person.isFriend ? handleRemoveFriend : handleAddFriend}
                  actionLabel={person.isFriend ? 'Remove' : 'Add'}
                  busy={busyKey === `add:${person.id}` || busyKey === `remove:${person.id}`}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-neutral-900/60 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Friends</p>
                  <h3 className="mt-1 text-lg font-black text-white">Your friends</h3>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-black text-neutral-300">{friends.length}</span>
              </div>
              <div className="mt-3 grid gap-2">
                {friends.length ? friends.map((friend) => (
                  <PersonCard key={friend.id} person={friend} action={handleRemoveFriend} actionLabel="Remove" busy={busyKey === `remove:${friend.id}`} />
                )) : <p className="rounded-2xl border border-dashed border-white/10 bg-neutral-950/60 p-3 text-sm text-neutral-500">No friends yet.</p>}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-neutral-900/60 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">Safety</p>
                  <h3 className="mt-1 text-lg font-black text-white">Blocked members</h3>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-black text-neutral-300">{blockedMembers.length}</span>
              </div>
              <div className="mt-3 grid gap-2">
                {loading ? <p className="rounded-2xl border border-white/10 bg-neutral-950 p-3 text-sm text-neutral-400">Loading blocked members…</p> : blockedMembers.length ? blockedMembers.map((member) => (
                  <article key={member.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-neutral-950/75 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-white">{member.displayName}</p>
                      {member.blockedAt ? <p className="mt-1 text-xs text-neutral-500">Blocked {new Date(member.blockedAt).toLocaleDateString()}</p> : null}
                    </div>
                    <button type="button" disabled={busyKey === `unblock:${member.id}`} onClick={() => handleUnblock(member)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-neutral-300 transition hover:bg-white hover:text-neutral-950 disabled:opacity-50">{busyKey === `unblock:${member.id}` ? 'Unblocking…' : 'Unblock'}</button>
                  </article>
                )) : <p className="rounded-2xl border border-dashed border-white/10 bg-neutral-950/60 p-3 text-sm text-neutral-500">No blocked members.</p>}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
