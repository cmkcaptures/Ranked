import { useEffect, useState } from 'react'
import { sb } from './cloud.js'

// Owner-only traffic dashboard (#/admin)
export default function SiteStats() {
  const [s, setS] = useState(null)
  const [err, setErr] = useState('')
  const [hrs, setHrs] = useState(24)
  const load = () => sb.rpc('site_stats', { p_hours: hrs }).then(({ data, error }) => { if (error) setErr(error.message); else setS(data) })
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t) }, [hrs])
  if (err) return <div className="card pad error">{err}</div>
  if (!s) return <div className="loading">Counting visitors…</div>
  const P = hrs === 24 ? '24h' : '7d'
  const series = hrs === 24 ? s.hourly.map(x => ({ d: x.h, v: x.v, l: new Date(x.h).toLocaleTimeString(undefined, { hour: '2-digit' }) })) : s.daily.map(x => ({ d: x.d, v: x.v, l: new Date(x.d).toLocaleDateString(undefined, { weekday: 'short' }) }))
  const max = Math.max(1, ...series.map(d => d.v)), srcMax = Math.max(1, ...s.sources.map(x => x.v))
  const label = p => ({ landing: 'Landing page', vs: 'VS Arena', league: 'League', market: 'Market', home: 'Home', times: 'The Times', inbox: 'Notifications', profile: 'Profiles', anime: 'Anime pages' }[p] || p)
  return <div className="sstats">
    <h2>Site stats <small>live · only you can see this</small></h2>
    <div className="tabs">{[[24, 'Last 24 hours'], [168, 'Last 7 days']].map(([h, l]) => <button key={h} className={hrs === h ? 'on' : ''} onClick={() => setHrs(h)}>{l}</button>)}</div>
    <div className="ss-tiles">
      {[['Visitors today', s.today], [`Visitors (${P})`, s.period], ['Visitors (7d)', s.week], ['All-time visitors', s.all], [`Page views (${P})`, s.views],
        ['Accounts', s.signups, `+${s.signups_period} in ${P}`], ['Leagues', s.leagues, `${s.league_players} players`], [`Traders (${P})`, s.traders]].map(([k, v, sub]) =>
        <div key={k}><small>{k}</small><b>{v}</b>{sub && <span>{sub}</span>}</div>)}
    </div>
    <h3>Visitors per {hrs === 24 ? 'hour' : 'day'}</h3>
    <div className="ss-chart">{series.map(d => <div key={d.d} title={`${d.l}: ${d.v}`}><i style={{ height: `${d.v / max * 100}%` }} /><b>{d.v}</b><small>{d.l}</small></div>)}
      {!series.length && <p className="muted">No visits logged yet. Counting starts now.</p>}</div>
    <div className="ss-cols">
      <div><h3>Where they came from ({P})</h3>{s.sources.map(x => <div key={x.src} className="ss-bar"><span>{x.src}</span><i><em style={{ width: `${x.v / srcMax * 100}%` }} /></i><b>{x.v}</b></div>)}
        {!s.sources.length && <p className="muted">Nothing yet.</p>}</div>
      <div><h3>What they looked at ({P})</h3>{s.pages.map(x => <div key={x.page} className="ss-row"><span>{label(x.page)}</span><b>{x.v}</b><small>{x.n} views</small></div>)}</div>
    </div>
  </div>
}
