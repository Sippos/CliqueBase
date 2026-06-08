import { ACTIVE_GROUP_STORAGE_KEY, GROUPS_CHANGED_EVENT, GROUPS_STORAGE_KEY } from './lib/groups.js'

const ENTRY_ID = 'cliquebase-clique-music-entry'

function activeGroupName(activeGroupId) {
  try {
    const groups = JSON.parse(window.localStorage.getItem(GROUPS_STORAGE_KEY) || '[]')
    return groups.find((group) => group?.id === activeGroupId)?.name || 'active clique'
  } catch {
    return 'active clique'
  }
}

function shouldShow() {
  return typeof window !== 'undefined' && (window.location.pathname === '/groups' || window.location.pathname.startsWith('/cliques'))
}

function renderCliqueMusicEntry() {
  if (!shouldShow()) return

  const existing = document.getElementById(ENTRY_ID)
  const activeGroupId = window.localStorage.getItem(ACTIVE_GROUP_STORAGE_KEY) || ''
  if (!activeGroupId) {
    existing?.remove()
    return
  }

  const target = document.querySelector('main .mx-auto.max-w-6xl') || document.querySelector('main')
  if (!target) return

  const href = `/music?clique=${encodeURIComponent(activeGroupId)}`
  const label = `Open music for ${activeGroupName(activeGroupId)}`

  if (existing) {
    const link = existing.querySelector('a')
    if (link) {
      link.setAttribute('href', href)
      link.querySelector('[data-label]').textContent = label
    }
    return
  }

  const wrapper = document.createElement('section')
  wrapper.id = ENTRY_ID
  wrapper.className = 'mb-4 rounded-[1.65rem] border border-emerald-200/15 bg-emerald-300/[0.055] p-3 shadow-xl shadow-black/15'
  wrapper.innerHTML = `
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0">
        <p class="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-200/70">Clique music</p>
        <p class="mt-1 text-sm font-semibold text-neutral-300">Add tracks, Spotify links, covers, and saved songs to the currently selected clique.</p>
      </div>
      <a href="${href}" class="inline-flex shrink-0 items-center justify-center rounded-2xl bg-white px-4 py-3 text-sm font-black text-neutral-950 hover:bg-neutral-200">
        <span data-label>${label}</span>
      </a>
    </div>
  `

  target.insertBefore(wrapper, target.firstChild)
}

if (typeof window !== 'undefined') {
  renderCliqueMusicEntry()
  window.addEventListener(GROUPS_CHANGED_EVENT, renderCliqueMusicEntry)
  window.addEventListener('popstate', renderCliqueMusicEntry)
  const observer = new MutationObserver(() => renderCliqueMusicEntry())
  observer.observe(document.documentElement, { childList: true, subtree: true })
}
