import { Route, Routes } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Movies from './pages/Movies.jsx'
import Series from './pages/Series.jsx'
import Games from './pages/Games.jsx'
import Videos from './pages/Videos.jsx'
import Music from './pages/Music.jsx'
import Groups from './pages/Groups.jsx'
import Leaderboard from './pages/Leaderboard.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/movies" element={<Movies />} />
      <Route path="/series" element={<Series />} />
      <Route path="/games" element={<Games />} />
      <Route path="/videos" element={<Videos />} />
      <Route path="/music" element={<Music />} />
      <Route path="/groups" element={<Groups />} />
      <Route path="/g/:groupId" element={<Groups />} />
      <Route path="/invite/:code" element={<Groups inviteMode />} />
      <Route path="/leaderboard" element={<Leaderboard />} />
    </Routes>
  )
}
