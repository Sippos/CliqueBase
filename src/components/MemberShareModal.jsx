import { useEffect, useMemo, useState } from 'react'
import { buildShareUrl, mediaTypeLabel } from '../lib/share.js'
import { hasSupabase } from '../lib/supabaseClient.js'
import { searchCliquesByName, searchMembersByProfileName, shareMediaWithClique, shareMediaWithMember } from '../lib/communityShare.js'

function copyToClipboard(value) {
  if (!value) return Promise.resolve(false)
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(value).then(() => true).catch(() => false)
  }
  return Promise.resolve(false)
}

function TargetToggle({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] transition ${active ? 'bg-white text-neutral-950' : 'border border-white/10 text-neutral-400 hover:bg-white hover:text-neutral-950'}`}
    >
      {children}
    </button>
  )
}

function TargetCard({ selected, title, subtitle, badge, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-32 w-44 shrink-0 snap-start rounded-3xl border p-3 text-left transition hover:-translate-y-0.5 ${selected ? 'border-white bg-white text-neutral-950 shadow-xl shadow-white/10' : 'border-white/10 bg-neutral-900 text-white hover:border-white/30'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-black ${selected ? 'bg-neutral-950 text-white' : 'bg-white text-neutral-950'}`}>{badge}</span>
        <span className="text-[10px] font-black uppercase tracking-[0.18em] opacity-60">{selected ? 'Selected' : 'Choose'}</span>
      </div>
      <div className="mt-4 line-clamp-2 text-base font-black leading-tight">{title}</div>
      <div className="mt-2 line-clamp-2 text-xs font-semibold opacity-60">{subtitle}</div>
    </button>
  )
}

export default function MemberShareModal({ item, type, onClose, onMessage }) {
  const [query, setQuery] = useState('')
  const [people, setPeople] = useState([])
  const [cliques, setCliques] = useState([])
  const [targetMode, setTargetMode] = useState('people')
  const [selectedTarget, setSelectedTarget] = useState(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)
  const shareUrl = useMemo(() => item && type ? buildShareUrl(type, item) : '', [item, type])
  const currentResults = targetMode === 'people' ? people : cliques

  useEffect(() => {
    setQuery('')
    setPeople([])
    setCliques([])
    setSelectedTarget(null)
    setStatus('idle')
    setError('')
    setLinkCopied(false)
    setTargetMode('people')
  }, [item, type])

  useEffect(() => {
    setSelectedTarget(null)
    setError('')
  }, [targetMode])

  useEffect(() => {
    if (!item || !hasSupabase) {
      setPeople([])
      setCliques([])
      return
    }

    const trimmed = query.trim()
    if (targetMode === 'people' && trimmed.length < 2) {
      setPeople([])
      return
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setStatus('searching')
      setError('')
      try {
        if (targetMode === 'people') {
          const results = await searchMembersByProfileName(trimmed)
          if (!cancelled) setPeople(results)
        } else {
          const results = await searchCliquesByName(trimmed)
          if (!cancelled) setCliques(results)
        }
      } catch (searchError) {
        if (!cancelled) {
          if (targetMode === 'people') setPeople([])
          else setCliques([])
          setError(searchError.message || 'Could not search CliqueBase.')
        }
      } finally {
        if (!cancelled) setStatus('idle')
      }
    }, 260)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, item, targetMode])

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

  function handleWhatsAppShare() {
    const text = `${item.title} on CliqueBase ${shareUrl}`
    if (typeof window !== 'undefined') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
      onMessage?.('WhatsApp share opened.')
    }
  }

  async function handlePlatformShare() {
    if (!selectedTarget) {
      setError(targetMode === 'people' ? 'Choose a member by profile name first.' : 'Choose a clique first.')
      return
    }

    setStatus('sharing')
    setError('')
    try {
      if (selectedTarget.kind === 'member') {
        await shareMediaWithMember(type, item, selectedTarget.id)
        onMessage?.(`Suggested "${item.title}" to ${selectedTarget.displayName}.`)
      } else {
        await shareMediaWithClique(type, item, selectedTarget.id)
        onMessage?.(`Added "${item.title}" to ${selectedTarget.name}.`)
      }
      onClose?.()
    } catch (shareError) {
      setError(shareError.message || 'Could not share with that target.')
    } finally {
      setStatus('idle')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-white/10 bg-neutral-950 p-5 text-white shadow-2xl shadow-black/40">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.28em] text-neutral-500">Share on CliqueBase</p>
            <h2 className="mt-2 truncate text-2xl font-black">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-400">Send it to WhatsApp, suggest it to a platform user, or add it directly to one of your cliques.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-2xl text-neutral-400 transition hover:bg-white hover:text-neutral-950">×</button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={handleNativeShare} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:bg-white hover:text-neutral-950">
            <span className="text-xs font-black uppercase tracking-[0.18em] opacity-60">Link</span>
            <span className="mt-2 block text-lg font-black">{linkCopied ? 'Link copied' : 'Copy / send link'}</span>
          </button>
          <button type="button" onClick={handleWhatsAppShare} className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:bg-white hover:text-neutral-950">
            <span className="text-xs font-black uppercase tracking-[0.18em] opacity-60">WhatsApp</span>
            <span className="mt-2 block text-lg font-black">Send to chat</span>
          </button>
        </div>

        <div className="mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-neutral-500">Platform suggestions</p>
              <p className="mt-1 text-sm text-neutral-400">Swipe through results and pick where this should go.</p>
            </div>
            <div className="flex gap-2">
              <TargetToggle active={targetMode === 'people'} onClick={() => setTargetMode('people')}>People</TargetToggle>
              <TargetToggle active={targetMode === 'cliques'} onClick={() => setTargetMode('cliques')}>Cliques</TargetToggle>
            </div>
          </div>

          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={targetMode === 'people' ? 'Search people by profile name...' : 'Search your cliques...'} className="mt-4 w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-white/30" />

          {hasSupabase ? (
            <div className="mt-3">
              {status === 'searching' ? <p className="rounded-2xl border border-white/10 bg-neutral-900 p-3 text-sm text-neutral-400">Searching...</p> : null}
              {targetMode === 'people' && query.trim().length < 2 ? <p className="rounded-2xl border border-white/10 bg-neutral-900 p-3 text-sm text-neutral-400">Type at least 2 letters to find people.</p> : null}
              {((targetMode === 'people' && query.trim().length > 1) || targetMode === 'cliques') && !currentResults.length && status !== 'searching' ? <p className="rounded-2xl border border-white/10 bg-neutral-900 p-3 text-sm text-neutral-400">No matching {targetMode} yet.</p> : null}
              {currentResults.length ? (
                <div className="flex snap-x gap-3 overflow-x-auto pb-2 pt-1 [scrollbar-width:thin]">
                  {targetMode === 'people' ? people.map((member) => (
                    <TargetCard
                      key={member.id}
                      selected={selectedTarget?.kind === 'member' && selectedTarget.id === member.id}
                      title={member.displayName}
                      subtitle="Suggest as a swipe card in their CliqueBase inbox"
                      badge={member.displayName.slice(0, 1).toUpperCase() || 'U'}
                      onClick={() => setSelectedTarget({ ...member, kind: 'member' })}
                    />
                  )) : cliques.map((clique) => (
                    <TargetCard
                      key={clique.id}
                      selected={selectedTarget?.kind === 'clique' && selectedTarget.id === clique.id}
                      title={clique.name}
                      subtitle={`${clique.memberCount || 0} members · ${clique.isPublic ? 'Public' : 'Private'} clique`}
                      badge="C"
                      onClick={() => setSelectedTarget({ ...clique, kind: 'clique' })}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-3 text-sm leading-6 text-yellow-100">Platform search needs Supabase sign-in. You can still copy the link or send it through WhatsApp.</p>
          )}

          {error ? <p className="mt-3 rounded-2xl bg-red-600 p-3 text-sm text-white">{error}</p> : null}

          <button type="button" onClick={handlePlatformShare} disabled={!hasSupabase || !selectedTarget || status === 'sharing'} className="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-50">
            {status === 'sharing' ? 'Sharing...' : selectedTarget?.kind === 'clique' ? 'Add to clique' : 'Suggest to member'}
          </button>
        </div>
      </div>
    </div>
  )
}
