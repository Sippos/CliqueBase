import { useEffect, useMemo, useRef, useState } from 'react'
import SwipeDeck from '../components/SwipeDeck.jsx'
import PageShell from '../components/PageShell.jsx'
import { DetailPill, InfoModal, PageHero, RatedHistorySection, ResultRow, SearchResultsSection, StatusMessage, TopRankingSection, displayYear } from '../components/MediaBlocks.jsx'
import { getSavedHandle } from '../lib/handle.js'
import { GROUPS_CHANGED_EVENT, getActiveGroup } from '../lib/groups.js'
import { demoGames } from '../lib/demoMovies.js'
import { getGameDetails, searchGames } from '../lib/tmdb.js'
import { getCurrentSession, getGames, hasSupabase, markGamePlayed, rateGame as saveGameRating, saveGame, voteGame } from '../lib/supabaseClient.js'

function makeId(title) {
  return `custom-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now()}`
}

function splitList(value) {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function setupMessage(state) {
  if (!hasSupabase) return null
  if (state === 'signed-out') return 'Sign in from Profile, then create or select a group before adding games.'
  if (state === 'no-group') return 'Create or select a group in Profile before adding games.'
  return null
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
  const [draft, setDraft] = useState({ title: '', year: '', poster: '', genres: '', platform: '', overview: '' })
  const deckRef = useRef(null)
  const activeHandle = getSavedHandle()
  const hasResults = results.length > 0
  const activeGroupId = activeGroup?.id || null
  const canUseGroup = !hasSupabase || setupState === 'ready'

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
      if (!group?.id) {
        clearRemoteState()
        setSetupState('no-group')
        return
      }
      setSetupState('ready')
      await loadGames(group.id)
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
    if (!groupId) return
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

  function needGroup() {
    if (canUseGroup) return false
    showMessage(setupMessage(setupState) || 'Create or select a group first.', 'error')
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
    if (needGroup()) return

    setSearching(true)
    try {
      const found = await searchGames(query)
      setResults(found)
      if (!found.length) showMessage('No games found.', 'error')
    } catch (error) {
      showMessage(error.message || 'Game search failed.', 'error')
    } finally {
      setSearching(false)
    }
  }

  async function addGame(event) {
    event.preventDefault()
    const title = draft.title.trim()
    if (!title) return
    if (needGroup()) return

    const game = {
      id: makeId(title),
      title,
      year: draft.year.trim() || 'New pick',
      poster: draft.poster.trim() || null,
      overview: draft.overview.trim(),
      genres: splitList(draft.genres),
      platform: draft.platform.trim(),
      nominated_by: activeHandle || 'You',
      picks: 0,
      score: 0,
    }

    try {
      if (hasSupabase) {
        const saved = await saveGame(game, activeHandle || 'anonymous', activeGroupId)
        setGames((current) => current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current])
      } else {
        setGames((current) => [game, ...current])
      }
      setResults([game])
      setDraft({ title: '', year: '', poster: '', genres: '', platform: '', overview: '' })
      showMessage(`"${game.title}" added to ${activeGroup?.name || 'the game pile'}.`)
    } catch (error) {
      showMessage(error.message || 'Could not save game.', 'error')
    }
  }

  async function addExistingGame(game) {
    if (needGroup()) return
    try {
      const details = await getGameDetails(game).catch(() => game)
      const fullGame = { ...(details || game), nominated_by: activeHandle || game.nominated_by || 'You' }

      if (hasSupabase) {
        const saved = await saveGame(fullGame, activeHandle || 'anonymous', activeGroupId)
        setGames((current) => current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current])
      } else {
        setGames((current) => current.some((item) => item.id === fullGame.id) ? current : [fullGame, ...current])
      }

      clearSearch()
      showMessage(`"${fullGame.title}" added to ${activeGroup?.name || 'the game pile'}.`)
    } catch (error) {
      showMessage(error.message || 'Could not add that game.', 'error')
    }
  }

  async function handleSwipe(vote, game) {
    if (needGroup()) return

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
    if (needGroup()) return

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
    if (needGroup()) return

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
      const details = await getGameDetails(game)
      if (details) setInfoGame({ ...game, ...details })
    } catch {
      // Keep current details.
    } finally {
      setLoadingInfoGame(false)
    }
  }

  function resetPage() {
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
    setDraft({ title: '', year: '', poster: '', genres: '', platform: '', overview: '' })
    setMessage(null)
  }

  return (
    <PageShell active="games">
      <PageHero
        eyebrow="Game night"
        title="Pick what to play"
        description="Search real games from the games API, add them to the active group, vote with friends, then rate played games."
        warning={setupMessage(setupState) || (!activeHandle && !hasSupabase ? 'Create a profile with the Profile button in the navbar to keep your game picks under one name.' : null)}
        actions={<button type="button" onClick={resetPage} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-neutral-200 transition hover:bg-white hover:text-neutral-950">Refresh</button>}
      >
        {hasSupabase ? (
          <p className="mt-4 rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-sm text-neutral-300">
            {canUseGroup ? <>Saving to <strong className="text-white">{activeGroup.name}</strong>.</> : 'No demo games are loaded in Supabase mode. Sign in and create/select a group to start your real database.'}
          </p>
        ) : null}

        <form onSubmit={handleSearch} className="mt-5">
          <div className="flex gap-2">
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a game..." className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-white/30" />
            {hasResults ? <button type="button" className="rounded-2xl border border-white/10 px-4 py-3 font-semibold text-neutral-200 transition hover:bg-white hover:text-neutral-950" onClick={clearSearch}>Back</button> : null}
            <button type="submit" disabled={searching || !canUseGroup} className="rounded-2xl bg-white px-4 py-3 font-semibold text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-60 sm:px-5">{searching ? 'Searching...' : 'Search'}</button>
          </div>
        </form>

        <details className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-4">
          <summary className="cursor-pointer text-sm font-semibold text-neutral-200">Add custom game manually</summary>
          <form onSubmit={addGame} className="mt-4 space-y-3">
            <div className="grid gap-2 md:grid-cols-[1fr_0.35fr_0.7fr_auto]">
              <input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Game title..." className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-white/30" />
              <input value={draft.year} onChange={(event) => setDraft((current) => ({ ...current, year: event.target.value }))} placeholder="Year" className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-white/30" />
              <input value={draft.platform} onChange={(event) => setDraft((current) => ({ ...current, platform: event.target.value }))} placeholder="Platform" className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-white/30" />
              <button type="submit" disabled={!canUseGroup} className="rounded-2xl bg-white px-5 py-3 font-semibold text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-60">Add</button>
            </div>
            <div className="grid gap-2 md:grid-cols-[1fr_1fr]">
              <input value={draft.poster} onChange={(event) => setDraft((current) => ({ ...current, poster: event.target.value }))} placeholder="Cover image URL" className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-white/30" />
              <input value={draft.genres} onChange={(event) => setDraft((current) => ({ ...current, genres: event.target.value }))} placeholder="Genres, comma separated" className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-white/30" />
            </div>
            <textarea value={draft.overview} onChange={(event) => setDraft((current) => ({ ...current, overview: event.target.value }))} placeholder="Optional notes or description" className="min-h-20 w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-white/30" />
          </form>
        </details>
      </PageHero>

      <StatusMessage message={message} />

      {hasResults ? (
        <SearchResultsSection title="Game results" onClear={clearSearch}>
          <div className="space-y-2">
            {results.map((game) => <ResultRow key={game.id} item={game} onInfo={openGameInfo} onAdd={addExistingGame} onDone={markPlayed} addLabel="Add" doneLabel="Played" imageClass="h-20 w-14" />)}
          </div>
        </SearchResultsSection>
      ) : null}

      <section ref={deckRef} className="mb-8">
        <SwipeDeck items={queue} onSwipe={handleSwipe} itemLabel="games" emptyLabel={canUseGroup ? 'No games yet. Search and add your first pick.' : 'Create or select a group to start voting.'} likeLabel="Play" dislikeLabel="Pass" infoType="game" loadDetails={getGameDetails} />
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
