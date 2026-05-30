import { supabase, hasSupabase } from './supabaseClient.js'

export async function getPublicGroupsForDiscovery() {
  if (!hasSupabase || !supabase) return []
  const { data, error } = await supabase.rpc('get_public_groups_for_discovery')
  if (error) throw error
  return Array.isArray(data) ? data : []
}

export async function joinPublicGroupById(groupId, displayName = '') {
  if (!hasSupabase || !supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase.rpc('join_public_group', {
    group_id_input: groupId,
    display_name_input: displayName || null,
  })
  if (error) throw error
  return Array.isArray(data) ? data[0] : data
}
