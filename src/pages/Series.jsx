import { useEffect, useMemo, useRef, useState } from 'react'
import SwipeDeck from '../components/SwipeDeck.jsx'
import PageShell from '../components/PageShell.jsx'
import { DetailPill, InfoModal, PageHero, RatedHistorySection, ResultRow, SearchResultsSection, StatusMessage, TopRankingSection, displayYear } from '../components/MediaBlocks.jsx'
import { getSavedHandle } from '../lib/handle.js'
import { GROUPS_CHANGED_EVENT, getActiveGroup } from '../lib/groups.js'
import { demoSeries } from '../lib/demoMovies.js'
import { getSeriesDetails, searchSeries } from '../lib/tmdb.js'
import { getCurrentSession, getRemoteGroups, getSeries, hasSupabase, markSeriesFinished, rateSeries as saveSeriesRating, saveSeries, voteSeries } from '../lib/supabaseClient.js'
import { useMediaVotes } from '../hooks/useMediaVotes.js'

function setupMessage(state) {
  if (!hasSupabase) return null
  if (state === 'signed-out') return 'Sign in from Profile to build your personal series library and save picks to cliques.'
  return null
}

function scopeLabel(scope, groups) {
  if (scope === 'personal') return 'Personal library'
  return groups.find((group) => group.id === scope)?.name || 'Selected clique'
}

export default function Series() {
  const [series, setSeries] = useState(() => hasSupabase ? [] : demoSeries)
  const [finished, setFinished] = useState(() => hasSupabase ? [] : demoSeries.filter((item) => item.finished).map((item) => item.id))
  const [ratings, setRatings] = useState(() => hasSupabase ? {} : Object.fromEntries(demoSeries.filter((item) => item.rating).map((item) => [item.id, item.rating])))
  const [editingRating, setEditingRating] = useState(null)
  const [infoSeries, setInfoSeries] = useState(null)
  const [loadingInfoSeries, setLoadingInfoSeries] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [groups, setGroups] = useState([])
  const [activeGroup, setActiveGroupState] = useState(() => getActiveGroup())
  const [selectedScope, setSelectedScope] = useState('personal')
  const [setupState, setSetupState] = useState(() => hasSupabase ? 'checking' : 'local')
  const deckRef = useRef(null)
  const activeHandle = getSavedHandle()
  const hasResults = results.length > 0
  const activeGroupId = activeGroup?.id || null
  const canUseLibrary = !hasSupabase || setupState === 'ready'
  const isPersonalScope = selectedScope === 'personal'
  const selectedGroupId = isPersonalScope ? null : selectedScope
  const [votes, recordVote] = useMediaVotes('series', selectedGroupId)
  const destinationLabel = hasSupabase ? scopeLabel(selectedScope, groups) : 'Local demo library'

  const queue = useMemo(() => series.filter((item) => !votes[item.id] && !finished.includes(item.id)), [series, votes, finished])
  const ranking = useMemo(() => series.slice().sort((a, b) => (votes[b.id] === 'like') - (votes[a.id] === 'like') || (b.score || 0) - (a.score || 0) || (b.picks || 0) - (a.picks || 0)), [series, votes])
  const finishedSeries = useMemo(() => series.filter((item) => finished.includes(item.id)), [series, finished])

  useEffect(() => {
    refreshContext()
  }, [activeGroupId])

  useEffect(() => {
    if (!hasSupabase || setupState !== 'ready') return
    loadSeries(selectedGroupId)
  }, [selectedScope, setupState])

  useEffect(() => {
    function handleGroupChange() {
      setActiveGroupState(getActiveGroup())
    }

    window.addEventListener(GROUPS_CHANGED_EVENT, handleGroupChange)
    return () => window.removeEventListener(GROUPS_CHANGED_EVENT, handleGroupChange)
  }, [])

  async function refreshContext() {
    if (!hasSupabase) return

    const group = getActiveGroup()
    setActiveGroupState(group)

    try {
      const session = await getCurrentSession()
      if (!session?.user) {
        clearRemoteState()
        setSetupState('signed-out')
        return
      }

      const remoteGroups = await getRemoteGroups().catch(() => [])
      setGroups(remoteGroups)

      if (selectedScope !== 'personal' && !remoteGroups.some((remoteGroup) => remoteGroup.id === selectedScope)) {
        setSelectedScope('personal')
      } else if (selectedScope === 'personal' && group?.id && remoteGroups.some((remoteGroup) => remoteGroup.id === group.id)) {
        setSelectedScope(group.id)
      }

      setSetupState('ready')
      await loadSeries(selectedScope === 'personal' ? null : selectedScope)
    } catch (error) {
      clearRemoteState()
      setSetupState('signed-out')
      setMessage({ type: 'error', text: `Could not check your account: ${error.message}` })
    }
  }

  function clearRemoteState() {
    setSeries([])
    setFinished([])
    setRatings({})
    setResults([])
  }

  async function loadSeries(groupId = selectedGroupId) {
    try {
      const rows = await getSeries(groupId)
      setSeries(rows)
      setFinished(rows.filter((item) => item.finished).map((item) => item.id))
      setRatings(Object.fromEntries(rows.filter((item) => item.rating).map((item) => [item.id, item.rating])))
    } catch (error) {
      setMessage({ type: 'error', text: `Could not load saved series: ${error.message}` })
    }
  }

  function showMessage(text, type = 'success') {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 2400)
  }

  function needLibrary() {
    if (canUseLibrary) return false
    showMessage(setupMessage(setupState) || 'Sign in first.', 'error')
    return true
  }

  function clearSearch() {
    setResults([])
    setQuery('')
    setTimeout(() => deckRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  async function handleSearch(event) {
    event.preventDefault()
    if (!query.trim()) return
    if (needLibrary()) return

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
    if (needLibrary()) return
    try {
      const details = await getSeriesDetails(item).catch(() => item)
      const fullItem = { ...(details || item), nominated_by: activeHandle || 'You' }

      if (hasSupabase) {
        const saved = await saveSeries(fullItem, activeHandle || 'anonymous', selectedGroupId)
        setSeries((current) => current.some((entry) => entry.id === saved.id) ? current.map((entry) => entry.id === saved.id ? saved : entry) : [saved, ...current])
      } else {
        setSeries((current) => current.some((entry) => entry.id === fullItem.id) ? current : [fullItem, ...current])
      }

      clearSearch()
      showMessage(`"${fullItem.title}" added to ${destinationLabel}.`)
    } catch (error) {
      showMessage(error.message || 'Could not add series.', 'error')
    }
  }

  async function handleSwipe(vote, item) {
    if (needLibrary()) return

    recordVote(item.id, vote)

    if (hasSupabase) {
      try {
        await voteSeries(item, vote, selectedGroupId)
        await loadSeries(selectedGroupId)
      } catch (error) {
        showMessage(error.message || 'Could not save vote.', 'error')
        return
      }
    }

    showMessage(vote === 'like' ? `You voted to watch "${item.title}".` : `You passed on "${item.title}".`)
  }

  async function markFinished(item) {
    if (needLibrary()) return

    setFinished((current) => current.includes(item.id) ? current : [...current, item.id])
    recordVote(item.id, 'like')
    setEditingRating(item.id)

    if (hasSupabase) {
      try {
        await markSeriesFinished(item, ratings[item.id] || null, selectedGroupId)
        await loadSeries(selectedGroupId)
      } catch (error) {
        showMessage(error.message || 'Could not save watched series.', 'error')
        return
      }
    }

    showMessage(`"${item.title}" moved to watched.`)
  }

  async function rateSeries(item, rating) {
    if (needLibrary()) return

    setRatings((current) => ({ ...current, [item.id]: rating }))
    setEditingRating(null)

    if (hasSupabase) {
      try {
        await saveSeriesRating(item, rating, selectedGroupId)
        await loadSeries(selectedGroupId)
      } catch (error) {
        showMessage(error.message || 'Could not save rating.', 'error')
      }
    }
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

  function refreshPage() {
    if (hasSupabase) {
      clearRemoteState()
      refreshContext()
      return
    }
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
        eyebrow={isPersonalScope ? 'My Library' : 'Clique picks'}
        title={isPersonalScope ? 'Your watched series' : 'Pick what to binge'}
        description={isPersonalScope ? 'Search series, mark the ones you watched, and keep your personal ratings here. Swipe voting stays inside cliques.' : 'Search series, save them to this clique, vote through the pile, and keep a shared watch ranking.'}
        warning={setupMessage(setupState) || (!activeHandle && !hasSupabase ? 'Create a profile with the Profile button in the navbar to keep your picks under one name.' : null)}
        actions={hasSupabase ? (
          <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Library space
            <select value={selectedScope} onChange={(event) => setSelectedScope(event.target.value)} disabled={!canUseLibrary} className="rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-sm font-semibold normal-case tracking-normal text-white outline-none disabled:opacity-50">
              <option value="personal">Personal library</option>
              {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
          </label>
        ) : <button type="button" onClick={refreshPage} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-neutral-200 transition hover:bg-white hover:text-neutral-950">Reset local demo</button>}
      >
        <form onSubmit={handleSearch} className="mt-4">
          <div className="flex gap-2">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a series..." className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-white/30" />
            {hasResults ? <button type="button" className="rounded-2xl border border-white/10 px-4 py-3 font-semibold text-neutral-200 transition hover:bg-white hover:text-neutral-950" onClick={clearSearch}>Back</button> : null}
            <button type="submit" disabled={loading || !canUseLibrary} className="rounded-2xl bg-white px-4 py-3 font-semibold text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-60 sm:px-5">{loading ? 'Searching...' : 'Search'}</button>
          </div>
        </form>
      </PageHero>

      <StatusMessage message={message} />

      {hasResults ? (
        <SearchResultsSection clearLabel={isPersonalScope ? 'Back to watched series' : 'Back to clique picks'} onClear={clearSearch}>
          <div className="space-y-2">
            {results.map((item) => <ResultRow key={item.id} item={item} onInfo={openSeriesInfo} onAdd={addSeries} addLabel={isPersonalScope ? 'Add' : 'Add pick'} onDone={markFinished} doneLabel="Watched" />)}
          </div>
        </SearchResultsSection>
      ) : null}

      {!isPersonalScope ? (
        <>
          <section ref={deckRef} className="mb-8">
            <SwipeDeck items={queue} onSwipe={handleSwipe} itemLabel="series" emptyLabel={canUseLibrary ? 'No series here yet. Search and add your first pick.' : 'Sign in to start your series library.'} likeLabel="Watch" dislikeLabel="Pass" infoType="series" loadDetails={getSeriesDetails} />
          </section>

          <TopRankingSection title="Next series" items={ranking} votes={votes} onInfo={openSeriesInfo} onDone={markFinished} doneLabel="Watched" />
        </>
      ) : null}

      <RatedHistorySection
        eyebrow={isPersonalScope ? 'Personal history' : 'After watching'}
        title={isPersonalScope ? 'Watched series' : 'Watched series ranking'}
        countText={`${finishedSeries.length} watched`}
        emptyLabel="No watched series yet. Search a series and mark it watched to start your library."
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
