export default async function handler(req, res) {
  const query = String(req.query.q || '').trim()

  if (!query) {
    return res.status(400).json({ error: 'Missing search query' })
  }

  if (!process.env.TMDB_API_KEY) {
    return res.status(500).json({ error: 'TMDB API key is not configured' })
  }

  const url = new URL('https://api.themoviedb.org/3/search/movie')
  url.searchParams.set('api_key', process.env.TMDB_API_KEY)
  url.searchParams.set('language', 'en-US')
  url.searchParams.set('query', query)
  url.searchParams.set('page', '1')
  url.searchParams.set('include_adult', 'false')

  try {
    const tmdbRes = await fetch(url)
    const data = await tmdbRes.json()
    return res.status(tmdbRes.status).json(data)
  } catch {
    return res.status(502).json({ error: 'Could not reach TMDB' })
  }
}
