import { useEffect, useMemo, useRef, useState } from 'react'
import SwipeDeck from '../components/SwipeDeck.jsx'
import PageShell from '../components/PageShell.jsx'
import { DetailPill, InfoModal, PageHero, RatedHistorySection, ResultRow, SearchResultsSection, StatusMessage, TopRankingSection, displayYear } from '../components/MediaBlocks.jsx'
import { getSavedHandle } from '../lib/handle.js'
import { demoMovies } from '../lib/demoMovies.js'
import { getMovieDetails, searchMovies } from '../lib/tmdb.js'
import { getMovies, markMovieWatched, rateMovie as saveMovieRating, saveMovie, supabase, voteMovie } from '../lib/supabaseClient.js'

export default function Movies() {
  const [movies, setMovies] = useState(demoMovies)
  const [votes, setVotes] = useState({})
  const [watched, setWatched] = useState(() => demoMovies.filter((movie) => movie.watched).map((movie) => movie.id))
  const [ratings, setRatings] = useState(() => Object.fromEntries(demoMovies.filter((movie) => movie.rating).map((movie) => [movie.id, movie.rating])))
  const [editingRating, setEditingRating] = useState(null)
  const [infoMovie, setInfoMovie] = useState(null)
  const [loadingInfoMovie, setLoadingInfoMovie] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const deckRef = useRef(null)
  const activeHandle = getSavedHandle()
  const hasSupabase = Boolean(supabase)
  const hasResults = results.length > 0

  const queue = useMemo(() => movies.filter((movie) => !votes[movie.id] && !watched.includes(movie.id)), [movies, votes, watched])
  const ranking = useMemo(() => movies.slice().sort((a, b) => (votes[b.id] === 'like') - (votes[a.id] === 'like') || (b.score || 0) - (a.score || 0) || (b.picks || 0) - (a.picks || 0)), [movies, votes])
  const watchedMovies = useMemo(() => movies.filter((movie) => watched.includes(movie.id)), [movies, watched])

  useEffect(() => {
    if (!hasSupabase) return
    loadMovies()
  }, [hasSupabase])

  async function loadMovies() {
    try {
      const rows = await getMovies()
      if (rows.length) {
        setMovies(rows)
        setWatched(rows.filter((movie) => movie.watched).map((movie) => movie.id))
        setRatings(Object.fromEntries(rows.filter((movie) => movie.rating).map((movie) => [movie.id, movie.rating])))
      }
    } catch (error) {
      setMessage({ type: 'error', text: `Could not load saved movies: ${error.message}` })
    }
  }

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
    try {
      const details = await getMovieDetails(movie.id).catch(() => movie)
      const fullMovie = details || movie

      if (hasSupabase) {
        const saved = await saveMovie(fullMovie, activeHandle || 'anonymous')
        setMovies((current) => current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current])
      } else {
        setMovies((current) => current.some((item) => item.id === fullMovie.id) ? current : [{ ...fullMovie, nominated_by: activeHandle || 'You' }, ...current])
      }

      clearSearch()
      showMessage(`"${fullMovie.title}" added to the swipe pile.`)
    } catch (error) {
      showMessage(error.message || 'Could not add movie.', 'error')
    }
  }

  async function handleSwipe(vote, movie) {
    setVotes((current) => ({ ...current, [movie.id]: vote }))

    if (hasSupabase) {
      try {
        await voteMovie(movie, vote)
        await loadMovies()
      } catch (error) {
        showMessage(error.message || 'Could not save vote.', 'error')
        return
      }
    }

    showMessage(vote === 'like' ? `You voted to watch "${movie.title}".` : `You passed on "${movie.title}".`)
  }

  async function markWatched(movie) {
    setWatched((current) => current.includes(movie.id) ? current : [...current, movie.id])
    setVotes((current) => ({ ...current, [movie.id]: 'like' }))
    setEditingRating(movie.id)

    if (hasSupabase) {
      try {
        await markMovieWatched(movie, ratings[movie.id] || null)
        await loadMovies()
      } catch (error) {
        showMessage(error.message || 'Could not save watched movie.', 'error')
        return
      }
    }

    showMessage(`"${movie.title}" moved to watched.`)
  }

  async function rateWatchedMovie(movie, rating) {
    setRatings((current) => ({ ...current, [movie.id]: rating }))
    setEditingRating(null)

    if (hasSupabase) {
      try {
        await saveMovieRating(movie, rating)
        await loadMovies()
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

  function resetPage() {
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
        eyebrow="Movie night"
        title="Pick what to watch"
        description="Search movies, add them to the pile, swipe through options, and keep a watched ranking with ratings."
        warning={!activeHandle ? 'Create a profile with the Profile button in the navbar to keep your picks under one name.' : null}
        actions={<button type="button" onClick={resetPage} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-neutral-200 transition hover:bg-white hover:text-neutral-950">Reset</button>}
      >
        <form onSubmit={handleSearch} className="mt-4">
          <div className="flex gap-2">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a movie..." className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-white/30" />
            {hasResults ? <button type="button" className="rounded-2xl border border-white/10 px-4 py-3 font-semibold text-neutral-200 transition hover:bg-white hover:text-neutral-950" onClick={clearSearch}>Back</button> : null}
            <button type="submit" disabled={loading} className="rounded-2xl bg-white px-4 py-3 font-semibold text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-60 sm:px-5">{loading ? 'Searching...' : 'Search'}</button>
          </div>
        </form>
      </PageHero>

      <StatusMessage message={message} />

      {hasResults ? (
        <SearchResultsSection onClear={clearSearch}>
          <div className="space-y-2">
            {results.map((movie) => <ResultRow key={movie.id} item={movie} onInfo={openMovieInfo} onAdd={addMovie} onDone={markWatched} doneLabel="Watched" />)}
          </div>
        </SearchResultsSection>
      ) : null}

      <section ref={deckRef} className="mb-8">
        <SwipeDeck items={queue} onSwipe={handleSwipe} itemLabel="movies" likeLabel="Watch" dislikeLabel="Pass" infoType="movie" loadDetails={getMovieDetails} />
      </section>

      <TopRankingSection title="Next movies" items={ranking} votes={votes} onInfo={openMovieInfo} onDone={markWatched} doneLabel="Watched" />

      <RatedHistorySection
        eyebrow="After watching"
        title="Watched ranking"
        countText={`${watchedMovies.length} watched`}
        emptyLabel="No watched movies yet."
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
