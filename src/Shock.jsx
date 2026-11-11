import { useEffect, useState } from 'react'
import { sb } from './cloud.js'
import { sfx } from './sfx.js'
import { saleResult, showSale } from './profit.js'
import { openChar } from './CharProfile.jsx'
import './shock.css'

// Live story shocks: when a real episode moment moves a character's price, everyone gets a manga panel alert
// with one-tap panic sell / buy the dip. Shows on every page.
const WORDS = { death: 'ガーン', lose: 'ズーン', transform: 'ドドド', win: 'ドン!', news: 'ババーン!', revive: 'ドーン!!', debut: 'ゴゴゴ' }
const LABEL = { death: 'Died', lose: 'Lost a fight', transform: 'Power-up', win: 'Won a fight', news: 'Big news', revive: 'Came back', debut: '🌟 New form debut' }

export default function ShockAlert({ me }) {
  const [q, setQ] = useState([])        // queue of shocks to show
  const [wallet, setWallet] = useState(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const cur = q[0]

  useEffect(() => {
    if (!sb || !me) return
    const ch = sb.channel('shocks').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'story_shocks' }, async ({ new: s }) => {
      const { data: c } = await sb.from('characters').select('id, name, image, sym, price, color').eq('id', s.char_id).maybeSingle()
      if (c) setQ(x => [...x, { ...s, c }])
    }).subscribe()
    return () => { sb.removeChannel(ch) }
  }, [me?.id])

  useEffect(() => {
    if (!cur) return
    setMsg('')
    sb.from('wallets').select('*').eq('user_id', me.id).maybeSingle().then(({ data }) => setWallet(data))
    setTimeout(() => sfx(cur.pct < 0 ? 'loss' : 'win', { text: WORDS[cur.kind], at: { x: innerWidth - 220, y: 130 } }), 300)
    const t = setTimeout(() => next(), 20000)
    return () => clearTimeout(t)
  }, [cur?.id])

  const next = () => setQ(x => x.slice(1))
  if (import.meta.env.DEV) window.testShock = s => setQ(x => [...x, s])
  const held = +(wallet?.holdings?.[cur?.char_id]?.qty || 0)
  const trade = async qty => {
    setBusy(true)
    const { data, error } = await sb.rpc('trade', { p_char: cur.char_id, p_qty: qty })
    setBusy(false)
    if (error) { setMsg(error.message); sfx('loss') }
    else { if (qty < 0) { const r = saleResult(wallet, data, cur.char_id, -qty); showSale(r, cur.c.name); setMsg(r ? `Sold ${-qty}: ${r.profit >= 0 ? '+' : '−'}${Math.round(Math.abs(r.profit))} coins` : `Sold ${-qty}.`) } else { setMsg(`Bought ${qty}. Diamond hands.`); sfx('money') } setWallet(data) }
  }
  if (!cur) return null
  const up = cur.pct > 0, p = Math.round(Math.abs(cur.pct) * 100)
  return <div key={cur.id} className={`shock ${up ? 'up' : 'down'}`} style={{ '--c': cur.c.color || '#e8202f' }}>
    <div className="shock-head"><b>{up ? '🚀 PRICE SPIKE' : '📉 MARKET CRASH'}</b><span>LIVE</span><button className="shock-x" data-nosfx="1" onClick={next}>✕</button></div>
    <div className="shock-body">
      <img src={cur.c.image} alt="" referrerPolicy="origin" onClick={() => openChar(cur.c.id)} />
      <div className="shock-info">
        <div className="shock-kind">{LABEL[cur.kind]}</div>
        <h3>{cur.c.name}</h3>
        <div className="shock-px"><em>{up ? '+' : '−'}{p}%</em><span>${cur.c.sym} {Number(cur.old_price).toFixed(0)} → <b>{Number(cur.new_price).toFixed(0)}</b></span></div>
        {cur.note && <p>{cur.note}</p>}
      </div>
      <div className="shock-word">{WORDS[cur.kind]}</div>
    </div>
    <div className="shock-acts">
      {held > 0 && <button className="pill sell" disabled={busy} onClick={() => trade(-held)}>{up ? `Take profit (${held})` : `Panic sell (${held})`}</button>}
      <button className="pill" disabled={busy} onClick={() => trade(5)}>{up ? 'Ride it ×5' : 'Buy the dip ×5'}</button>
      <button className="pill ghost" onClick={() => { location.hash = '#/market'; next() }}>Market</button>
    </div>
    {msg && <div className="shock-msg">{msg}</div>}
    {q.length > 1 && <div className="shock-more">+{q.length - 1} more</div>}
    <i className="shock-timer" />
  </div>
}
