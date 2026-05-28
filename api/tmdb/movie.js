export default async function handler(req, res) {
  const id = String(req.query.id || '').trim()

  if (!id) {
    return res.status(400).json({ error: 'Missing movie id' })
  }

  if (!process.env.TMDB_API_KEY) {
    return res.status(500).json({ error: 'TMDB API key is not configured' })
  }

  const url = new URL(`https://api.themoviedb.org/3/movie/${encodeURIComponent(id)}`)
  url.searchParams.set('api_key', process.env.TMDB_API_KEY)
  url.searchParams.set('language', 'en-US')

  try {
    const tmdbRes = await fetch(url)
    const data = await tmdbRes.json()
    return res.status(tmdbRes.status).json(data)
  } catch {
    return res.status(502).json({ error: 'Could not reach TMDB' })
  }
}
