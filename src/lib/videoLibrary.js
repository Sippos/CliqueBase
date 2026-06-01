import { getCurrentUser, hasSupabase, supabase } from './supabaseClient.js'

function clean(value) {
  return String(value || '').trim()
}

function requireSupabase() {
  if (!hasSupabase || !supabase) throw new Error('Sign in to upload videos to CliqueBase.')
  return supabase
}

function isMissingVideosTable(error) {
  const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase()
  return text.includes('public.videos') || text.includes("table 'videos'") || text.includes('schema cache') || error?.code === '42P01' || error?.code === 'PGRST205'
}

function videoMigrationError() {
  return new Error('Videos are almost ready. Apply the latest Supabase videos migration, then uploads will work here.')
}

function getYoutubeId(url) {
  const value = clean(url)
  if (!value) return null
  const patterns = [
    /youtu\.be\/([^?&#/]+)/,
    /youtube\.com\/watch\?v=([^?&#/]+)/,
    /youtube\.com\/shorts\/([^?&#/]+)/,
    /youtube\.com\/embed\/([^?&#/]+)/,
  ]
  for (const pattern of patterns) {
    const match = value.match(pattern)
    if (match?.[1]) return match[1]
  }
  return null
}

function makeTitleFromUrl(url) {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return 'Saved video'
  }
}

export function makeVideoFromLink(url, title = '', activeHandle = '') {
  const cleanUrl = clean(url)
  const youtubeId = getYoutubeId(cleanUrl)
  const fallbackTitle = clean(title) || makeTitleFromUrl(cleanUrl)
  return {
    id: youtubeId || `link-${btoa(unescape(encodeURIComponent(cleanUrl))).replace(/=+$/g, '').slice(0, 48)}`,
    title: fallbackTitle,
    year: 'Saved link',
    url: cleanUrl,
    poster: youtubeId ? `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` : null,
    backdrop: youtubeId ? `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg` : null,
    overview: cleanUrl,
    platform: youtubeId ? 'YouTube' : 'Link',
    nominated_by: activeHandle || 'You',
    picks: 0,
    score: 0,
    classic: false,
  }
}

function normalizeVideo(row) {
  return {
    id: String(row.video_id),
    groupId: row.group_id || null,
    ownerId: row.owner_id || null,
    title: row.title || 'Saved video',
    year: row.year || 'Saved link',
    url: row.url || row.overview || '',
    poster: row.poster || null,
    backdrop: row.backdrop || row.poster || null,
    overview: row.overview || row.url || '',
    platform: row.platform || 'Link',
    nominated_by: row.nominated_by || 'Someone',
    picks: Number(row.picks || 0),
    score: Number(row.score || 0),
    classic: Boolean(row.classic),
  }
}

async function getScopeUserId(groupId) {
  if (groupId) return null
  const user = await getCurrentUser()
  if (!user) throw new Error('Sign in to use your video library.')
  return user.id
}

export async function getVideos(groupId = null) {
  const client = requireSupabase()
  const ownerId = await getScopeUserId(groupId)
  let query = client.from('videos').select('*')
  query = groupId ? query.eq('group_id', groupId) : query.is('group_id', null).eq('owner_id', ownerId)
  const { data, error } = await query.order('classic', { ascending: false }).order('score', { ascending: false }).order('updated_at', { ascending: false })
  if (error) {
    if (isMissingVideosTable(error)) return []
    throw error
  }
  return (data || []).map(normalizeVideo)
}

export async function saveVideo(video, nominatedBy = 'anonymous', groupId = null, classic = false) {
  const client = requireSupabase()
  const ownerId = await getScopeUserId(groupId)
  const payload = {
    video_id: String(video.id),
    title: video.title || 'Saved video',
    url: video.url || video.overview || '',
    year: video.year || 'Saved link',
    poster: video.poster || null,
    backdrop: video.backdrop || video.poster || null,
    overview: video.overview || video.url || null,
    platform: video.platform || null,
    nominated_by: nominatedBy || 'anonymous',
    classic: Boolean(classic || video.classic),
    updated_at: new Date().toISOString(),
  }
  if (groupId) payload.group_id = groupId
  else payload.owner_id = ownerId

  const { data, error } = await client.from('videos').upsert(payload, { onConflict: groupId ? 'group_id,video_id' : 'owner_id,video_id' }).select().single()
  if (error) {
    if (isMissingVideosTable(error)) throw videoMigrationError()
    throw error
  }
  return normalizeVideo(data)
}

export async function markVideoClassic(video, groupId = null) {
  return saveVideo({ ...video, classic: true }, video.nominated_by || 'anonymous', groupId, true)
}

export async function voteVideo(video, vote, groupId = null) {
  const client = requireSupabase()
  const delta = vote === 'like' ? 1 : -1
  const payload = groupId
    ? { video_id_input: String(video.id), vote_delta_input: delta, group_id_input: groupId }
    : { video_id_input: String(video.id), vote_delta_input: delta }
  const { data, error } = await client.rpc('vote_video', payload)
  if (error) {
    if (isMissingVideosTable(error)) throw videoMigrationError()
    throw error
  }
  return data
}
