import { useEffect, useMemo, useState } from 'react'
import PageShell from '../components/PageShell.jsx'
import { DetailPill, InfoModal, StatusMessage } from '../components/MediaBlocks.jsx'
import { getSavedHandle } from '../lib/handle.js'
import { getActiveGroup } from '../lib/groups.js'
import { deleteBookItem, getBookItems, saveBookItem, searchBookCatalog, updateBookStatus } from '../lib/bookLibrary.js'

const statusOptions = [
  { value: 'want', label: 'Want to read' },
  { value: 'reading', label: 'Reading' },
  { value: 'finished', label: 'Finished' },
]

function metaLine(book) {
  return [book.author, book.year].filter(Boolean).join(' · ') || book.source || 'Book'
}

function BookCover({ book, className = 'h-20 w-14', rounded = 'rounded-xl' }) {
  return book?.poster ? <img src={book.poster} alt="" loading="lazy" decoding="async" className={`${className} ${rounded} shrink-0 object-cover shadow-xl shadow-black/30 ring-1 ring-white/10`} /> : <div className={`${className} ${rounded} flex shrink-0 items-center justify-center bg-gradient-to-br from-amber-900/60 to-neutral-950 text-2xl shadow-xl shadow-black/30 ring-1 ring-white/10`}>📖</div>
}

function SearchForm({ draft, searching, onChange, onSubmit, onClear }) {
  return (
    <form onSubmit={onSubmit} className="rounded-[2rem] border border-amber-200/15 bg-gradient-to-br from-amber-400/12 via-white/[0.055] to-orange-500/10 p-3 shadow-2xl shadow-black/20 ring-1 ring-white/10 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-100/70">Search books</label>
          <input value={draft.query} onChange={(event) => onChange('query', event.target.value)} placeholder="Title, author, ISBN…" className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-amber-200/40" />
        </div>
        <button disabled={searching} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-neutral-950 shadow-lg shadow-white/10 transition hover:bg-neutral-200 disabled:opacity-50">{searching ? 'Searching…' : 'Search'}</button>
        <button type="button" onClick={onClear} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-neutral-300 transition hover:bg-white hover:text-neutral-950">Clear</button>
      </div>
      <p className="mt-3 text-xs leading-5 text-neutral-400">Powered by Open Library. Choose a result before adding it to your library or clique.</p>
    </form>
  )
}

function SearchResults({ results, savingId, onAdd, onInfo, onClear }) {
  if (!results.length) return null
  return (
    <section className="rounded-[2rem] border border-amber-200/15 bg-amber-300/[0.045] p-4 shadow-2xl shadow-black/20">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div><p className="text-xs uppercase tracking-[0.3em] text-amber-200/70">Search results</p><h2 className="mt-1 text-2xl font-black text-white">Choose a book</h2></div>
        <button type="button" onClick={onClear} className="rounded-2xl border border-white/10 px-3 py-2 text-xs font-bold text-neutral-300 hover:bg-white hover:text-neutral-950">Close</button>
      </div>
      <div className="grid gap-2">
        {results.map((book) => (
          <article key={`${book.source}-${book.sourceId || book.id}-${book.title}`} className="flex items-center gap-3 rounded-[1.35rem] border border-white/10 bg-neutral-950/70 p-3">
            <button type="button" onClick={() => onInfo(book)} className="shrink-0"><BookCover book={book} className="h-20 w-14" /></button>
            <div className="min-w-0 flex-1">
              <button type="button" onClick={() => onInfo(book)} className="block max-w-full truncate text-left font-black text-white hover:underline">{book.title}</button>
              <p className="mt-1 truncate text-xs text-neutral-400">{metaLine(book)}</p>
              <p className="mt-0.5 truncate text-[11px] text-neutral-600">{book.source}</p>
            </div>
            <button type="button" onClick={() => onAdd(book)} disabled={savingId === book.id} className="rounded-xl bg-white px-3 py-2 text-xs font-black text-neutral-950 hover:bg-neutral-200 disabled:opacity-50">{savingId === book.id ? 'Adding…' : 'Add'}</button>
          </article>
        ))}
      </div>
    </section>
  )
}

function BookCard({ book, onInfo, onStatus, onRemove }) {
  return (
    <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-3 transition hover:border-amber-100/25 hover:bg-white/[0.06]">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => onInfo(book)} className="shrink-0"><BookCover book={book} className="h-24 w-16" /></button>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => onInfo(book)} className="block max-w-full truncate text-left font-black text-white hover:underline">{book.title}</button>
          <p className="mt-1 truncate text-xs text-neutral-400">{metaLine(book)}</p>
          <p className="mt-0.5 truncate text-[11px] text-neutral-600">Added by {book.nominated_by}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {statusOptions.map((option) => <button key={option.value} type="button" onClick={() => onStatus(book, option.value)} className={`rounded-xl border px-2.5 py-1.5 text-[11px] font-black ${book.readingStatus === option.value ? 'border-white bg-white text-neutral-950' : 'border-white/10 text-neutral-300 hover:bg-white hover:text-neutral-950'}`}>{option.label}</button>)}
          </div>
        </div>
        <button type="button" onClick={() => onRemove(book)} className="hidden rounded-xl border border-red-400/20 px-3 py-2 text-xs font-bold text-red-200 hover:bg-red-500 hover:text-white sm:block">Delete</button>
      </div>
      <button type="button" onClick={() => onRemove(book)} className="mt-3 w-full rounded-xl border border-red-400/20 px-3 py-2 text-xs font-bold text-red-200 sm:hidden">Delete</button>
    </article>
  )
}

function StorageStatus({ activeGroup, storageMode }) {
  return <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-neutral-300"><strong className="text-white">{activeGroup ? activeGroup.name : 'Personal book library'}</strong><span className="text-neutral-500"> · </span>Storage: <strong className="text-white">{storageMode === 'remote' ? 'Supabase' : 'local fallback'}</strong></section>
}

export default function Books() {
  const [books, setBooks] = useState([])
  const [results, setResults] = useState([])
  const [draft, setDraft] = useState({ query: '' })
  const [message, setMessage] = useState(null)
  const [infoBook, setInfoBook] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [savingId, setSavingId] = useState('')
  const [storageMode, setStorageMode] = useState('local')
  const activeHandle = getSavedHandle()
  const activeGroup = getActiveGroup()

  const grouped = useMemo(() => ({
    reading: books.filter((book) => book.readingStatus === 'reading'),
    want: books.filter((book) => book.readingStatus === 'want'),
    finished: books.filter((book) => book.readingStatus === 'finished'),
  }), [books])

  function showMessage(text, type = 'success') { setMessage({ text, type }); setTimeout(() => setMessage(null), 2600) }
  function updateDraft(field, value) { setDraft((current) => ({ ...current, [field]: value })) }
  function clearSearch() { setDraft({ query: '' }); setResults([]) }

  async function refreshBooks() {
    setLoading(true)
    try {
      const result = await getBookItems(activeGroup?.id || null)
      setBooks(result.books)
      setStorageMode(result.source)
    } catch (error) { showMessage(error.message || 'Could not load books.', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => { refreshBooks() }, [activeGroup?.id])

  async function handleSearch(event) {
    event.preventDefault()
    if (!draft.query.trim()) return showMessage('Search for a title, author, or ISBN first.', 'error')
    setSearching(true)
    try {
      const found = await searchBookCatalog(draft)
      setResults(found)
      if (!found.length) showMessage('No book results found.', 'error')
    } catch (error) { showMessage(error.message || 'Book search failed.', 'error') }
    finally { setSearching(false) }
  }

  async function addBook(book) {
    setSavingId(book.id)
    try {
      const result = await saveBookItem(book, { group: activeGroup, nominatedBy: activeHandle, readingStatus: 'want' })
      setBooks((current) => [result.book, ...current.filter((item) => item.id !== result.book.id)])
      setStorageMode(result.source)
      setResults((current) => current.filter((item) => item.id !== book.id))
      showMessage(`"${result.book.title}" added.`)
    } catch (error) { showMessage(error.message || 'Could not add that book.', 'error') }
    finally { setSavingId('') }
  }

  async function changeStatus(book, readingStatus) {
    try {
      const result = await updateBookStatus(book, readingStatus)
      setStorageMode(result.source)
      setBooks((current) => current.map((item) => item.id === book.id ? result.book : item))
      if (infoBook?.id === book.id) setInfoBook(result.book)
    } catch (error) { showMessage(error.message || 'Could not update reading status.', 'error') }
  }

  async function removeBook(book) {
    try {
      const result = await deleteBookItem(book)
      setStorageMode(result.source)
      setBooks((current) => current.filter((item) => item.id !== book.id))
      if (infoBook?.id === book.id) setInfoBook(null)
      showMessage(`"${book.title}" deleted.`)
    } catch (error) { showMessage(error.message || 'Could not delete book.', 'error') }
  }

  return (
    <PageShell active="books">
      <section className="mb-5 overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-neutral-900 via-neutral-950 to-amber-950/50 p-4 shadow-2xl shadow-black/30 ring-1 ring-white/10 sm:p-5">
        <div className="grid gap-5 lg:grid-cols-[1fr_20rem] lg:items-end">
          <div className="min-w-0"><p className="text-xs font-black uppercase tracking-[0.3em] text-amber-200/70">Books</p><h1 className="mt-2 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-5xl">Build a reading shelf for your library or family clique.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400 sm:text-base">Search books, add covers/authors, and track Want to read, Reading, and Finished.</p></div>
          <StorageStatus activeGroup={activeGroup} storageMode={storageMode} />
        </div>
        <div className="mt-5"><SearchForm draft={draft} searching={searching} onSubmit={handleSearch} onChange={updateDraft} onClear={clearSearch} /></div>
      </section>
      <StatusMessage message={message} />
      <main className="grid gap-4">
        <SearchResults results={results} savingId={savingId} onAdd={addBook} onInfo={setInfoBook} onClear={() => setResults([])} />
        {loading ? <p className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 text-neutral-400">Loading books…</p> : null}
        {[['reading', 'Currently reading'], ['want', 'Want to read'], ['finished', 'Finished']].map(([key, title]) => (
          <section key={key} className="rounded-[2rem] border border-white/10 bg-white/[0.025] p-4 shadow-2xl shadow-black/20">
            <div className="flex items-end justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.3em] text-neutral-500">Shelf</p><h2 className="mt-1 text-2xl font-black text-white">{title}</h2></div><span className="text-sm text-neutral-500">{grouped[key].length}</span></div>
            <div className="mt-4 grid gap-2">{grouped[key].length ? grouped[key].map((book) => <BookCard key={book.id} book={book} onInfo={setInfoBook} onStatus={changeStatus} onRemove={removeBook} />) : <p className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-neutral-500">No books here yet.</p>}</div>
          </section>
        ))}
      </main>
      <InfoModal item={infoBook} onClose={() => setInfoBook(null)}>
        <div className="mt-4 grid gap-5 md:grid-cols-[12rem_1fr] md:items-start">
          <BookCover book={infoBook} className="w-full max-w-48 aspect-[2/3]" rounded="rounded-[1.5rem]" />
          <div className="min-w-0"><div className="flex flex-wrap gap-2">{infoBook?.source ? <DetailPill>{infoBook.source}</DetailPill> : null}{infoBook?.readingStatus ? <DetailPill>{infoBook.readingStatus}</DetailPill> : null}{infoBook?.year ? <DetailPill>{infoBook.year}</DetailPill> : null}</div><p className="mt-4 text-sm text-neutral-300">{metaLine(infoBook || {})}</p><p className="mt-5 break-words text-sm leading-7 text-neutral-400">{infoBook?.overview || infoBook?.url || 'No description available.'}</p>{infoBook?.url ? <a href={infoBook.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-2xl bg-white px-4 py-3 text-sm font-black text-neutral-950 hover:bg-neutral-200">Open source</a> : null}</div>
        </div>
      </InfoModal>
    </PageShell>
  )
}
