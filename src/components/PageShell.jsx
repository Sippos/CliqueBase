import PageNav from './PageNav.jsx'
import CliqueGovernanceBar from './CliqueGovernanceBar.jsx'
import NotificationCenter from './NotificationCenter.jsx'

export default function PageShell({ active = 'home', children }) {
  return (
    <main className="min-h-screen bg-neutral-950 px-3 py-3 text-white sm:px-4 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="fixed right-4 top-4 z-[90] lg:right-6 lg:top-6">
          <NotificationCenter />
        </div>
        <PageNav active={active} />
        <CliqueGovernanceBar active={active} />
        {children}
      </div>
    </main>
  )
}
