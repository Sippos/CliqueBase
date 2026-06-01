import { getSavedHandle } from './lib/handle.js'

const NOTE_STORAGE_PREFIX = 'cliquebase_suggested_pick_note:'
const NOTE_SECTION_ID = 'cliquebase-suggested-pick-note'
const CLIQUE_CARD_POLISH_ATTR = 'data-clique-card-polished'

function normalize(value) {
  return String(value || '').trim()
}

function noteKey({ title, source }) {
  return `${NOTE_STORAGE_PREFIX}${normalize(source).toLowerCase()}::${normalize(title).toLowerCase()}`
}

function findDetailModal() {
  return Array.from(document.querySelectorAll('article')).find((article) => {
    const title = article.querySelector('h2')?.textContent
    const body = article.textContent || ''
    return title && body.includes('Suggested by') && body.includes('Copy to my library')
  })
}

function pickInfo(article) {
  const title = normalize(article.querySelector('h2')?.textContent)
  const sourceLine = Array.from(article.querySelectorAll('p')).find((node) => (node.textContent || '').includes('Suggested by'))
  const sourceText = normalize(sourceLine?.textContent)
  const suggestedBy = normalize(sourceText.split('Suggested by').pop())
  const source = normalize(sourceText.replace(`Suggested by ${suggestedBy}`, '').replace('·', ''))
  return { title, source, suggestedBy }
}

function noteSection({ key, title, isOwner, suggestedBy }) {
  const existingNote = localStorage.getItem(key) || ''
  const section = document.createElement('section')
  section.id = NOTE_SECTION_ID
  section.className = 'mt-5 rounded-3xl border border-white/10 bg-white/[0.03] p-4'

  if (isOwner) {
    section.innerHTML = `
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="text-xs font-bold uppercase tracking-[0.22em] text-neutral-500">Your note</h3>
          <p class="mt-1 text-xs text-neutral-500">Visible here because you suggested ${escapeHtml(title)}.</p>
        </div>
        <span class="rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold text-neutral-300">Suggested by you</span>
      </div>
      <textarea rows="3" maxlength="280" placeholder="Why did you suggest this?" class="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-neutral-950 px-4 py-3 text-sm leading-6 text-white outline-none transition focus:border-white/30">${escapeHtml(existingNote)}</textarea>
      <div class="mt-2 flex items-center justify-between gap-3">
        <p class="text-xs text-neutral-500"><span data-count>${existingNote.length}</span>/280</p>
        <button type="button" class="rounded-2xl bg-white px-4 py-2 text-sm font-black text-neutral-950 transition hover:bg-neutral-200">Save note</button>
      </div>
      <p data-status class="mt-2 hidden text-xs font-semibold text-neutral-300"></p>
    `

    const textarea = section.querySelector('textarea')
    const counter = section.querySelector('[data-count]')
    const button = section.querySelector('button')
    const status = section.querySelector('[data-status]')

    textarea.addEventListener('input', () => {
      counter.textContent = String(textarea.value.length)
    })

    button.addEventListener('click', () => {
      const value = normalize(textarea.value)
      if (value) localStorage.setItem(key, value)
      else localStorage.removeItem(key)
      status.textContent = value ? 'Note saved.' : 'Note cleared.'
      status.classList.remove('hidden')
      setTimeout(() => status.classList.add('hidden'), 1800)
    })
  } else if (existingNote) {
    section.innerHTML = `
      <h3 class="text-xs font-bold uppercase tracking-[0.22em] text-neutral-500">${escapeHtml(suggestedBy)}'s note</h3>
      <p class="mt-2 text-sm leading-6 text-neutral-300">${escapeHtml(existingNote)}</p>
    `
  } else {
    return null
  }

  return section
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function enhanceDetailModal() {
  const article = findDetailModal()
  if (!article || article.querySelector(`#${NOTE_SECTION_ID}`)) return

  const info = pickInfo(article)
  if (!info.title || !info.suggestedBy) return

  const handle = normalize(getSavedHandle()).toLowerCase()
  const isOwner = handle && info.suggestedBy.toLowerCase() === handle
  const section = noteSection({ key: noteKey(info), title: info.title, isOwner, suggestedBy: info.suggestedBy })
  if (!section) return

  const overview = Array.from(article.querySelectorAll('section')).find((node) => (node.textContent || '').includes('Overview'))
  const target = overview || article.querySelector('dl')
  if (target) target.insertAdjacentElement('afterend', section)
}

function polishCliqueFlipCards() {
  const openLinks = Array.from(document.querySelectorAll('a')).filter((link) => normalize(link.textContent).includes('Open clique voting list'))

  openLinks.forEach((openLink) => {
    const backFace = openLink.closest('[style*="rotateY(180deg)"]')
    if (!backFace || backFace.getAttribute(CLIQUE_CARD_POLISH_ATTR) === 'true') return
    backFace.setAttribute(CLIQUE_CARD_POLISH_ATTR, 'true')

    const flipButton = Array.from(backFace.querySelectorAll('button')).find((button) => normalize(button.textContent).toLowerCase() === 'flip back')
    if (flipButton) {
      flipButton.textContent = 'Actions'
      flipButton.className = 'rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400'
    }

    const actions = openLink.parentElement
    if (actions) actions.className = 'mt-5 grid grid-cols-2 gap-2'

    openLink.textContent = 'Ladder ↗'
    openLink.className = 'inline-flex items-center justify-center rounded-2xl bg-white px-3 py-3 text-sm font-black text-neutral-950 transition hover:bg-neutral-200'

    const shareButton = Array.from(backFace.querySelectorAll('button')).find((button) => normalize(button.textContent).toLowerCase().startsWith('share'))
    if (shareButton) {
      shareButton.textContent = 'Share'
      shareButton.className = 'inline-flex items-center justify-center rounded-2xl border border-white/10 px-3 py-3 text-sm font-black text-white transition hover:bg-white hover:text-neutral-950'
    }

    const copyButton = Array.from(backFace.querySelectorAll('button')).find((button) => normalize(button.textContent).toLowerCase().includes('copy'))
    if (copyButton) {
      copyButton.textContent = copyButton.disabled ? 'Copying…' : 'Copy'
      copyButton.className = 'col-span-2 inline-flex items-center justify-center rounded-2xl border border-white/10 px-3 py-3 text-sm font-black text-white transition hover:bg-white hover:text-neutral-950 disabled:opacity-60'
    }

    const hint = document.createElement('p')
    hint.className = 'col-span-2 mt-1 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-600'
    hint.textContent = 'Tap again to flip back'
    actions?.appendChild(hint)
  })
}

function enhancePage() {
  enhanceDetailModal()
  polishCliqueFlipCards()
}

if (typeof window !== 'undefined') {
  const observer = new MutationObserver(() => enhancePage())
  observer.observe(document.body, { childList: true, subtree: true })
  window.addEventListener('load', enhancePage)
  enhancePage()
}
