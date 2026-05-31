import { Route, Routes } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Movies from './pages/Movies.jsx'
import Series from './pages/Series.jsx'
import Games from './pages/Games.jsx'
import Videos from './pages/Videos.jsx'
import Music from './pages/Music.jsx'
import Groups from './pages/Groups.jsx'
import Leaderboard from './pages/Leaderboard.jsx'
import Share from './pages/Share.jsx'
import MemberLibrary from './pages/MemberLibrary.jsx'
import { ACTIVE_GROUP_STORAGE_KEY } from './lib/groups.js'

function syncCliqueScopeFromUrl() {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  const cliqueId = params.get('clique') || params.get('group') || params.get('scope')
  if (cliqueId) window.localStorage.setItem(ACTIVE_GROUP_STORAGE_KEY, cliqueId)
}

export default function App() {
  syncCliqueScopeFromUrl()

  return (
    <Routes>
      <Route path="/" element={<Leaderboard />} />
      <Route path="/explore" element={<Leaderboard />} />
      <Route path="/leaderboard" element={<Leaderboard />} />

      <Route path="/dashboard" element={<Home scope="personal" />} />
      <Route path="/library" element={<Home scope="personal" />} />
      <Route path="/library/movies" element={<Movies />} />
      <Route path="/library/series" element={<Series />} />
      <Route path="/library/games" element={<Games />} />
      <Route path="/movies" element={<Movies />} />
      <Route path="/series" element={<Series />} />
      <Route path="/games" element={<Games />} />
      <Route path="/videos" element={<Videos />} />
      <Route path="/music" element={<Music />} />

      <Route path="/share/:type/:id" element={<Share />} />
      <Route path="/members/:memberId" element={<MemberLibrary />} />
      <Route path="/users/:memberId" element={<MemberLibrary />} />
      <Route path="/groups" element={<Groups />} />
      <Route path="/cliques" element={<Groups />} />
      <Route path="/g/:groupId" element={<Home scope="group" />} />
      <Route path="/cliques/:groupId" element={<Home scope="group" />} />
      <Route path="/invite/:code" element={<Groups inviteMode />} />
    </Routes>
  )
}
