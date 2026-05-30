import { useEffect, useMemo, useRef, useState } from 'react'
import SwipeDeck from '../components/SwipeDeck.jsx'
import PageShell from '../components/PageShell.jsx'
import { DetailPill, InfoModal, PageHero, RatedHistorySection, ResultRow, SearchResultsSection, StatusMessage, TopRankingSection, displayYear } from '../components/MediaBlocks.jsx'
import { getSavedHandle } from '../lib/handle.js'
import { GROUPS_CHANGED_EVENT, getActiveGroup } from '../lib/groups.js'
import { demoGames } from '../lib/demoMovies.js'
import { getGameDetails, searchGames } from '../lib/tmdb.js'
import { markGamePlayed, rateGame as saveGameRating, saveGame } from '../lib/gamesSupabase.js'
import { getCurrentSession, getGames, hasSupabase, voteGame } from '../lib/supabaseClient.js'

function setupMessage(state) {
  if (!hasSupabase) return null
  if (state === 'signed-out') return 'Sign in from Profile to build your personal game library and save picks to groups.'
  return null
}

function makeCustomGame(query) {
  const title = String(query || '').trim()
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'custom-game'

  return {
    id: `custom-${slug}`,
    title: title || 'Custom game',
    year: '',
    released: null,
    poster: null,
    backdrop: null,
    overview: 'Custom game pick added from search.',
    description: 'Custom game pick added from search.',
    rawgRating: null,
    genres: [],
    platform: '',
    platforms: [],
    picks: 0,
    score: 0,
    custom: true,
  }
}

export default function Games() {
  const [games, setGames] = useState(() => hasSupabase ? [] : demoGames)
  const [votes, setVotes] = useState({})
  const [played, setPlayed] = useState(() => hasSupabase ? [] : demoGames.filter((game) => game.played || game.finished).map((game) => game.id))
  const [ratings, setRatings] = useState(() => hasSupabase ? {} : Object.fromEntries(demoGames.filter((game) => game.rating).map((game) => [game.id, game.rating])))
  const [editingRating, setEditingRating] = useState(null)
  const [infoGame, setInfoGame] = useState(null)
  const [loadingInfoGame, setLoadingInfoGame] = useState(false)
  const [message, setMessage] = useState(null)
  const [results, setResults] = useState([])
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [activeGroup, setActiveGroupState] = useState(() => getActiveGroup())
  const [setupState, setSetupState] = useState(() => hasSupabase ? 'checking' : 'local')
  const deckRef = useRef(null)
  const activeHandle = getSavedHandle()
  const hasResults = results.length > 0
  const activeGroupId = activeGroup?.id || null
  const canUseLibrary = !hasSupabase || setupState === 'ready'

  const queue = useMemo(() => games.filter((game) => !votes[game.id] && !played.includes(game.id)), [games, votes, played])
  const ranking = useMemo(() => games.slice().sort((a, b) => (votes[b.id] === 'like') - (votes[a.id] === 'like') || (b.score || 0) - (a.score || 0) || (b.picks || 0) - (a.picks || 0)), [games, votes])
  const playedGames = useMemo(() => games.filter((game) => played.includes(game.id)), [games, played])

  useEffect(() => {
    refreshContext()
  }, [activeGroupId])

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

      setSetupState('ready')
      await loadGames(group?.id || null)
    } catch (error) {
      clearRemoteState()
      setSetupState('signed-out')
      setMessage({ type: 'error', text: `Could not check your account: ${error.message}` })
    }
  }

  function clearRemoteState() {
    setGames([])
    setVotes({})
    setPlayed([])
    setRatings({})
    setResults([])
  }

  async function loadGames(groupId = activeGroupId) {
    try {
      const rows = await getGames(groupId)
      setGames(rows)
      setPlayed(rows.filter((game) => game.played).map((game) => game.id))
      setRatings(Object.fromEntries(rows.filter((game) => game.rating).map((game) => [game.id, game.rating])))
    } catch (error) {
      setMessage({ type: 'error', text: `Could not load saved games: ${error.message}` })
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
    const cleanQuery = query.trim()
    if (!cleanQuery) return
    if (needLibrary()) return

    setSearching(true)
    try {
      const found = await searchGames(cleanQuery)
      if (found.length) {
        setResults(found)
      } else {
        setResults([makeCustomGame(cleanQuery)])
        showMessage('No API result found. You can add this as a custom game pick.', 'error')
      }
    } catch (error) {
      setResults([makeCustomGame(cleanQuery)])
      showMessage(error.message ? `${error.message}. You can still add it as a custom game pick.` : 'Game search failed. You can still add it as a custom game pick.', 'error')
    } finally {
      setSearching(false)
    }
  }

  async function addExistingGame(game) {
    if (needLibrary()) return
    try {
      const details = game.custom ? game : await getGameDetails(game).catch(() => game)
      const fullGame = { ...(details || game), nominated_by: activeHandle || game.nominated_by || 'You' }

      if (hasSupabase) {
        const saved = await saveGame(fullGame, activeHandle || 'anonymous', activeGroupId)
        setGames((current) => current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current])
      } else {
        setGames((current) => current.some((item) => item.id === fullGame.id) ? current : [fullGame, ...current])
      }

      clearSearch()
      showMessage(`"${fullGame.title}" added.`)
    } catch (error) {
      showMessage(error.message || 'Could not add that game.', 'error')
    }
  }

  async function handleSwipe(vote, game) {
    if (needLibrary()) return

    setVotes((current) => ({ ...current, [game.id]: vote }))

    if (hasSupabase) {
      try {
        await voteGame(game, vote, activeGroupId)
        await loadGames(activeGroupId)
      } catch (error) {
        showMessage(error.message || 'Could not save vote.', 'error')
        return
      }
    }

    showMessage(vote === 'like' ? `You voted to play "${game.title}".` : `You passed on "${game.title}".`)
  }

  async function markPlayed(game) {
    if (needLibrary()) return

    setPlayed((current) => current.includes(game.id) ? current : [...current, game.id])
    setVotes((current) => ({ ...current, [game.id]: 'like' }))
    setEditingRating(game.id)

    if (hasSupabase) {
      try {
        await markGamePlayed(game, ratings[game.id] || null, activeGroupId)
        await loadGames(activeGroupId)
      } catch (error) {
        showMessage(error.message || 'Could not save played game.', 'error')
        return
      }
    }

    showMessage(`"${game.title}" moved to played.`)
  }

  async function rateGame(game, rating) {
    if (needLibrary()) return

    setRatings((current) => ({ ...current, [game.id]: rating }))
    setEditingRating(null)

    if (hasSupabase) {
      try {
        await saveGameRating(game, rating, activeGroupId)
        await loadGames(activeGroupId)
      } catch (error) {
        showMessage(error.message || 'Could not save rating.', 'error')
      }
    }
  }

  async function openGameInfo(game) {
    setLoadingInfoGame(true)
    setInfoGame(game)
    try {
      if (!game.custom) {
        const details = await getGameDetails(game)
        if (details) setInfoGame({ ...game, ...details })
      }
    } catch {
      // Keep current details.
    } finally {
      setLoadingInfoGame(false)
    }
  }

  function refreshPage() {
    if (hasSupabase) {
      clearRemoteState()
      refreshContext()
      return
    }
    setGames(demoGames)
    setVotes({})
    setPlayed(demoGames.filter((game) => game.played || game.finished).map((game) => game.id))
    setRatings(Object.fromEntries(demoGames.filter((game) => game.rating).map((game) => [game.id, game.rating])))
    setEditingRating(null)
    setInfoGame(null)
    setResults([])
    setQuery('')
    setMessage(null)
  }

  return (
    <PageShell active="games">
      <PageHero
        eyebrow="Game night"
        title="Pick what to play"
        description="Search real games and add them into the active navbar context. Switch between Personal and groups from the top bar."
        warning={setupMessage(setupState) || (!activeHandle && !hasSupabase ? 'Create a profile with the Profile button in the navbar to keep your game picks under one name.' : null)}
        actions={!hasSupabase ? <button type="button" onClick={refreshPage} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-neutral-200 transition hover:bg-white hover:text-neutral-950">Reset local demo</button> : null}
      >
        <form onSubmit={handleSearch} className="mt-5">
          <div className="flex gap-2">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a game..." className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-white/30" />
            {hasResults ? <button type="button" className="rounded-2xl border border-white/10 px-4 py-3 font-semibold text-neutral-200 transition hover:bg-white hover:text-neutral-950" onClick={clearSearch}>Back</button> : null}
            <button type="submit" disabled={searching || !canUseLibrary} className="rounded-2xl bg-white px-4 py-3 font-semibold text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-60 sm:px-5">{searching ? 'Searching...' : 'Search'}</button>
          </div>
        </form>
      </PageHero>

      <StatusMessage message={message} />

      {hasResults ? (
        <SearchResultsSection title="Game results" onClear={clearSearch}>
          <div className="space-y-2">
            {results.map((game) => <ResultRow key={game.id} item={game} onInfo={openGameInfo} onAdd={addExistingGame} onDone={markPlayed} addLabel={game.custom ? 'Add custom' : 'Add'} doneLabel="Played" imageClass="h-20 w-14" />)}
          </div>
        </SearchResultsSection>
      ) : null}

      <section ref={deckRef} className="mb-8">
        <SwipeDeck items={queue} onSwipe={handleSwipe} itemLabel="games" emptyLabel={canUseLibrary ? 'No games here yet. Search and add your first pick.' : 'Sign in to start your game library.'} likeLabel="Play" dislikeLabel="Pass" infoType="game" loadDetails={getGameDetails} />
      </section>

      <TopRankingSection title="Next games" items={ranking} votes={votes} onInfo={openGameInfo} onDone={markPlayed} doneLabel="Played" imageClass="h-14 w-10" />

      <RatedHistorySection
        eyebrow="After playing"
        title="Played ranking"
        countText={`${playedGames.length} played`}
        emptyLabel="No played games yet."
        items={playedGames}
        ratings={ratings}
        editingRating={editingRating}
        onToggleRating={(game) => setEditingRating(editingRating === game.id ? null : game.id)}
        onRate={rateGame}
        onInfo={openGameInfo}
        detailsLabel="Game details"
        renderMeta={(game) => `${displayYear(game.released || game.year) || 'Unknown year'} · ${(game.genres || []).slice(0, 2).join(' · ') || game.platform || 'No details yet'}`}
        renderPills={(game) => <>{game.platform ? <DetailPill>{game.platform}</DetailPill> : null}{game.rawgRating ? <DetailPill>RAWG ★ {Number(game.rawgRating).toFixed(1)}</DetailPill> : null}</>}
      />

      <InfoModal item={infoGame} loading={loadingInfoGame && !infoGame} loadingLabel="Loading game info..." onClose={() => setInfoGame(null)} year={displayYear(infoGame?.released || infoGame?.year)} backdrop={infoGame?.backdrop || infoGame?.poster}>
        <div className="mt-4 flex flex-wrap gap-2">
          {infoGame?.platform ? <DetailPill>{infoGame.platform}</DetailPill> : null}
          {infoGame?.rawgRating ? <DetailPill>RAWG ★ {Number(infoGame.rawgRating).toFixed(1)}</DetailPill> : null}
          {ratings[infoGame?.id] ? <DetailPill>Your rating ★ {ratings[infoGame.id]}/10</DetailPill> : null}
          {infoGame?.genres?.map((genre) => <DetailPill key={genre}>{genre}</DetailPill>)}
        </div>
        {infoGame?.poster ? <img src={infoGame.poster} alt="" className="mt-5 max-h-80 w-full rounded-3xl object-cover" /> : null}
        <p className="mt-5 text-sm leading-7 text-neutral-300">{infoGame?.overview || infoGame?.description || 'No game description available.'}</p>
      </InfoModal>
    </PageShell>
  )
}
