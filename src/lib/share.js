const SHARE_BASE_PATH = '/share'

function clean(value) {
  return String(value || '').trim()
}

function encodeJson(value) {
  const json = JSON.stringify(value)
  return btoa(unescape(encodeURIComponent(json)))
}

function decodeJson(value) {
  if (!value) return null
  try {
    return JSON.parse(decodeURIComponent(escape(atob(value))))
  } catch {
    return null
  }
}

export function mediaTypeLabel(type) {
  if (type === 'movie') return 'Movie'
  if (type === 'series') return 'Series'
  if (type === 'game') return 'Game'
  if (type === 'video') return 'Video'
  if (type === 'music') return 'Music'
  if (type === 'book') return 'Book'
  return 'Pick'
}

export function mediaTypePath(type) {
  if (type === 'movie') return '/movies'
  if (type === 'series') return '/series'
  if (type === 'game') return '/games'
  if (type === 'video') return '/videos'
  if (type === 'music') return '/music'
  if (type === 'book') return '/books'
  return '/library'
}

export function normalizeShareType(type) {
  const value = clean(type).toLowerCase()
  if (['movie', 'movies'].includes(value)) return 'movie'
  if (['series', 'show', 'tv'].includes(value)) return 'series'
  if (['game', 'games'].includes(value)) return 'game'
  if (['video', 'videos', 'link'].includes(value)) return 'video'
  if (['music', 'song', 'songs', 'track', 'tracks', 'album', 'playlist'].includes(value)) return 'music'
  if (['book', 'books', 'novel', 'reading'].includes(value)) return 'book'
  return ''
}

export function sharePayload(type, item) {
  const normalizedType = normalizeShareType(type)
  return {
    type: normalizedType,
    id: String(item?.id || ''),
    title: item?.title || 'Untitled pick',
    year: item?.year || '',
    released: item?.released || null,
    poster: item?.poster || item?.cover || null,
    backdrop: item?.backdrop || null,
    overview: item?.overview || item?.description || item?.subtitle || item?.url || '',
    url: item?.url || '',
    tmdbRating: item?.tmdbRating ?? null,
    rawgRating: item?.rawgRating ?? null,
    runtime: item?.runtime ?? null,
    genres: item?.genres || [],
    seasons: item?.seasons ?? null,
    episodes: item?.episodes ?? null,
    platform: item?.platform || item?.source || '',
    platforms: item?.platforms || [],
    artist: item?.artist || '',
    album: item?.album || '',
    source: item?.source || '',
    sourceId: item?.sourceId || item?.source_id || '',
    itemType: item?.itemType || item?.item_type || '',
    previewUrl: item?.previewUrl || item?.preview_url || '',
    authors: item?.authors || (item?.author ? String(item.author).split(',').map((value) => value.trim()).filter(Boolean) : []),
    author: item?.author || '',
    isbn: item?.isbn || '',
    subjects: item?.subjects || [],
    readingStatus: item?.readingStatus || item?.reading_status || '',
    ageBand: item?.ageBand || item?.age_band || 'unknown',
  }
}

export function buildShareUrl(type, item) {
  const payload = sharePayload(type, item)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const data = encodeURIComponent(encodeJson(payload))
  return `${origin}${SHARE_BASE_PATH}/${payload.type}/${encodeURIComponent(payload.id)}?data=${data}`
}

export function readSharePayload(encodedValue) {
  return decodeJson(encodedValue)
}

export async function shareContent(type, item) {
  const payload = sharePayload(type, item)
  const url = buildShareUrl(type, item)
  const title = `${payload.title} on CliqueBase`
  const text = `Check out this ${mediaTypeLabel(payload.type).toLowerCase()} on CliqueBase.`

  if (navigator?.share) {
    try {
      await navigator.share({ title, text, url })
      return 'Share sheet opened.'
    } catch (error) {
      if (error?.name === 'AbortError') return 'Share cancelled.'
    }
  }

  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(url)
    return 'Share link copied.'
  }

  return url
}
