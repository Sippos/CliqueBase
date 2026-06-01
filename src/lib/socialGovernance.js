import { hasSupabase, supabase } from './supabaseClient.js'

function requireConfiguredSupabase() {
  if (!hasSupabase || !supabase) throw new Error('Sign in to use CliqueBase social features.')
  return supabase
}

function clean(value) {
  return String(value || '').trim()
}

function firstRpcRow(data) {
  return Array.isArray(data) ? data[0] : data
}

function normalizePermissionRow(row = {}) {
  return {
    groupId: row.group_id || row.groupId || null,
    userId: row.user_id || row.userId || null,
    role: row.role || 'member',
    canUpdateSettings: Boolean(row.can_update_settings ?? row.canUpdateSettings),
    canManageMembers: Boolean(row.can_manage_members ?? row.canManageMembers),
    canModerateContent: Boolean(row.can_moderate_content ?? row.canModerateContent),
    canDeleteGroup: Boolean(row.can_delete_group ?? row.canDeleteGroup),
    canTransferOwnership: Boolean(row.can_transfer_ownership ?? row.canTransferOwnership),
  }
}

function normalizeMember(row = {}) {
  return {
    userId: row.user_id || row.userId || row.id || null,
    displayName: clean(row.display_name || row.displayName) || 'Member',
    role: row.role || 'member',
    joinedAt: row.joined_at || row.joinedAt || null,
  }
}

function normalizeFriendRequest(row = {}) {
  return {
    id: row.id,
    direction: row.direction || 'incoming',
    userId: row.user_id || row.userId,
    displayName: clean(row.display_name || row.displayName) || 'CliqueBase member',
    status: row.status || 'pending',
    createdAt: row.created_at || row.createdAt || null,
    respondedAt: row.responded_at || row.respondedAt || null,
  }
}

function normalizeNotification(row = {}) {
  return {
    id: row.id,
    type: row.type || 'system',
    actorId: row.actor_id || row.actorId || null,
    actorDisplayName: clean(row.actor_display_name || row.actorDisplayName) || null,
    entityType: row.entity_type || row.entityType || null,
    entityId: row.entity_id || row.entityId || null,
    payload: row.payload || {},
    readAt: row.read_at || row.readAt || null,
    createdAt: row.created_at || row.createdAt || null,
  }
}

export async function getGroupPermissions(groupId) {
  const client = requireConfiguredSupabase()
  if (!groupId) throw new Error('Choose a clique first.')
  const { data, error } = await client.rpc('get_group_permissions', { group_id_input: groupId })
  if (error) throw error
  return normalizePermissionRow(firstRpcRow(data) || {})
}

export async function getGroupManagementSummary(groupId) {
  const client = requireConfiguredSupabase()
  if (!groupId) throw new Error('Choose a clique first.')
  const { data, error } = await client.rpc('get_group_management_summary', { group_id_input: groupId })
  if (error) throw error
  const payload = data || {}
  return {
    permissions: normalizePermissionRow(payload.permissions || {}),
    members: Array.isArray(payload.members) ? payload.members.map(normalizeMember) : [],
  }
}

export async function updateGroupSettings(groupId, { name, isPublic } = {}) {
  const client = requireConfiguredSupabase()
  if (!groupId) throw new Error('Choose a clique first.')
  const { data, error } = await client.rpc('update_group_settings', {
    group_id_input: groupId,
    name_input: name === undefined ? null : clean(name),
    is_public_input: isPublic === undefined ? null : Boolean(isPublic),
  })
  if (error) throw error
  return firstRpcRow(data)
}

export async function updateGroupMemberRole(groupId, memberId, role) {
  const client = requireConfiguredSupabase()
  if (!groupId || !memberId) throw new Error('Choose a clique member first.')
  const { data, error } = await client.rpc('update_group_member_role', {
    group_id_input: groupId,
    member_id_input: memberId,
    role_input: clean(role).toLowerCase(),
  })
  if (error) throw error
  return normalizeMember(firstRpcRow(data) || {})
}

export async function removeGroupMember(groupId, memberId) {
  const client = requireConfiguredSupabase()
  if (!groupId || !memberId) throw new Error('Choose a clique member first.')
  const { error } = await client.rpc('remove_group_member', {
    group_id_input: groupId,
    member_id_input: memberId,
  })
  if (error) throw error
  return true
}

export async function leaveGroup(groupId) {
  const client = requireConfiguredSupabase()
  if (!groupId) throw new Error('Choose a clique first.')
  const { error } = await client.rpc('leave_group', { group_id_input: groupId })
  if (error) throw error
  return true
}

export async function transferGroupOwnership(groupId, newOwnerId) {
  const client = requireConfiguredSupabase()
  if (!groupId || !newOwnerId) throw new Error('Choose a new owner first.')
  const { data, error } = await client.rpc('transfer_group_ownership', {
    group_id_input: groupId,
    new_owner_id_input: newOwnerId,
  })
  if (error) throw error
  return firstRpcRow(data)
}

export async function deleteGroup(groupId) {
  const client = requireConfiguredSupabase()
  if (!groupId) throw new Error('Choose a clique first.')
  const { error } = await client.rpc('delete_group', { group_id_input: groupId })
  if (error) throw error
  return true
}

export async function sendFriendRequest(memberId) {
  const client = requireConfiguredSupabase()
  if (!memberId) throw new Error('Choose a member first.')
  const { data, error } = await client.rpc('send_friend_request', { friend_id_input: memberId })
  if (error) throw error
  return firstRpcRow(data)
}

export async function respondFriendRequest(requestId, response) {
  const client = requireConfiguredSupabase()
  if (!requestId) throw new Error('Choose a friend request first.')
  const { data, error } = await client.rpc('respond_friend_request', {
    request_id_input: requestId,
    response_input: clean(response).toLowerCase(),
  })
  if (error) throw error
  return firstRpcRow(data)
}

export async function cancelFriendRequest(requestId) {
  const client = requireConfiguredSupabase()
  if (!requestId) throw new Error('Choose a friend request first.')
  const { error } = await client.rpc('cancel_friend_request', { request_id_input: requestId })
  if (error) throw error
  return true
}

export async function getFriendRequests(status = 'pending') {
  const client = requireConfiguredSupabase()
  const { data, error } = await client.rpc('get_friend_requests', { status_input: status })
  if (error) throw error
  return (data || []).map(normalizeFriendRequest)
}

export async function getNotifications({ limit = 30, includeRead = false } = {}) {
  const client = requireConfiguredSupabase()
  const { data, error } = await client.rpc('get_notifications', {
    limit_input: limit,
    include_read_input: includeRead,
  })
  if (error) throw error
  return (data || []).map(normalizeNotification)
}

export async function markNotificationRead(notificationId) {
  const client = requireConfiguredSupabase()
  if (!notificationId) throw new Error('Choose a notification first.')
  const { error } = await client.rpc('mark_notification_read', { notification_id_input: notificationId })
  if (error) throw error
  return true
}

export async function markAllNotificationsRead() {
  const client = requireConfiguredSupabase()
  const { error } = await client.rpc('mark_all_notifications_read')
  if (error) throw error
  return true
}
