import { FIGHTERS, TIER_NAMES } from '../vsdata.js'
import { fight } from '../vsengine.js'
import './clip.css'

// Vertical (9:16) animated scenes for TikTok/Shorts. The recorder injects window.__FEED (from clip_feed) and opens
// clips.html?scene=vs&a=gojo&b=sukuna  |  scene=crash&i=0  |  scene=cup  |  scene=moments  |  scene=movers
const q = new URLSearchParams(location.search)
const feed = window.__FEED || { shocks: [], cup: [], moments: [], movers: [], images: {} }
const pct = v => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1)}%`

function End({ line }) {
  return <div className="c-end"><div className="c-logo"><i>R</i><b>RANKED</b></div><p>{line}</p><small>link in bio</small></div>
}

function Vs() {
  const A = FIGHTERS.find(f => f.id === q.get('a')) || FIGHTERS[0], B = FIGHTERS.find(f => f.id === q.get('b')) || FIGHTERS[1]
  const fa = A.forms.at(-1), fb = B.forms.at(-1)
  const r = fight({ ...fa, short: A.name }, { ...fb, short: B.name }, { blood: true })
  const win = r.winner === 'A' ? A : r.winner === 'B' ? B : null
  const img = f => feed.images[f.search] || ''
  return <div className="clip vs">
    <div className="c-hook">Who actually wins? 🤔</div>
    <div className="c-fighter a"><img src={img(A)} alt="" /><b>{A.name}</b><span>{fa.name}</span><em>{fa.tier} · {TIER_NAMES[fa.tier]}</em></div>
    <div className="c-vs">VS</div>
    <div className="c-fighter b"><img src={img(B)} alt="" /><b>{B.name}</b><span>{fb.name}</span><em>{fb.tier} · {TIER_NAMES[fb.tier]}</em></div>
    <div className="c-reasons">{r.reasons.slice(0, 3).map((x, i) => <div key={i} style={{ animationDelay: `${5.2 + i * 0.9}s` }}>{x.t}</div>)}</div>
    <div className="c-verdict"><span className="c-stamp">{r.verdict}</span><b>{win ? `${win.name} wins` : 'Dead even'}</b><em>{Math.round(Math.max(r.win, 1 - r.win) * 100)}%</em></div>
    <End line="Pick ANY two fighters, any form →" />
  </div>
}

function Crash() {
  const s = feed.shocks[+q.get('i') || 0]
  if (!s) return <div className="clip"><div className="c-hook">No shocks this week</div></div>
  const down = s.pct < 0
  const pts = Array.from({ length: 24 }, (_, i) => i < 17 ? 60 + Math.sin(i * 1.3) * 6 + i * 0.4 : (down ? 60 + 6 - (i - 16) * 9 : 60 - (i - 16) * 9))
  const d = pts.map((y, i) => `${(i / 23) * 100},${y}`).join(' ')
  return <div className={`clip crash ${down ? 'down' : 'up'}`}>
    <div className="c-hook">{down ? `${s.name} just got hit… 📉` : `${s.name} just went OFF 🚀`}</div>
    <div className="c-port"><img src={s.image} alt="" /><b>${s.sym}</b></div>
    <svg className="c-chart" viewBox="0 0 100 120" preserveAspectRatio="none"><polyline points={d} /></svg>
    <div className="c-big">{pct(s.pct)}</div>
    <div className="c-sfx">{down ? 'ガーン' : 'ドーン!!'}</div>
    <div className="c-note">{s.note}</div>
    <div className="c-alert">{down ? '🚨 MARKET CRASH · panic sell?' : '🚀 PRICE SPIKE · ride it?'}</div>
    <End line="Trade anime characters like stocks →" />
  </div>
}

function Cup() {
  return <div className="clip cup">
    <div className="c-hook">This week's Trading Cup 🏆</div>
    <div className="c-sub">Who made the most trading anime characters?</div>
    <div className="c-board">{feed.cup.map((r, i) => <div key={r.username} style={{ animationDelay: `${1.4 + (feed.cup.length - i) * 0.7}s` }}>
      <i>{i === 0 ? '🏆' : i + 1}</i><b>{r.username}</b><em className={r.pct >= 0 ? 'up' : 'dn'}>{pct(r.pct)}</em></div>)}</div>
    <End line="New cup every Monday. Start with 10k →" />
  </div>
}

function Moments() {
  return <div className="clip moments">
    <div className="c-hook">Biggest fantasy plays this week ⚡</div>
    <div className="c-moms">{feed.moments.slice(0, 4).map((m, i) => <div key={i} style={{ animationDelay: `${1.2 + i * 1.6}s` }}>
      <img src={m.image} alt="" /><div><b>{m.name}</b><span>{m.note}</span><small>{m.team}'s team</small></div><em className={m.points >= 0 ? 'up' : 'dn'}>{m.points > 0 ? '+' : ''}{m.points}</em></div>)}</div>
    <End line="Fantasy football, but anime →" />
  </div>
}

function Movers() {
  const m = feed.movers.slice(0, 6)
  return <div className="clip movers">
    <div className="c-hook">Anime stock market today 📈</div>
    <div className="c-grid">{m.map((x, i) => <div key={x.sym} className={x.ch >= 0 ? 'up' : 'dn'} style={{ animationDelay: `${1 + i * 0.5}s` }}>
      <img src={x.image} alt="" /><b>${x.sym}</b><em>{pct(x.ch)}</em></div>)}</div>
    <End line="Buy the hype. Short the flops →" />
  </div>
}

export default function Clip() {
  const s = q.get('scene')
  return s === 'crash' ? <Crash /> : s === 'cup' ? <Cup /> : s === 'moments' ? <Moments /> : s === 'movers' ? <Movers /> : <Vs />
}
