import PageNav from './PageNav.jsx'

export default function PageShell({ active = 'home', children }) {
  return (
    <main className="min-h-screen bg-neutral-950 px-3 py-3 text-white sm:px-4 md:px-6">
      <div className="mx-auto max-w-5xl">
        <PageNav active={active} />
        {children}
      </div>
    </main>
  )
}
