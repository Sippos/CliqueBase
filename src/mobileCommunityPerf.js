// Mobile feed performance guard.
// React's community pull-to-refresh state updates on touchmove; Android browsers can
// emit far more touchmove events than the feed can render. This capture listener lets
// the first event through, then drops extra touchmove events within a short frame
// window before React sees them. The pull interaction remains, but the full feed is
// not re-rendered for every single drag event.

const MOBILE_FEED_QUERY = '(max-width: 767px)'
const TOUCH_THROTTLE_MS = 48
let lastCommunityTouchMove = 0

function isMobileFeedTarget(target) {
  if (typeof window === 'undefined' || !window.matchMedia?.(MOBILE_FEED_QUERY).matches) return false
  if (!(target instanceof Element)) return false
  if (target.closest('[role="dialog"], .notification-panel, input, textarea, select')) return false

  const page = target.closest('main')
  return Boolean(page?.querySelector?.('.community-feed-hero'))
}

function handleCommunityTouchMove(event) {
  if (!isMobileFeedTarget(event.target)) return

  const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
  if (now - lastCommunityTouchMove < TOUCH_THROTTLE_MS) {
    event.stopImmediatePropagation()
    return
  }

  lastCommunityTouchMove = now
}

if (typeof document !== 'undefined') {
  document.addEventListener('touchmove', handleCommunityTouchMove, { capture: true, passive: true })
}
