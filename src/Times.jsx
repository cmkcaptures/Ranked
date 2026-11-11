import { useEffect, useState } from 'react'
import { sb } from './cloud.js'
import { fantasySeason } from './Fantasy.jsx'
import { openChar } from './CharProfile.jsx'
import './times.css'

// The Ranked Times: an automatic weekly front page built from last week's league + market data.
export default function Times({ me, friends, openProfile }) {
  const S = fantasySeason()
  const wk = Math.max(1, S.week - 1)          // the last finished week
  const [d, setD] = useState(null)
  const since = new Date(Date.now() - 7 * 864e5).toISOString()
  const name = id => friends.find(f => f.id === id)?.username || 'Someone'

  useEffect(() => {
    if (!sb) return
    Promise.all([
      sb.from('fantasy_events').select('*').eq('season', S.key).eq('status', 'confirmed'),
      sb.from('activity').select('user_id, kind, payload, created_at').eq('kind', 'trade').gte('created_at', since).limit(1000),
      sb.from('story_shocks').select('*').gte('at', since).neq('kind', 'ripple').order('pct'),
      sb.from('fantasy_trades').select('*').eq('season', S.key).eq('status', 'accepted').gte('decided_at', since),
      sb.from('fantasy_swaps').select('*').eq('season', S.key).gte('created_at', since),
      sb.from('shorts').select('*').neq('status', 'open').gte('closed_at', since),
      sb.from('fantasy_streaks').select('*').eq('season', S.key).order('streak', { ascending: false }).limit(1),
    ]).then(async ([ev, act, sh, tr, sw, shorts, st]) => {
      ev = ev.data || []
      const wkEv = ev.filter(e => e.week === wk)
      const teamWk = {}; for (const e of wkEv) teamWk[e.team_user] = (teamWk[e.team_user] || 0) + e.points
      const tw = Object.entries(teamWk).sort((a, b) => b[1] - a[1])
      const tot = {}; for (const e of ev) tot[e.team_user] = (tot[e.team_user] || 0) + e.points
      const table = Object.entries(tot).sort((a, b) => b[1] - a[1])
      const totBefore = {}; for (const e of ev) if (e.week < wk) totBefore[e.team_user] = (totBefore[e.team_user] || 0) + e.points
      const before = Object.entries(totBefore).sort((a, b) => b[1] - a[1]).map(x => x[0])
      const climber = table.map(([u], i) => ({ u, moved: (before.indexOf(u) + 1 || i + 1) - (i + 1) })).sort((a, b) => b.moved - a.moved)[0]
      const moment = [...wkEv].filter(e => e.char_id && ['transform', 'debut', 'win', 'death', 'news', 'vault', 'trailer'].includes(e.kind)).sort((a, b) => Math.abs(b.points) - Math.abs(a.points))[0]
      const trades = (act.data || []).filter(a => a.payload?.pnl != null)
      const best = [...trades].sort((a, b) => b.payload.pnl - a.payload.pnl)[0]
      const worst = [...trades].sort((a, b) => a.payload.pnl - b.payload.pnl)[0]
      const vol = {}; for (const a of act.data || []) vol[a.user_id] = (vol[a.user_id] || 0) + Math.abs(a.payload?.qty || 0)
      const whale = Object.entries(vol).sort((a, b) => b[1] - a[1])[0]
      const crash = (sh.data || [])[0], spike = (sh.data || []).slice(-1)[0]
      const shortWin = [...(shorts.data || [])].sort((a, b) => b.pnl - a.pnl)[0]
      const ids = [moment?.char_id, crash?.char_id, spike?.char_id, st.data?.[0]?.char_id, shortWin?.char_id].filter(Boolean)
      const cs = ids.length ? (await sb.from('characters').select('id, name, image, sym').in('id', ids)).data || [] : []
      const C = Object.fromEntries(cs.map(c => [c.id, c]))
      setD({ tw, table, climber, moment: moment && { ...moment, c: C[moment.char_id] }, best, worst, whale, crash: crash && { ...crash, c: C[crash.char_id] },
        spike: spike && spike.pct > 0 && { ...spike, c: C[spike.char_id] }, trades: tr.data || [], swaps: sw.data || [], shortWin: shortWin && shortWin.pnl > 0 && { ...shortWin, c: C[shortWin.char_id] },
        streak: st.data?.[0]?.streak > 1 && { ...st.data[0], c: C[st.data[0].char_id] } })
    })
  }, [])

  if (!d) return <div className="loading">Printing the paper…</div>
  const date = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const [topU, topP] = d.tw[0] || [], [flopU, flopP] = d.tw[d.tw.length - 1] || []
  const headline = topU ? `${name(topU).toUpperCase()} RUNS RIOT WITH ${topP} IN WEEK ${wk}` : `WEEK ${wk}: A QUIET ONE`
  return <article className="times">
    <header className="t-mast">
      <div className="t-ears"><span>Vol. {S.label}</span><span>No. {wk}</span><span>Price: 1 coin</span></div>
      <h1>The Ranked Times</h1>
      <div className="t-date">{date} · Week {wk} edition · ランクド新聞</div>
    </header>

    <section className="t-lead">
      <div className="t-kicker">League</div>
      <h2>{headline}</h2>
      <p className="t-deck">{topU && <>Top score of the week, while {flopU !== topU ? <><b>{name(flopU)}</b> limped home with {flopP}</> : 'nobody else got close'}.</>}
        {d.climber?.moved > 0 && <> Biggest climber: <b>{name(d.climber.u)}</b>, up {d.climber.moved} place{d.climber.moved > 1 ? 's' : ''}.</>}</p>
      <div className="t-table">{d.table.map(([u, p], i) => <div key={u} className={u === me?.id ? 'me' : ''} onClick={() => openProfile(u)}><i>{i + 1}</i><b>{name(u)}</b><em>{p}</em><small>{(d.tw.find(x => x[0] === u) || [, 0])[1] >= 0 ? '+' : ''}{(d.tw.find(x => x[0] === u) || [, 0])[1]} wk</small></div>)}</div>
    </section>

    <div className="t-cols">
      {d.moment?.c && <section className="t-story photo" onClick={() => openChar(d.moment.c.id)}>
        <img src={d.moment.c.image} alt="" referrerPolicy="origin" />
        <div><div className="t-kicker">Moment of the week</div><h3>{d.moment.c.name}: {d.moment.points > 0 ? '+' : ''}{d.moment.points}</h3><p>{d.moment.note}</p><small>for {name(d.moment.team_user)}</small></div>
      </section>}
      <section className="t-story">
        <div className="t-kicker">Markets</div>
        <h3>{d.crash?.c ? `$${d.crash.c.sym} CRASHES ${Math.round(Math.abs(d.crash.pct) * 100)}%` : 'Markets hold steady'}</h3>
        <p>{d.crash?.c && <>{d.crash.note}. </>}{d.spike?.c && <>Meanwhile <b>${d.spike.c.sym}</b> rocketed {Math.round(d.spike.pct * 100)}%.</>}</p>
        {d.best && <p>💰 <b>Trade of the week:</b> {name(d.best.user_id)} banked <b className="up">+{Math.round(d.best.payload.pnl)}</b> selling ${d.best.payload.sym}.</p>}
        {d.worst && d.worst.payload.pnl < 0 && <p>🤡 <b>Panic sell of the week:</b> {name(d.worst.user_id)} dumped ${d.worst.payload.sym} for <b className="down">{Math.round(d.worst.payload.pnl)}</b>.</p>}
        {d.shortWin?.c && <p>📉 <b>Short of the week:</b> {name(d.shortWin.user_id)} shorted ${d.shortWin.c.sym} for <b className="up">+{Math.round(d.shortWin.pnl)}</b>.</p>}
        {d.whale?.[1] > 0 && <p>🐋 <b>Whale watch:</b> {name(d.whale[0])} moved {d.whale[1]} shares.</p>}
      </section>
      <section className="t-story">
        <div className="t-kicker">Transfer news</div>
        <h3>{d.trades.length + d.swaps.length ? `${d.trades.length + d.swaps.length} MOVES THIS WEEK` : 'NO MOVES: SQUADS STAND FIRM'}</h3>
        {d.trades.slice(0, 4).map(t => <p key={t.id}>🔄 <b>{name(t.from_user)}</b> and <b>{name(t.to_user)}</b> agreed a 1-for-1 deal.</p>)}
        {d.swaps.slice(0, 4).map(s => <p key={s.id || s.created_at}>✍️ <b>{name(s.user_id)}</b> made a signing.</p>)}
        {d.streak?.c && <><div className="t-kicker">Form</div><p>🔥 <b>{d.streak.c.name}</b> is on a {d.streak.streak}-week scoring streak for {name(d.streak.user_id)}.</p></>}
      </section>
      <section className="t-story ad">
        <div className="t-kicker">Advertisement</div>
        <h3>GOT COINS?</h3><p>Vote the next IPO in the Market. Voters get first dibs. Terms: none. Refunds: also none.</p>
      </section>
    </div>
    <footer className="t-foot">Printed automatically every week by The Ranked Times. No journalists were harmed.</footer>
  </article>
}
