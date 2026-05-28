export const HANDLE_STORAGE_KEY = 'cliquebase_handle'

export function cleanHandle(value) {
  return String(value || '').trim()
}

export function getHandleKey(value) {
  return cleanHandle(value).toLowerCase()
}

export function getSavedHandle() {
  const saved = cleanHandle(localStorage.getItem(HANDLE_STORAGE_KEY) || '')

  if (saved) {
    localStorage.setItem(HANDLE_STORAGE_KEY, saved)
  }

  return saved
}

export function saveSharedHandle(value) {
  const clean = cleanHandle(value)
  if (!clean) return ''

  localStorage.setItem(HANDLE_STORAGE_KEY, clean)
  return clean
}
