import { hasSupabase, supabase } from './supabaseClient.js'

function requireConfiguredSupabase() {
  if (!hasSupabase || !supabase) throw new Error('Sign in to use the community feed.')
  return supabase
}

function clean(value) {
  return String(value || '').trim()
}

function normalizeItemType(value = 'other') {
  const type = clean(value).toLowerCase()
  if (['movie', 'series', 'game', 'video', 'music', 'other'].includes(type)) return type
  if (type === 'movies') return 'movie'
  if (type === 'games') return 'game'
  if (type === 'videos') return 'video'
  return 'other'
}

function normalizeActivity(row = {}) {
  return {
    id: row.id,
    type: row.type || 'system',
    actorId: row.actor_id || row.actorId || null,
    actorDisplayName: clean(row.actor_display_name || row.actorDisplayName) || 'CliqueBase member',
    groupId: row.group_id || row.groupId || null,
    groupName: clean(row.group_name || row.groupName) || '',
    itemType: row.item_type || row.itemType || '',
    itemId: row.item_id || row.itemId || '',
    title: clean(row.title) || 'Untitled pick',
    payload: row.payload || {},
    createdAt: row.created_at || row.createdAt || null,
  }
}

function normalizeRecommendation(row = {}) {
  return {
    id: row.id,
    itemType: row.item_type || row.itemType || 'other',
    itemId: row.item_id || row.itemId || '',
    groupId: row.group_id || row.groupId || null,
    ownerId: row.owner_id || row.ownerId || null,
    recommendedTo: row.recommended_to || row.recommendedTo || null,
    title: clean(row.title) || 'Untitled pick',
    note: row.note || '',
    moodTags: Array.isArray(row.mood_tags) ? row.mood_tags : row.moodTags || [],
    contextLabel: row.context_label || row.contextLabel || '',
    priority: row.priority || 'maybe',
    status: row.status || 'saved',
    createdAt: row.created_at || row.createdAt || null,
  }
}

function normalizeComment(row = {}) {
  return {
    id: row.id,
    itemType: row.item_type || row.itemType || 'other',
    itemId: row.item_id || row.itemId || '',
    groupId: row.group_id || row.groupId || null,
    ownerId: row.owner_id || row.ownerId || null,
    body: row.body || '',
    createdAt: row.created_at || row.createdAt || null,
  }
}

export async function getSocialActivity({ limit = 40, includePublic = true } = {}) {
  const client = requireConfiguredSupabase()
  const { data, error } = await client.rpc('get_social_activity', {
    limit_input: limit,
    include_public_input: includePublic,
  })
  if (error) throw error
  return (data || []).map(normalizeActivity)
}

export async function createRecommendationNote({
  itemType = 'other',
  itemId = '',
  title = '',
  note = '',
  groupId = null,
  recommendedTo = null,
  moodTags = [],
  contextLabel = '',
  priority = 'maybe',
} = {}) {
  const client = requireConfiguredSupabase()
  if (!clean(title)) throw new Error('Add a title first.')
  const tags = Array.isArray(moodTags)
    ? moodTags.map(clean).filter(Boolean).slice(0, 8)
    : clean(moodTags).split(',').map(clean).filter(Boolean).slice(0, 8)
  const { data, error } = await client.rpc('create_recommendation_note', {
    item_type_input: normalizeItemType(itemType),
    item_id_input: clean(itemId) || `${normalizeItemType(itemType)}:${clean(title).toLowerCase()}`,
    title_input: clean(title),
    note_input: note || '',
    group_id_input: groupId || null,
    recommended_to_input: recommendedTo || null,
    mood_tags_input: tags,
    context_label_input: clean(contextLabel) || null,
    priority_input: clean(priority).toLowerCase() || 'maybe',
  })
  if (error) throw error
  return normalizeRecommendation(Array.isArray(data) ? data[0] : data)
}

export async function addMediaComment({ itemType = 'other', itemId = '', title = '', body = '', groupId = null } = {}) {
  const client = requireConfiguredSupabase()
  if (!clean(body)) throw new Error('Write a comment first.')
  const { data, error } = await client.rpc('add_media_comment', {
    item_type_input: normalizeItemType(itemType),
    item_id_input: clean(itemId) || `${normalizeItemType(itemType)}:${clean(title).toLowerCase()}`,
    title_input: clean(title) || 'Untitled pick',
    body_input: clean(body),
    group_id_input: groupId || null,
  })
  if (error) throw error
  return normalizeComment(Array.isArray(data) ? data[0] : data)
}
