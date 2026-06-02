const items = [
  { href: '/explore', label: 'Explore', icon: '◎', match: (path) => path === '/explore' || path === '/' },
  { href: '/dashboard', label: 'Library', icon: '▦', match: (path) => path === '/dashboard' || path === '/movies' || path === '/series' || path === '/games' || path === '/videos' || path === '/music' },
  { href: '/groups', label: 'Cliques', icon: '♧', match: (path) => path === '/groups' || path.startsWith('/cliques') },
]

function currentPath() {
  return window.location.pathname || '/explore'
}

function buildLink(item) {
  const link = document.createElement('a')
  link.href = item.href
  link.setAttribute('aria-label', item.label)
  link.innerHTML = `<span aria-hidden="true">${item.icon}</span><span>${item.label}</span>`
  return link
}

function updateActive(nav) {
  const path = currentPath()
  nav.querySelectorAll('a').forEach((link, index) => {
    const selected = items[index]?.match(path)
    if (selected) link.setAttribute('aria-current', 'page')
    else link.removeAttribute('aria-current')
  })
}

function ensureMobileNav() {
  let nav = document.querySelector('.mobile-bottom-nav')
  if (!nav) {
    nav = document.createElement('nav')
    nav.className = 'mobile-bottom-nav'
    nav.setAttribute('aria-label', 'Mobile primary navigation')
    items.forEach((item) => nav.appendChild(buildLink(item)))
    document.body.appendChild(nav)
  }
  updateActive(nav)
}

if (typeof window !== 'undefined') {
  ensureMobileNav()
  window.addEventListener('popstate', ensureMobileNav)
  window.addEventListener('pushstate', ensureMobileNav)
  window.addEventListener('replacestate', ensureMobileNav)
  window.setInterval(ensureMobileNav, 800)
}
