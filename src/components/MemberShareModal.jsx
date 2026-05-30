import { useEffect, useMemo, useState } from 'react'
import { buildShareUrl, mediaTypeLabel } from '../lib/share.js'
import { hasSupabase } from '../lib/supabaseClient.js'
import { searchMembersByProfileName, shareMediaWithMember } from '../lib/communityShare.js'

function copyToClipboard(value) {
  if (!value) return Promise.resolve(false)
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(value).then(() => true).catch(() => false)
  }
  return Promise.resolve(false)
}

export default function MemberShareModal({ item, type, onClose, onMessage }) {
  const [query, setQuery] = useState('')
  const [members, setMembers] = useState([])
  const [selectedMember, setSelectedMember] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  const shareUrl = useMemo(() => item && type ? buildShareUrl(type, item) : '', [item, type])

  useEffect(() => {
    setQuery('')
    setMembers([])
    setSelectedMember(null)
    setStatus('idle')
    setError('')
    setLinkCopied(false)
  }, [item, type])

  useEffect(() => {
    if (!item || !hasSupabase || query.trim().length < 2) {
      setMembers([])
      return
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setStatus('searching')
      setError('')
      try {
        const results = await searchMembersByProfileName(query)
        if (!cancelled) {
          setMembers(results)
          setStatus('idle')
        }
      } catch (searchError) {
        if (!cancelled) {
          setMembers([])
          setStatus('idle')
          setError(searchError.message || 'Could not search members.')
        }
      }
    }, 260)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, item])

  if (!item) return null

  async function handleNativeShare() {
    setError('')
    const title = `${item.title} on CliqueBase`
    const text = `Check out this ${mediaTypeLabel(type).toLowerCase()} on CliqueBase.`

    if (navigator?.share) {
      try {
        await navigator.share({ title, text, url: shareUrl })
        onMessage?.('Share sheet opened.')
        return
      } catch (shareError) {
        if (shareError?.name === 'AbortError') return
      }
    }

    const copied = await copyToClipboard(shareUrl)
    setLinkCopied(copied)
    onMessage?.(copied ? 'Share link copied.' : shareUrl)
  }

  async function handleMemberShare() {
    if (!selectedMember) {
      setError('Choose a member by profile name first.')
      return
    }

    setStatus('sharing')
    setError('')
    try {
      await shareMediaWithMember(type, item, selectedMember.id)
      onMessage?.(`Shared "${item.title}" with ${selectedMember.displayName}.`)
      onClose?.()
    } catch (shareError) {
      setError(shareError.message || 'Could not share with that member.')
    } finally {
      setStatus('idle')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[2rem] border border-white/10 bg-neutral-950 p-5 text-white shadow-2xl shadow-black/40">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.28em] text-neutral-500">Share on CliqueBase</p>
            <h2 className="mt-2 truncate text-2xl font-black">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-400">Search a member by profile name or send them a share link.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-2xl text-neutral-400 transition hover:bg-white hover:text-neutral-950">×</button>
        </div>

        <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <label className="text-xs font-black uppercase tracking-[0.2em] text-neutral-500">Member profile name</label>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search members..." className="mt-3 w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-white/30" />

          {hasSupabase ? (
            <div className="mt-3 grid gap-2">
              {status === 'searching' ? <p className="rounded-2xl border border-white/10 bg-neutral-900 p-3 text-sm text-neutral-400">Searching members...</p> : null}
              {query.trim().length > 1 && !members.length && status !== 'searching' ? <p className="rounded-2xl border border-white/10 bg-neutral-900 p-3 text-sm text-neutral-400">No matching members yet.</p> : null}
              {members.map((member) => {
                const selected = selectedMember?.id === member.id
                return (
                  <button key={member.id} type="button" onClick={() => setSelectedMember(member)} className={`flex items-center justify-between gap-3 rounded-2xl border p-3 text-left transition ${selected ? 'border-white bg-white text-neutral-950' : 'border-white/10 bg-neutral-900 text-white hover:border-white/30'}`}>
                    <span className="font-bold">{member.displayName}</span>
                    <span className="text-xs font-black uppercase tracking-[0.18em] opacity-60">{selected ? 'Selected' : 'Choose'}</span>
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="mt-3 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-3 text-sm leading-6 text-yellow-100">Member search needs Supabase sign-in. You can still copy or send the share link.</p>
          )}

          {error ? <p className="mt-3 rounded-2xl bg-red-600 p-3 text-sm text-white">{error}</p> : null}

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={handleMemberShare} disabled={!hasSupabase || !selectedMember || status === 'sharing'} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-50">{status === 'sharing' ? 'Sharing...' : 'Share with member'}</button>
            <button type="button" onClick={handleNativeShare} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-white transition hover:bg-white hover:text-neutral-950">{linkCopied ? 'Link copied' : 'Copy / send link'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
