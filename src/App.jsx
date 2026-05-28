import { Route, Routes } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Movies from './pages/Movies.jsx'
import MediaPage from './pages/MediaPage.jsx'
import Leaderboard from './pages/Leaderboard.jsx'
import { demoGames, demoSeries, demoVideos } from './lib/demoMovies.js'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/movies" element={<Movies />} />
      <Route path="/series" element={<MediaPage active="series" eyebrow="Shows" title="Series to start next" description="Collect shows your group wants to start, continue, or finish together." items={demoSeries} itemLabel="series" likeLabel="Watch" historyLabel="Finished series" />} />
      <Route path="/games" element={<MediaPage active="games" eyebrow="Games" title="Games to play next" description="Collect party games, co-op campaigns, and solo recommendations worth trying." items={demoGames} itemLabel="games" likeLabel="Play" historyLabel="Played games" />} />
      <Route path="/videos" element={<MediaPage active="videos" eyebrow="Shared links" title="Videos worth saving" description="Save clips, playlists, streams, and links everyone keeps sending around." items={demoVideos} itemLabel="videos" likeLabel="Save" historyLabel="Saved videos" />} />
      <Route path="/leaderboard" element={<Leaderboard />} />
    </Routes>
  )
}
