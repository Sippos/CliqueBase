function getTmdbFetchOptions(url) {
  const key = process.env.TMDB_API_KEY?.trim()
  if (!key) return null

  if (key.startsWith('eyJ')) {
    return {
      url,
      options: {
        headers: {
          Authorization: `Bearer ${key}`,
          accept: 'application/json',
        },
      },
    }
  }

  url.searchParams.set('api_key', key)
  return { url, options: {} }
}

export default async function handler(req, res) {
  const id = String(req.query.id || '').trim()

  if (!id) {
    return res.status(400).json({ error: 'Missing movie id' })
  }

  const url = new URL(`https://api.themoviedb.org/3/movie/${encodeURIComponent(id)}`)
  url.searchParams.set('language', 'en-US')

  const request = getTmdbFetchOptions(url)

  if (!request) {
    return res.status(500).json({ error: 'TMDB API key is not configured' })
  }

  try {
    const tmdbRes = await fetch(request.url, request.options)
    const data = await tmdbRes.json()
    return res.status(tmdbRes.status).json(data)
  } catch {
    return res.status(502).json({ error: 'Could not reach TMDB' })
  }
}
