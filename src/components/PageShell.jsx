import PageNav from './PageNav.jsx'
import CliqueGovernanceBar from './CliqueGovernanceBar.jsx'

export default function PageShell({ active = 'home', children }) {
  return (
    <main className="min-h-screen overflow-x-clip px-3 pb-24 pt-3 text-white sm:px-4 sm:pb-6 md:px-6">
      <div className="relative mx-auto max-w-6xl">
        <PageNav active={active} />
        <CliqueGovernanceBar active={active} />
        {children}
      </div>
    </main>
  )
}
