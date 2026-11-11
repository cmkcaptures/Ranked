import { useEffect, useMemo, useState } from 'react'
import { sb } from './cloud.js'
import { sfx } from './sfx.js'
import { openChar } from './CharProfile.jsx'
import './replay.css'

// Draft-day replay: every pick in order, rebuilt from the activity log, with what each pick has scored since.
// Steal = scored far more than its pick slot suggests; bust = far less.
export default function DraftReplay({ S, draft, chars, charPts, who, onClose }) {
  const [picks, setPicks] = useState(null)
  const [n, setN] = useState(0)
  const [play, setPlay] = useState(true)
  const [speed, setSpeed] = useState(900)
  const byName = useMemo(() => Object.fromEntries(chars.map(c => [c.name, c])), [chars])

  useEffect(() => {
    const total = (draft?.draft_order?.length || 0) * (draft?.rounds || 5)
    sb.from('activity').select('user_id, payload, created_at').eq('kind', 'fantasy_team').order('created_at', { ascending: false }).limit(400).then(({ data }) => {
      const rows = (data || []).filter(r => r.payload?.season === S.label || r.payload?.season === S.key).filter(r => (r.payload?.names || []).length === 1)
      // the latest draft = the most recent `total` single picks
      const mine = rows.slice(0, total || rows.length).reverse()
      setPicks(mine.map((r, i) => ({ no: i + 1, round: Math.floor(i / (draft?.draft_order?.length || 1)) + 1, user: r.user_id, c: byName[r.payload.names[0]], name: r.payload.names[0], cover: r.payload.cover })))
    })
  }, [chars.length])

  // value judgement: rank by points vs pick number
  const verdict = useMemo(() => {
    if (!picks) return {}
    const ranked = [...picks].sort((a, b) => (charPts[b.c?.id] || 0) - (charPts[a.c?.id] || 0)).map(p => p.no)
    const out = {}
    ranked.forEach((no, i) => { const d = no - (i + 1); out[no] = d >= picks.length * 0.35 ? 'steal' : d <= -picks.length * 0.35 ? 'bust' : '' })
    return out
  }, [picks])

  useEffect(() => {
    if (!play || !picks || n >= picks.length) return
    const t = setTimeout(() => {
      const next = n + 1; setN(next)
      const p = picks[next - 1]
      if (verdict[p.no] === 'steal') sfx('win', { text: 'スティール!', at: { x: innerWidth / 2, y: 160 } })
      else if (verdict[p.no] === 'bust') sfx('loss', { text: 'ガーン', at: { x: innerWidth / 2, y: 160 } })
      else if (next % 3 === 0) sfx('press', { at: { x: innerWidth / 2, y: 160 } })
    }, speed)
    return () => clearTimeout(t)
  }, [n, play, picks, speed])

  const name = id => who(id)?.username || '?'
  const order = draft?.draft_order || [...new Set((picks || []).map(p => p.user))]
  const last = picks?.[n - 1]
  if (!picks) return <div className="rp"><div className="rp-load">Rewinding the tape…</div></div>
  if (!picks.length) return <div className="rp" onClick={onClose}><div className="rp-load">No draft found for {S.label} yet.</div></div>
  return <div className="rp">
    <div className="rp-top">
      <div><small>{S.label}</small><b>Draft-day replay</b></div>
      <div className="rp-ctrl">
        <button className="pill ghost" onClick={() => { setN(0); setPlay(true) }}>⏮</button>
        <button className="pill" onClick={() => { if (n >= picks.length) setN(0); setPlay(p => !p) }}>{play && n < picks.length ? '⏸ Pause' : '▶ Play'}</button>
        <button className="pill ghost" onClick={() => setSpeed(s => s > 400 ? 300 : 900)}>{speed > 400 ? '1×' : '3×'}</button>
        <button className="pill ghost" onClick={() => { setN(picks.length); setPlay(false) }}>⏭</button>
        <button className="pill ghost" data-nosfx="1" onClick={onClose}>✕</button>
      </div>
    </div>
    {last && <div key={last.no} className={`rp-now ${verdict[last.no]}`}>
      <img src={last.c?.image || last.cover} alt="" referrerPolicy="origin" />
      <div><small>Round {last.round} · Pick {last.no}</small><b>{name(last.user)}</b><span>selects</span><h2>{last.name}</h2>
        <em>{charPts[last.c?.id] || 0} pts since{verdict[last.no] === 'steal' ? ' · 💎 STEAL' : verdict[last.no] === 'bust' ? ' · 🧱 BUST' : ''}</em></div>
    </div>}
    <div className="rp-board" style={{ gridTemplateColumns: `repeat(${order.length}, minmax(0, 1fr))` }}>
      {order.map(u => <div key={u} className="rp-col"><b>{name(u)}</b>
        {picks.filter(p => p.user === u).map(p => { const shown = p.no <= n
          return <div key={p.no} className={`rp-pick ${shown ? 'on' : ''} ${shown ? verdict[p.no] : ''}`} onClick={() => shown && p.c && openChar(p.c.id)}>
            {shown ? <><img src={p.c?.image || p.cover} alt="" referrerPolicy="origin" /><span><i>#{p.no}</i>{p.name}</span><em>{charPts[p.c?.id] || 0}</em></> : <span className="q">#{p.no}</span>}
          </div> })}
      </div>)}
    </div>
    <div className="rp-prog"><i style={{ width: `${n / picks.length * 100}%` }} /></div>
  </div>
}
