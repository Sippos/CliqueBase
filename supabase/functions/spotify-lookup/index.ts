// Supabase Edge Function: spotify-lookup
// Required secrets:
//   supabase secrets set SPOTIFY_CLIENT_ID=...
//   supabase secrets set SPOTIFY_CLIENT_SECRET=...
// Deploy:
//   supabase functions deploy spotify-lookup

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SPOTIFY_API_URL = 'https://api.spotify.com/v1'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
      'access-control-allow-methods': 'POST, OPTIONS',
    },
  })
}

function clean(value: unknown) {
  return String(value || '').trim()
}

function extractSpotifyId(url: string) {
  const value = clean(url)
  if (!value) return { type: '', id: '' }

  const uriMatch = value.match(/^spotify:(track|album|artist|playlist):([A-Za-z0-9]+)$/i)
  if (uriMatch) return { type: uriMatch[1].toLowerCase(), id: uriMatch[2] }

  try {
    const parsed = new URL(value)
    if (!parsed.hostname.includes('spotify.com')) return { type: '', id: '' }
    const parts = parsed.pathname.split('/').filter(Boolean)
    const type = parts[0]
    const id = parts[1]
    if (['track', 'album', 'artist', 'playlist'].includes(type) && id) return { type, id }
  } catch {
    return { type: '', id: '' }
  }

  return { type: '', id: '' }
}

function bestImage(images: Array<{ url?: string; width?: number; height?: number }> = []) {
  return [...images].sort((a, b) => Math.abs((a.width || 300) - 300) - Math.abs((b.width || 300) - 300))[0]?.url || images[0]?.url || ''
}

function normalizeTrack(track: any) {
  return {
    source: 'Spotify',
    sourceId: track?.id || '',
    itemType: 'track',
    title: track?.name || 'Spotify track',
    artist: Array.isArray(track?.artists) ? track.artists.map((artist: any) => artist.name).filter(Boolean).join(', ') : '',
    album: track?.album?.name || '',
    url: track?.external_urls?.spotify || '',
    poster: bestImage(track?.album?.images || []),
    previewUrl: track?.preview_url || '',
  }
}

function normalizeAlbum(album: any) {
  return {
    source: 'Spotify',
    sourceId: album?.id || '',
    itemType: 'album',
    title: album?.name || 'Spotify album',
    artist: Array.isArray(album?.artists) ? album.artists.map((artist: any) => artist.name).filter(Boolean).join(', ') : '',
    album: album?.name || '',
    url: album?.external_urls?.spotify || '',
    poster: bestImage(album?.images || []),
    previewUrl: '',
  }
}

function normalizeArtist(artist: any) {
  return {
    source: 'Spotify',
    sourceId: artist?.id || '',
    itemType: 'artist',
    title: artist?.name || 'Spotify artist',
    artist: artist?.name || '',
    album: '',
    url: artist?.external_urls?.spotify || '',
    poster: bestImage(artist?.images || []),
    previewUrl: '',
  }
}

function normalizePlaylist(playlist: any) {
  return {
    source: 'Spotify',
    sourceId: playlist?.id || '',
    itemType: 'playlist',
    title: playlist?.name || 'Spotify playlist',
    artist: playlist?.owner?.display_name || '',
    album: '',
    url: playlist?.external_urls?.spotify || '',
    poster: bestImage(playlist?.images || []),
    previewUrl: '',
  }
}

function normalizeByType(type: string, data: any) {
  if (type === 'album') return normalizeAlbum(data)
  if (type === 'artist') return normalizeArtist(data)
  if (type === 'playlist') return normalizePlaylist(data)
  return normalizeTrack(data)
}

async function getSpotifyToken() {
  const clientId = Deno.env.get('SPOTIFY_CLIENT_ID')
  const clientSecret = Deno.env.get('SPOTIFY_CLIENT_SECRET')
  if (!clientId || !clientSecret) throw new Error('Spotify credentials are not configured.')

  const credentials = btoa(`${clientId}:${clientSecret}`)
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      authorization: `Basic ${credentials}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  })

  if (!response.ok) throw new Error(`Spotify token request failed: ${response.status}`)
  const data = await response.json()
  if (!data.access_token) throw new Error('Spotify token response was empty.')
  return data.access_token as string
}

async function spotifyFetch(token: string, path: string) {
  const response = await fetch(`${SPOTIFY_API_URL}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  })
  if (!response.ok) throw new Error(`Spotify API request failed: ${response.status}`)
  return response.json()
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return json({ ok: true })
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const body = await request.json().catch(() => ({}))
    const url = clean(body.url)
    const query = clean(body.query)
    const requestedType = clean(body.type).toLowerCase() || 'track'
    const token = await getSpotifyToken()
    const fromUrl = extractSpotifyId(url)

    if (fromUrl.id && fromUrl.type) {
      const data = await spotifyFetch(token, `/${fromUrl.type}s/${encodeURIComponent(fromUrl.id)}`)
      return json({ track: normalizeByType(fromUrl.type, data) })
    }

    const searchQuery = query || url
    if (!searchQuery) return json({ error: 'Provide a Spotify URL or search query.' }, 400)

    const type = ['track', 'album', 'artist', 'playlist'].includes(requestedType) ? requestedType : 'track'
    const data = await spotifyFetch(token, `/search?${new URLSearchParams({ q: searchQuery, type, limit: '1' })}`)
    const bucketName = `${type}s`
    const item = data?.[bucketName]?.items?.[0]
    if (!item) return json({ track: null, error: 'No Spotify match found.' }, 404)

    return json({ track: normalizeByType(type, item) })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Spotify lookup failed.' }, 500)
  }
})
