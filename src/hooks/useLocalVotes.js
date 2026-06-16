import { useState, useEffect } from 'react'

export function useLocalVotes(category, groupId) {
  const key = `clique_votes_${category}_${groupId || 'personal'}`
  const [votes, setVotes] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        return JSON.parse(localStorage.getItem(key)) || {}
      } catch (err) {
        return {}
      }
    }
    return {}
  })

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key)
      if (stored) {
        setVotes(JSON.parse(stored))
      } else {
        setVotes({})
      }
    } catch (err) {
      setVotes({})
    }
  }, [key])

  function recordVote(id, vote) {
    setVotes((current) => {
      const next = { ...current, [id]: vote }
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch (err) {}
      return next
    })
  }

  function setVotesDirectly(newVotes) {
    setVotes(newVotes)
    if (Object.keys(newVotes).length === 0) {
      try {
        localStorage.removeItem(key)
      } catch (err) {}
    } else {
      try {
        localStorage.setItem(key, JSON.stringify(newVotes))
      } catch (err) {}
    }
  }

  return [votes, recordVote, setVotesDirectly]
}
