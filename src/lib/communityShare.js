import { hasSupabase, supabase } from './supabaseClient.js'
import { normalizeShareType, sharePayload } from './share.js'

function clean(value) {
  return String(value || '').trim()
}

function requireConfiguredSupabase() {
  if (!hasSupabase || !supabase) throw new Error('Sign in to use CliqueBase social features.')
  return supabase
}

function isMissingRpc(error, names = []) {
  const message = `${error?.message || ''} ${error?.details || ''}`.toLowerCase()
  return message.includes('function') && names.some((name) => message.includes(name))
}

function platformSearchError(error) {
  if (isMissingRpc(error, [
    'search_members_by_profile_name',
    'share_media_with_member',
    'search_my_cliques_by_name',
    'share_media_with_clique',
    'get_member_public_library',
    'get_my_friends',
    'send_friend_request',
    'add_friend',
    'remove_friend',
  ])) {
    return new Error('Platform social features need the latest Supabase social migration. Until then, use WhatsApp or copy the share link.')
  }
  return error
}

function normalizeMember(member, fallbackId = '') {
  return {
    id: member?.id || fallbackId,
    displayName: clean(member?.display_name || member?.displayName) || 'CliqueBase member',
    isFriend: Boolean(member?.is_friend ?? member?.isFriend),
    libraryCount: Number(member?.library_count ?? member?.libraryCount ?? 0),
    friendSince: member?.created_at || member?.friendSince || null,
  }
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
    .map((member) => normalizeMember(member))
    .filter((member) => {
      if (!member.id || seen.has(member.id)) return false
      seen.add(member.id)
      return true
    })
}

export async function getFriendsList() {
  const client = requireConfiguredSupabase()
  const { data, error } = await client.rpc('get_my_friends')
  if (error) throw platformSearchError(error)
  return (data || []).map((friend) => normalizeMember({ ...friend, is_friend: true }))
}

export async function addFriend(memberId) {
  const client = requireConfiguredSupabase()
  if (!memberId) throw new Error('Choose a member first.')
  const { data, error } = await client.rpc('send_friend_request', { friend_id_input: memberId })
  if (error) throw platformSearchError(error)
  const request = Array.isArray(data) ? data[0] : data
  return normalizeMember({ id: memberId, display_name: request?.status === 'accepted' ? 'Friend' : 'Friend request sent', is_friend: request?.status === 'accepted' }, memberId)
}

export async function removeFriend(memberId) {
  const client = requireConfiguredSupabase()
  if (!memberId) throw new Error('Choose a friend first.')
  const { error } = await client.rpc('remove_friend', { friend_id_input: memberId })
  if (error) throw platformSearchError(error)
  return true
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
      ...normalizeMember(profile, memberId),
      isSelf: Boolean(profile.isSelf || profile.is_self),
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
      genres: item.genres || [],
      runtime: item.runtime ?? null,
      seasons: item.seasons ?? null,
      episodes: item.episodes ?? null,
      platform: item.platform || '',
      platforms: item.platforms || [],
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
