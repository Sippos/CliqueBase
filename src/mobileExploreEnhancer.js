import { searchMembersByProfileName, shareMediaWithMember } from './lib/communityShare.js'

function getItemType(title = '') {
  const heading = [...document.querySelectorAll('button[aria-label], h1, h2, h3')]
    .map((node) => node.textContent || '')
    .find((text) => /movies|series|games/i.test(text)) || ''
  if (/series/i.test(heading)) return 'series'
  if (/games/i.test(heading)) return 'game'
  return 'movie'
}

function currentSharePayload(article) {
  const title = article?.querySelector('h2')?.textContent?.trim() || article?.querySelector('h3')?.textContent?.trim() || 'CliqueBase pick'
  return {
    id: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || title,
    title,
    category: getItemType(title),
  }
}

function ensureNavVisible() {
  const nav = document.querySelector('.mobile-bottom-nav')
  if (!nav) return
  nav.style.setProperty('display', 'grid', 'important')
  nav.style.setProperty('z-index', '2147483000', 'important')
}

function enhanceShareSheet() {
  const overlays = [...document.querySelectorAll('div[class*="z-[70]"] article')]
  overlays.forEach((article) => {
    if (article.dataset.memberShareEnhanced === 'true') return
    const buttons = [...article.querySelectorAll('button')]
    const cliqueBaseButton = buttons.find((button) => /cliquebase/i.test(button.textContent || ''))
    if (!cliqueBaseButton) return
    article.dataset.memberShareEnhanced = 'true'
    cliqueBaseButton.addEventListener('click', (event) => {
      event.preventDefault()
      event.stopPropagation()
      openMemberSearch(article)
    }, true)
  })
}

function openMemberSearch(article) {
  let panel = article.querySelector('[data-cliquebase-member-share]')
  if (!panel) {
    panel = document.createElement('section')
    panel.setAttribute('data-cliquebase-member-share', 'true')
    panel.innerHTML = `
      <input data-cliquebase-member-input type="search" placeholder="Search friends or members by profile name" autocomplete="off" />
      <div data-cliquebase-member-results><div>Type at least 2 characters to search CliqueBase members.</div></div>
    `
    article.appendChild(panel)
    const input = panel.querySelector('[data-cliquebase-member-input]')
    input?.focus()
    input?.addEventListener('input', () => runMemberSearch(article, input.value))
  } else {
    panel.querySelector('input')?.focus()
  }
}

let searchTimer = null
function runMemberSearch(article, query) {
  window.clearTimeout(searchTimer)
  const results = article.querySelector('[data-cliquebase-member-results]')
  if (!results) return
  if ((query || '').trim().length < 2) {
    results.innerHTML = '<div>Type at least 2 characters to search CliqueBase members.</div>'
    return
  }
  results.innerHTML = '<div>Searching members…</div>'
  searchTimer = window.setTimeout(async () => {
    try {
      const members = await searchMembersByProfileName(query, 6)
      if (!members.length) {
        results.innerHTML = '<div>No matching members found.<small>Try their exact profile name.</small></div>'
        return
      }
      results.innerHTML = ''
      members.forEach((member) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.innerHTML = `${member.displayName}<small>${member.libraryCount || 0} public items${member.isFriend ? ' · friend' : ''}</small>`
        button.addEventListener('click', async (event) => {
          event.preventDefault()
          event.stopPropagation()
          await shareWithMember(article, member, button)
        })
        results.appendChild(button)
      })
    } catch (error) {
      results.innerHTML = `<div>${error?.message || 'Member search is not available yet.'}<small>Use copy link or WhatsApp for now.</small></div>`
    }
  }, 250)
}

async function shareWithMember(article, member, button) {
  const item = currentSharePayload(article)
  button.disabled = true
  button.textContent = `Sharing with ${member.displayName}…`
  try {
    await shareMediaWithMember(item.category, item, member.id)
    button.textContent = `Shared with ${member.displayName}`
  } catch (error) {
    button.disabled = false
    button.innerHTML = `${member.displayName}<small>${error?.message || 'Could not share with this member.'}</small>`
  }
}

function enhance() {
  ensureNavVisible()
  enhanceShareSheet()
}

if (typeof window !== 'undefined') {
  enhance()
  const observer = new MutationObserver(enhance)
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true })
  window.addEventListener('popstate', ensureNavVisible)
  window.setInterval(ensureNavVisible, 750)
}
