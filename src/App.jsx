import { Route, Routes } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Movies from './pages/Movies.jsx'
import Series from './pages/Series.jsx'
import Games from './pages/Games.jsx'
import Videos from './pages/Videos.jsx'
import Leaderboard from './pages/Leaderboard.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/movies" element={<Movies />} />
      <Route path="/series" element={<Series />} />
      <Route path="/games" element={<Games />} />
      <Route path="/videos" element={<Videos />} />
      <Route path="/leaderboard" element={<Leaderboard />} />
    </Routes>
  )
}
