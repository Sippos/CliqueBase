import { ACTIVE_GROUP_STORAGE_KEY } from './lib/groups.js'

const cliqueMediaPaths = {
  movies: '/movies',
  series: '/series',
  games: '/games',
  videos: '/videos',
  music: '/music',
}

function hasActiveClique() {
  return Boolean(localStorage.getItem(ACTIVE_GROUP_STORAGE_KEY))
}

function mediaPathFromUrl(url) {
  const media = url.searchParams.get('media')
  return media ? cliqueMediaPaths[media] || null : null
}

function isGroupsMediaUrl(url) {
  return url.pathname === '/groups' && Boolean(url.searchParams.get('media'))
}

function goToCliqueMedia(path, replace = false) {
  if (!path) return
  if (replace) window.location.replace(path)
  else window.location.assign(path)
}

function handleCliqueMediaClick(event) {
  const link = event.target?.closest?.('a[href]')
  if (!link || !hasActiveClique()) return

  const url = new URL(link.href, window.location.origin)
  if (!isGroupsMediaUrl(url)) return

  const path = mediaPathFromUrl(url)
  if (!path) return

  event.preventDefault()
  event.stopPropagation()
  goToCliqueMedia(path)
}

function redirectCurrentCliqueMediaUrl() {
  if (!hasActiveClique()) return

  const url = new URL(window.location.href)
  if (!isGroupsMediaUrl(url)) return

  const path = mediaPathFromUrl(url)
  if (path) goToCliqueMedia(path, true)
}

if (typeof window !== 'undefined') {
  document.addEventListener('click', handleCliqueMediaClick, true)
  window.addEventListener('load', redirectCurrentCliqueMediaUrl)
  redirectCurrentCliqueMediaUrl()
}
