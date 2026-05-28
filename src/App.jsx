import { Route, Routes } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Movies from './pages/Movies.jsx'
import ComingSoonPage from './pages/ComingSoonPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/movies" element={<Movies />} />
      <Route path="/series" element={<ComingSoonPage active="series" title="Series" eyebrow="Shows" description="Keep track of shows to start, continue, and finish together." />} />
      <Route path="/games" element={<ComingSoonPage active="games" title="Games" eyebrow="Games" description="Collect game recommendations and find the next group favorite." />} />
      <Route path="/videos" element={<ComingSoonPage active="videos" title="Videos" eyebrow="Shared links" description="Save funny clips, classics, and links everyone keeps sending around." />} />
      <Route path="/leaderboard" element={<ComingSoonPage active="leaderboard" title="Leaderboard" eyebrow="Group stats" description="See the most picked titles and the people adding the best recommendations." />} />
    </Routes>
  )
}
