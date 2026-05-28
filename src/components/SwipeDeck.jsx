import { useEffect, useRef, useState } from 'react'

function DetailPill({ children }) {
  if (!children) return null
  return <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-neutral-300">{children}</span>
}

function displayYear(value) {
  const year = String(value || '').match(/\d{4}/)?.[0]
  return year || ''
}

export default function SwipeDeck({
  items = [],
  onSwipe = () => {},
  itemLabel = 'items',
  emptyLabel = null,
  likeLabel = 'Yes',
  dislikeLabel = 'Pass',
  infoType = 'item',
  loadDetails = null,
}) {
  const [drag, setDrag] = useState(null)
  const [infoItem, setInfoItem] = useState(null)
  const [loadingInfo, setLoadingInfo] = useState(false)
  const [cardDetails, setCardDetails] = useState({})
  const pointer = useRef({ x: 0, y: 0 })

  const topItem = items[0]
  const dragX = drag?.dx || 0
  const yesOpacity = Math.min(Math.max(dragX / 110, 0), 1)
  const passOpacity = Math.min(Math.max(-dragX / 110, 0), 1)

  useEffect(() => {
    if (!topItem?.id || cardDetails[topItem.id] || !loadDetails) return

    const alreadyHasSmallInfo = Boolean(topItem.year || topItem.released || topItem.genres?.length)
    if (alreadyHasSmallInfo) return

    let cancelled = false

    async function preloadTopCardDetails() {
      const details = await loadDetails(topItem)
      if (cancelled || !details) return
      setCardDetails((current) => current[topItem.id] ? current : { ...current, [topItem.id]: details })
    }

    preloadTopCardDetails()

    return () => {
      cancelled = true
    }
  }, [topItem?.id, loadDetails, cardDetails])

  const handlePointerDown = (event) => {
    const point = event.touches ? event.touches[0] : event
    pointer.current = { x: point.clientX, y: point.clientY }
    setDrag({ dx: 0, dy: 0 })
  }

  const handlePointerMove = (event) => {
    if (!drag) return
    const point = event.touches ? event.touches[0] : event
    setDrag({ dx: point.clientX - pointer.current.x, dy: point.clientY - pointer.current.y })
  }

  const handlePointerUp = (item) => {
    if (!drag) return
    const threshold = 120
    if (drag.dx > threshold) onSwipe('like', item)
    if (drag.dx < -threshold) onSwipe('dislike', item)
    setDrag(null)
  }

  async function openInfo(item) {
    setLoadingInfo(true)
    const cachedDetails = cardDetails[item.id]
    const details = cachedDetails || (loadDetails ? await loadDetails(item) : null)
    setInfoItem({ ...item, ...(details || {}) })

    if (details && !cachedDetails) {
      setCardDetails((current) => current[item.id] ? current : { ...current, [item.id]: details })
    }

    setLoadingInfo(false)
  }

  if (items.length === 0) {
    return (
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-10 text-center shadow-2xl shadow-black/20">
        <h3 className="text-xl font-semibold text-white">{emptyLabel || `No ${itemLabel} left to vote on`}</h3>
        <p className="mt-2 text-sm text-neutral-500">Add more {itemLabel} to the pile or check the ranking below.</p>
      </div>
    )
  }

  return (
    <>
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-5 text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-neutral-500">Swipe deck</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">Your {itemLabel} pile</h2>
          <p className="mt-2 text-sm text-neutral-400">Drag the top card left to {dislikeLabel.toLowerCase()} or right to {likeLabel.toLowerCase()}.</p>
        </div>

        <div className="relative h-[620px]">
          {items.map((item, index) => {
            const itemWithDetails = { ...item, ...(cardDetails[item.id] || {}) }
            const isTop = item.id === topItem.id
            const rotation = drag ? drag.dx / 18 : 0
            const year = displayYear(itemWithDetails.released || itemWithDetails.year)
            const style = isTop && drag
              ? { transform: `translate(${drag.dx}px, ${drag.dy}px) rotate(${rotation}deg)`, transition: 'transform 0s' }
              : { transform: `scale(${1 - index * 0.035}) translateY(${index * 14}px)`, transition: 'transform 250ms ease' }

            return (
              <div
                key={item.id}
                className={`absolute left-0 right-0 mx-auto w-[350px] select-none overflow-hidden rounded-[2rem] border border-white/10 bg-neutral-950 shadow-2xl shadow-black/40 ${isTop ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`}
                style={{ ...style, zIndex: items.length - index }}
                onMouseDown={isTop ? handlePointerDown : undefined}
                onMouseMove={isTop ? handlePointerMove : undefined}
                onMouseUp={isTop ? () => handlePointerUp(itemWithDetails) : undefined}
                onMouseLeave={isTop ? () => handlePointerUp(itemWithDetails) : undefined}
                onTouchStart={isTop ? handlePointerDown : undefined}
                onTouchMove={isTop ? handlePointerMove : undefined}
                onTouchEnd={isTop ? () => handlePointerUp(itemWithDetails) : undefined}
              >
                <div className="relative h-[440px] bg-neutral-900">
                  {itemWithDetails.poster ? (
                    <img src={itemWithDetails.poster} alt={itemWithDetails.title} draggable="false" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-neutral-800 text-neutral-500 uppercase tracking-[0.25em]">{itemWithDetails.platform || itemLabel}</div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

                  <button type="button" onClick={(event) => { event.stopPropagation(); openInfo(itemWithDetails) }} className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/60 text-lg font-bold text-white backdrop-blur transition hover:bg-white hover:text-black">i</button>

                  {isTop ? (
                    <>
                      <div className="absolute left-6 top-8 -rotate-12 rounded-2xl border-4 border-rose-300 px-5 py-2 text-3xl font-black uppercase tracking-wide text-rose-300" style={{ opacity: passOpacity }}>{dislikeLabel}</div>
                      <div className="absolute right-6 top-8 rotate-12 rounded-2xl border-4 border-emerald-300 px-5 py-2 text-3xl font-black uppercase tracking-wide text-emerald-300" style={{ opacity: yesOpacity }}>{likeLabel}</div>
                    </>
                  ) : null}

                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <h3 className="text-3xl font-bold leading-tight text-white">{itemWithDetails.title}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-300">
                      {year ? <span>{year}</span> : null}
                      {year && itemWithDetails.genres?.length ? <span>·</span> : null}
                      {itemWithDetails.genres?.length ? <span className="line-clamp-1">{itemWithDetails.genres.slice(0, 2).join(' · ')}</span> : null}
                    </div>
                    {itemWithDetails.nominated_by ? <div className="mt-2 text-xs uppercase tracking-[0.2em] text-neutral-400">Added by {itemWithDetails.nominated_by}</div> : null}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 p-4">
                  <button type="button" className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 font-semibold text-neutral-200 transition hover:bg-white hover:text-neutral-950" onClick={() => onSwipe('dislike', itemWithDetails)}>{dislikeLabel}</button>
                  <button type="button" className="rounded-2xl bg-white px-4 py-3 font-semibold text-neutral-950 transition hover:bg-neutral-200" onClick={() => onSwipe('like', itemWithDetails)}>{likeLabel}</button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {infoItem || loadingInfo ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-white/10 bg-neutral-950 p-5 shadow-2xl shadow-black/40">
            {loadingInfo ? (
              <div className="py-16 text-center text-neutral-400">Loading {infoType} info...</div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-2xl font-bold leading-tight text-white">{infoItem.title}</h3>
                    {infoItem.year || infoItem.released ? <div className="mt-1 text-sm text-neutral-400">{displayYear(infoItem.released || infoItem.year)}</div> : null}
                  </div>
                  <button type="button" onClick={() => setInfoItem(null)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-xl text-neutral-300 transition hover:bg-white hover:text-black">×</button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {infoItem.tmdbRating ? <DetailPill>TMDB ★ {Number(infoItem.tmdbRating).toFixed(1)}</DetailPill> : null}
                  {infoItem.runtime ? <DetailPill>{infoItem.runtime} min</DetailPill> : null}
                  {infoItem.genres?.map((genre) => <DetailPill key={genre}>{genre}</DetailPill>)}
                </div>

                <p className="mt-5 text-sm leading-7 text-neutral-300">{infoItem.description || infoItem.overview || `No ${infoType} description available.`}</p>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
