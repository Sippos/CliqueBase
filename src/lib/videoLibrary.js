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
  const youtubeId = getYoutubeId(url)
  if (youtubeId) return `YouTube video ${youtubeId}`
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return 'Saved video'
  }
}

function makeBaseVideoFromLink(url, title = '', activeHandle = '') {
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

async function fetchPublicVideoMetadata(url) {
  const cleanUrl = clean(url)
  if (!cleanUrl || typeof fetch === 'undefined') return null

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timeout = controller ? window.setTimeout(() => controller.abort(), 4500) : null

  try {
    const response = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(cleanUrl)}`, {
      signal: controller?.signal,
    })
    if (!response.ok) return null
    const data = await response.json()
    const title = clean(data?.title)
    if (!title) return null
    return {
      title,
      poster: clean(data?.thumbnail_url) || null,
      backdrop: clean(data?.thumbnail_url) || null,
      platform: clean(data?.provider_name) || null,
      author: clean(data?.author_name) || null,
    }
  } catch {
    return null
  } finally {
    if (timeout) window.clearTimeout(timeout)
  }
}

export async function makeVideoFromLink(url, title = '', activeHandle = '') {
  const base = makeBaseVideoFromLink(url, title, activeHandle)
  if (clean(title)) return base

  const metadata = await fetchPublicVideoMetadata(url)
  if (!metadata?.title) return base

  return {
    ...base,
    title: metadata.title,
    poster: metadata.poster || base.poster,
    backdrop: metadata.backdrop || base.backdrop,
    platform: metadata.platform || base.platform,
    overview: metadata.author ? `${metadata.author} · ${base.url}` : base.url,
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

function applyVideoScope(query, groupId, ownerId) {
  return groupId ? query.eq('group_id', groupId) : query.is('group_id', null).eq('owner_id', ownerId)
}

export async function getVideos(groupId = null) {
  const client = requireSupabase()
  const ownerId = await getScopeUserId(groupId)
  let query = applyVideoScope(client.from('videos').select('*'), groupId, ownerId)
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

export async function updateVideo(video, updates = {}, groupId = null) {
  const client = requireSupabase()
  const ownerId = await getScopeUserId(groupId)
  const payload = {
    updated_at: new Date().toISOString(),
  }

  if ('title' in updates) payload.title = clean(updates.title) || video.title || 'Saved video'
  if ('classic' in updates) payload.classic = Boolean(updates.classic)

  let query = applyVideoScope(client.from('videos').update(payload).eq('video_id', String(video.id)), groupId, ownerId)
  const { data, error } = await query.select().single()
  if (error) {
    if (isMissingVideosTable(error)) throw videoMigrationError()
    throw error
  }
  return normalizeVideo(data)
}

export async function deleteVideo(video, groupId = null) {
  const client = requireSupabase()
  const ownerId = await getScopeUserId(groupId)
  let query = applyVideoScope(client.from('videos').delete().eq('video_id', String(video.id)), groupId, ownerId)
  const { error } = await query
  if (error) {
    if (isMissingVideosTable(error)) throw videoMigrationError()
    throw error
  }
  return true
}

export async function markVideoClassic(video, groupId = null) {
  return updateVideo(video, { classic: true }, groupId)
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
