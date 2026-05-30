import { useMemo, useRef, useState } from 'react'
import SwipeDeck from '../components/SwipeDeck.jsx'
import PageShell from '../components/PageShell.jsx'
import { DetailPill, InfoModal, PageHero, RatedHistorySection, ResultRow, SearchResultsSection, StatusMessage, TopRankingSection, displayYear } from '../components/MediaBlocks.jsx'
import { getSavedHandle } from '../lib/handle.js'
import { demoSeries } from '../lib/demoMovies.js'
import { getSeriesDetails, searchSeries } from '../lib/tmdb.js'

export default function Series() {
  const [series, setSeries] = useState(demoSeries)
  const [votes, setVotes] = useState({})
  const [finished, setFinished] = useState(() => demoSeries.filter((item) => item.finished).map((item) => item.id))
  const [ratings, setRatings] = useState(() => Object.fromEntries(demoSeries.filter((item) => item.rating).map((item) => [item.id, item.rating])))
  const [editingRating, setEditingRating] = useState(null)
  const [infoSeries, setInfoSeries] = useState(null)
  const [loadingInfoSeries, setLoadingInfoSeries] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const deckRef = useRef(null)
  const activeHandle = getSavedHandle()
  const hasResults = results.length > 0

  const queue = useMemo(() => series.filter((item) => !votes[item.id] && !finished.includes(item.id)), [series, votes, finished])
  const ranking = useMemo(() => series.slice().sort((a, b) => (votes[b.id] === 'like') - (votes[a.id] === 'like') || (b.score || 0) - (a.score || 0) || (b.picks || 0) - (a.picks || 0)), [series, votes])
  const finishedSeries = useMemo(() => series.filter((item) => finished.includes(item.id)), [series, finished])

  function showMessage(text, type = 'success') {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 2200)
  }

  function clearSearch() {
    setResults([])
    setQuery('')
    setTimeout(() => deckRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  async function handleSearch(event) {
    event.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    try {
      const found = await searchSeries(query)
      setResults(found)
      if (!found.length) showMessage('No series found.', 'error')
    } catch (error) {
      showMessage(error.message || 'Search failed.', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function addSeries(item) {
    const details = await getSeriesDetails(item).catch(() => item)
    const fullItem = { ...(details || item), nominated_by: activeHandle || 'You' }
    setSeries((current) => current.some((entry) => entry.id === fullItem.id) ? current : [fullItem, ...current])
    clearSearch()
    showMessage(`"${fullItem.title}" added to the swipe pile.`)
  }

  function handleSwipe(vote, item) {
    setVotes((current) => ({ ...current, [item.id]: vote }))
    showMessage(vote === 'like' ? `You voted to watch "${item.title}".` : `You passed on "${item.title}".`)
  }

  function markFinished(item) {
    setFinished((current) => current.includes(item.id) ? current : [...current, item.id])
    setVotes((current) => ({ ...current, [item.id]: 'like' }))
    setEditingRating(item.id)
    showMessage(`"${item.title}" moved to watched.`)
  }

  function rateSeries(item, rating) {
    setRatings((current) => ({ ...current, [item.id]: rating }))
    setEditingRating(null)
  }

  async function openSeriesInfo(item) {
    setLoadingInfoSeries(true)
    setInfoSeries(item)
    try {
      const details = await getSeriesDetails(item)
      if (details) setInfoSeries({ ...item, ...details })
    } catch {
      // Keep current details.
    } finally {
      setLoadingInfoSeries(false)
    }
  }

  function resetPage() {
    setSeries(demoSeries)
    setVotes({})
    setFinished(demoSeries.filter((item) => item.finished).map((item) => item.id))
    setRatings(Object.fromEntries(demoSeries.filter((item) => item.rating).map((item) => [item.id, item.rating])))
    setEditingRating(null)
    setInfoSeries(null)
    setResults([])
    setQuery('')
    setMessage(null)
  }

  return (
    <PageShell active="series">
      <PageHero
        eyebrow="Series night"
        title="Pick what to binge"
        description="Search series, add them to the pile, vote with the swipe deck, and rate everything after watching."
        warning={!activeHandle ? 'Create a profile with the Profile button in the navbar to keep your picks under one name.' : null}
        actions={<button type="button" onClick={resetPage} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-neutral-200 transition hover:bg-white hover:text-neutral-950">Reset</button>}
      >
        <form onSubmit={handleSearch} className="mt-4">
          <div className="flex gap-2">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a series..." className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-white/30" />
            {hasResults ? <button type="button" className="rounded-2xl border border-white/10 px-4 py-3 font-semibold text-neutral-200 transition hover:bg-white hover:text-neutral-950" onClick={clearSearch}>Back</button> : null}
            <button type="submit" disabled={loading} className="rounded-2xl bg-white px-4 py-3 font-semibold text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-60 sm:px-5">{loading ? 'Searching...' : 'Search'}</button>
          </div>
        </form>
      </PageHero>

      <StatusMessage message={message} />

      {hasResults ? (
        <SearchResultsSection onClear={clearSearch}>
          <div className="space-y-2">
            {results.map((item) => <ResultRow key={item.id} item={item} onInfo={openSeriesInfo} onAdd={addSeries} onDone={markFinished} doneLabel="Watched" />)}
          </div>
        </SearchResultsSection>
      ) : null}

      <section ref={deckRef} className="mb-8">
        <SwipeDeck items={queue} onSwipe={handleSwipe} itemLabel="series" emptyLabel="No series left to vote on" likeLabel="Watch" dislikeLabel="Pass" infoType="series" loadDetails={getSeriesDetails} />
      </section>

      <TopRankingSection title="Next series" items={ranking} votes={votes} onInfo={openSeriesInfo} onDone={markFinished} doneLabel="Watched" />

      <RatedHistorySection
        eyebrow="After watching"
        title="Watched series ranking"
        countText={`${finishedSeries.length} watched`}
        emptyLabel="No watched series yet."
        items={finishedSeries}
        ratings={ratings}
        editingRating={editingRating}
        onToggleRating={(item) => setEditingRating(editingRating === item.id ? null : item.id)}
        onRate={rateSeries}
        onInfo={openSeriesInfo}
        detailsLabel="Series details"
        renderMeta={(item) => `${displayYear(item.released || item.year) || 'Unknown year'} · ${(item.genres || []).slice(0, 2).join(' · ') || 'No genres yet'}`}
        renderPills={(item) => <>{item.tmdbRating ? <DetailPill>TMDB ★ {Number(item.tmdbRating).toFixed(1)}</DetailPill> : null}{item.seasons ? <DetailPill>{item.seasons} seasons</DetailPill> : null}{item.episodes ? <DetailPill>{item.episodes} episodes</DetailPill> : null}</>}
      />

      <InfoModal item={infoSeries} loading={loadingInfoSeries && !infoSeries} loadingLabel="Loading series info..." onClose={() => setInfoSeries(null)} year={displayYear(infoSeries?.released || infoSeries?.year)} backdrop={infoSeries?.backdrop}>
        <div className="mt-4 flex flex-wrap gap-2">
          {infoSeries?.tmdbRating ? <DetailPill>TMDB ★ {Number(infoSeries.tmdbRating).toFixed(1)}</DetailPill> : null}
          {infoSeries?.seasons ? <DetailPill>{infoSeries.seasons} seasons</DetailPill> : null}
          {infoSeries?.episodes ? <DetailPill>{infoSeries.episodes} episodes</DetailPill> : null}
          {ratings[infoSeries?.id] ? <DetailPill>Your rating ★ {ratings[infoSeries.id]}/10</DetailPill> : null}
          {infoSeries?.genres?.map((genre) => <DetailPill key={genre}>{genre}</DetailPill>)}
        </div>
        <p className="mt-5 text-sm leading-7 text-neutral-300">{infoSeries?.overview || 'No series description available.'}</p>
      </InfoModal>
    </PageShell>
  )
}
