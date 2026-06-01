import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import AppIcon from '../components/AppIcon.jsx'
import PageShell from '../components/PageShell.jsx'
import { DetailPill, InfoModal, StatusMessage, displayYear } from '../components/MediaBlocks.jsx'
import { getMemberPublicLibrary, searchMembersByProfileName } from '../lib/communityShare.js'

const categoryMeta = {
  Movie: { title: 'Movies', icon: 'movies' },
  Series: { title: 'Series', icon: 'series' },
  Game: { title: 'Games', icon: 'games' },
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isUuid(value) { return UUID_RE.test(String(value || '').trim()) }

async function resolveMemberId(rawValue) {
  const value = decodeURIComponent(String(rawValue || '').trim())
  if (!value) throw new Error('Choose a member first.')
  if (isUuid(value)) return value
  if (value.length < 2) throw new Error('This member name is too short to search.')
  const matches = await searchMembersByProfileName(value, 8)
  const exact = matches.find((member) => String(member.displayName || '').toLowerCase() === value.toLowerCase())
  const resolved = exact || matches[0]
  if (!resolved?.id) throw new Error(`Could not find a member named "${value}".`)
  return resolved.id
}

function PublicLibraryCard({ item, onInfo }) {
  const meta = categoryMeta[item.type] || { title: item.type || 'Pick', icon: 'explore' }
  const image = item.backdrop || item.poster

  return (
    <article className="group overflow-hidden rounded-[1.65rem] border border-white/10 bg-white/[0.035] text-white transition hover:-translate-y-0.5 hover:border-white/25">
      <button type="button" onClick={() => onInfo(item)} className="block w-full text-left">
        <div className="relative h-48 bg-neutral-900">
          {image ? <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-105" /> : <div className="absolute inset-0 flex items-center justify-center text-neutral-500"><AppIcon name={meta.icon} size={40} /></div>}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/5" />
          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-950">
            <AppIcon name={meta.icon} size={12} />
            {item.type}
          </span>
          {item.rating ? <span className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1.5 text-xs font-black text-white backdrop-blur">★ {Number(item.rating).toFixed(1)}</span> : null}
        </div>
        <div className="p-4">
          <h3 className="line-clamp-2 text-lg font-black leading-tight">{item.title}</h3>
          <p className="mt-1 text-xs text-neutral-500">{displayYear(item.released || item.year) || meta.title}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-neutral-300">
            <span className="rounded-full border border-white/10 px-2.5 py-1">Score {item.score || 0}</span>
            <span className="rounded-full border border-white/10 px-2.5 py-1">{item.picks || 0} picks</span>
          </div>
        </div>
      </button>
    </article>
  )
}

function CategoryStrip({ title, icon, count }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-neutral-950/70 p-4">
      <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-neutral-500"><AppIcon name={icon} size={14} />{title}</p>
      <p className="mt-2 text-3xl font-black text-white">{count}</p>
    </div>
  )
}

export default function MemberLibrary() {
  const { memberId } = useParams()
  const [library, setLibrary] = useState({ profile: null, items: [], totals: {} })
  const [message, setMessage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setMessage(null)
      try {
        const resolvedMemberId = await resolveMemberId(memberId)
        const data = await getMemberPublicLibrary(resolvedMemberId)
        if (!cancelled) setLibrary(data)
      } catch (error) {
        if (!cancelled) setMessage({ type: 'error', text: error.message || 'Could not load this member library.' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [memberId])

  const buckets = useMemo(() => ({
    Movie: library.items.filter((item) => item.type === 'Movie'),
    Series: library.items.filter((item) => item.type === 'Series'),
    Game: library.items.filter((item) => item.type === 'Game'),
  }), [library.items])

  const name = library.profile?.displayName || decodeURIComponent(memberId || '') || 'Member'

  return (
    <PageShell active="explore">
      <section className="mb-5 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] shadow-2xl shadow-black/20">
        <div className="relative min-h-64 p-5 sm:p-7">
          {library.items[0]?.backdrop || library.items[0]?.poster ? <img src={library.items[0].backdrop || library.items[0].poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" /> : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30" />
          <div className="relative flex min-h-52 flex-col justify-end">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-neutral-500">Public member library</p>
            <h1 className="mt-2 text-4xl font-black text-white sm:text-5xl">{name}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">A read-only preview of this member’s shared library picks. Private-only items stay hidden.</p>
          </div>
        </div>
      </section>

      <StatusMessage message={message} />

      {loading ? <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-10 text-center text-neutral-400">Loading library...</div> : null}

      {!loading && !message ? (
        <>
          <section className="mb-5 grid gap-3 sm:grid-cols-3">
            <CategoryStrip title="Movies" icon="movies" count={buckets.Movie.length} />
            <CategoryStrip title="Series" icon="series" count={buckets.Series.length} />
            <CategoryStrip title="Games" icon="games" count={buckets.Game.length} />
          </section>

          {library.items.length ? (
            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {library.items.map((item) => <PublicLibraryCard key={`${item.type}-${item.id}`} item={item} onInfo={setSelectedItem} />)}
            </section>
          ) : (
            <section className="rounded-[2rem] border border-dashed border-white/15 bg-white/[0.03] p-8 text-center text-neutral-400">No public library items are visible for this member yet.</section>
          )}
        </>
      ) : null}

      <InfoModal item={selectedItem} onClose={() => setSelectedItem(null)} year={displayYear(selectedItem?.released || selectedItem?.year)} backdrop={selectedItem?.backdrop || selectedItem?.poster}>
        <div className="mt-4 flex flex-wrap gap-2">
          <DetailPill>{selectedItem?.type}</DetailPill>
          <DetailPill>Score {selectedItem?.score || 0}</DetailPill>
          <DetailPill>{selectedItem?.picks || 0} picks</DetailPill>
          {selectedItem?.rating ? <DetailPill>Rating ★ {Number(selectedItem.rating).toFixed(1)}</DetailPill> : null}
        </div>
        <p className="mt-5 text-sm leading-7 text-neutral-300">{selectedItem?.overview || 'No description available yet.'}</p>
      </InfoModal>
    </PageShell>
  )
}
