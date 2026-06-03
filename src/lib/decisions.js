import { hasSupabase, supabase } from './supabaseClient.js'

function requireConfiguredSupabase() {
  if (!hasSupabase || !supabase) throw new Error('Sign in to use decisions.')
  return supabase
}

function clean(value) {
  return String(value || '').trim()
}

function normalizeDecision(row = {}) {
  return {
    id: row.id,
    groupId: row.group_id || row.groupId,
    pollId: row.poll_id || row.pollId || null,
    selectedLabel: clean(row.selected_label || row.selectedLabel) || 'Untitled decision',
    itemType: row.item_type || row.itemType || 'other',
    itemId: row.item_id || row.itemId || '',
    status: row.status || 'selected',
    selectedByDisplayName: clean(row.selected_by_display_name || row.selectedByDisplayName) || 'CliqueBase member',
    selectedAt: row.selected_at || row.selectedAt || null,
    completedByDisplayName: clean(row.completed_by_display_name || row.completedByDisplayName) || '',
    completedAt: row.completed_at || row.completedAt || null,
    rating: row.rating ?? null,
    notes: row.notes || '',
  }
}

export async function getCliqueDecisions(groupId, limit = 5) {
  if (!groupId) return []
  const client = requireConfiguredSupabase()
  const { data, error } = await client.rpc('get_clique_decisions', {
    group_id_input: groupId,
    limit_input: limit,
  })
  if (error) throw error
  return (data || []).map(normalizeDecision)
}

export async function markDecisionDone(decisionId, rating = null, notes = '') {
  const client = requireConfiguredSupabase()
  if (!decisionId) throw new Error('Choose a decision first.')
  const nextRating = rating === '' || rating === null || rating === undefined ? null : Number(rating)
  if (nextRating !== null && (Number.isNaN(nextRating) || nextRating < 0 || nextRating > 10)) throw new Error('Rating must be between 0 and 10.')
  const { error } = await client.rpc('mark_decision_done', {
    decision_id_input: decisionId,
    rating_input: nextRating,
    notes_input: notes || null,
  })
  if (error) throw error
  return true
}
