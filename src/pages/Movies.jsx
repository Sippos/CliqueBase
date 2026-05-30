import { useEffect, useMemo, useRef, useState } from 'react'
import SwipeDeck from '../components/SwipeDeck.jsx'
import PageShell from '../components/PageShell.jsx'
import { DetailPill, InfoModal, PageHero, RatedHistorySection, ResultRow, SearchResultsSection, StatusMessage, TopRankingSection, displayYear } from '../components/MediaBlocks.jsx'
import { getSavedHandle } from '../lib/handle.js'
import { GROUPS_CHANGED_EVENT, getActiveGroup, getActiveGroupId, setActiveGroup as setActiveGroupContext } from '../lib/groups.js'
import { demoMovies } from '../lib/demoMovies.js'
import { getMovieDetails, searchMovies } from '../lib/tmdb.js'
import { getCurrentSession, getMovies, getRemoteGroups, hasSupabase, markMovieWatched, rateMovie as saveMovieRating, saveMovie, voteMovie } from '../lib/supabaseClient.js'

const MOVIES_SCOPE_STORAGE_KEY = 'cliquebase_movies_scope'

function setupMessage(state) {
  if (!hasSupabase) return null
  if (state === 'signed-out') return 'Sign in from Profile to build your personal movie library and save picks to cliques.'
  return null
}

function scopeLabel(scope, groups) {
  if (scope === 'personal') return 'Personal library'
  return groups.find((group) => group.id === scope)?.name || 'Selected clique'
}

function getInitialScope() {
  if (typeof window === 'undefined') return 'personal'
  return getActiveGroupId() || 'personal'
}

export default function Movies() {
  const [movies, setMovies] = useState(() => hasSupabase ? [] : demoMovies)
  const [votes, setVotes] = useState({})
  const [watched, setWatched] = useState(() => hasSupabase ? [] : demoMovies.filter((movie) => movie.watched).map((movie) => movie.id))
  const [ratings, setRatings] = useState(() => hasSupabase ? {} : Object.fromEntries(demoMovies.filter((movie) => movie.rating).map((movie) => [movie.id, movie.rating])))
  const [editingRating, setEditingRating] = useState(null)
  const [infoMovie, setInfoMovie] = useState(null)
  const [loadingInfoMovie, setLoadingInfoMovie] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [groups, setGroups] = useState([])
  const [activeGroup, setActiveGroupState] = useState(() => getActiveGroup())
  const [activeContextGroupId, setActiveContextGroupId] = useState(() => getActiveGroupId())
  const [selectedScope, setSelectedScopeState] = useState(() => getInitialScope())
  const [setupState, setSetupState] = useState(() => hasSupabase ? 'checking' : 'local')
  const deckRef = useRef(null)
  const activeHandle = getSavedHandle()
  const hasResults = results.length > 0
  const canUseLibrary = !hasSupabase || setupState === 'ready'
  const isPersonalScope = selectedScope === 'personal'
  const selectedGroupId = isPersonalScope ? null : selectedScope
  const destinationLabel = hasSupabase ? scopeLabel(selectedScope, groups) : 'Local demo library'

  const queue = useMemo(() => movies.filter((movie) => !votes[movie.id] && !watched.includes(movie.id)), [movies, votes, watched])
  const ranking = useMemo(() => movies.slice().sort((a, b) => (votes[b.id] === 'like') - (votes[a.id] === 'like') || (b.score || 0) - (a.score || 0) || (b.picks || 0) - (a.picks || 0)), [movies, votes])
  const watchedMovies = useMemo(() => movies.filter((movie) => watched.includes(movie.id)), [movies, watched])

  useEffect(() => {
    refreshContext()
  }, [activeContextGroupId])

  useEffect(() => {
    if (!hasSupabase || setupState !== 'ready') return
    loadMovies(selectedGroupId)
  }, [selectedScope, setupState])

  useEffect(() => {
    function handleGroupChange() {
      const nextGroupId = getActiveGroupId()
      const nextScope = nextGroupId || 'personal'
      setActiveGroupState(getActiveGroup())
      setActiveContextGroupId(nextGroupId)
      saveSelectedScope(nextScope)
    }

    window.addEventListener(GROUPS_CHANGED_EVENT, handleGroupChange)
    return () => window.removeEventListener(GROUPS_CHANGED_EVENT, handleGroupChange)
  }, [])

  function saveSelectedScope(scope) {
    const nextScope = scope || 'personal'
    setSelectedScopeState(nextScope)
    if (typeof window !== 'undefined') localStorage.setItem(MOVIES_SCOPE_STORAGE_KEY, nextScope)
  }

  function setSelectedScope(scope) {
    const nextScope = scope || 'personal'
    saveSelectedScope(nextScope)
    setActiveContextGroupId(nextScope === 'personal' ? '' : nextScope)
    setActiveGroupState(nextScope === 'personal' ? null : groups.find((group) => group.id === nextScope) || activeGroup)
    setActiveGroupContext(nextScope === 'personal' ? '' : nextScope)
  }

  async function refreshContext() {
    if (!hasSupabase) return

    const group = getActiveGroup()
    const activeId = getActiveGroupId()
    setActiveGroupState(group)
    setActiveContextGroupId(activeId)

    try {
      const session = await getCurrentSession()
      if (!session?.user) {
        clearRemoteState()
        setSetupState('signed-out')
        return
      }

      const remoteGroups = await getRemoteGroups().catch(() => [])
      setGroups(remoteGroups)

      let nextScope = activeId || selectedScope || 'personal'
      if (nextScope !== 'personal' && !remoteGroups.some((remoteGroup) => remoteGroup.id === nextScope)) {
        nextScope = 'personal'
        saveSelectedScope(nextScope)
        setActiveGroupContext('')
        setActiveContextGroupId('')
        setActiveGroupState(null)
      } else {
        saveSelectedScope(nextScope)
      }

      setSetupState('ready')
      await loadMovies(nextScope === 'personal' ? null : nextScope)
    } catch (error) {
      clearRemoteState()
      setSetupState('signed-out')
      setMessage({ type: 'error', text: `Could not check your account: ${error.message}` })
    }
  }

  function clearRemoteState() {
    setMovies([])
    setVotes({})
    setWatched([])
    setRatings({})
    setResults([])
  }

  async function loadMovies(groupId = selectedGroupId) {
    try {
      const rows = await getMovies(groupId)
      setMovies(rows)
      setWatched(rows.filter((movie) => movie.watched).map((movie) => movie.id))
      setRatings(Object.fromEntries(rows.filter((movie) => movie.rating).map((movie) => [movie.id, movie.rating])))
    } catch (error) {
      setMessage({ type: 'error', text: `Could not load saved movies: ${error.message}` })
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
      const found = await searchMovies(query)
      setResults(found)
      if (!found.length) showMessage('No movies found.', 'error')
    } catch (error) {
      showMessage(error.message || 'Search failed.', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function addMovie(movie) {
    if (needLibrary()) return
    try {
      const details = await getMovieDetails(movie.id).catch(() => movie)
      const fullMovie = { ...(details || movie), nominated_by: activeHandle || 'You' }

      if (hasSupabase) {
        const saved = await saveMovie(fullMovie, activeHandle || 'anonymous', selectedGroupId)
        setMovies((current) => current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current])
      } else {
        setMovies((current) => current.some((item) => item.id === fullMovie.id) ? current : [fullMovie, ...current])
      }

      clearSearch()
      showMessage(`"${fullMovie.title}" added to ${destinationLabel}.`)
    } catch (error) {
      showMessage(error.message || 'Could not add movie.', 'error')
    }
  }

  async function handleSwipe(vote, movie) {
    if (needLibrary()) return

    setVotes((current) => ({ ...current, [movie.id]: vote }))

    if (hasSupabase) {
      try {
        await voteMovie(movie, vote, selectedGroupId)
        await loadMovies(selectedGroupId)
      } catch (error) {
        showMessage(error.message || 'Could not save vote.', 'error')
        return
      }
    }

    showMessage(vote === 'like' ? `You voted to watch "${movie.title}".` : `You passed on "${movie.title}".`)
  }

  async function markWatched(movie) {
    if (needLibrary()) return

    setWatched((current) => current.includes(movie.id) ? current : [...current, movie.id])
    setVotes((current) => ({ ...current, [movie.id]: 'like' }))
    setEditingRating(movie.id)

    if (hasSupabase) {
      try {
        await markMovieWatched(movie, ratings[movie.id] || null, selectedGroupId)
        await loadMovies(selectedGroupId)
      } catch (error) {
        showMessage(error.message || 'Could not save watched movie.', 'error')
        return
      }
    }

    showMessage(`"${movie.title}" moved to watched.`)
  }

  async function rateWatchedMovie(movie, rating) {
    if (needLibrary()) return

    setRatings((current) => ({ ...current, [movie.id]: rating }))
    setEditingRating(null)

    if (hasSupabase) {
      try {
        await saveMovieRating(movie, rating, selectedGroupId)
        await loadMovies(selectedGroupId)
      } catch (error) {
        showMessage(error.message || 'Could not save rating.', 'error')
      }
    }
  }

  async function openMovieInfo(movie) {
    setLoadingInfoMovie(true)
    setInfoMovie(movie)
    try {
      const details = await getMovieDetails(movie.id)
      if (details) setInfoMovie({ ...movie, ...details })
    } catch {
      // Keep existing local details.
    } finally {
      setLoadingInfoMovie(false)
    }
  }

  function refreshPage() {
    if (hasSupabase) {
      clearRemoteState()
      refreshContext()
      return
    }
    setMovies(demoMovies)
    setVotes({})
    setWatched(demoMovies.filter((movie) => movie.watched).map((movie) => movie.id))
    setRatings(Object.fromEntries(demoMovies.filter((movie) => movie.rating).map((movie) => [movie.id, movie.rating])))
    setEditingRating(null)
    setInfoMovie(null)
    setResults([])
    setQuery('')
    setMessage(null)
  }

  return (
    <PageShell active="movies">
      <PageHero
        eyebrow={isPersonalScope ? 'My Library' : 'Clique picks'}
        title={isPersonalScope ? 'Your watched movies' : 'Pick what to watch'}
        description={isPersonalScope ? 'Search movies, mark the ones you watched, and keep your personal ratings here. Swipe voting stays inside cliques.' : 'Search movies, save them to this clique, vote through the pile, and keep a shared watch ranking.'}
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
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a movie..." className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-white/30" />
            {hasResults ? <button type="button" className="rounded-2xl border border-white/10 px-4 py-3 font-semibold text-neutral-200 transition hover:bg-white hover:text-neutral-950" onClick={clearSearch}>Back</button> : null}
            <button type="submit" disabled={loading || !canUseLibrary} className="rounded-2xl bg-white px-4 py-3 font-semibold text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-60 sm:px-5">{loading ? 'Searching...' : 'Search'}</button>
          </div>
        </form>
      </PageHero>

      <StatusMessage message={message} />

      {hasResults ? (
        <SearchResultsSection clearLabel={isPersonalScope ? 'Back to watched movies' : 'Back to clique picks'} onClear={clearSearch}>
          <div className="space-y-2">
            {results.map((movie) => <ResultRow key={movie.id} item={movie} onInfo={openMovieInfo} onAdd={addMovie} addLabel={isPersonalScope ? 'Add' : 'Add pick'} onDone={markWatched} doneLabel="Watched" />)}
          </div>
        </SearchResultsSection>
      ) : null}

      {!isPersonalScope ? (
        <>
          <section ref={deckRef} className="mb-8">
            <SwipeDeck items={queue} onSwipe={handleSwipe} itemLabel="movies" emptyLabel={canUseLibrary ? 'No movies here yet. Search and add your first pick.' : 'Sign in to start your movie library.'} likeLabel="Watch" dislikeLabel="Pass" infoType="movie" loadDetails={getMovieDetails} />
          </section>

          <TopRankingSection title="Next movies" items={ranking} votes={votes} onInfo={openMovieInfo} onDone={markWatched} doneLabel="Watched" />
        </>
      ) : null}

      <RatedHistorySection
        eyebrow={isPersonalScope ? 'Personal history' : 'After watching'}
        title={isPersonalScope ? 'Watched movies' : 'Watched ranking'}
        countText={`${watchedMovies.length} watched`}
        emptyLabel="No watched movies yet. Search a movie and mark it watched to start your library."
        items={watchedMovies}
        ratings={ratings}
        editingRating={editingRating}
        onToggleRating={(movie) => setEditingRating(editingRating === movie.id ? null : movie.id)}
        onRate={rateWatchedMovie}
        onInfo={openMovieInfo}
        detailsLabel="Movie details"
        renderMeta={(movie) => `${displayYear(movie.released || movie.year) || 'Unknown year'} · ${(movie.genres || []).slice(0, 2).join(' · ') || 'No genres yet'}`}
        renderPills={(movie) => <>{movie.tmdbRating ? <DetailPill>TMDB ★ {Number(movie.tmdbRating).toFixed(1)}</DetailPill> : null}{movie.runtime ? <DetailPill>{movie.runtime} min</DetailPill> : null}</>}
      />

      <InfoModal item={infoMovie} loading={loadingInfoMovie && !infoMovie} loadingLabel="Loading movie info..." onClose={() => setInfoMovie(null)} year={displayYear(infoMovie?.released || infoMovie?.year)} backdrop={infoMovie?.backdrop}>
        <div className="mt-4 flex flex-wrap gap-2">
          {infoMovie?.tmdbRating ? <DetailPill>TMDB ★ {Number(infoMovie.tmdbRating).toFixed(1)}</DetailPill> : null}
          {infoMovie?.runtime ? <DetailPill>{infoMovie.runtime} min</DetailPill> : null}
          {ratings[infoMovie?.id] ? <DetailPill>Your rating ★ {ratings[infoMovie.id]}/10</DetailPill> : null}
          {infoMovie?.genres?.map((genre) => <DetailPill key={genre}>{genre}</DetailPill>)}
        </div>
        <p className="mt-5 text-sm leading-7 text-neutral-300">{infoMovie?.overview || 'No movie description available.'}</p>
      </InfoModal>
    </PageShell>
  )
}
