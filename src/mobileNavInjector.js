const iconSvg = {
  explore: `
    <circle cx="12" cy="12" r="9" />
    <path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z" />
  `,
  dashboard: `
    <rect x="3" y="3" width="7" height="8" rx="2" />
    <rect x="14" y="3" width="7" height="5" rx="2" />
    <rect x="14" y="12" width="7" height="9" rx="2" />
    <rect x="3" y="15" width="7" height="6" rx="2" />
  `,
  users: `
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  `,
}

const items = [
  { href: '/explore', label: 'Explore', icon: 'explore', match: (path) => path === '/explore' || path === '/' },
  { href: '/dashboard', label: 'Library', icon: 'dashboard', match: (path) => path === '/dashboard' || path === '/movies' || path === '/series' || path === '/games' || path === '/videos' || path === '/music' },
  { href: '/groups', label: 'Cliques', icon: 'users', match: (path) => path === '/groups' || path.startsWith('/cliques') },
]

function currentPath() {
  return window.location.pathname || '/explore'
}

function renderIcon(name) {
  return `
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      ${iconSvg[name] || iconSvg.dashboard}
    </svg>
  `
}

function buildLink(item) {
  const link = document.createElement('a')
  link.href = item.href
  link.setAttribute('aria-label', item.label)
  link.innerHTML = `${renderIcon(item.icon)}<span>${item.label}</span>`
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
