import { useEffect, useState } from 'react'
import { getGroupReports, reviewContentReport } from '../lib/safety.js'

function reportReasonLabel(reason = 'other') {
  if (reason === 'spam') return 'Spam'
  if (reason === 'harassment') return 'Harassment'
  if (reason === 'spoiler') return 'Spoiler'
  if (reason === 'unsafe') return 'Unsafe'
  return 'Other'
}

function ReportCard({ report, busyKey, onReview }) {
  const busy = busyKey === report.id
  return (
    <article className="rounded-[1.5rem] border border-white/10 bg-neutral-900/70 p-4 text-white">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-red-300/30 bg-red-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-red-100">{reportReasonLabel(report.reason)}</span>
            <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">{report.itemType}</span>
          </div>
          <h3 className="mt-3 text-lg font-black">Reported {report.actorDisplayName || 'content'}</h3>
          <p className="mt-1 text-xs text-neutral-500">By {report.reporterDisplayName} · {report.createdAt ? new Date(report.createdAt).toLocaleString() : 'recently'}</p>
          {report.details ? <p className="mt-3 rounded-2xl border border-white/10 bg-neutral-950 p-3 text-sm leading-6 text-neutral-300">{report.details}</p> : <p className="mt-3 text-sm text-neutral-500">No details supplied.</p>}
          {report.itemId ? <p className="mt-2 break-all text-xs text-neutral-600">Item: {report.itemId}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => onReview(report, 'reviewed')} className="rounded-2xl border border-white/10 px-3 py-2 text-xs font-black text-white transition hover:bg-white hover:text-neutral-950 disabled:opacity-50">Mark reviewed</button>
          <button type="button" disabled={busy} onClick={() => onReview(report, 'dismissed')} className="rounded-2xl border border-white/10 px-3 py-2 text-xs font-black text-neutral-300 transition hover:bg-white/10 disabled:opacity-50">Dismiss</button>
        </div>
      </div>
    </article>
  )
}

export default function ModerationInbox({ groupId, canModerate = false, onMessage }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(false)
  const [busyKey, setBusyKey] = useState('')

  async function refresh() {
    if (!groupId || !canModerate) {
      setReports([])
      return
    }
    setLoading(true)
    try {
      setReports(await getGroupReports(groupId, false))
    } catch (error) {
      onMessage?.(error.message || 'Could not load reports.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { refresh() }, [groupId, canModerate])

  async function reviewReport(report, status) {
    setBusyKey(report.id)
    try {
      await reviewContentReport(report.id, status)
      setReports((current) => current.filter((item) => item.id !== report.id))
      onMessage?.(status === 'dismissed' ? 'Report dismissed.' : 'Report marked reviewed.')
    } catch (error) {
      onMessage?.(error.message || 'Could not review report.', 'error')
    } finally {
      setBusyKey('')
    }
  }

  if (!canModerate) return null

  return (
    <section className="rounded-[2rem] border border-red-300/20 bg-red-500/5 p-5 text-white">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-black uppercase tracking-[0.28em] text-red-200/70">Moderation inbox</p><h2 className="mt-1 text-2xl font-black">Open reports</h2></div>
        <button type="button" onClick={refresh} className="rounded-2xl border border-white/10 px-3 py-2 text-xs font-black text-white transition hover:bg-white hover:text-neutral-950">Refresh</button>
      </div>
      {loading ? <div className="mt-4 h-28 animate-pulse rounded-[1.5rem] bg-white/[0.06]" /> : reports.length ? <div className="mt-4 grid gap-3">{reports.map((report) => <ReportCard key={report.id} report={report} busyKey={busyKey} onReview={reviewReport} />)}</div> : <p className="mt-4 rounded-3xl border border-white/10 bg-neutral-950/70 p-4 text-sm leading-6 text-neutral-400">No open reports for this clique.</p>}
    </section>
  )
}
