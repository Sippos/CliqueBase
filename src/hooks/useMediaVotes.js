import { useState, useEffect } from 'react'
import { getUserVotes } from '../lib/supabaseClient.js'

export function useMediaVotes(category, groupId) {
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
    let cancelled = false
    async function fetchVotes() {
      // First ensure we have local storage loaded
      let currentVotes = {}
      try {
        const stored = localStorage.getItem(key)
        if (stored) {
          currentVotes = JSON.parse(stored)
          setVotes(currentVotes)
        } else {
          setVotes({})
        }
      } catch (err) {
        setVotes({})
      }

      // Then fetch from remote
      try {
        const remoteVotes = await getUserVotes(category, groupId)
        if (!cancelled && Object.keys(remoteVotes).length > 0) {
          // Merge remote votes with current votes (remote wins on conflict)
          const merged = { ...currentVotes, ...remoteVotes }
          setVotes(merged)
          try {
            localStorage.setItem(key, JSON.stringify(merged))
          } catch (err) {}
        }
      } catch (err) {
        console.error('Failed to fetch remote votes', err)
      }
    }
    fetchVotes()
    return () => { cancelled = true }
  }, [category, groupId, key])

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
