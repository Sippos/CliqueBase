import { Link } from 'react-router-dom'
import PageNav from './PageNav.jsx'
import CliqueGovernanceBar from './CliqueGovernanceBar.jsx'
import NotificationCenter from './NotificationCenter.jsx'

export default function PageShell({ active = 'home', children }) {
  return (
    <main className="min-h-screen bg-neutral-950 px-3 py-3 text-white sm:px-4 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="fixed right-4 top-4 z-[90] flex items-center gap-2 lg:right-6 lg:top-6">
          <Link to="/community" className="hidden rounded-full border border-white/10 bg-neutral-950/90 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white shadow-2xl shadow-black/30 transition hover:bg-white hover:text-neutral-950 sm:inline-flex">Community</Link>
          <NotificationCenter />
        </div>
        <PageNav active={active} />
        <CliqueGovernanceBar active={active} />
        {children}
      </div>
    </main>
  )
}
