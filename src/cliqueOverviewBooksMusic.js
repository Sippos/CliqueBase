import { getBookItems } from './lib/bookLibrary.js'
import { getMusicItems } from './lib/musicLibrary.js'

const CATEGORY_ORDER = ['Books', 'Music', 'Movies', 'Series', 'Games', 'Videos']
const injectedClass = 'clique-overview-extra-category'
const cache = new Map()
const loading = new Set()

function categoryFromText(text = '') {
  const value = String(text || '').toLowerCase()
  if (value.includes('book')) return 'Books'
  if (value.includes('music') || value.includes('song')) return 'Music'
  if (value.includes('movie')) return 'Movies'
  if (value.includes('series')) return 'Series'
  if (value.includes('game')) return 'Games'
  if (value.includes('video')) return 'Videos'
  return ''
}

function orderFor(category, count = 0) {
  const index = CATEGORY_ORDER.indexOf(category)
  return String((count > 0 ? 0 : 10000) + (999 - Math.min(999, Number(count || 0))) * 10 + (index >= 0 ? index : 99))
}

function text(node) {
  return String(node?.textContent || '')
}

function extractGroupId(card) {
  const links = Array.from(card.querySelectorAll('a[href]'))
  for (const link of links) {
    const match = String(link.getAttribute('href') || '').match(/\/(?:cliques|g)\/([^/?#]+)/)
    if (match?.[1]) return decodeURIComponent(match[1])
  }
  return ''
}

function findOverviewGrid(card) {
  const grids = Array.from(card.querySelectorAll('div')).filter((node) => {
    const children = Array.from(node.children)
    if (children.length < 2) return false
    return children.filter((child) => categoryFromText(text(child))).length >= 2
  })
  return grids.sort((a, b) => b.children.length - a.children.length)[0] || null
}

function readCount(tile) {
  const value = text(tile)
  if (/no\s+.+\s+yet/i.test(value)) return 0
  const match = value.match(/\b(\d+)\s*(?:saved|items|picks)?\b/i)
  return match ? Number(match[1]) : 0
}

function setMetric(card, label, value) {
  const labelNode = Array.from(card.querySelectorAll('span,p')).find((node) => text(node).trim().toLowerCase() === label.toLowerCase())
  const valueNode = labelNode?.previousElementSibling
  if (valueNode && /^\d+$/.test(text(valueNode).trim())) valueNode.textContent = String(value)
}

function topItem(items = []) {
  return items.slice().sort((a, b) => {
    const aScore = Number(a.score || 0) * 10 + Number(a.picks || 0) + Number(a.rating || 0) + (Date.parse(a.createdAt || a.created_at || '') || 0) / 1000000000000
    const bScore = Number(b.score || 0) * 10 + Number(b.picks || 0) + Number(b.rating || 0) + (Date.parse(b.createdAt || b.created_at || '') || 0) / 1000000000000
    return bScore - aScore || String(a.title || '').localeCompare(String(b.title || ''))
  })[0] || null
}

function addClass(node, className) {
  className.split(' ').filter(Boolean).forEach((part) => node.classList.add(part))
}

function makeText(tag, className, value) {
  const node = document.createElement(tag)
  addClass(node, className)
  node.textContent = value
  return node
}

function imageFor(item = {}) {
  return item.backdrop || item.poster || item.cover || ''
}

function subtitleFor(item = {}, count = 0) {
  return [item.author, item.artist, item.album, item.year, item.readingStatus, item.source].filter(Boolean).slice(0, 2).join(' · ') || `${count} saved`
}

function createExtraTile(category, items, groupId) {
  const count = items.length
  const item = topItem(items)
  const article = document.createElement('article')
  article.className = injectedClass
  article.dataset.category = category
  article.style.order = orderFor(category, count)
  addClass(article, 'group relative min-h-[6.15rem] overflow-hidden rounded-[1rem] border border-white/10 bg-neutral-950/75 transition hover:border-white/25 hover:bg-neutral-900 sm:min-h-[7.25rem] sm:rounded-[1.25rem]')

  const link = document.createElement('a')
  link.href = groupId ? `/cliques/${encodeURIComponent(groupId)}` : '/groups'
  addClass(link, 'block h-full min-h-[6.15rem] w-full text-left sm:min-h-[7.25rem]')
  link.setAttribute('aria-label', `Open ${item?.title || category}`)

  const img = imageFor(item)
  if (img) {
    const image = document.createElement('img')
    image.src = img
    image.alt = ''
    addClass(image, 'absolute inset-0 h-full w-full object-cover opacity-68 transition group-hover:scale-105')
    link.appendChild(image)
  }

  const overlay = document.createElement('div')
  addClass(overlay, 'absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/10')
  link.appendChild(overlay)

  const label = makeText('span', 'absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.1em] text-neutral-950 sm:left-3 sm:top-3 sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[9px] sm:tracking-[0.12em]', `Top ${category === 'Books' ? 'Book' : 'Music'}`)
  link.appendChild(label)

  const countBadge = makeText('span', 'absolute right-2 top-2 rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-black text-white backdrop-blur sm:right-3 sm:top-3 sm:px-2 sm:py-1 sm:text-[10px]', String(count))
  link.appendChild(countBadge)

  const bottom = document.createElement('div')
  addClass(bottom, 'absolute inset-x-0 bottom-0 p-2.5 sm:p-3')
  bottom.appendChild(makeText('h3', 'line-clamp-1 text-sm font-black leading-tight text-white sm:text-base', item?.title || `No ${category.toLowerCase()} yet`))
  bottom.appendChild(makeText('p', 'mt-0.5 line-clamp-1 text-[10px] font-semibold text-neutral-400 sm:mt-1 sm:text-[11px]', subtitleFor(item || {}, count)))
  link.appendChild(bottom)
  article.appendChild(link)
  return article
}

function sortGrid(grid, counts) {
  Array.from(grid.children).forEach((tile) => {
    const category = tile.dataset.category || categoryFromText(text(tile))
    if (!category) return
    const count = Object.hasOwn(counts, category) ? counts[category] : readCount(tile)
    tile.style.order = orderFor(category, count)
  })
}

function updateCard(card, groupId, data) {
  const grid = findOverviewGrid(card)
  if (!grid) return
  Array.from(grid.querySelectorAll(`.${injectedClass}`)).forEach((node) => node.remove())

  const books = data.books || []
  const music = data.music || []
  if (books.length) grid.appendChild(createExtraTile('Books', books, groupId))
  if (music.length) grid.appendChild(createExtraTile('Music', music, groupId))

  const existing = Array.from(grid.children).reduce((sum, tile) => tile.classList.contains(injectedClass) ? sum : sum + readCount(tile), 0)
  setMetric(card, 'ITEMS', existing + books.length + music.length)
  sortGrid(grid, { Books: books.length, Music: music.length })
}

async function loadExtra(groupId) {
  if (cache.has(groupId)) return cache.get(groupId)
  if (loading.has(groupId)) return null
  loading.add(groupId)
  try {
    const [bookResult, musicResult] = await Promise.all([
      getBookItems(groupId).catch(() => ({ books: [] })),
      getMusicItems(groupId).catch(() => ({ tracks: [] })),
    ])
    const data = { books: bookResult.books || [], music: musicResult.tracks || [] }
    cache.set(groupId, data)
    return data
  } finally {
    loading.delete(groupId)
  }
}

function groupCards() {
  return Array.from(document.querySelectorAll('article')).filter((card) => /Content overview/i.test(text(card)) && extractGroupId(card))
}

function refreshOverviewCards() {
  if (!/^\/(groups|cliques|g)(\/|$)/.test(window.location.pathname)) return
  groupCards().forEach(async (card) => {
    const groupId = extractGroupId(card)
    const cached = cache.get(groupId)
    if (cached) updateCard(card, groupId, cached)
    const data = await loadExtra(groupId)
    if (data) updateCard(card, groupId, data)
  })
}

function schedule() {
  if (window.__cliqueOverviewBooksFrame) cancelAnimationFrame(window.__cliqueOverviewBooksFrame)
  window.__cliqueOverviewBooksFrame = requestAnimationFrame(refreshOverviewCards)
}

if (typeof window !== 'undefined') {
  window.addEventListener('load', schedule)
  window.addEventListener('popstate', schedule)
  document.addEventListener('click', () => setTimeout(schedule, 120), true)
  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true })
  schedule()
}
