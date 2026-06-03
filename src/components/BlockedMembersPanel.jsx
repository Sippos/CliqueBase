import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { addFriend, getFriendsList, removeFriend, searchMembersByProfileName } from '../lib/communityShare.js'
import { getBlockedUsers, unblockUser } from '../lib/safety.js'
import { getFriendRequests, respondFriendRequest } from '../lib/socialGovernance.js'

function PersonCard({ person, action, actionLabel, busy, status = '', onClose, friend = false }) {
  return (
    <article className="rounded-2xl border border-white/15 bg-white/8 p-3 shadow-lg shadow-black/10 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <Link to={`/members/${person.id}`} onClick={onClose} className="min-w-0 flex-1 transition hover:opacity-80">
          <p className="truncate text-sm font-black text-white">{person.displayName}</p>
          <p className="mt-1 text-xs leading-5 text-neutral-300/75">{status || `${person.libraryCount || 0} public picks${person.friendSince ? ` · friends since ${new Date(person.friendSince).toLocaleDateString()}` : ''}`}</p>
        </Link>
        {action ? <button type="button" disabled={busy} onClick={() => action(person)} className="shrink-0 rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-xs font-black text-neutral-100 transition hover:bg-white hover:text-neutral-950 disabled:opacity-50">{busy ? '…' : actionLabel}</button> : null}
      </div>
      {friend ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Link to={`/members/${person.id}`} className="rounded-xl border border-white/15 bg-white/8 px-3 py-2 text-xs font-black text-neutral-100 transition hover:bg-white hover:text-neutral-950">View library</Link>
          <a href="#recommend" className="rounded-xl border border-white/15 bg-white/8 px-3 py-2 text-xs font-black text-neutral-100 transition hover:bg-white hover:text-neutral-950">Recommend</a>
          <button type="button" disabled={busy} onClick={() => action?.(person)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-neutral-400 transition hover:bg-white hover:text-neutral-950 disabled:opacity-50">Remove</button>
        </div>
      ) : null}
    </article>
  )
}

function RequestCard({ request, busy, onRespond }) {
  const incoming = request.direction === 'incoming'
  return (
    <article className="rounded-2xl border border-white/15 bg-white/8 p-3 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-white">{request.displayName}</p>
          <p className="mt-1 text-xs text-neutral-300/75">{incoming ? 'Wants to be friends' : 'Request sent'}</p>
        </div>
        {incoming ? (
          <div className="flex shrink-0 gap-2">
            <button type="button" disabled={busy} onClick={() => onRespond(request, 'accepted')} className="rounded-xl bg-white px-3 py-2 text-xs font-black text-neutral-950 disabled:opacity-50">Accept</button>
            <button type="button" disabled={busy} onClick={() => onRespond(request, 'declined')} className="rounded-xl border border-white/15 bg-white/8 px-3 py-2 text-xs font-black text-neutral-100 disabled:opacity-50">No</button>
          </div>
        ) : <span className="rounded-full border border-white/15 bg-white/8 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-300">Pending</span>}
      </div>
    </article>
  )
}

export default function BlockedMembersPanel({ signedIn = false, defaultOpen = false, onFlash, onChanged }) {
  const [blockedMembers, setBlockedMembers] = useState([])
  const [friends, setFriends] = useState([])
  const [requests, setRequests] = useState([])
  const [peopleSearch, setPeopleSearch] = useState('')
  const [peopleResults, setPeopleResults] = useState([])
  const [peopleSearching, setPeopleSearching] = useState(false)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(defaultOpen)
  const [showSafety, setShowSafety] = useState(false)
  const [busyKey, setBusyKey] = useState('')

  async function refresh() {
    if (!signedIn) {
      setBlockedMembers([])
      setFriends([])
      setRequests([])
      setPeopleResults([])
      return
    }
    setLoading(true)
    try {
      const [nextBlocked, nextFriends, nextRequests] = await Promise.all([
        getBlockedUsers().catch(() => []),
        getFriendsList().catch((error) => { onFlash?.(error.message || 'Could not load friends.'); return [] }),
        getFriendRequests('pending').catch((error) => { onFlash?.(error.message || 'Could not load friend requests.'); return [] }),
      ])
      setBlockedMembers(nextBlocked)
      setFriends(nextFriends)
      setRequests(nextRequests)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [signedIn])
  useEffect(() => { if (defaultOpen) setOpen(true) }, [defaultOpen])

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
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [open, signedIn, peopleSearch])

  async function handleAddFriend(person) {
    setBusyKey(`add:${person.id}`)
    try {
      await addFriend(person.id)
      setPeopleResults((current) => current.map((item) => item.id === person.id ? { ...item, isFriend: true, isPending: true } : item))
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

  async function handleRequest(request, response) {
    setBusyKey(`request:${request.id}`)
    try {
      await respondFriendRequest(request.id, response)
      setRequests((current) => current.filter((item) => item.id !== request.id))
      onFlash?.(response === 'accepted' ? `${request.displayName} is now your friend.` : 'Friend request declined.')
      await refresh()
      onChanged?.()
    } catch (error) {
      onFlash?.(error.message || 'Could not respond to request.')
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

  const incomingCount = requests.filter((request) => request.direction === 'incoming').length

  return (
    <section className="rounded-[1.75rem] border border-white/15 bg-gradient-to-br from-emerald-400/12 via-white/[0.055] to-cyan-500/8 p-4 text-white shadow-2xl shadow-black/20 backdrop-blur-xl">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex w-full items-center justify-between gap-3 text-left">
        <span>
          <span className="block text-xl font-black">Friends</span>
          <span className="mt-1 block text-xs text-neutral-300/75">{friends.length} friends{incomingCount ? ` · ${incomingCount} request${incomingCount === 1 ? '' : 's'}` : ''}</span>
        </span>
        <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-black text-neutral-100">{loading ? '…' : friends.length}</span>
      </button>

      {open ? (
        <div className="mt-4 grid gap-4">
          {requests.length ? (
            <div className="grid gap-2">
              <h3 className="text-sm font-black text-white">Friend requests</h3>
              {requests.map((request) => <RequestCard key={request.id} request={request} busy={busyKey === `request:${request.id}`} onRespond={handleRequest} />)}
            </div>
          ) : null}

          <div>
            <input value={peopleSearch} onChange={(event) => setPeopleSearch(event.target.value)} placeholder="Search people…" className="w-full rounded-2xl border border-white/15 bg-black/25 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-300/65" />
            <div className="mt-3 grid gap-2">
              {peopleSearching ? <p className="rounded-2xl border border-white/15 bg-white/8 p-3 text-sm text-neutral-300">Searching people…</p> : null}
              {!peopleSearching && peopleSearch.trim().length < 2 ? <p className="rounded-2xl border border-dashed border-white/15 bg-black/15 p-3 text-sm text-neutral-300/70">Type 2 letters to find members.</p> : null}
              {!peopleSearching && peopleSearch.trim().length >= 2 && !peopleResults.length ? <p className="rounded-2xl border border-dashed border-white/15 bg-black/15 p-3 text-sm text-neutral-300/70">No people found.</p> : null}
              {peopleResults.map((person) => {
                const pending = requests.some((request) => request.id === person.id || request.memberId === person.id || request.userId === person.id)
                return <PersonCard key={person.id} person={person} action={person.isFriend ? handleRemoveFriend : pending ? null : handleAddFriend} actionLabel={person.isFriend ? 'Remove' : 'Add'} status={pending ? 'Request pending' : ''} busy={busyKey === `add:${person.id}` || busyKey === `remove:${person.id}`} />
              })}
            </div>
          </div>

          <div className="grid gap-2">
            <h3 className="text-sm font-black text-white">Friends</h3>
            {friends.length ? friends.map((friend) => <PersonCard key={friend.id} person={friend} action={handleRemoveFriend} actionLabel="Remove" busy={busyKey === `remove:${friend.id}`} friend />) : <p className="rounded-2xl border border-dashed border-white/15 bg-black/15 p-3 text-sm text-neutral-300/70">No friends yet.</p>}
          </div>

          <button type="button" onClick={() => setShowSafety((value) => !value)} className="text-left text-xs font-black uppercase tracking-[0.16em] text-neutral-300/55 hover:text-neutral-100">{showSafety ? 'Hide blocked users' : `Blocked users (${blockedMembers.length})`}</button>
          {showSafety ? (
            <div className="grid gap-2">
              {blockedMembers.length ? blockedMembers.map((member) => (
                <article key={member.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/15 bg-black/20 p-3">
                  <div className="min-w-0"><p className="truncate text-sm font-black text-white">{member.displayName}</p>{member.blockedAt ? <p className="mt-1 text-xs text-neutral-300/65">Blocked {new Date(member.blockedAt).toLocaleDateString()}</p> : null}</div>
                  <button type="button" disabled={busyKey === `unblock:${member.id}`} onClick={() => handleUnblock(member)} className="rounded-xl border border-white/15 bg-white/8 px-3 py-2 text-xs font-black text-neutral-100 transition hover:bg-white hover:text-neutral-950 disabled:opacity-50">{busyKey === `unblock:${member.id}` ? 'Unblocking…' : 'Unblock'}</button>
                </article>
              )) : <p className="rounded-2xl border border-dashed border-white/15 bg-black/15 p-3 text-sm text-neutral-300/70">No blocked members.</p>}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
