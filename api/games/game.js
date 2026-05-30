function getRawgUrl(path) {
  const key = (process.env.RAWG_API_KEY || process.env.GAMES_API_KEY || '').trim()
  if (!key) return null

  const url = new URL(`https://api.rawg.io/api/${path}`)
  url.searchParams.set('key', key)
  return url
}

export default async function handler(req, res) {
  const id = String(req.query.id || '').trim()

  if (!id) {
    return res.status(400).json({ error: 'Missing game id' })
  }

  const url = getRawgUrl(`games/${encodeURIComponent(id)}`)

  if (!url) {
    return res.status(500).json({ error: 'RAWG API key is not configured' })
  }

  try {
    const rawgRes = await fetch(url)
    const data = await rawgRes.json()
    return res.status(rawgRes.status).json(data)
  } catch {
    return res.status(502).json({ error: 'Could not reach games API' })
  }
}
