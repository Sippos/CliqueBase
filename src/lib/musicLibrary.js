import { getActiveGroupId } from './groups.js'
import { getCurrentUser, hasSupabase, supabase } from './supabaseClient.js'

const MUSIC_STORAGE_KEY = 'cliquebase:music-items:v1'

export function detectMusicSource(url) {
  const value = String(url || '').toLowerCase()
  if (value.includes('spotify.com') || value.startsWith('spotify:')) return 'Spotify'
  if (value.includes('music.apple.com')) return 'Apple Music'
  if (value.includes('youtube.com') || value.includes('youtu.be')) return 'YouTube'
  if (value.includes('soundcloud.com')) return 'SoundCloud'
  return 'Music link'
}

export function getYoutubeId(url) {
  try {
    const parsed = new URL(url)
    if (parsed.hostname.includes('youtu.be')) return parsed.pathname.replace('/', '').split('/')[0]
    if (parsed.hostname.includes('youtube.com')) return parsed.searchParams.get('v') || parsed.pathname.split('/').filter(Boolean).pop() || ''
  } catch {
    return ''
  }
  return ''
}

function clean(value) {
  return String(value || '').trim()
}

function compact(values) {
  return values.map(clean).filter(Boolean).join(' · ')
}

function makeTitleFromUrl(url) {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return 'Shared song'
  }
}

function localId() {
  return `music-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function normalizeRow(row = {}) {
  const source = row.source || detectMusicSource(row.url)
  const title = clean(row.title) || clean(row.name) || makeTitleFromUrl(row.url)
  const artist = clean(row.artist || row.artists)
  const album = clean(row.album)
  const itemType = clean(row.item_type || row.itemType) || 'track'
  const sourceId = clean(row.source_id || row.sourceId)
  const url = clean(row.url || row.external_url || row.externalUrl)
  const poster = clean(row.poster || row.cover || row.coverUrl || row.image)
  const previewUrl = clean(row.preview_url || row.previewUrl)

  return {
    id: row.id || localId(),
    source,
    sourceId,
    itemType,
    title,
    artist,
    album,
    subtitle: compact([artist, album]),
    url,
    poster,
    previewUrl,
    nominated_by: clean(row.nominated_by || row.nominatedBy) || 'Someone',
    groupId: row.group_id || row.groupId || null,
    groupName: clean(row.group_name || row.groupName),
    saved: Boolean(row.saved),
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || row.updatedAt || null,
    metadataReady: Boolean(poster || artist || album || sourceId),
  }
}

function readLocalTracks() {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(MUSIC_STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.map(normalizeRow) : []
  } catch {
    return []
  }
}

function writeLocalTracks(tracks) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(MUSIC_STORAGE_KEY, JSON.stringify(tracks.map(normalizeRow)))
}

function localScopeMatches(track, groupId) {
  const activeGroupId = groupId || ''
  if (activeGroupId) return track.groupId === activeGroupId
  return !track.groupId
}

export async function getMusicItems(groupId = getActiveGroupId()) {
  const activeGroupId = groupId || null
  if (hasSupabase && supabase) {
    try {
      const user = await getCurrentUser().catch(() => null)
      if (user?.id) {
        let query = supabase.from('music_items').select('*').order('created_at', { ascending: false })
        query = activeGroupId ? query.eq('group_id', activeGroupId) : query.is('group_id', null).eq('owner_id', user.id)
        const { data, error } = await query
        if (error) throw error
        return { tracks: (data || []).map(normalizeRow), source: 'remote' }
      }
    } catch (error) {
      console.warn('Music remote load failed, using local music:', error.message || error)
    }
  }

  return { tracks: readLocalTracks().filter((track) => localScopeMatches(track, activeGroupId)), source: 'local' }
}

export async function lookupMusicMetadata({ url = '', title = '' } = {}) {
  const cleanUrl = clean(url)
  const cleanTitle = clean(title)
  const source = detectMusicSource(cleanUrl)
  const youtubeId = source === 'YouTube' ? getYoutubeId(cleanUrl) : ''

  if (hasSupabase && supabase && (source === 'Spotify' || cleanTitle)) {
    try {
      const { data, error } = await supabase.functions.invoke('spotify-lookup', {
        body: { url: cleanUrl, query: cleanTitle, type: 'track' },
      })
      if (error) throw error
      if (data?.track) return normalizeRow({ ...data.track, nominated_by: data.track.nominated_by || 'Someone' })
    } catch (error) {
      console.warn('Spotify lookup failed, using manual metadata:', error.message || error)
    }
  }

  return normalizeRow({
    id: localId(),
    title: cleanTitle || makeTitleFromUrl(cleanUrl),
    url: cleanUrl,
    source,
    poster: youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : '',
    itemType: 'track',
  })
}

export async function saveMusicItem(track, { group = null, nominatedBy = '', saved = false } = {}) {
  const groupId = group?.id || getActiveGroupId() || null
  const normalized = normalizeRow({ ...track, groupId, groupName: group?.name || track.groupName || '', nominated_by: nominatedBy || track.nominated_by, saved })

  if (hasSupabase && supabase) {
    try {
      const user = await getCurrentUser().catch(() => null)
      if (user?.id) {
        const payload = {
          owner_id: user.id,
          group_id: groupId,
          source: normalized.source,
          source_id: normalized.sourceId || null,
          item_type: normalized.itemType || 'track',
          title: normalized.title,
          artist: normalized.artist || null,
          album: normalized.album || null,
          url: normalized.url,
          poster: normalized.poster || null,
          preview_url: normalized.previewUrl || null,
          nominated_by: normalized.nominated_by,
          saved: Boolean(normalized.saved),
          updated_at: new Date().toISOString(),
        }
        const { data, error } = await supabase.from('music_items').insert(payload).select().single()
        if (error) throw error
        return { track: normalizeRow(data), source: 'remote' }
      }
    } catch (error) {
      console.warn('Music remote save failed, saving locally:', error.message || error)
    }
  }

  const localTrack = normalizeRow({ ...normalized, id: normalized.id || localId(), groupId })
  const existing = readLocalTracks()
  writeLocalTracks([localTrack, ...existing.filter((item) => item.id !== localTrack.id)])
  return { track: localTrack, source: 'local' }
}

export async function updateMusicSaved(track, saved) {
  if (hasSupabase && supabase && !String(track.id || '').startsWith('music-')) {
    try {
      const { data, error } = await supabase.from('music_items').update({ saved: Boolean(saved), updated_at: new Date().toISOString() }).eq('id', track.id).select().single()
      if (error) throw error
      return { track: normalizeRow(data), source: 'remote' }
    } catch (error) {
      console.warn('Music remote update failed, updating local copy:', error.message || error)
    }
  }

  const existing = readLocalTracks()
  const nextTrack = normalizeRow({ ...track, saved })
  writeLocalTracks(existing.map((item) => item.id === track.id ? nextTrack : item))
  return { track: nextTrack, source: 'local' }
}

export async function deleteMusicItem(track) {
  if (hasSupabase && supabase && !String(track.id || '').startsWith('music-')) {
    try {
      const { error } = await supabase.from('music_items').delete().eq('id', track.id)
      if (error) throw error
      return { source: 'remote' }
    } catch (error) {
      console.warn('Music remote delete failed, deleting local copy:', error.message || error)
    }
  }

  writeLocalTracks(readLocalTracks().filter((item) => item.id !== track.id))
  return { source: 'local' }
}
