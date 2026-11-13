import './league.css'
import './league2.css'
import { useEffect, useRef, useState } from 'react'
import { openChar } from './CharProfile.jsx'
import { sfx } from './sfx.js'

// League v3 UI: scoreboard hero, race-lane standings, flip/tilt squad cards.

const sign = n => (n > 0 ? '+' : '') + n

// number that counts up when it changes
export function CountUp({ to = 0, ms = 900 }) {
  const [v, setV] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    const a = from.current, t0 = performance.now(); let raf
    const step = t => { const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3); setV(Math.round(a + (to - a) * e)); if (k < 1) raf = requestAnimationFrame(step); else from.current = to }
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf)
  }, [to])
  return <>{v}</>
}

// 3D tilt that follows the mouse
function useTilt(max = 10) {
  const ref = useRef(null)
  const move = e => { const el = ref.current; if (!el) return; const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5
    el.style.setProperty('--rx', `${-y * max}deg`); el.style.setProperty('--ry', `${x * max}deg`)
    el.style.setProperty('--mx', `${(x + .5) * 100}%`); el.style.setProperty('--my', `${(y + .5) * 100}%`) }
  const leave = () => { const el = ref.current; if (!el) return; el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg') }
  return { ref, onMouseMove: move, onMouseLeave: leave }
}

// ===== Hero: scoreboard =====
export function Scoreboard({ S, mine, rank, count, captain, chip, feed, byId, KINDS }) {
  const daysLeft = Math.ceil((S.end - Date.now()) / 86400000)
  return <div className="lg-hero">
    <div className="lg-jp">決戦</div>
    <div className="lg-hl">
      <div className="lg-kick"><b>LIVE</b> {S.label} · Fantasy League · {count} teams · {daysLeft}d left</div>
      <div className="lg-wk"><small>Week</small><b>{String(S.week).padStart(2, '0')}</b></div>
      <div className="lg-big"><small>Your points</small><b><CountUp to={mine?.total || 0} /></b><em className={mine?.week < 0 ? 'dn' : ''}>{sign(mine?.week || 0)} THIS WEEK</em></div>
      {chip && <div className="lg-hchips"><span className="gold">{chip[0]} {chip[1]} on</span></div>}
    </div>
    <div className="lg-stamp">#{rank}<small>OF {count}</small></div>
    {captain && <div className="lg-capart" onClick={() => openChar(captain.id)}><img src={captain.image} alt="" referrerPolicy="origin" /></div>}
    <div className="lg-captag"><small>👑 YOUR CAPTAIN · ×2 POINTS</small><b>{captain?.name || 'None picked'}</b></div>
  </div>
}

// ===== Tabs with a sliding pill =====
export function SlideTabs({ tabs, tab, setTab }) {
  const wrap = useRef(null)
  const [pill, setPill] = useState({})
  useEffect(() => {
    const el = wrap.current?.querySelector('.on'); if (!el) return
    setPill({ left: el.offsetLeft, width: el.offsetWidth })
  }, [tab, tabs.map(t => t[1]).join()])
  return <div className="lb-tabs" ref={wrap}>
    <i className="pill" style={pill} />
    {tabs.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
  </div>
}

// ===== Standings: race lanes =====
export function Race({ teams, who, me, lastRank, topWeek, capOf, benchOf, chipNow, CHIPS, byId, charPts, weekPts, dead, vault = {}, events, openProfile, KINDS }) {
  const [mode, setMode] = useState('season')
  const [open, setOpen] = useState(null)
  useEffect(() => { const i = [...teams].sort((a, b) => b.total - a.total).findIndex(t => t.user === me.id) + 1
    if (i && lastRank[me.id] > i && !sessionStorage.getItem('sfx-climb')) { sessionStorage.setItem('sfx-climb', 1); setTimeout(() => sfx('win', { text: `${lastRank[me.id] - i}位アップ!`, at: { x: innerWidth / 2, y: 220 } }), 900) } }, [teams.length])
  const val = t => mode === 'season' ? t.total : t.week
  const list = [...teams].sort((a, b) => val(b) - val(a))
  const top = Math.max(1, ...list.map(t => Math.abs(val(t))))
  const moved = (t, i) => mode === 'season' ? (lastRank[t.user] || i + 1) - (i + 1) : 0
  const Mv = ({ n }) => n ? <i className={`lg-mvi ${n > 0 ? 'up' : 'dn'}`}>{n > 0 ? '▲' : '▼'}{Math.abs(n)}</i> : <i className="lg-mvi">–</i>
  const tags = t => { const cap = capOf(t.user), bench = benchOf(t)
    return <div className="lg-tags">{[...t.chars].sort((a, b) => (b === cap) - (a === cap)).map(id => { const c = byId[id]; if (!c) return null
      return <span key={id} className={`lg-tag ${id === cap ? 'cap' : ''} ${id === bench ? 'bn' : ''} ${dead[id] ? 'dd' : ''}`} onClick={e => { e.stopPropagation(); openChar(id) }} title={`${c.name}: ${charPts[id] || 0} pts (${sign(weekPts[id] || 0)} this week)`}>
        <img src={c.image} alt="" referrerPolicy="origin" /><b>{c.name.split(' ')[0]}</b><em>{charPts[id] || 0}</em></span> })}</div> }
  const capImg = t => byId[capOf(t.user)]?.image || byId[t.chars[0]]?.image
  const sub = t => { const chip = chipNow(t.user), cap = byId[capOf(t.user)]
    return <small>{cap ? `👑 ${cap.name}` : 'No captain'}{chip ? ` · ${CHIPS[chip][0]} ${CHIPS[chip][1]}` : ''}{t.week === topWeek && t.week > 0 ? ' · 🔥 top this week' : ''}</small> }
  const pod = list.slice(0, 3), rest = list.slice(3), order = pod.length === 3 ? [1, 0, 2] : pod.map((_, i) => i)
  const sel = list.find(t => t.user === open)
  return <div className="lg-race">
    <div className="lg-track">{list.map((t, i) => { const p = who(t.user), w = Math.max(3, Math.abs(val(t)) / top * 100)
      return <div key={t.user} className={`lg-lane ${i === 0 ? 'p1' : ''} ${t.user === me.id ? 'me' : ''}`} style={{ '--d': `${i * 80}ms` }}>
        <span>{t.user === me.id ? 'You' : p?.username || '?'}</span>
        <div className="lg-bar"><i style={{ width: `${w}%` }} /><img style={{ left: `${w}%` }} src={capImg(t)} alt="" referrerPolicy="origin" /></div>
        <b><CountUp to={val(t)} /></b></div> })}</div>
    <div className="lg-panel">
      <div className="lg-ph">The table <div className="lg-seg">{[['season', 'Season'], ['week', 'This week']].map(([k, l]) => <button key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{l}</button>)}</div></div>
      <div className="lg-pod">{order.map(i => { const t = pod[i], p = who(t.user)
        return <div key={t.user} className={`lg-pc p${i + 1} ${t.user === me.id ? 'me' : ''}`} onClick={() => setOpen(open === t.user ? null : t.user)}>
          <div className="lg-art"><span className="lg-num">{i + 1}</span><span className="lg-mv"><Mv n={moved(t, i)} /></span><img src={capImg(t)} alt="" referrerPolicy="origin" /></div>
          <div className="lg-info"><b className="lg-mgr">{p?.username || '?'}</b>{sub(t)}{tags(t)}
            <div className="lg-row"><strong><CountUp to={val(t)} /></strong>{mode === 'season' && <em className={t.week < 0 ? 'dn' : 'up'}>{sign(t.week)} wk</em>}</div></div>
        </div> })}</div>
      <div className="lg-rest">{rest.map((t, j) => { const i = j + 3, p = who(t.user)
        return <div key={t.user} className={`lg-tr ${t.user === me.id ? 'me' : ''}`} onClick={() => setOpen(open === t.user ? null : t.user)}>
          <span className="lg-rk">{i + 1}</span><div className="lg-who"><b>{p?.username || '?'} <Mv n={moved(t, i)} /></b>{sub(t)}</div>{tags(t)}
          <span className={`lg-wkp ${t.week < 0 ? 'dn' : 'up'}`}>{mode === 'season' ? `${sign(t.week)} wk` : ''}</span><span className="lg-tot"><CountUp to={val(t)} /></span></div> })}</div>
      {sel && <div className="lb-squad lg-open">
        {sel.chars.map(id => { const c = byId[id]; if (!c) return null; const cap = capOf(sel.user), bench = benchOf(sel)
          const ev = events.filter(e => e.char_id === id && e.team_user === sel.user)
          const big = Object.entries(ev.reduce((m, e) => (m[e.kind] = (m[e.kind] || 0) + e.points, m), {})).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 3)
          return <div key={id} className={`lb-mini ${id === cap ? 'cap' : ''} ${id === bench ? 'bench' : ''} ${dead[id] ? 'dead' : ''}`} onClick={() => openChar(id)}>
            <img src={c.image} alt="" referrerPolicy="origin" />
            {id === cap && <i className="tag gold">👑 C</i>}{id === bench && <i className="tag">🪑 Bench</i>}{dead[id] && <i className="tag red">💀</i>}{vault[id] > 0 && <i className="tag pig">📦 {vault[id]}</i>}
            <div className="info"><b>{c.name}</b><span>{charPts[id] || 0} pts · <em className={(weekPts[id] || 0) < 0 ? 'dn' : 'up'}>{sign(weekPts[id] || 0)} wk</em></span>
              <div className="kinds">{big.map(([k, v]) => <span key={k}>{KINDS[k]?.[0]} {sign(v)}</span>)}</div></div>
          </div> })}
        <button className="lb-prof" onClick={() => openProfile(sel.user)}>View {who(sel.user)?.username}’s profile →</button>
      </div>}
      {!teams.length && <div className="card pad muted">No teams yet.</div>}
    </div>
  </div>
}

// ===== My team: flip + tilt cards =====
export function SquadCard({ c, pts, wk, events, KINDS, captain, benched, dead, tag, vault, streak, form, actions, delay = 0 }) {
  const [flip, setFlip] = useState(false)
  const tilt = useTilt(12)
  if (!c) return null
  const by = Object.entries(events.reduce((m, e) => (m[e.kind] = (m[e.kind] || 0) + e.points, m), {})).sort((a, b) => b[1] - a[1])
  const maxAbs = Math.max(1, ...by.map(([, v]) => Math.abs(v)))
  return <div className={`sq-card ${captain ? 'cap' : ''} ${benched ? 'bench' : ''} ${dead ? 'dead' : ''} ${flip ? 'flip' : ''}`} style={{ '--c': c.color || '#7b5cff', animationDelay: `${delay}ms` }} {...tilt}>
    <div className="sq-in" onClick={() => { setFlip(f => !f); sfx('flip') }}>
      <div className="sq-front">
        <img src={c.image} alt="" referrerPolicy="origin" />
        <i className="shine" />
        <div className="sq-top">
          {c.form && <i className="sq-f">{c.form}</i>}
          {tag && <i className={`sq-act ${tag.active ? 'live' : ''}`}>{tag.active ? '📺 Active' : '🏛️ Legacy'}</i>}
          {vault > 0 && <i className="sq-act vault" title="Stockpile: pays out when big news or their story returns">📦 {vault}</i>}
          {streak > 0 && <i className="sq-act streak" title={`Scoring streak: ${streak} week${streak > 1 ? 's' : ''}, pays +${Math.min(2 * streak, 10)} if they score again`}>🔥 {streak}</i>}
          {captain && <i className="sq-crown">👑 {captain}</i>}
          {benched && <i className="sq-bn">🪑 Bench</i>}
          {dead && <i className="sq-bn">💀 Dead</i>}
        </div>
        <div className="sq-bot">
          <b>{c.name}</b>
          <div className="sq-pts"><strong><CountUp to={pts} /></strong><span>pts</span><em className={wk < 0 ? 'dn' : 'up'}>{sign(wk)} this wk</em></div>
          {form}
        </div>
        <span className="sq-hint">tap to flip</span>
      </div>
      <div className="sq-back">
        <b>{c.name}</b><small>{c.media_title}</small>
        <div className="sq-break">{by.map(([k, v]) => <div key={k}><span>{KINDS[k]?.[0]} {KINDS[k]?.[1]}</span><i><em className={v < 0 ? 'neg' : ''} style={{ width: `${Math.abs(v) / maxAbs * 100}%` }} /></i><strong>{sign(v)}</strong></div>)}
          {!by.length && <p>No points yet.</p>}</div>
        <div className="sq-acts" onClick={e => e.stopPropagation()}>{actions}<button className="btn sm" onClick={() => openChar(c.id)}>Profile</button></div>
      </div>
    </div>
  </div>
}

export function ChipCard({ ic, name, desc, state, label, disabled, onClick }) {
  const tilt = useTilt(14)
  return <button className={`lb-chip ${state}`} disabled={disabled} onClick={onClick} {...tilt}>
    <i className="shine" /><b>{ic}</b><strong>{name}</strong><span>{desc}</span><em>{label}</em>
  </button>
}
