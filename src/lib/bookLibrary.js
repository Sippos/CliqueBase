import { getActiveGroupId } from './groups.js'
import { getCurrentUser, hasSupabase, supabase } from './supabaseClient.js'

const BOOK_STORAGE_KEY = 'cliquebase:book-items:v1'
const OPEN_LIBRARY_SEARCH = 'https://openlibrary.org/search.json'
const OPEN_LIBRARY_WORK = 'https://openlibrary.org'
const MAX_ENRICHED_SEARCH_RESULTS = 10
const MAX_ENRICHED_SAVED_BOOKS = 12

function clean(value) {
  return String(value || '').trim()
}

function compact(values) {
  return values.map(clean).filter(Boolean).join(' · ')
}

function localId() {
  return `book-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function coverFromId(coverId, size = 'L') {
  return coverId ? `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg` : ''
}

function uniqueSubjects(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map(clean).filter(Boolean))).slice(0, 12)
}

function descriptionText(value) {
  if (!value) return ''
  if (typeof value === 'string') return clean(value)
  if (typeof value === 'object') return clean(value.value || value.text || '')
  return ''
}

function workKeyFromSourceId(sourceId = '') {
  const value = clean(sourceId)
  if (!value) return ''
  if (value.startsWith('/works/')) return value
  if (/^OL\d+W$/i.test(value)) return `/works/${value}`
  return ''
}

function normalizeRow(row = {}) {
  const authors = Array.isArray(row.authors) ? row.authors.filter(Boolean) : clean(row.authors || row.author).split(',').map(clean).filter(Boolean)
  const title = clean(row.title || row.name) || 'Untitled book'
  const cover = clean(row.cover || row.poster || row.image || row.coverUrl)
  const subjects = uniqueSubjects(row.subjects || row.genres || row.categories || [])
  return {
    id: row.id || localId(),
    source: clean(row.source) || 'Open Library',
    sourceId: clean(row.source_id || row.sourceId),
    title,
    authors,
    author: authors.join(', '),
    year: clean(row.year || row.first_publish_year || row.firstPublishYear),
    isbn: clean(row.isbn || row.primary_isbn || row.primaryIsbn),
    subjects,
    genres: subjects,
    overview: clean(row.overview || row.description || row.subtitle),
    url: clean(row.url),
    poster: cover,
    cover,
    readingStatus: clean(row.reading_status || row.readingStatus) || 'want',
    ageBand: clean(row.age_band || row.ageBand) || 'unknown',
    nominated_by: clean(row.nominated_by || row.nominatedBy) || 'Someone',
    groupId: row.group_id || row.groupId || null,
    groupName: clean(row.group_name || row.groupName),
    saved: Boolean(row.saved),
    createdAt: row.created_at || row.createdAt || new Date().toISOString(),
    updatedAt: row.updated_at || row.updatedAt || null,
    subtitle: compact([authors.join(', '), row.year || row.first_publish_year]),
    metadataReady: Boolean(cover || authors.length || row.year || subjects.length || row.overview || row.description),
  }
}

function normalizeOpenLibraryDoc(doc = {}) {
  const sourceId = clean(doc.key || (doc.edition_key || [])[0] || doc.cover_edition_key || doc.lending_edition_s)
  const isbn = Array.isArray(doc.isbn) ? doc.isbn[0] : ''
  return normalizeRow({
    id: sourceId || localId(),
    source: 'Open Library',
    sourceId,
    title: doc.title,
    authors: Array.isArray(doc.author_name) ? doc.author_name.slice(0, 5) : [],
    year: doc.first_publish_year || '',
    isbn,
    subjects: Array.isArray(doc.subject) ? doc.subject.slice(0, 10) : [],
    overview: Array.isArray(doc.first_sentence) ? doc.first_sentence[0] : '',
    url: sourceId ? `${OPEN_LIBRARY_WORK}${sourceId.startsWith('/') ? sourceId : `/works/${sourceId}`}` : '',
    poster: coverFromId(doc.cover_i),
  })
}

async function fetchOpenLibraryWork(sourceId) {
  const workKey = workKeyFromSourceId(sourceId)
  if (!workKey) return null
  try {
    const response = await fetch(`${OPEN_LIBRARY_WORK}${workKey}.json`)
    if (!response.ok) return null
    return response.json()
  } catch (error) {
    console.warn('Open Library work fetch failed:', error.message || error)
    return null
  }
}

async function enrichBookMetadata(book) {
  const normalized = normalizeRow(book)
  const needsOverview = !normalized.overview
  const needsSubjects = !normalized.subjects?.length
  if (!needsOverview && !needsSubjects) return normalized

  const work = await fetchOpenLibraryWork(normalized.sourceId)
  if (!work) return normalized
  const overview = descriptionText(work.description) || normalized.overview
  const subjects = uniqueSubjects([
    ...(normalized.subjects || []),
    ...(work.subjects || []),
    ...(work.subject_places || []),
    ...(work.subject_people || []),
    ...(work.subject_times || []),
  ])
  return normalizeRow({
    ...normalized,
    overview,
    subjects,
    url: normalized.url || `${OPEN_LIBRARY_WORK}${work.key || normalized.sourceId}`,
  })
}

async function enrichBookList(books, limit = MAX_ENRICHED_SAVED_BOOKS) {
  const normalized = books.map(normalizeRow)
  const enriched = await Promise.all(normalized.slice(0, limit).map(enrichBookMetadata))
  return [...enriched, ...normalized.slice(limit)]
}

function readLocalBooks() {
  if (typeof window === 'undefined') return []
  try {
    const parsed = JSON.parse(window.localStorage.getItem(BOOK_STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.map(normalizeRow) : []
  } catch {
    return []
  }
}

function writeLocalBooks(books) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(BOOK_STORAGE_KEY, JSON.stringify(books.map(normalizeRow)))
}

function localScopeMatches(book, groupId) {
  const activeGroupId = groupId || ''
  if (activeGroupId) return book.groupId === activeGroupId
  return !book.groupId
}

export async function searchBookCatalog({ query = '', title = '', author = '' } = {}) {
  const term = clean(query || title || author)
  if (!term) return []
  try {
    const params = new URLSearchParams({ q: term, limit: '16', fields: 'key,title,author_name,first_publish_year,cover_i,isbn,subject,first_sentence,cover_edition_key,edition_key' })
    const response = await fetch(`${OPEN_LIBRARY_SEARCH}?${params}`)
    if (!response.ok) throw new Error(`Book search failed: ${response.status}`)
    const data = await response.json()
    const basicResults = Array.isArray(data?.docs) ? data.docs.map(normalizeOpenLibraryDoc).filter((book) => book.title) : []
    const enriched = await Promise.all(basicResults.slice(0, MAX_ENRICHED_SEARCH_RESULTS).map(enrichBookMetadata))
    return [...enriched, ...basicResults.slice(MAX_ENRICHED_SEARCH_RESULTS)]
  } catch (error) {
    console.warn('Book search failed:', error.message || error)
    return []
  }
}

export async function getBookItems(groupId = getActiveGroupId()) {
  const activeGroupId = groupId || null
  if (hasSupabase && supabase) {
    try {
      const user = await getCurrentUser().catch(() => null)
      if (user?.id) {
        let query = supabase.from('book_items').select('*').order('created_at', { ascending: false })
        query = activeGroupId ? query.eq('group_id', activeGroupId) : query.is('group_id', null).eq('owner_id', user.id)
        const { data, error } = await query
        if (error) throw error
        return { books: await enrichBookList(data || []), source: 'remote' }
      }
    } catch (error) {
      console.warn('Books remote load failed, using local books:', error.message || error)
    }
  }
  const localBooks = readLocalBooks().filter((book) => localScopeMatches(book, activeGroupId))
  return { books: await enrichBookList(localBooks), source: 'local' }
}

export async function saveBookItem(book, { group = null, groupId = '', groupName = '', nominatedBy = '', saved = false, readingStatus = '' } = {}) {
  const scopedGroupId = group?.id || groupId || getActiveGroupId() || null
  const normalized = await enrichBookMetadata(normalizeRow({ ...book, groupId: scopedGroupId, groupName: group?.name || groupName || book.groupName || '', nominated_by: nominatedBy || book.nominated_by, saved, readingStatus: readingStatus || book.readingStatus }))

  if (hasSupabase && supabase) {
    try {
      const user = await getCurrentUser().catch(() => null)
      if (user?.id) {
        const payload = {
          owner_id: user.id,
          group_id: scopedGroupId,
          source: normalized.source,
          source_id: normalized.sourceId || normalized.id || null,
          title: normalized.title,
          authors: normalized.authors,
          year: normalized.year || null,
          isbn: normalized.isbn || null,
          overview: normalized.overview || null,
          url: normalized.url || null,
          poster: normalized.poster || null,
          subjects: normalized.subjects || [],
          reading_status: normalized.readingStatus || 'want',
          age_band: normalized.ageBand || 'unknown',
          nominated_by: normalized.nominated_by,
          saved: Boolean(normalized.saved),
          updated_at: new Date().toISOString(),
        }
        const { data, error } = await supabase.from('book_items').insert(payload).select().single()
        if (error) throw error
        return { book: normalizeRow(data), source: 'remote' }
      }
    } catch (error) {
      console.warn('Books remote save failed, saving locally:', error.message || error)
    }
  }

  const localBook = normalizeRow({ ...normalized, id: normalized.id || localId(), groupId: scopedGroupId })
  const existing = readLocalBooks()
  writeLocalBooks([localBook, ...existing.filter((item) => item.id !== localBook.id)])
  return { book: localBook, source: 'local' }
}

export async function updateBookStatus(book, readingStatus = 'want') {
  if (hasSupabase && supabase && !String(book.id || '').startsWith('book-')) {
    try {
      const { data, error } = await supabase.from('book_items').update({ reading_status: readingStatus, updated_at: new Date().toISOString() }).eq('id', book.id).select().single()
      if (error) throw error
      return { book: normalizeRow(data), source: 'remote' }
    } catch (error) {
      console.warn('Books remote update failed, updating local copy:', error.message || error)
    }
  }

  const existing = readLocalBooks()
  const nextBook = normalizeRow({ ...book, readingStatus })
  writeLocalBooks(existing.map((item) => item.id === book.id ? nextBook : item))
  return { book: nextBook, source: 'local' }
}

export async function deleteBookItem(book) {
  if (hasSupabase && supabase && !String(book.id || '').startsWith('book-')) {
    try {
      const { error } = await supabase.from('book_items').delete().eq('id', book.id)
      if (error) throw error
      return { source: 'remote' }
    } catch (error) {
      console.warn('Books remote delete failed, deleting local copy:', error.message || error)
    }
  }
  writeLocalBooks(readLocalBooks().filter((item) => item.id !== book.id))
  return { source: 'local' }
}