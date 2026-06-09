// Explore enhancer for all media categories. The SQL migration feeds these categories
// into get_community_leaderboard(); this keeps the current Explore UI aware of them.

const CATEGORY_META = {
  Movies: { icon: '🎬', label: 'Movies' },
  Series: { icon: '📺', label: 'Series' },
  Games: { icon: '🎮', label: 'Games' },
  Videos: { icon: '▶', label: 'Videos' },
  Music: { icon: '♪', label: 'Music' },
  Books: { icon: '▣', label: 'Books' },
}

function onExplore() {
  return window.location.pathname === '/explore' || window.location.pathname === '/leaderboard'
}

function schedule() {
  if (!onExplore()) return
  if (window.__exploreAllCategoriesFrame) cancelAnimationFrame(window.__exploreAllCategoriesFrame)
  window.__exploreAllCategoriesFrame = requestAnimationFrame(apply)
}

function categoryFromText(value = '') {
  const text = String(value || '').toLowerCase()
  if (text.includes('movie')) return 'Movies'
  if (text.includes('series')) return 'Series'
  if (text.includes('game')) return 'Games'
  if (text.includes('video')) return 'Videos'
  if (text.includes('music') || text.includes('song')) return 'Music'
  if (text.includes('book')) return 'Books'
  return ''
}

function orderFor(category) {
  const keys = Object.keys(CATEGORY_META)
  const index = keys.indexOf(category)
  return index >= 0 ? index : keys.length
}

function sortCategoryButtons() {
  document.querySelectorAll('button').forEach((button) => {
    const category = categoryFromText(button.textContent)
    if (category) button.style.order = String(orderFor(category))
  })
}

function sortCategorySections() {
  document.querySelectorAll('section').forEach((section) => {
    const category = categoryFromText(section.textContent)
    if (category) section.style.order = String(orderFor(category))
  })
}

function updateEmptyCopy() {
  document.querySelectorAll('p').forEach((node) => {
    const value = node.textContent || ''
    if (value.includes('once movies, series, or games get votes')) {
      node.textContent = 'The Explore dashboard will fill with the best public clique picks once movies, series, games, videos, music, or books are shared.'
    }
  })
}

function apply() {
  sortCategoryButtons()
  sortCategorySections()
  updateEmptyCopy()
}

if (typeof window !== 'undefined') {
  window.addEventListener('load', schedule)
  window.addEventListener('popstate', schedule)
  document.addEventListener('click', () => setTimeout(schedule, 100), true)
  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })
  schedule()
}
