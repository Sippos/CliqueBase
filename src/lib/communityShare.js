import { hasSupabase, supabase } from './supabaseClient.js'
import { normalizeShareType, sharePayload } from './share.js'

function clean(value) {
  return String(value || '').trim()
}

function requireConfiguredSupabase() {
  if (!hasSupabase || !supabase) throw new Error('Sign in to use CliqueBase sharing.')
  return supabase
}

function isMissingRpc(error, names = []) {
  const message = `${error?.message || ''} ${error?.details || ''}`.toLowerCase()
  return message.includes('function') && names.some((name) => message.includes(name))
}

function platformSearchError(error) {
  if (isMissingRpc(error, ['search_members_by_profile_name', 'share_media_with_member', 'search_my_cliques_by_name', 'share_media_with_clique', 'get_member_public_library'])) {
    return new Error('Platform social features need the latest Supabase sharing migration. Until then, use WhatsApp or copy the share link.')
  }
  return error
}

export async function searchMembersByProfileName(query, limit = 10) {
  const search = clean(query)
  if (search.length < 2) return []

  const client = requireConfiguredSupabase()
  const { data, error } = await client.rpc('search_members_by_profile_name', {
    search_input: search,
    limit_input: limit,
  })
  if (error) throw platformSearchError(error)

  const seen = new Set()
  return (data || [])
    .map((member) => ({
      id: member.id,
      displayName: clean(member.display_name) || 'CliqueBase member',
    }))
    .filter((member) => {
      if (!member.id || seen.has(member.id)) return false
      seen.add(member.id)
      return true
    })
}

export async function searchCliquesByName(query = '', limit = 10) {
  const client = requireConfiguredSupabase()
  const { data, error } = await client.rpc('search_my_cliques_by_name', {
    search_input: clean(query),
    limit_input: limit,
  })
  if (error) throw platformSearchError(error)

  return (data || []).map((clique) => ({
    id: clique.id,
    name: clean(clique.name) || 'Untitled clique',
    memberCount: Number(clique.member_count || 0),
    isPublic: Boolean(clique.is_public),
  }))
}

export async function getMemberPublicLibrary(memberId) {
  const client = requireConfiguredSupabase()
  if (!memberId) throw new Error('Choose a member first.')

  const { data, error } = await client.rpc('get_member_public_library', {
    member_id_input: memberId,
  })
  if (error) throw platformSearchError(error)

  const payload = data || {}
  const profile = payload.profile || {}
  const items = Array.isArray(payload.items) ? payload.items : []
  return {
    profile: {
      id: profile.id || memberId,
      displayName: clean(profile.displayName || profile.display_name) || 'CliqueBase member',
    },
    items: items.map((item) => ({
      id: item.id,
      type: item.type || 'Pick',
      title: item.title || 'Untitled pick',
      poster: item.poster || null,
      backdrop: item.backdrop || null,
      overview: item.overview || '',
      score: Number(item.score || 0),
      picks: Number(item.picks || 0),
      rating: item.rating ?? null,
      released: item.released || null,
      year: item.year || '',
    })),
    totals: payload.totals || {},
  }
}

export async function shareMediaWithMember(type, item, recipientId) {
  const client = requireConfiguredSupabase()
  const normalizedType = normalizeShareType(type)
  if (!normalizedType) throw new Error('This content type cannot be shared yet.')
  if (!recipientId) throw new Error('Choose a member first.')

  const payload = sharePayload(normalizedType, item)
  const { data, error } = await client.rpc('share_media_with_member', {
    recipient_id_input: recipientId,
    item_type_input: normalizedType,
    payload_input: payload,
  })
  if (error) throw platformSearchError(error)
  return Array.isArray(data) ? data[0] : data
}

export async function shareMediaWithClique(type, item, cliqueId) {
  const client = requireConfiguredSupabase()
  const normalizedType = normalizeShareType(type)
  if (!normalizedType) throw new Error('This content type cannot be shared yet.')
  if (!cliqueId) throw new Error('Choose a clique first.')

  const payload = sharePayload(normalizedType, item)
  const { data, error } = await client.rpc('share_media_with_clique', {
    group_id_input: cliqueId,
    item_type_input: normalizedType,
    payload_input: payload,
  })
  if (error) throw platformSearchError(error)
  return data
}
