import { hasSupabase, supabase } from './supabaseClient.js'

function requireConfiguredSupabase() {
  if (!hasSupabase || !supabase) throw new Error('Sign in to use safety tools.')
  return supabase
}

function clean(value) {
  return String(value || '').trim()
}

export async function reportContent({ actorId = null, groupId = null, itemType = 'other', itemId = '', reason = 'other', details = '' } = {}) {
  const client = requireConfiguredSupabase()
  const { data, error } = await client.rpc('report_content', {
    actor_id_input: actorId || null,
    group_id_input: groupId || null,
    item_type_input: clean(itemType) || 'other',
    item_id_input: clean(itemId),
    reason_input: clean(reason) || 'other',
    details_input: clean(details),
  })
  if (error) throw error
  return data
}

export async function blockUser(userId) {
  const client = requireConfiguredSupabase()
  if (!userId) throw new Error('Choose a member first.')
  const { error } = await client.rpc('block_user', { blocked_id_input: userId })
  if (error) throw error
  return true
}

export async function unblockUser(userId) {
  const client = requireConfiguredSupabase()
  if (!userId) throw new Error('Choose a member first.')
  const { error } = await client.rpc('unblock_user', { blocked_id_input: userId })
  if (error) throw error
  return true
}

export async function getGroupReports(groupId, includeReviewed = false) {
  const client = requireConfiguredSupabase()
  if (!groupId) return []
  const { data, error } = await client.rpc('get_group_reports', {
    group_id_input: groupId,
    include_reviewed_input: includeReviewed,
  })
  if (error) throw error
  return (data || []).map((report) => ({
    id: report.id,
    reporterId: report.reporter_id,
    reporterDisplayName: report.reporter_display_name || 'CliqueBase member',
    actorId: report.actor_id,
    actorDisplayName: report.actor_display_name || 'CliqueBase member',
    groupId: report.group_id,
    itemType: report.item_type,
    itemId: report.item_id,
    reason: report.reason,
    details: report.details || '',
    status: report.status,
    createdAt: report.created_at,
  }))
}

export async function reviewContentReport(reportId, nextStatus = 'reviewed') {
  const client = requireConfiguredSupabase()
  if (!reportId) throw new Error('Choose a report first.')
  const { error } = await client.rpc('review_content_report', {
    report_id_input: reportId,
    next_status_input: nextStatus,
  })
  if (error) throw error
  return true
}
