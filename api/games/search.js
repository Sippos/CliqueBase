function getRawgUrl(path) {
  const key = (process.env.RAWG_API_KEY || process.env.GAMES_API_KEY || '').trim()
  if (!key) return null

  const url = new URL(`https://api.rawg.io/api/${path}`)
  url.searchParams.set('key', key)
  return url
}

export default async function handler(req, res) {
  const query = String(req.query.q || '').trim()

  if (!query) {
    return res.status(400).json({ error: 'Missing search query' })
  }

  const url = getRawgUrl('games')

  if (!url) {
    return res.status(500).json({ error: 'RAWG API key is not configured' })
  }

  url.searchParams.set('search', query)
  url.searchParams.set('page_size', '12')

  try {
    const rawgRes = await fetch(url)
    const data = await rawgRes.json()
    return res.status(rawgRes.status).json(data)
  } catch {
    return res.status(502).json({ error: 'Could not reach games API' })
  }
}
