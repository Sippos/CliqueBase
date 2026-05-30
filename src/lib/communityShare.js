import { hasSupabase, supabase } from './supabaseClient.js'
import { normalizeShareType, sharePayload } from './share.js'

function clean(value) {
  return String(value || '').trim()
}

function requireConfiguredSupabase() {
  if (!hasSupabase || !supabase) throw new Error('Sign in to use CliqueBase sharing.')
  return supabase
}

export async function searchMembersByProfileName(query, limit = 10) {
  const search = clean(query)
  if (search.length < 2) return []

  const client = requireConfiguredSupabase()
  const { data, error } = await client.rpc('search_members_by_profile_name', {
    search_input: search,
    limit_input: limit,
  })
  if (error) throw error

  return (data || []).map((member) => ({
    id: member.id,
    displayName: clean(member.display_name) || 'CliqueBase member',
  }))
}

export async function searchCliquesByName(query = '', limit = 10) {
  const client = requireConfiguredSupabase()
  const { data, error } = await client.rpc('search_my_cliques_by_name', {
    search_input: clean(query),
    limit_input: limit,
  })
  if (error) throw error

  return (data || []).map((clique) => ({
    id: clique.id,
    name: clean(clique.name) || 'Untitled clique',
    memberCount: Number(clique.member_count || 0),
    isPublic: Boolean(clique.is_public),
  }))
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
  if (error) throw error
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
  if (error) throw error
  return data
}
