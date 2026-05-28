import { Route, Routes } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Movies from './pages/Movies.jsx'
import Series from './pages/Series.jsx'
import Videos from './pages/Videos.jsx'
import MediaPage from './pages/MediaPage.jsx'
import Leaderboard from './pages/Leaderboard.jsx'
import { demoGames } from './lib/demoMovies.js'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/movies" element={<Movies />} />
      <Route path="/series" element={<Series />} />
      <Route path="/games" element={<MediaPage active="games" eyebrow="Games" title="Games to play next" description="Collect party games, co-op campaigns, and solo recommendations worth trying. Search API will be added later." items={demoGames} itemLabel="games" likeLabel="Play" historyLabel="Played games" />} />
      <Route path="/videos" element={<Videos />} />
      <Route path="/leaderboard" element={<Leaderboard />} />
    </Routes>
  )
}
