import AppIcon from './AppIcon.jsx'

function imageFor(item) { return item?.backdrop || item?.poster || null }
function itemMetaChips(item) {
  if (!item) return []
  const genres = Array.isArray(item.genres) ? item.genres.filter(Boolean) : []
  const fallbackPlatform = Array.isArray(item.platforms) ? item.platforms[0] : ''
  return [item.year, genres[0], genres[1] || (!genres.length ? fallbackPlatform : '')].filter(Boolean).slice(0, 3)
}
function SmallIconButton({ icon, label, onClick, disabled = false }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur transition hover:bg-white hover:text-neutral-950 disabled:pointer-events-none disabled:opacity-50">
      <AppIcon name={icon} size={14} strokeWidth={2.4} />
    </button>
  )
}

export default function CategorySpotlightCard({ category, loading, isClique, saving, index, onCycle, onOpenPile, onInfo, onShare, onCopy }) {
  const items = category.items || []
  const safeIndex = items.length ? index % items.length : 0
  const item = items[safeIndex]
  const top = category.top
  const image = imageFor(item) || top?.poster || top?.backdrop
  const title = loading ? 'Loading section…' : item?.title || top?.title || category.title || `No ${category.title.toLowerCase()} yet`
  const chips = itemMetaChips(item)
  const canCycle = items.length > 1

  return (
    <article data-top-category={category.title} className="group relative min-h-[15.25rem] snap-start overflow-hidden rounded-[1.6rem] border border-white/15 bg-neutral-950/80 text-white shadow-2xl shadow-black/20 transition hover:-translate-y-0.5 hover:border-white/25 sm:min-h-[19rem] sm:rounded-[1.75rem]">
      {image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-100 transition duration-500 group-hover:scale-105" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.14),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,0,0,0.45))]" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/5" />
      <button type="button" onClick={() => item ? onInfo?.(item) : onOpenPile?.(category.title)} className="absolute inset-0 z-10" aria-label={`Open ${title}`} />

      <div className="pointer-events-none relative z-20 flex min-h-[15.25rem] flex-col justify-between p-3 sm:min-h-[19rem] sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/45 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-neutral-100 backdrop-blur sm:px-3 sm:text-[10px] sm:tracking-[0.16em]"><AppIcon name={category.icon} size={12} />{category.title}</span>
          <div className="pointer-events-auto flex flex-wrap justify-end gap-2">
            <SmallIconButton icon="list" label={`Open ${category.title} list`} onClick={(event) => { event.stopPropagation(); onOpenPile?.(category.title) }} />
            {canCycle ? <SmallIconButton icon="refresh" label="Next recommendation" onClick={(event) => { event.stopPropagation(); onCycle?.(category.title) }} /> : null}
            {item ? <SmallIconButton icon="share" label="Share" onClick={(event) => { event.stopPropagation(); onShare?.(item) }} /> : null}
            {item && !isClique ? <SmallIconButton icon="copy" label={saving ? 'Saving…' : 'Save to my library'} disabled={saving} onClick={(event) => { event.stopPropagation(); onCopy?.(item) }} /> : null}
          </div>
        </div>
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-xl font-black leading-tight sm:text-2xl">{title}</h3>
          {chips.length ? <div className="mt-2 flex flex-wrap gap-1.5">{chips.map((chip, i) => <span key={`${chip}-${i}`} className="rounded-full border border-white/15 bg-black/45 px-2 py-0.5 text-[10px] font-bold text-neutral-300 backdrop-blur sm:px-2.5 sm:text-[11px]">{chip}</span>)}</div> : null}
        </div>
      </div>
    </article>
  )
}
