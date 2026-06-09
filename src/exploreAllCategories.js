import { getCommunityLeaderboard, hasSupabase } from './lib/supabaseClient.js'

// Explore enhancer for all media categories. The main React page still has an older
// Movies/Series/Games pile layout, so this module adds the missing public category
// piles from the same leaderboard payload: Videos, Music, Books, and future types.

const CATEGORY_META = {
  Movies: { icon: '🎬', label: 'Movies', single: 'movie' },
  Series: { icon: '📺', label: 'Series', single: 'series' },
  Games: { icon: '🎮', label: 'Games', single: 'game' },
  Videos: { icon: '▶', label: 'Videos', single: 'video' },
  Music: { icon: '♪', label: 'Music', single: 'track' },
  Books: { icon: '▣', label: 'Books', single: 'book' },
}

const EXTRA_SECTION_ID = 'explore-extra-category-piles'
const BOARD_CACHE_TTL = 45000
let boardCache = null
let boardLoadedAt = 0
let boardLoading = null

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
  if (text.includes('music') || text.includes('song') || text.includes('track')) return 'Music'
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

function text(value) {
  return String(value || '').trim()
}

function getMeta(category) {
  return CATEGORY_META[category] || { icon: '◆', label: category || 'Picks', single: 'pick' }
}

function sortItems(items = []) {
  return items.slice().sort((a, b) => (
    Number(a.categoryRank || a.rank || 9999) - Number(b.categoryRank || b.rank || 9999)
    || Number(b.score || 0) - Number(a.score || 0)
    || Number(b.picks || 0) - Number(a.picks || 0)
    || String(a.title || '').localeCompare(String(b.title || ''))
  ))
}

function groupByCategory(items = []) {
  const map = new Map()
  items.forEach((item) => {
    const category = text(item.category)
    if (!category) return
    if (!map.has(category)) map.set(category, [])
    map.get(category).push(item)
  })
  return Array.from(map.entries()).map(([category, values]) => ({ category, items: sortItems(values).map((item, index) => ({ ...item, categoryRank: item.categoryRank || index + 1 })) }))
}

function visibleReactCategories() {
  const categories = new Set()
  const topHeading = Array.from(document.querySelectorAll('h1,h2')).find((node) => /Top public picks/i.test(node.textContent || ''))
  const topSection = topHeading?.closest('section')
  if (!topSection) return categories
  Object.keys(CATEGORY_META).forEach((category) => {
    if (new RegExp(`\\b${category}\\b`, 'i').test(topSection.textContent || '')) categories.add(category)
  })
  return categories
}

function imageFor(item = {}) {
  return item.backdrop || item.poster || item.cover || ''
}

function itemMeta(item = {}) {
  const values = []
  if (item.groupName) values.push(item.groupName)
  if (item.nominatedBy || item.nominated_by) values.push(`by ${item.nominatedBy || item.nominated_by}`)
  if (item.year) values.push(item.year)
  if (item.platform) values.push(item.platform)
  return values.slice(0, 3).join(' · ')
}

function makeNode(tag, className, content = '') {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (content) node.textContent = content
  return node
}

function createPickCard(item, category) {
  const meta = getMeta(category)
  const card = makeNode('article', 'group relative min-h-[15rem] overflow-hidden rounded-[1.45rem] border border-white/10 bg-neutral-950 shadow-2xl shadow-black/20 transition hover:-translate-y-0.5 hover:border-white/20')
  const image = imageFor(item)
  if (image) {
    const img = makeNode('img', 'absolute inset-0 h-full w-full object-cover opacity-78 transition duration-500 group-hover:scale-105')
    img.src = image
    img.alt = ''
    img.loading = 'lazy'
    card.appendChild(img)
  } else {
    const fallback = makeNode('div', 'absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-950 text-5xl text-neutral-500', meta.icon)
    card.appendChild(fallback)
  }

  card.appendChild(makeNode('div', 'absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/5'))

  const badge = makeNode('span', 'absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/65 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white shadow-lg shadow-black/30 backdrop-blur', `${meta.icon} ${meta.single}`)
  card.appendChild(badge)

  const rank = makeNode('span', 'absolute right-4 top-4 rounded-full bg-white px-3 py-1 text-xs font-black text-neutral-950', `#${item.categoryRank || item.rank || 1}`)
  card.appendChild(rank)

  const bottom = makeNode('div', 'absolute inset-x-0 bottom-0 p-4')
  bottom.appendChild(makeNode('h3', 'line-clamp-2 text-2xl font-black leading-tight text-white drop-shadow-lg', item.title || `Untitled ${meta.single}`))
  const metaLine = itemMeta(item)
  if (metaLine) bottom.appendChild(makeNode('p', 'mt-2 line-clamp-1 text-xs font-semibold text-neutral-300', metaLine))
  const stats = makeNode('p', 'mt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400', `Score ${item.score || 0} · ${item.picks || 0} picks`)
  bottom.appendChild(stats)
  card.appendChild(bottom)

  const link = makeNode('a', 'absolute inset-0 rounded-[inherit]')
  link.href = item.groupId ? `/cliques/${encodeURIComponent(item.groupId)}` : '/explore'
  link.setAttribute('aria-label', `Open ${item.title || meta.label}`)
  card.appendChild(link)
  return card
}

function createCategoryPile(pile) {
  const meta = getMeta(pile.category)
  const section = makeNode('section', 'grid gap-3')
  section.style.order = String(orderFor(pile.category))

  const header = makeNode('div', 'flex items-center justify-between gap-3 px-1')
  header.appendChild(makeNode('h2', 'inline-flex items-center gap-2 text-xl font-black text-white', `${meta.icon} ${meta.label}`))
  header.appendChild(makeNode('span', 'rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-300', `${pile.items.length} public`))
  section.appendChild(header)

  const grid = makeNode('div', 'grid gap-4 md:grid-cols-2 xl:grid-cols-3')
  pile.items.slice(0, 6).forEach((item) => grid.appendChild(createPickCard(item, pile.category)))
  section.appendChild(grid)
  return section
}

function findInsertPoint() {
  const topPicks = Array.from(document.querySelectorAll('h1,h2')).find((node) => /Top public picks/i.test(node.textContent || ''))?.closest('section')
  if (topPicks) return { parent: topPicks.parentElement, after: topPicks }
  const topCliques = Array.from(document.querySelectorAll('h1,h2')).find((node) => /Top Cliques/i.test(node.textContent || ''))?.closest('section')
  if (topCliques) return { parent: topCliques.parentElement, before: topCliques }
  return { parent: document.querySelector('main') || document.body }
}

function renderExtraCategories(board) {
  const topContent = Array.isArray(board?.topContent) ? board.topContent : []
  if (!topContent.length) return

  const rendered = visibleReactCategories()
  const extras = groupByCategory(topContent)
    .filter((pile) => pile.items.length)
    .filter((pile) => !rendered.has(pile.category) || ['Videos', 'Music', 'Books'].includes(pile.category))
    .filter((pile) => ['Videos', 'Music', 'Books'].includes(pile.category) || !CATEGORY_META[pile.category])
    .sort((a, b) => orderFor(a.category) - orderFor(b.category))

  let section = document.getElementById(EXTRA_SECTION_ID)
  if (!extras.length) {
    section?.remove()
    return
  }

  if (!section) {
    section = makeNode('section', 'mb-6 grid gap-5 pt-1 sm:mb-8')
    section.id = EXTRA_SECTION_ID
    const insert = findInsertPoint()
    if (insert.after?.parentElement) insert.after.insertAdjacentElement('afterend', section)
    else if (insert.before?.parentElement) insert.before.insertAdjacentElement('beforebegin', section)
    else insert.parent?.appendChild(section)
  }

  section.replaceChildren()
  const intro = makeNode('div', 'px-1')
  intro.appendChild(makeNode('h2', 'text-3xl font-black text-white', 'More public categories'))
  intro.appendChild(makeNode('p', 'mt-2 max-w-2xl text-sm leading-6 text-neutral-400', 'Videos, music, books, and every other public clique pick live here too.'))
  section.appendChild(intro)
  extras.forEach((pile) => section.appendChild(createCategoryPile(pile)))
}

async function loadBoard() {
  if (!hasSupabase) return null
  if (boardCache && Date.now() - boardLoadedAt < BOARD_CACHE_TTL) return boardCache
  if (boardLoading) return boardLoading
  boardLoading = getCommunityLeaderboard()
    .then((board) => {
      boardCache = board || null
      boardLoadedAt = Date.now()
      return boardCache
    })
    .catch(() => null)
    .finally(() => { boardLoading = null })
  return boardLoading
}

async function apply() {
  sortCategoryButtons()
  sortCategorySections()
  updateEmptyCopy()
  const board = await loadBoard()
  if (board) renderExtraCategories(board)
}

if (typeof window !== 'undefined') {
  window.addEventListener('load', schedule)
  window.addEventListener('popstate', schedule)
  document.addEventListener('click', () => setTimeout(schedule, 100), true)
  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })
  schedule()
}
