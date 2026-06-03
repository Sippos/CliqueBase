import { hasSupabase, supabase } from './supabaseClient.js'

function requireConfiguredSupabase() {
  if (!hasSupabase || !supabase) throw new Error('Sign in to use clique polls.')
  return supabase
}

function clean(value) {
  return String(value || '').trim()
}

function uniquePolls(polls = []) {
  const seen = new Set()
  return polls.filter((poll) => {
    if (!poll?.id || seen.has(poll.id)) return false
    seen.add(poll.id)
    return true
  })
}

function normalizePoll(row = {}) {
  const options = Array.isArray(row.options) ? row.options : []
  return {
    id: row.id,
    groupId: row.group_id || row.groupId,
    question: row.question || 'What should we pick?',
    status: row.status || 'open',
    creatorId: row.creator_id || row.creatorId,
    creatorDisplayName: clean(row.creator_display_name || row.creatorDisplayName) || 'CliqueBase member',
    createdAt: row.created_at || row.createdAt || null,
    closesAt: row.closes_at || row.closesAt || null,
    myOptionId: row.my_option_id || row.myOptionId || null,
    options: options.map((option) => ({
      id: option.id,
      label: clean(option.label) || 'Untitled option',
      itemType: option.itemType || option.item_type || 'other',
      itemId: option.itemId || option.item_id || '',
      votes: Number(option.votes || 0),
    })),
  }
}

export async function getCliquePolls(groupId, limit = 10) {
  if (!groupId) return []
  const client = requireConfiguredSupabase()
  const { data, error } = await client.rpc('get_clique_polls', {
    group_id_input: groupId,
    limit_input: limit,
  })
  if (error) throw error
  return (data || []).map(normalizePoll)
}

export async function getPendingExpiredPollDecisions(groupId, limit = 5) {
  if (!groupId) return []
  const client = requireConfiguredSupabase()
  const { data, error } = await client.rpc('get_pending_expired_poll_decisions', {
    group_id_input: groupId,
    limit_input: limit,
  })
  if (error) throw error
  return (data || []).map(normalizePoll)
}

export async function getCliquePollsWithPendingDecisions(groupId, limit = 10) {
  const [polls, pendingExpired] = await Promise.all([
    getCliquePolls(groupId, limit),
    getPendingExpiredPollDecisions(groupId, 5).catch(() => []),
  ])
  return uniquePolls([...pendingExpired, ...polls]).slice(0, limit + 5)
}

export async function createCliquePoll(groupId, question, options) {
  const client = requireConfiguredSupabase()
  const cleanOptions = Array.isArray(options)
    ? options.map(clean).filter(Boolean)
    : clean(options).split('\n').map(clean).filter(Boolean)
  if (!groupId) throw new Error('Choose a clique first.')
  if (!clean(question)) throw new Error('Add a question first.')
  if (cleanOptions.length < 2) throw new Error('Add at least two options.')
  const { data, error } = await client.rpc('create_clique_poll', {
    group_id_input: groupId,
    question_input: clean(question),
    options_input: cleanOptions.slice(0, 8),
  })
  if (error) throw error
  return data
}

export async function voteCliquePoll(pollId, optionId) {
  const client = requireConfiguredSupabase()
  if (!pollId || !optionId) throw new Error('Choose an option first.')
  const { error } = await client.rpc('vote_clique_poll', {
    poll_id_input: pollId,
    option_id_input: optionId,
  })
  if (error) throw error
  return true
}

export async function closeCliquePoll(pollId) {
  const client = requireConfiguredSupabase()
  if (!pollId) throw new Error('Choose a poll first.')
  const { data, error } = await client.rpc('close_clique_poll', { poll_id_input: pollId })
  if (error) throw error
  return data
}
