import './terminal.css'
import { useEffect, useRef, useState } from 'react'
import { sb } from './cloud.js'
import { sfx } from './sfx.js'
import { coins, pct, change24 } from './market.js'
import { openChar } from './CharProfile.jsx'

// ---------- live-ticking prices ----------
// The server reprices every 5 minutes. In between, each visible price drifts a little every ~2s toward where the
// server is heading (power target) with small noise, never straying more than 1.5% from the real price.
// Trades always fill at the real server price.
export function useLivePrices(chars, idsRef) {
  const [live, setLive] = useState({})
  const ref = useRef({})
  useEffect(() => { ref.current = {}; setLive({}) }, [chars])
  useEffect(() => {
    const t = setInterval(() => {
      const next = { ...ref.current }
      const byId = new Map((chars || []).map(c => [c.id, c]))
      for (const id of idsRef.current || []) {
        const c = byId.get(id); if (!c || !c.price) continue
        const real = +c.price, cur = next[id]?.p ?? real
        const target = c.p0 ? +c.base * +c.power / +c.p0 : real
        const drift = (target - cur) * 0.004
        let p = cur + drift + cur * (Math.random() - 0.5) * 0.004
        p = Math.min(real * 1.015, Math.max(real * 0.985, p))
        next[id] = { p, dir: p > cur ? 1 : p < cur ? -1 : 0, at: Date.now() }
      }
      ref.current = next; setLive(next)
    }, 2200)
    return () => clearInterval(t)
  }, [chars])
  return live
}
export const livePrice = (c, live) => live[c.id]?.p ?? +c.price
export const liveChange = (c, live) => c.price_24h > 0 ? livePrice(c, live) / c.price_24h - 1 : change24(c)

// a number that flashes green/red whenever it moves
export function Flash({ v, children, className = '' }) {
  const prev = useRef(v), [f, setF] = useState('')
  useEffect(() => {
    if (v > prev.current) setF('fl-up'); else if (v < prev.current) setF('fl-dn')
    prev.current = v
    const t = setTimeout(() => setF(''), 700); return () => clearTimeout(t)
  }, [v])
  return <span className={`${className} ${f}`}>{children}</span>
}

// ---------- top movers strip ----------
export function Movers({ chars, live, onPick }) {
  const ranked = chars.filter(c => c.price_24h > 0 && (!c.ipo_at || new Date(c.ipo_at) <= Date.now())).map(c => ({ c, ch: liveChange(c, live) }))
  const up = [...ranked].sort((a, b) => b.ch - a.ch).slice(0, 5), dn = [...ranked].sort((a, b) => a.ch - b.ch).slice(0, 5)
  const M = ({ c, ch }) => <button className={`mv-chip ${ch >= 0 ? 'up' : 'dn'}`} onClick={() => onPick(c.id)}>
    <img src={c.image} alt="" referrerPolicy="origin" /><b>${c.sym}</b><Flash v={livePrice(c, live)} className="mv-p">{coins(livePrice(c, live))}</Flash><em>{pct(ch)}</em></button>
  return <div className="movers">
    <div className="mv-side"><h4>▲ Gainers</h4><div>{up.map(x => <M key={x.c.id} {...x} />)}</div></div>
    <div className="mv-side"><h4>▼ Losers</h4><div>{dn.map(x => <M key={x.c.id} {...x} />)}</div></div>
  </div>
}

// ---------- heatmap ----------
// tiles sized by how much the squad + hype care (price x hype weight), coloured by today's move
export function Heatmap({ chars, live, onPick, sel }) {
  const list = chars.filter(c => c.price > 0 && (!c.ipo_at || new Date(c.ipo_at) <= Date.now()))
    .map(c => ({ c, ch: liveChange(c, live), w: +c.price * (1 + Math.max(0, +c.hype || 0)) })).sort((a, b) => b.w - a.w).slice(0, 72)
  const max = list[0]?.w || 1
  return <div className="heat">{list.map(({ c, ch, w }) => {
    const big = w / max > 0.55 ? 3 : w / max > 0.25 ? 2 : 1
    const a = Math.min(1, Math.abs(ch) / 0.12)
    const bg = ch >= 0 ? `rgba(46, 190, 110, ${0.18 + a * 0.62})` : `rgba(232, 32, 47, ${0.18 + a * 0.62})`
    return <button key={c.id} className={`ht s${big} ${sel?.id === c.id ? 'sel' : ''}`} style={{ background: bg }} onClick={() => onPick(c.id)} title={`${c.name} · ${pct(ch)}`}>
      {big > 1 && <img src={c.image} alt="" referrerPolicy="origin" />}
      <b>${c.sym}</b><Flash v={livePrice(c, live)}><em>{pct(ch)}</em></Flash>
    </button> })}</div>
}

// ---------- live trade tape ----------
export function TradeTape({ friends, byId, onPick }) {
  const [rows, setRows] = useState([])
  const name = id => friends.find(f => f.id === id)?.username || 'Someone'
  useEffect(() => {
    sb.from('activity').select('id, user_id, payload, created_at').eq('kind', 'trade').order('created_at', { ascending: false }).limit(40)
      .then(({ data }) => setRows(data || []))
    const ch = sb.channel('tradetape').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity' }, ({ new: r }) => {
      if (r.kind !== 'trade') return
      setRows(x => [{ ...r, fresh: true }, ...x].slice(0, 60))
      const v = Math.abs(r.payload?.qty || 0) * (r.payload?.price || 0)
      if (v > 1500) sfx(r.payload?.qty > 0 ? 'money' : 'deal', { text: v > 5000 ? 'ドドド' : undefined, at: { x: innerWidth - 160, y: 260 } })
    }).subscribe()
    return () => { sb.removeChannel(ch) }
  }, [])
  const ago = t => { const s = (Date.now() - new Date(t)) / 1000; return s < 60 ? 'now' : s < 3600 ? `${Math.floor(s / 60)}m` : s < 86400 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 86400)}d` }
  return <div className="ttape">
    <h4><i className="ttape-dot" />Live trades</h4>
    <div className="ttape-list">{rows.map(r => { const p = r.payload || {}, buy = p.qty > 0, short = p.short, c = byId[p.char_id]
      if (!p.sym) return null
      return <div key={r.id} className={`tt ${short ? 'short' : buy ? 'buy' : 'sell'} ${r.fresh ? 'fresh' : ''}`} onClick={() => c && onPick(c.id)}>
        {c && <img src={c.image} alt="" referrerPolicy="origin" />}
        <div><b>{name(r.user_id)}</b> <span>{short ? 'shorted' : buy ? 'bought' : 'sold'} {Math.abs(p.qty)} <b>${p.sym}</b></span>
          <small>@ {coins(p.price)}{p.pnl != null && <em className={p.pnl >= 0 ? 'up' : 'down'}> · {p.pnl >= 0 ? '+' : ''}{Math.round(p.pnl)}</em>}</small></div>
        <time>{ago(r.created_at)}</time>
      </div> })}
      {!rows.length && <div className="muted small pad">No trades yet. Be the first.</div>}</div>
  </div>
}
