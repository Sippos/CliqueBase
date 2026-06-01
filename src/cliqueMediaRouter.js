import { ACTIVE_GROUP_STORAGE_KEY } from './lib/groups.js'

const cliqueMediaPaths = {
  movies: '/movies',
  series: '/series',
  games: '/games',
  videos: '/videos',
  music: '/music',
}

const scopedMediaPaths = new Set(['/movies', '/series', '/games'])

function getActiveCliqueId() {
  return localStorage.getItem(ACTIVE_GROUP_STORAGE_KEY) || ''
}

function setActiveCliqueId(groupId) {
  if (!groupId) return ''
  localStorage.setItem(ACTIVE_GROUP_STORAGE_KEY, groupId)
  return groupId
}

function getRouteCliqueId(url) {
  const match = url.pathname.match(/^\/(?:cliques|g)\/([^/?#]+)/)
  return match?.[1] ? decodeURIComponent(match[1]) : ''
}

function getUrlCliqueId(url) {
  return url.searchParams.get('clique') || url.searchParams.get('group') || url.searchParams.get('scope') || getRouteCliqueId(url)
}

function syncCliqueFromUrl(url = new URL(window.location.href)) {
  return setActiveCliqueId(getUrlCliqueId(url)) || getActiveCliqueId()
}

function mediaPathFromUrl(url) {
  const media = url.searchParams.get('media')
  return media ? cliqueMediaPaths[media] || null : null
}

function isGroupsMediaUrl(url) {
  return url.pathname === '/groups' && Boolean(url.searchParams.get('media'))
}

function scopedMediaUrl(path, groupId) {
  if (!path || !groupId || !scopedMediaPaths.has(path)) return path
  const url = new URL(path, window.location.origin)
  url.searchParams.set('clique', groupId)
  return `${url.pathname}${url.search}${url.hash}`
}

function goToCliqueMedia(path, groupId = getActiveCliqueId(), replace = false) {
  const nextPath = scopedMediaUrl(path, groupId)
  if (!nextPath) return
  if (replace) window.location.replace(nextPath)
  else window.location.assign(nextPath)
}

function handleCliqueMediaClick(event) {
  const link = event.target?.closest?.('a[href]')
  if (!link) return

  const currentCliqueId = syncCliqueFromUrl()
  if (!currentCliqueId) return

  const url = new URL(link.href, window.location.origin)

  if (isGroupsMediaUrl(url)) {
    const path = mediaPathFromUrl(url)
    if (!path) return
    event.preventDefault()
    event.stopPropagation()
    goToCliqueMedia(path, currentCliqueId)
    return
  }

  if (scopedMediaPaths.has(url.pathname) && !getUrlCliqueId(url)) {
    event.preventDefault()
    event.stopPropagation()
    goToCliqueMedia(url.pathname, currentCliqueId)
  }
}

function redirectCurrentCliqueMediaUrl() {
  const url = new URL(window.location.href)
  const currentCliqueId = syncCliqueFromUrl(url)
  if (!currentCliqueId) return

  if (isGroupsMediaUrl(url)) {
    const path = mediaPathFromUrl(url)
    if (path) goToCliqueMedia(path, currentCliqueId, true)
    return
  }

  if (scopedMediaPaths.has(url.pathname) && !getUrlCliqueId(url)) {
    goToCliqueMedia(url.pathname, currentCliqueId, true)
  }
}

if (typeof window !== 'undefined') {
  syncCliqueFromUrl()
  document.addEventListener('click', handleCliqueMediaClick, true)
  window.addEventListener('load', redirectCurrentCliqueMediaUrl)
  redirectCurrentCliqueMediaUrl()
}
