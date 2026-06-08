import { ACTIVE_GROUP_STORAGE_KEY, GROUPS_CHANGED_EVENT } from './lib/groups.js'

function syncMusicCliqueScope() {
  if (typeof window === 'undefined') return
  if (window.location.pathname !== '/music') return

  const cliqueId = new URLSearchParams(window.location.search).get('clique')?.trim()
  if (!cliqueId) return

  const current = window.localStorage.getItem(ACTIVE_GROUP_STORAGE_KEY) || ''
  if (current === cliqueId) return

  window.localStorage.setItem(ACTIVE_GROUP_STORAGE_KEY, cliqueId)
  window.dispatchEvent(new Event(GROUPS_CHANGED_EVENT))
}

syncMusicCliqueScope()
window.addEventListener('popstate', syncMusicCliqueScope)
