import { useMemo, useRef, useState } from 'react'
import SwipeDeck from '../components/SwipeDeck.jsx'
import PageShell from '../components/PageShell.jsx'
import { DetailPill, InfoModal, PageHero, RatedHistorySection, ResultRow, SearchResultsSection, StatusMessage, TopRankingSection, displayYear } from '../components/MediaBlocks.jsx'
import { getSavedHandle } from '../lib/handle.js'
import { demoGames } from '../lib/demoMovies.js'

function makeId(title) {
  return `game-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now()}`
}

function splitList(value) {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

export default function Games() {
  const [games, setGames] = useState(demoGames)
  const [votes, setVotes] = useState({})
  const [played, setPlayed] = useState(() => demoGames.filter((game) => game.played || game.finished).map((game) => game.id))
  const [ratings, setRatings] = useState(() => Object.fromEntries(demoGames.filter((game) => game.rating).map((game) => [game.id, game.rating])))
  const [editingRating, setEditingRating] = useState(null)
  const [infoGame, setInfoGame] = useState(null)
  const [message, setMessage] = useState(null)
  const [results, setResults] = useState([])
  const [draft, setDraft] = useState({ title: '', year: '', poster: '', genres: '', platform: '', overview: '' })
  const deckRef = useRef(null)
  const activeHandle = getSavedHandle()
  const hasResults = results.length > 0

  const queue = useMemo(() => games.filter((game) => !votes[game.id] && !played.includes(game.id)), [games, votes, played])
  const ranking = useMemo(() => games.slice().sort((a, b) => (votes[b.id] === 'like') - (votes[a.id] === 'like') || (b.score || 0) - (a.score || 0) || (b.picks || 0) - (a.picks || 0)), [games, votes])
  const playedGames = useMemo(() => games.filter((game) => played.includes(game.id)), [games, played])

  function showMessage(text, type = 'success') {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 2200)
  }

  function clearSearch() {
    setResults([])
    setTimeout(() => deckRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  function addGame(event) {
    event.preventDefault()
    const title = draft.title.trim()
    if (!title) return

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

    setGames((current) => [game, ...current])
    setResults([game])
    setDraft({ title: '', year: '', poster: '', genres: '', platform: '', overview: '' })
    showMessage(`"${game.title}" added to the game pile.`)
  }

  function addExistingGame(game) {
    setGames((current) => current.some((item) => item.id === game.id) ? current : [{ ...game, nominated_by: activeHandle || game.nominated_by || 'You' }, ...current])
    clearSearch()
    showMessage(`"${game.title}" added to the swipe pile.`)
  }

  function handleSwipe(vote, game) {
    setVotes((current) => ({ ...current, [game.id]: vote }))
    showMessage(vote === 'like' ? `You voted to play "${game.title}".` : `You passed on "${game.title}".`)
  }

  function markPlayed(game) {
    setPlayed((current) => current.includes(game.id) ? current : [...current, game.id])
    setVotes((current) => ({ ...current, [game.id]: 'like' }))
    setEditingRating(game.id)
    showMessage(`"${game.title}" moved to played.`)
  }

  function rateGame(game, rating) {
    setRatings((current) => ({ ...current, [game.id]: rating }))
    setEditingRating(null)
  }

  function resetPage() {
    setGames(demoGames)
    setVotes({})
    setPlayed(demoGames.filter((game) => game.played || game.finished).map((game) => game.id))
    setRatings(Object.fromEntries(demoGames.filter((game) => game.rating).map((game) => [game.id, game.rating])))
    setEditingRating(null)
    setInfoGame(null)
    setResults([])
    setDraft({ title: '', year: '', poster: '', genres: '', platform: '', overview: '' })
    setMessage(null)
  }

  return (
    <PageShell active="games">
      <PageHero
        eyebrow="Game night"
        title="Pick what to play"
        description="Add games manually, swipe through the pile, then rate played games in a cleaner NewYorkBurger-style layout."
        warning={!activeHandle ? 'Create a profile with the Profile button in the navbar to keep your game picks under one name.' : null}
        actions={<button type="button" onClick={resetPage} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-neutral-200 transition hover:bg-white hover:text-neutral-950">Reset</button>}
      >
        <form onSubmit={addGame} className="mt-5 space-y-3">
          <div className="grid gap-2 md:grid-cols-[1fr_0.35fr_0.7fr_auto]">
            <input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Game title..." className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-white/30" />
            <input value={draft.year} onChange={(event) => setDraft((current) => ({ ...current, year: event.target.value }))} placeholder="Year" className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-white/30" />
            <input value={draft.platform} onChange={(event) => setDraft((current) => ({ ...current, platform: event.target.value }))} placeholder="Platform" className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-white/30" />
            <button type="submit" className="rounded-2xl bg-white px-5 py-3 font-semibold text-neutral-950 transition hover:bg-neutral-200">Add</button>
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_1fr]">
            <input value={draft.poster} onChange={(event) => setDraft((current) => ({ ...current, poster: event.target.value }))} placeholder="Cover image URL" className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-white/30" />
            <input value={draft.genres} onChange={(event) => setDraft((current) => ({ ...current, genres: event.target.value }))} placeholder="Genres, comma separated" className="rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-white/30" />
          </div>
          <textarea value={draft.overview} onChange={(event) => setDraft((current) => ({ ...current, overview: event.target.value }))} placeholder="Optional notes or description" className="min-h-20 w-full rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-white outline-none transition focus:border-white/30" />
        </form>
      </PageHero>

      <StatusMessage message={message} />

      {hasResults ? (
        <SearchResultsSection title="Added game" onClear={clearSearch}>
          <div className="space-y-2">
            {results.map((game) => <ResultRow key={game.id} item={game} onInfo={setInfoGame} onAdd={addExistingGame} onDone={markPlayed} addLabel="Keep" doneLabel="Played" imageClass="h-20 w-14" />)}
          </div>
        </SearchResultsSection>
      ) : null}

      <section ref={deckRef} className="mb-8">
        <SwipeDeck items={queue} onSwipe={handleSwipe} itemLabel="games" emptyLabel="No games left to vote on" likeLabel="Play" dislikeLabel="Pass" infoType="game" />
      </section>

      <TopRankingSection title="Next games" items={ranking} votes={votes} onInfo={setInfoGame} onDone={markPlayed} doneLabel="Played" imageClass="h-14 w-10" />

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
        onInfo={setInfoGame}
        detailsLabel="Game details"
        renderMeta={(game) => `${displayYear(game.released || game.year) || 'Unknown year'} · ${(game.genres || []).slice(0, 2).join(' · ') || game.platform || 'No details yet'}`}
        renderPills={(game) => <>{game.platform ? <DetailPill>{game.platform}</DetailPill> : null}{game.rawgRating ? <DetailPill>RAWG ★ {Number(game.rawgRating).toFixed(1)}</DetailPill> : null}</>}
      />

      <InfoModal item={infoGame} onClose={() => setInfoGame(null)} year={displayYear(infoGame?.released || infoGame?.year)}>
        <div className="mt-4 flex flex-wrap gap-2">
          {infoGame?.platform ? <DetailPill>{infoGame.platform}</DetailPill> : null}
          {ratings[infoGame?.id] ? <DetailPill>Your rating ★ {ratings[infoGame.id]}/10</DetailPill> : null}
          {infoGame?.genres?.map((genre) => <DetailPill key={genre}>{genre}</DetailPill>)}
        </div>
        {infoGame?.poster ? <img src={infoGame.poster} alt="" className="mt-5 max-h-80 w-full rounded-3xl object-cover" /> : null}
        <p className="mt-5 text-sm leading-7 text-neutral-300">{infoGame?.overview || infoGame?.description || 'No game description available.'}</p>
      </InfoModal>
    </PageShell>
  )
}
