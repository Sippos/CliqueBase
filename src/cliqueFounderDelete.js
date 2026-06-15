import { ACTIVE_GROUP_STORAGE_KEY } from './lib/groups.js'
import { getCurrentUser, hasSupabase, supabase } from './lib/supabaseClient.js'

const DELETE_CLASS = 'clique-founder-delete-button'
const STATUS_CLASS = 'clique-founder-delete-status'
const CATEGORY_TABLE = {
  movies: { table: 'movies', idColumn: 'movie_id' },
  movie: { table: 'movies', idColumn: 'movie_id' },
  series: { table: 'series', idColumn: 'series_id' },
  games: { table: 'games', idColumn: 'game_id' },
  game: { table: 'games', idColumn: 'game_id' },
  videos: { table: 'videos', idColumn: 'video_id' },
  video: { table: 'videos', idColumn: 'video_id' },
  music: { table: 'music_items', idColumn: 'id' },
  book: { table: 'book_items', idColumn: 'id' },
  books: { table: 'book_items', idColumn: 'id' },
}

function clean(value = '') {
  return String(value || '').trim()
}

function getCliqueId() {
  const match = window.location.pathname.match(/^\/(?:cliques|g)\/([^/?#]+)/)
  if (match?.[1]) return decodeURIComponent(match[1])
  const params = new URLSearchParams(window.location.search)
  return params.get('clique') || params.get('group') || params.get('scope') || window.localStorage.getItem(ACTIVE_GROUP_STORAGE_KEY) || ''
}

function categoryFromText(value = '') {
  const text = clean(value).toLowerCase()
  if (text.includes('book')) return 'books'
  if (text.includes('music') || text.includes('song')) return 'music'
  if (text.includes('movie')) return 'movies'
  if (text.includes('series')) return 'series'
  if (text.includes('game')) return 'games'
  if (text.includes('video')) return 'videos'
  return ''
}

function isCliqueLibraryPage() {
  return /^\/(cliques|g)\//.test(window.location.pathname) || Boolean(new URLSearchParams(window.location.search).get('clique'))
}

function setStatus(message, type = 'success') {
  let node = document.querySelector(`.${STATUS_CLASS}`)
  if (!node) {
    node = document.createElement('div')
    node.className = STATUS_CLASS
    Object.assign(node.style, {
      position: 'fixed',
      left: '50%',
      bottom: '1.25rem',
      transform: 'translateX(-50%)',
      zIndex: '160',
      borderRadius: '1rem',
      padding: '0.75rem 1rem',
      fontSize: '0.875rem',
      fontWeight: '800',
      boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
      maxWidth: 'min(92vw, 34rem)',
      textAlign: 'center',
    })
    document.body.appendChild(node)
  }
  node.textContent = message
  node.style.background = type === 'error' ? '#fecdd3' : '#fff'
  node.style.color = '#0a0a0a'
  window.clearTimeout(window.__cliqueFounderDeleteStatusTimer)
  window.__cliqueFounderDeleteStatusTimer = window.setTimeout(() => node.remove(), 2800)
}

async function currentRole(groupId) {
  if (!hasSupabase || !supabase || !groupId) return ''
  const user = await getCurrentUser().catch(() => null)
  if (!user?.id) return ''
  const { data, error } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) return ''
  return data?.role || ''
}

function canDeleteRole(role) {
  return ['owner', 'admin', 'moderator'].includes(role)
}

function findCategorySection(card) {
  return card.closest('section[id^="library-"]') || card.closest('section') || card
}

function getCategory(card) {
  const section = findCategorySection(card)
  const idCategory = clean(section?.id || '').replace(/^library-/, '')
  return categoryFromText(idCategory) || categoryFromText(section?.textContent || '') || categoryFromText(card?.textContent || '')
}

function getTitle(card) {
  const headings = Array.from(card.querySelectorAll('h1,h2,h3'))
    .map((node) => clean(node.textContent))
    .filter(Boolean)
  return headings[0] || ''
}

function getCardInfo(card) {
  const category = getCategory(card)
  const title = getTitle(card)
  return { category, title, config: CATEGORY_TABLE[category] }
}

async function deleteByTitle({ groupId, category, title, config }) {
  if (!hasSupabase || !supabase) throw new Error('Sign in first.')
  if (!groupId) throw new Error('Open a clique first.')
  if (!config || !title) throw new Error('Could not identify this item.')

  const role = await currentRole(groupId)
  if (!canDeleteRole(role)) throw new Error('Only the clique founder, admin, or moderator can delete items.')

  const { error, count } = await supabase
    .from(config.table)
    .delete({ count: 'exact' })
    .eq('group_id', groupId)
    .eq('title', title)

  if (error) throw error
  if (!count) throw new Error(`No matching ${category} item found to delete.`)
  return count
}

async function handleDelete(card) {
  const groupId = getCliqueId()
  const info = getCardInfo(card)
  if (!info.title) return setStatus('Could not identify this item.', 'error')
  const ok = window.confirm(`Delete "${info.title}" from this clique?`)
  if (!ok) return
  try {
    await deleteByTitle({ groupId, ...info })
    card.style.opacity = '0.35'
    card.style.pointerEvents = 'none'
    setStatus(`Deleted "${info.title}" from this clique.`)
    window.setTimeout(() => window.location.reload(), 650)
  } catch (error) {
    setStatus(error.message || 'Could not delete that item.', 'error')
  }
}

function makeButton(card) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = DELETE_CLASS
  button.textContent = 'Delete'
  button.title = 'Delete from this clique'
  Object.assign(button.style, {
    position: 'absolute',
    left: '0.55rem',
    top: '0.55rem',
    zIndex: '35',
    border: '1px solid rgba(255,255,255,0.16)',
    borderRadius: '999px',
    background: 'rgba(10,10,10,0.68)',
    color: '#fff',
    padding: '0.35rem 0.62rem',
    fontSize: '0.68rem',
    fontWeight: '900',
    letterSpacing: '0.02em',
    backdropFilter: 'blur(12px)',
  })
  button.addEventListener('click', (event) => {
    event.preventDefault()
    event.stopPropagation()
    handleDelete(card)
  })
  return button
}

function isShelfCard(card) {
  const section = findCategorySection(card)
  if (!section?.id?.startsWith?.('library-')) return false
  return Boolean(getTitle(card) && getCategory(card))
}

async function applyDeleteButtons() {
  if (!isCliqueLibraryPage()) return
  const groupId = getCliqueId()
  if (!groupId) return
  const role = await currentRole(groupId)
  if (!canDeleteRole(role)) return

  document.querySelectorAll('article').forEach((card) => {
    if (!isShelfCard(card) || card.querySelector(`.${DELETE_CLASS}`)) return
    const style = window.getComputedStyle(card)
    if (style.position === 'static') card.style.position = 'relative'
    card.appendChild(makeButton(card))
  })
}

function schedule() {
  if (window.__cliqueFounderDeleteFrame) cancelAnimationFrame(window.__cliqueFounderDeleteFrame)
  window.__cliqueFounderDeleteFrame = requestAnimationFrame(applyDeleteButtons)
}

if (typeof window !== 'undefined') {
  window.addEventListener('load', schedule)
  window.addEventListener('popstate', schedule)
  document.addEventListener('click', () => setTimeout(schedule, 120), true)
  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true })
  schedule()
}
