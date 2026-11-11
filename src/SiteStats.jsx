import { useEffect, useState } from 'react'
import { sb } from './cloud.js'

// Owner-only traffic dashboard (#/admin)
export default function SiteStats() {
  const [s, setS] = useState(null)
  const [err, setErr] = useState('')
  const load = () => sb.rpc('site_stats').then(({ data, error }) => { if (error) setErr(error.message); else setS(data) })
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t) }, [])
  if (err) return <div className="card pad error">{err}</div>
  if (!s) return <div className="loading">Counting visitors…</div>
  const max = Math.max(1, ...s.daily.map(d => d.v)), srcMax = Math.max(1, ...s.sources.map(x => x.v))
  const label = p => ({ landing: 'Landing page', vs: 'VS Arena', league: 'League', market: 'Market', home: 'Home', times: 'The Times', inbox: 'Notifications', profile: 'Profiles', anime: 'Anime pages' }[p] || p)
  return <div className="sstats">
    <h2>Site stats <small>live · only you can see this</small></h2>
    <div className="ss-tiles">
      {[['Visitors today', s.today], ['Visitors (7 days)', s.week], ['All-time visitors', s.all], ['Page views (7d)', s.views_week],
        ['Accounts', s.signups, `+${s.signups_week} this week`], ['Leagues', s.leagues, `${s.league_players} players`], ['Traders (7d)', s.traders_week], ['Signed in', `${s.signed_in_share ?? 0}%`, 'of visitors']].map(([k, v, sub]) =>
        <div key={k}><small>{k}</small><b>{v}</b>{sub && <span>{sub}</span>}</div>)}
    </div>
    <h3>Visitors per day</h3>
    <div className="ss-chart">{s.daily.map(d => <div key={d.d} title={`${d.d}: ${d.v}`}><i style={{ height: `${d.v / max * 100}%` }} /><b>{d.v}</b><small>{new Date(d.d).toLocaleDateString(undefined, { weekday: 'short' })}</small></div>)}
      {!s.daily.length && <p className="muted">No visits logged yet. Counting starts now.</p>}</div>
    <div className="ss-cols">
      <div><h3>Where they came from (7d)</h3>{s.sources.map(x => <div key={x.src} className="ss-bar"><span>{x.src}</span><i><em style={{ width: `${x.v / srcMax * 100}%` }} /></i><b>{x.v}</b></div>)}
        {!s.sources.length && <p className="muted">Nothing yet.</p>}</div>
      <div><h3>What they looked at (7d)</h3>{s.pages.map(x => <div key={x.page} className="ss-row"><span>{label(x.page)}</span><b>{x.v}</b><small>{x.n} views</small></div>)}</div>
    </div>
  </div>
}
