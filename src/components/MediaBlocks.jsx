import { useState } from 'react'
import MemberShareModal from './MemberShareModal.jsx'

export const RATINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

export function DetailPill({ children }) {
  if (!children) return null
  return <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-neutral-300">{children}</span>
}

export function displayYear(value) {
  const year = String(value || '').match(/\d{4}/)?.[0]
  return year || ''
}

function inferShareType(...values) {
  const text = values.filter(Boolean).join(' ').toLowerCase()
  if (text.includes('series') || text.includes('binge')) return 'series'
  if (text.includes('game') || text.includes('play')) return 'game'
  if (text.includes('movie') || text.includes('watch')) return 'movie'
  return ''
}

function itemShareType(item, fallback = '') {
  const explicitType = String(item?.type || item?.category || '').toLowerCase()
  if (explicitType === 'movie' || explicitType === 'series' || explicitType === 'game') return explicitType
  return fallback
}

export function PageHero({ eyebrow, title, description, warning, actions = null, children }) {
  return (
    <section className="mb-5 pt-2">
      <div className="flex flex-col gap-4 px-1 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">{eyebrow}</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl md:text-5xl">{title}</h1>
          {description ? <p className="mt-3 max-w-2xl text-neutral-400">{description}</p> : null}
          {warning ? <p className="mt-3 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-3 text-sm text-yellow-200">{warning}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="px-1">
        {children}
      </div>
    </section>
  )
}

export function StatusMessage({ message }) {
  if (!message) return null
  const isError = message.type === 'error'
  return <div className={`mb-4 rounded-2xl p-3 text-white ${isError ? 'bg-red-600' : 'bg-emerald-700'}`}>{message.text}</div>
}

export function SearchResultsSection({ title = 'Search results', clearLabel = 'Back to swipe deck', onClear, children }) {
  return (
    <section className="mb-8 rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-semibold text-white">{title}</h2>
        {onClear ? <button type="button" className="text-sm text-neutral-400 hover:text-white" onClick={onClear}>{clearLabel}</button> : null}
      </div>
      {children}
    </section>
  )
}

export function ResultRow({ item, onInfo, onAdd, onDone, onShareMessage, addLabel = 'Add', doneLabel = null, imageClass = 'h-16 w-11', shareType = '', children }) {
  const [sharingItem, setSharingItem] = useState(null)
  const resolvedShareType = itemShareType(item, shareType)
  const canShare = Boolean(resolvedShareType)

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900 p-3">
        {item.poster ? (
          <button type="button" onClick={() => onInfo?.(item)} className="shrink-0 overflow-hidden rounded-xl text-left">
            <img src={item.poster} alt="" className={`${imageClass} object-cover transition hover:opacity-80`} />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => onInfo?.(item)} className="block max-w-full truncate text-left font-semibold text-white hover:underline">{item.title}</button>
          <div className="mt-1 text-sm text-neutral-400">{children || item.year || 'Unknown year'}</div>
        </div>
        {canShare ? <button type="button" onClick={() => setSharingItem(item)} className="rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-neutral-300 transition hover:bg-white hover:text-neutral-950">Share</button> : null}
        {onAdd ? <button type="button" onClick={() => onAdd(item)} className="rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-neutral-200 transition hover:bg-white hover:text-neutral-950">{addLabel}</button> : null}
        {onDone && doneLabel ? <button type="button" onClick={() => onDone(item)} className="rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-neutral-300 transition hover:bg-white hover:text-neutral-950">{doneLabel}</button> : null}
      </div>
      <MemberShareModal item={sharingItem} type={resolvedShareType} onClose={() => setSharingItem(null)} onMessage={onShareMessage} />
    </>
  )
}

export function TopRankingSection({ eyebrow = '', title, items, votes = {}, limit = 6, onInfo, onDone, onShare, shareType = '', onShareMessage, doneLabel = 'Done', imageClass = 'h-14 w-10' }) {
  const [sharingItem, setSharingItem] = useState(null)
  const visible = items.slice(0, limit)
  const inferredShareType = shareType || inferShareType(eyebrow, title, doneLabel)
  const canShare = Boolean(inferredShareType || onShare)

  function handleShare(item) {
    if (itemShareType(item, inferredShareType)) {
      setSharingItem(item)
      return
    }
    if (onShare) onShare(item)
  }

  return (
    <>
      <section className="mb-8 rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            {eyebrow ? <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">{eyebrow}</p> : null}
            <h2 className="mt-1 text-2xl font-bold text-white">{title}</h2>
          </div>
          <span className="text-sm text-neutral-500">Top {Math.min(limit, items.length)}</span>
        </div>
        {visible.length === 0 ? <p className="text-neutral-400">Nothing in the ranking yet.</p> : (
          <div className="grid gap-2 md:grid-cols-2">
            {visible.map((item, index) => {
              const picks = (item.picks || 0) + (votes[item.id] === 'like' ? 1 : 0)
              const score = (item.score || 0) + (votes[item.id] === 'like' ? 1 : 0)

              return (
                <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-neutral-900 p-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-sm font-black text-neutral-950">{index + 1}</div>
                  {item.poster ? <button type="button" onClick={() => onInfo?.(item)} className="shrink-0 overflow-hidden rounded-lg"><img src={item.poster} alt="" className={`${imageClass} object-cover transition hover:opacity-80`} /></button> : null}
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => onInfo?.(item)} className="block max-w-full truncate text-left font-semibold text-white hover:underline">{item.title}</button>
                    <div className="mt-1 text-xs text-neutral-400">{picks} picks · score {score}</div>
                  </div>
                  <button type="button" onClick={() => onInfo?.(item)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-neutral-300 hover:bg-white hover:text-neutral-950">Details</button>
                  {canShare ? <button type="button" onClick={() => handleShare(item)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-neutral-300 hover:bg-white hover:text-neutral-950">Share</button> : null}
                  <button type="button" onClick={() => onDone?.(item)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-neutral-300 hover:bg-white hover:text-neutral-950">{doneLabel}</button>
                </div>
              )
            })}
          </div>
        )}
      </section>
      <MemberShareModal item={sharingItem} type={sharingItem ? itemShareType(sharingItem, inferredShareType) : inferredShareType} onClose={() => setSharingItem(null)} onMessage={onShareMessage} />
    </>
  )
}

export function RatedHistorySection({ eyebrow, title, countText, emptyLabel, items, ratings = {}, editingRating, onToggleRating, onRate, onInfo, onShare, shareType = '', onShareMessage, detailsLabel = 'Details', imageClass = 'h-28 w-20', renderPills = null, renderMeta = null }) {
  const [sharingItem, setSharingItem] = useState(null)
  const inferredShareType = shareType || inferShareType(eyebrow, title, detailsLabel)
  const canShare = Boolean(inferredShareType || onShare)

  function handleShare(item) {
    if (itemShareType(item, inferredShareType)) {
      setSharingItem(item)
      return
    }
    if (onShare) onShare(item)
  }

  return (
    <>
      <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">{eyebrow}</p>
            <h2 className="mt-1 text-2xl font-semibold text-white">{title}</h2>
          </div>
          <div className="text-sm text-neutral-500">{countText}</div>
        </div>

        {items.length === 0 ? <p className="text-neutral-400">{emptyLabel}</p> : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {items.map((item) => {
              const rating = ratings[item.id]
              const hasRating = Number(rating) > 0
              const isRatingOpen = !hasRating || editingRating === item.id
              const ratingLabel = hasRating ? `${rating}/10` : 'Rate'

              return (
                <div key={item.id} className="rounded-3xl border border-white/10 bg-neutral-950/70 p-3 transition hover:border-white/20">
                  <div className="flex gap-3">
                    {item.poster ? (
                      <button type="button" onClick={() => onInfo?.(item)} className={`${imageClass} group shrink-0 overflow-hidden rounded-2xl text-left`} title={`Open ${item.title} details`}>
                        <img src={item.poster} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                      </button>
                    ) : (
                      <button type="button" onClick={() => onInfo?.(item)} className={`${imageClass} flex shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-neutral-900 px-2 text-center text-xs font-semibold text-neutral-400 hover:bg-white hover:text-neutral-950`}>
                        Details
                      </button>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <strong className="line-clamp-2 text-lg leading-tight text-white">{item.title}</strong>
                        <button type="button" onClick={() => onToggleRating?.(item)} className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-neutral-950 transition hover:bg-neutral-200" title="Change your rating">{ratingLabel}</button>
                      </div>
                      {renderMeta ? <div className="mt-1 text-xs text-neutral-500">{renderMeta(item)}</div> : null}
                      {renderPills ? <div className="mt-3 flex flex-wrap gap-2">{renderPills(item)}</div> : null}
                      {item.genres?.length ? <div className="mt-2 line-clamp-2 text-xs leading-5 text-neutral-400">{item.genres.join(' · ')}</div> : null}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => onInfo?.(item)} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-neutral-200 transition hover:bg-white hover:text-neutral-950">
                          <span aria-hidden="true">ⓘ</span>
                          {detailsLabel}
                        </button>
                        {canShare ? <button type="button" onClick={() => handleShare(item)} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-neutral-200 transition hover:bg-white hover:text-neutral-950">Share</button> : null}
                      </div>
                      {isRatingOpen ? (
                        <div className="mt-3 grid grid-cols-5 gap-1.5">
                          {RATINGS.map((nextRating) => (
                            <button key={nextRating} type="button" className={`rounded-xl border px-0 py-2 text-sm font-semibold transition ${Number(rating) === nextRating ? 'border-white bg-white text-neutral-950' : 'border-white/10 bg-white/[0.03] text-neutral-300 hover:border-white/30'}`} onClick={() => onRate?.(item, nextRating)}>{nextRating}</button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
      <MemberShareModal item={sharingItem} type={sharingItem ? itemShareType(sharingItem, inferredShareType) : inferredShareType} onClose={() => setSharingItem(null)} onMessage={onShareMessage} />
    </>
  )
}

export function InfoModal({ item, loading = false, loadingLabel = 'Loading info...', onClose, year = '', backdrop = null, children }) {
  if (!item && !loading) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-white/10 bg-neutral-950 p-5 shadow-2xl shadow-black/40">
        {loading ? (
          <div className="py-16 text-center text-neutral-400">{loadingLabel}</div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-2xl font-bold leading-tight text-white">{item.title}</h3>
                {year ? <div className="mt-1 text-sm text-neutral-400">{year}</div> : null}
              </div>
              <button type="button" onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-xl text-neutral-300 transition hover:bg-white hover:text-black">×</button>
            </div>

            {backdrop ? <img src={backdrop} alt="" className="mt-5 h-44 w-full rounded-3xl object-cover" /> : null}
            {children}
          </>
        )}
      </div>
    </div>
  )
}
