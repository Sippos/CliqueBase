import PageShell from '../components/PageShell.jsx'

export default function ComingSoonPage({ active, eyebrow, title, description }) {
  return (
    <PageShell active={active}>
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5 shadow-2xl shadow-black/20 sm:p-8">
        <p className="text-xs uppercase tracking-[0.35em] text-neutral-500">{eyebrow}</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">{title}</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-400">{description}</p>
        <div className="mt-6 rounded-2xl border border-yellow-400/30 bg-yellow-400/10 p-4 text-sm leading-6 text-yellow-100">
          This page is intentionally paused so no unsafe API keys or permissive database writes are copied into the new public app.
        </div>
      </section>
    </PageShell>
  )
}
