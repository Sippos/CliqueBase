import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AppIcon from '../components/AppIcon.jsx'
import PageShell from '../components/PageShell.jsx'
import { DetailPill, InfoModal, StatusMessage, displayYear } from '../components/MediaBlocks.jsx'
import { getActiveGroup, setActiveGroup } from '../lib/groups.js'
import { getCurrentSession, getGames, getMovies, getRemoteGroups, getSeries, hasSupabase } from '../lib/supabaseClient.js'
import { getVideos } from '../lib/videoLibrary.js'

const CATEGORY_META = [
  { key: 'movies', title: 'Movies', singular: 'Movie', icon: 'movies', href: '/movies', doneKey: 'watched', addLabel: 'Search movies', description: 'Find a movie and add it to this clique.' },
  { key: 'series', title: 'Series', singular: 'Series', icon: 'series', href: '/series', doneKey: 'finished', addLabel: 'Search series', description: 'Find a series and add it to this clique.' },
  { key: 'games', title: 'Games', singular: 'Game', icon: 'games', href: '/games', doneKey: 'played', addLabel: 'Search games', description: 'Find a game and add it to this clique.' },
  { key: 'videos', title: 'Videos', singular: 'Video', icon: 'videos', href: '/videos', doneKey: 'classic', addLabel: 'Add video link', description: 'Paste a YouTube, TikTok, Instagram, or other video link.' },
]

function scopedHref(category, groupId) {
  return `${category.href}?clique=${encodeURIComponent(groupId)}`
}

function artFor(item) {
  return item?.backdrop || item?.poster || null
}

function normalizeItems(rows = [], category) {
  return rows.map((item) => ({
    ...item,
    type: category.singular,
    icon: category.icon,
    done: category.doneKey === 'classic' ? Boolean(item.classic) : Boolean(item[category.doneKey]),
    rating: item.rating ?? null,
    score: Number(item.score || 0),
    picks: Number(item.picks || 0),
    sortValue: Number(item.score || 0) * 10 + Number(item.picks || 0) + Number(item.rating || 0) + (item.classic ? 4 : 0),
  })).sort((a, b) => b.sortValue - a.sortValue || String(a.title || '').localeCompare(String(b.title || '')))
}

function AddContentModal({ groupId, groupName, onClose }) {
  if (!groupId) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-neutral-950 p-5 text-white shadow-2xl shadow-black/40">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.26em] text-neutral-500">Add content</p>
            <h2 className="mt-1 text-2xl font-black">What should go into {groupName}?</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-400">Each option opens the right search or upload screen inside this clique.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close add content" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-2xl text-neutral-400 transition hover:bg-white hover:text-neutral-950">×</button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {CATEGORY_META.map((category) => (
            <Link key={category.key} to={scopedHref(category, groupId)} onClick={onClose} className="group rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-4 transition hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.07]">
              <div className="flex items-start justify-between gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-neutral-950"><AppIcon name={category.icon} size={19} /></span>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-black text-neutral-300 transition group-hover:bg-white group-hover:text-neutral-950">Open</span>
              </div>
              <h3 className="mt-4 text-lg font-black text-white">{category.addLabel}</h3>
              <p className="mt-2 text-sm leading-6 text-neutral-400">{category.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function MiniCategoryTile({ category, groupId }) {
  const top = category.items[0]
  const image = artFor(top)
  return (
    <Link to={scopedHref(category, groupId)} className="group relative min-h-[5.75rem] overflow-hidden rounded-[1.15rem] border border-white/10 bg-neutral-950 transition hover:-translate-y-0.5 hover:border-white/25">
      {image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-78 transition duration-500 group-hover:scale-105" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.12),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.07),rgba(0,0,0,0.45))]" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/5" />
      <div className="relative flex min-h-[5.75rem] flex-col justify-between p-3">
        <div className="flex items-start justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-neutral-950"><AppIcon name={category.icon} size={10} />{category.title}</span>
          <span className="rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-black text-white backdrop-blur">{category.count}</span>
        </div>
        <h3 className="line-clamp-1 text-sm font-black text-white drop-shadow">{top?.title || `No ${category.title.toLowerCase()}`}</h3>
      </div>
    </Link>
  )
}

function CategoryOverviewCard({ category, groupId, onInfo }) {
  const top = category.items[0]
  const image = artFor(top)
  return (
    <article className="group relative min-h-[18.5rem] overflow-hidden rounded-[1.65rem] border border-white/10 bg-neutral-950 text-white transition hover:-translate-y-0.5 hover:border-white/25">
      <Link to={scopedHref(category, groupId)} className="absolute inset-0" aria-label={`Open ${category.title}`}>
        {image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-82 transition duration-500 group-hover:scale-105" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.14),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,0,0,0.45))]" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/5" />
      </Link>

      <div className="pointer-events-none relative z-10 flex min-h-[18.5rem] flex-col justify-between p-4">
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-950"><AppIcon name={category.icon} size={12} />{category.title}</span>
          <span className="rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-xs font-black text-white backdrop-blur">{category.count}</span>
        </div>

        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-300">Top {category.singular.toLowerCase()}</p>
          <h3 className="mt-1 line-clamp-2 text-2xl font-black leading-tight text-white drop-shadow-lg">{top?.title || `No ${category.title.toLowerCase()} yet`}</h3>
          <div className="pointer-events-auto mt-4 flex gap-2">
            {top ? <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onInfo(top) }} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/55 text-white backdrop-blur transition hover:bg-white hover:text-neutral-950" aria-label={`Info for ${top.title}`}><AppIcon name="info" size={17} /></button> : null}
            <Link to={scopedHref(category, groupId)} className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-3 text-xs font-black text-neutral-950 transition hover:bg-neutral-200"><AppIcon name="list" size={14} />Pile</Link>
          </div>
        </div>
      </div>
    </article>
  )
}

function ContentRow({ item, onInfo }) {
  const image = item.poster || item.backdrop
  return (
    <button type="button" onClick={() => onInfo(item)} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-neutral-950/70 p-2 text-left transition hover:border-white/25 hover:bg-white/[0.06]">
      <div className="h-14 w-16 shrink-0 overflow-hidden rounded-xl bg-neutral-900">{image ? <img src={image} alt="" className="h-full w-full object-cover opacity-90" /> : <div className="flex h-full w-full items-center justify-center text-neutral-500"><AppIcon name={item.icon || 'explore'} size={17} /></div>}</div>
      <div className="min-w-0 flex-1"><p className="truncate font-black text-white">{item.title}</p><p className="mt-0.5 truncate text-xs text-neutral-500">{item.type} · Score {item.score || 0} · {item.picks || 0} picks</p></div>
    </button>
  )
}

export default function CliqueDetail() {
  const { groupId = '' } = useParams()
  const [session, setSession] = useState(null)
  const [group, setGroup] = useState(null)
  const [media, setMedia] = useState({ movies: [], series: [], games: [], videos: [] })
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [addOpen, setAddOpen] = useState(false)

  useEffect(() => {
    if (groupId) setActiveGroup(groupId)
    let cancelled = false
    async function loadClique() {
      setLoading(true)
      setMessage(null)
      try {
        const nextSession = hasSupabase ? await getCurrentSession().catch(() => null) : null
        if (!cancelled) setSession(nextSession)
        const remoteGroups = hasSupabase && nextSession?.user ? await getRemoteGroups().catch(() => []) : []
        const currentGroup = remoteGroups.find((item) => item.id === groupId) || getActiveGroup() || { id: groupId, name: 'Clique', members: [] }
        const [movies, series, games, videos] = hasSupabase && nextSession?.user ? await Promise.all([getMovies(groupId), getSeries(groupId), getGames(groupId), getVideos(groupId)]) : [[], [], [], []]
        if (!cancelled) {
          setGroup(currentGroup)
          setMedia({ movies, series, games, videos })
        }
      } catch (error) {
        if (!cancelled) {
          setMessage({ type: 'error', text: error.message || 'Could not load this clique.' })
          setGroup({ id: groupId, name: 'Clique', members: [] })
          setMedia({ movies: [], series: [], games: [], videos: [] })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadClique()
    return () => { cancelled = true }
  }, [groupId])

  const categories = useMemo(() => {
    const rows = { movies: media.movies, series: media.series, games: media.games, videos: media.videos }
    return CATEGORY_META.map((meta) => {
      const items = normalizeItems(rows[meta.key], meta)
      return {
        ...meta,
        items,
        count: items.length,
        score: items.reduce((sum, item) => sum + Number(item.score || 0), 0),
        picks: items.reduce((sum, item) => sum + Number(item.picks || 0), 0),
        done: items.filter((item) => item.done || item.rating).length,
      }
    })
  }, [media])

  const allItems = useMemo(() => categories.flatMap((category) => category.items).sort((a, b) => b.sortValue - a.sortValue), [categories])
  const totalItems = allItems.length
  const activeCategories = categories.filter((category) => category.count > 0).length
  const topCategory = categories.slice().sort((a, b) => b.count - a.count || b.score - a.score)[0]
  const heroItem = allItems[0]
  const heroImage = artFor(heroItem)
  const groupName = group?.name || 'Clique'

  return (
    <PageShell active="cliques">
      <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] shadow-2xl shadow-black/20">
        <div className="grid gap-0 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.3em] text-neutral-500">Clique workspace</p>
                <h1 className="mt-2 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl">{groupName}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">{totalItems} items across {activeCategories} active content types.</p>
              </div>
              <button type="button" onClick={() => setAddOpen(true)} className="inline-flex h-10 w-fit shrink-0 items-center gap-2 rounded-full bg-white px-4 text-sm font-black text-neutral-950 transition hover:bg-neutral-200"><AppIcon name="explore" size={15} />Add</button>
            </div>
            {!session?.user && hasSupabase ? <p className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-neutral-300">Sign in from Profile to add and vote inside cliques.</p> : null}
            <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {categories.map((category) => <MiniCategoryTile key={category.key} category={category} groupId={groupId} />)}
            </div>
          </div>
          <div className="relative min-h-[21rem] bg-neutral-950">
            {heroImage ? <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-82" /> : <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.16),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.08),rgba(0,0,0,0.45))]" />}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/5" />
            <div className="absolute left-5 top-5 rounded-full border border-white/15 bg-black/45 px-3 py-1.5 text-xs font-black uppercase tracking-[0.22em] text-white backdrop-blur">Top pick</div>
            <div className="absolute inset-x-0 bottom-0 p-6">
              <p className="text-xs font-black uppercase tracking-[0.3em] text-neutral-300">{heroItem?.type || 'Empty clique'}</p>
              <h2 className="mt-2 text-3xl font-black text-white">{heroItem?.title || 'Add the first clique item'}</h2>
            </div>
          </div>
        </div>
      </section>

      <StatusMessage message={message} />

      <section className="mt-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-neutral-500">Category overview</p>
            <h2 className="mt-1 text-3xl font-black text-white">Contents at a glance</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">Strongest category: {topCategory?.title || 'none yet'}.</p>
          </div>
          <button type="button" onClick={() => setAddOpen(true)} className="inline-flex h-10 w-fit items-center gap-2 rounded-full border border-white/10 px-4 text-sm font-black text-white transition hover:bg-white hover:text-neutral-950"><AppIcon name="explore" size={15} />Add</button>
        </div>
        {loading ? <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((item) => <div key={item} className="h-72 animate-pulse rounded-[1.5rem] bg-white/[0.06]" />)}</div> : <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{categories.map((category) => <CategoryOverviewCard key={category.key} category={category} groupId={groupId} onInfo={setSelectedItem} />)}</div>}
      </section>

      <section className="mt-5 rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.3em] text-neutral-500">Recent content</p><h2 className="mt-1 text-2xl font-black text-white">Latest visible items</h2></div><span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-neutral-300">{allItems.length} total</span></div>
        {allItems.length ? <div className="mt-4 grid gap-2 md:grid-cols-2">{allItems.slice(0, 8).map((item) => <ContentRow key={`${item.type}-${item.id}`} item={item} onInfo={setSelectedItem} />)}</div> : <p className="mt-4 rounded-3xl border border-dashed border-white/10 p-5 text-sm leading-6 text-neutral-400">Nothing has been added yet. Use Add to start this clique library.</p>}
      </section>

      <InfoModal item={selectedItem} onClose={() => setSelectedItem(null)} year={displayYear(selectedItem?.released || selectedItem?.year)} backdrop={selectedItem?.backdrop || selectedItem?.poster}>
        <div className="mt-4 flex flex-wrap gap-2">
          <DetailPill>{selectedItem?.type}</DetailPill>
          <DetailPill>Score {selectedItem?.score || 0}</DetailPill>
          <DetailPill>{selectedItem?.picks || 0} picks</DetailPill>
          {selectedItem?.rating ? <DetailPill>Rating ★ {Number(selectedItem.rating).toFixed(1)}</DetailPill> : null}
          {selectedItem?.done ? <DetailPill>Done</DetailPill> : null}
        </div>
        <p className="mt-5 break-words text-sm leading-7 text-neutral-300">{selectedItem?.overview || selectedItem?.url || 'No description available yet.'}</p>
        {selectedItem?.url ? <a href={selectedItem.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-950 hover:bg-neutral-200">Open link</a> : null}
      </InfoModal>

      {addOpen ? <AddContentModal groupId={groupId} groupName={groupName} onClose={() => setAddOpen(false)} /> : null}
    </PageShell>
  )
}
