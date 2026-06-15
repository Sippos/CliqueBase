// Keeps clique/category views useful when only one media type is filled.
// Filled categories appear first, then categories with more items.

const CATEGORY_ORDER = ['Books', 'Movies', 'Series', 'Games', 'Videos', 'Music']
const CATEGORY_ALIASES = {
  book: 'Books', books: 'Books',
  movie: 'Movies', movies: 'Movies',
  series: 'Series', show: 'Series', shows: 'Series',
  game: 'Games', games: 'Games',
  video: 'Videos', videos: 'Videos',
  music: 'Music', songs: 'Music', song: 'Music',
}

function normalizeCategory(value = '') {
  const text = String(value || '').toLowerCase()
  const match = Object.keys(CATEGORY_ALIASES).find((key) => new RegExp(`\\b${key}\\b`, 'i').test(text))
  return match ? CATEGORY_ALIASES[match] : ''
}

function baseIndex(category) {
  const index = CATEGORY_ORDER.indexOf(category)
  return index >= 0 ? index : CATEGORY_ORDER.length
}

function cssOrder(count, category) {
  const safeCount = Number(count || 0)
  return (safeCount > 0 ? 0 : 10000) + (999 - Math.min(999, safeCount)) * 10 + baseIndex(category)
}

function findCategoryFromNode(node) {
  if (!node) return ''
  const idCategory = String(node.id || '').replace(/^library-/, '')
  return normalizeCategory(idCategory) || normalizeCategory(node.textContent || '')
}

function parseSavedCount(node) {
  const text = String(node?.textContent || '')
  const savedMatch = text.match(/(\d+)\s+saved/i)
  if (savedMatch) return Number(savedMatch[1])
  if (/no\s+.+\s+yet/i.test(text)) return 0
  const pureNumber = Array.from(node.querySelectorAll('span, p'))
    .map((element) => element.textContent?.trim() || '')
    .find((value) => /^\d+$/.test(value))
  return pureNumber ? Number(pureNumber) : 0
}

function getShelfCounts() {
  const counts = new Map()
  document.querySelectorAll('section[id^="library-"]').forEach((section) => {
    const category = findCategoryFromNode(section)
    if (category) counts.set(category, parseSavedCount(section))
  })
  return counts
}

function sortChildrenByCategory(container, countMap = null) {
  if (!container) return
  Array.from(container.children).forEach((child) => {
    const category = findCategoryFromNode(child)
    if (!category) return
    const count = countMap?.has(category) ? countMap.get(category) : parseSavedCount(child)
    child.style.order = String(cssOrder(count, category))
  })
}

function sortLibraryShelves(counts) {
  const shelves = Array.from(document.querySelectorAll('section[id^="library-"]'))
  const parent = shelves[0]?.parentElement
  if (!parent || shelves.some((shelf) => shelf.parentElement !== parent)) return
  sortChildrenByCategory(parent, counts)
}

function sortTopPicks(counts) {
  Array.from(document.querySelectorAll('section')).forEach((section) => {
    if (!/Top picks at a glance/i.test(section.textContent || '')) return
    const grid = Array.from(section.querySelectorAll('div')).find((node) => {
      const children = Array.from(node.children)
      return children.length >= 2 && children.some((child) => normalizeCategory(child.textContent || ''))
    })
    sortChildrenByCategory(grid, counts)
  })
}

function sortGroupOverviewTiles() {
  Array.from(document.querySelectorAll('div')).forEach((container) => {
    const text = container.textContent || ''
    if (!/Content overview/i.test(text)) return
    const grids = Array.from(container.querySelectorAll('div')).filter((node) => {
      const children = Array.from(node.children)
      return children.length >= 2 && children.some((child) => normalizeCategory(child.textContent || ''))
    })
    grids.forEach((grid) => sortChildrenByCategory(grid))
  })
}

function applyCategorySorting() {
  const counts = getShelfCounts()
  sortLibraryShelves(counts)
  sortTopPicks(counts)
  sortGroupOverviewTiles()
}

function scheduleCategorySorting() {
  if (window.__cliqueCategorySortFrame) cancelAnimationFrame(window.__cliqueCategorySortFrame)
  window.__cliqueCategorySortFrame = requestAnimationFrame(applyCategorySorting)
}

if (typeof window !== 'undefined') {
  window.addEventListener('load', scheduleCategorySorting)
  window.addEventListener('popstate', scheduleCategorySorting)
  document.addEventListener('click', () => setTimeout(scheduleCategorySorting, 80), true)
  const observer = new MutationObserver(scheduleCategorySorting)
  observer.observe(document.documentElement, { childList: true, subtree: true })
  scheduleCategorySorting()
}
