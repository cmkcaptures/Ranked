import './league.css'
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
  const weekStart = S.end - Math.ceil((S.end - Date.now()) / 604800000) * 604800000
  const pct = Math.min(1, Math.max(0, (Date.now() - weekStart) / 604800000))
  const daysLeft = Math.ceil((S.end - Date.now()) / 86400000)
  const R = 34, C = 2 * Math.PI * R
  const tilt = useTilt(8)
  return <div className="lb-hero">
    <div className="lb-week">
      <svg viewBox="0 0 80 80"><circle cx="40" cy="40" r={R} className="trk" /><circle cx="40" cy="40" r={R} className="bar" style={{ strokeDasharray: C, strokeDashoffset: C * (1 - pct) }} /></svg>
      <div><small>Week</small><b>{S.week}</b></div>
      <span>{S.label} · {daysLeft}d left</span>
    </div>
    <div className="lb-score">
      <small>Your points</small>
      <b><CountUp to={mine?.total || 0} /></b>
      <div className="lb-chips">
        <span className={mine?.week < 0 ? 'dn' : 'up'}>{sign(mine?.week || 0)} this week</span>
        <span>#{rank} of {count}</span>
        {chip && <span className="gold">{chip[0]} {chip[1]}</span>}
      </div>
    </div>
    {captain ? <div className="lb-cap" {...tilt} onClick={() => openChar(captain.id)}>
      <img src={captain.image} alt="" referrerPolicy="origin" />
      <i className="shine" />
      <div><small>👑 Captain</small><b>{captain.name}</b></div>
    </div> : <div className="lb-cap empty"><div><small>👑 Captain</small><b>None picked</b></div></div>}
    {feed.length > 0 && <div className="lb-ticker"><div>{[...feed, ...feed].map((e, i) =>
      <span key={i}>{KINDS[e.kind]?.[0]} <b>{byId[e.char_id]?.name || 'Team'}</b> <em className={e.points < 0 ? 'dn' : 'up'}>{sign(e.points)}</em></span>)}</div></div>}
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
  const [grown, setGrown] = useState(false)
  useEffect(() => { const t = setTimeout(() => setGrown(true), 60); return () => clearTimeout(t) }, [])
  // you climbed the table since the week started: celebrate once per session
  useEffect(() => { const i = [...teams].sort((a, b) => b.total - a.total).findIndex(t => t.user === me.id) + 1
    if (i && lastRank[me.id] > i && !sessionStorage.getItem('sfx-climb')) { sessionStorage.setItem('sfx-climb', 1); setTimeout(() => sfx('win', { text: `${lastRank[me.id] - i}位アップ!`, at: { x: innerWidth / 2, y: 220 } }), 900) } }, [teams.length])
  const val = t => mode === 'season' ? t.total : t.week
  const list = [...teams].sort((a, b) => val(b) - val(a))
  const top = Math.max(1, ...list.map(t => Math.abs(val(t))))
  return <div className="lb-race">
    <div className="lb-racehead">
      <h2>{mode === 'season' ? 'The race' : 'This week'}</h2>
      <div className="lb-seg">{[['season', 'Season'], ['week', 'This week']].map(([k, l]) => <button key={k} className={mode === k ? 'on' : ''} onClick={() => setMode(k)}>{l}</button>)}</div>
    </div>
    {list.map((t, i) => { const p = who(t.user), isOpen = open === t.user, moved = mode === 'season' ? (lastRank[t.user] || i + 1) - (i + 1) : 0
      const chip = chipNow(t.user), bench = benchOf(t), cap = capOf(t.user)
      const w = grown ? Math.max(4, Math.abs(val(t)) / top * 100) : 0
      return <div key={t.user} className={`lb-lane p${i + 1} ${t.user === me.id ? 'me' : ''} ${isOpen ? 'open' : ''}`} style={{ '--d': `${i * 70}ms` }}>
        <div className="lb-lanehead" onClick={() => setOpen(isOpen ? null : t.user)}>
          <div className="lb-pos">{i + 1}{moved !== 0 && <i className={moved > 0 ? 'up' : 'dn'}>{moved > 0 ? '▲' : '▼'}{Math.abs(moved)}</i>}</div>
          <div className="lb-track">
            <div className="lb-fill" style={{ width: `${w}%` }}>
              <div className="lb-rider">{p?.avatar ? <img src={p.avatar} alt="" /> : <span>{(p?.username || '?')[0]}</span>}</div>
            </div>
            <div className="lb-name"><b>{p?.username || '?'}</b>{chip && <em title={CHIPS[chip][1]}>{CHIPS[chip][0]}</em>}{t.week === topWeek && t.week > 0 && <em title="Top scorer this week">🔥</em>}</div>
            <div className="lb-faces">{t.chars.map(id => byId[id] && <img key={id} src={byId[id].image} alt="" referrerPolicy="origin" className={`${id === cap ? 'cap' : ''} ${id === bench ? 'bench' : ''}`} />)}</div>
          </div>
          <div className="lb-num"><b><CountUp to={val(t)} /></b><small>{mode === 'season' ? <span className={t.week < 0 ? 'dn' : 'up'}>{sign(t.week)} wk</span> : 'pts'}</small></div>
          <div className="lb-caret">{isOpen ? '−' : '+'}</div>
        </div>
        {isOpen && <div className="lb-squad">
          {t.chars.map(id => { const c = byId[id]; if (!c) return null
            const ev = events.filter(e => e.char_id === id && e.team_user === t.user)
            const big = Object.entries(ev.reduce((m, e) => (m[e.kind] = (m[e.kind] || 0) + e.points, m), {})).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 3)
            return <div key={id} className={`lb-mini ${id === cap ? 'cap' : ''} ${id === bench ? 'bench' : ''} ${dead[id] ? 'dead' : ''}`} onClick={() => openChar(id)}>
              <img src={c.image} alt="" referrerPolicy="origin" />
              {id === cap && <i className="tag gold">👑 C</i>}{id === bench && <i className="tag">🪑 Bench</i>}{dead[id] && <i className="tag red">💀</i>}{vault[id] > 0 && <i className="tag pig">🐷 {vault[id]}</i>}
              <div className="info"><b>{c.name}</b><span>{charPts[id] || 0} pts · <em className={(weekPts[id] || 0) < 0 ? 'dn' : 'up'}>{sign(weekPts[id] || 0)} wk</em></span>
                <div className="kinds">{big.map(([k, v]) => <span key={k}>{KINDS[k]?.[0]} {sign(v)}</span>)}</div></div>
            </div> })}
          <button className="lb-prof" onClick={() => openProfile(t.user)}>View {p?.username}'s profile →</button>
        </div>}
      </div> })}
    {!teams.length && <div className="card pad muted">No teams yet.</div>}
  </div>
}

// ===== My team: flip + tilt cards =====
export function SquadCard({ c, pts, wk, events, KINDS, captain, benched, dead, tag, vault, form, actions, delay = 0 }) {
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
          {vault > 0 && <i className="sq-act vault" title="Piggy bank: pays out when big news or their story returns">🐷 {vault}</i>}
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
