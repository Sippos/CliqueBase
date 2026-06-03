function clean(value) {
  return String(value || '').trim()
}

export const fallbackDecisionOptions = ['Movie night', 'Game night', 'One episode only']

export function defaultDecisionQuestion(groupName) {
  const name = clean(groupName)
  return name ? `What should ${name} pick tonight?` : 'What should we pick tonight?'
}

export function parseDecisionOptions(value, limit = 8) {
  const rawOptions = Array.isArray(value)
    ? value
    : clean(value).split('\n')

  const seen = new Set()
  return rawOptions
    .map(clean)
    .filter(Boolean)
    .filter((option) => {
      const key = option.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, limit)
}

export function totalPollVotes(poll) {
  return (poll?.options || []).reduce((sum, option) => sum + Number(option.votes || 0), 0)
}

export function isPollOpen(poll) {
  return (poll?.status || 'open') === 'open'
}

export function pollOptionStats(poll) {
  const votes = totalPollVotes(poll)
  const highestVotes = Math.max(0, ...(poll?.options || []).map((option) => Number(option.votes || 0)))

  return (poll?.options || []).map((option) => {
    const optionVotes = Number(option.votes || 0)
    return {
      ...option,
      votes: optionVotes,
      percent: votes ? Math.round((optionVotes / votes) * 100) : 0,
      selected: poll?.myOptionId === option.id,
      leading: votes > 0 && optionVotes === highestVotes,
    }
  })
}

export function leadingPollOptions(poll) {
  return pollOptionStats(poll).filter((option) => option.leading)
}

export function decisionOptionsOrFallback(value) {
  const parsed = parseDecisionOptions(value)
  return parsed.length ? parsed : fallbackDecisionOptions
}
