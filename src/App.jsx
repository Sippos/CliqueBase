import { Route, Routes } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Movies from './pages/Movies.jsx'
import ComingSoonPage from './pages/ComingSoonPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/movies" element={<Movies />} />
      <Route path="/series" element={<ComingSoonPage active="series" title="Series" eyebrow="Shows" description="The series picker will reuse the movie flow after the secure TMDB API proxy is finished." />} />
      <Route path="/games" element={<ComingSoonPage active="games" title="Games" eyebrow="Games" description="The game picker will be added after the RAWG API key is moved behind a serverless endpoint." />} />
      <Route path="/videos" element={<ComingSoonPage active="videos" title="Videos" eyebrow="Shared links" description="The video link dump can be reused safely once the Supabase policies are locked down." />} />
      <Route path="/leaderboard" element={<ComingSoonPage active="leaderboard" title="Leaderboard" eyebrow="Group stats" description="The leaderboard will come back after votes and profiles are connected securely." />} />
    </Routes>
  )
}
