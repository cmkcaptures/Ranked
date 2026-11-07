import { useEffect, useMemo, useState } from 'react'
import { sb } from './cloud.js'
import { openChar } from './CharProfile.jsx'

// Live snake draft: lobby → randomised order → 5 rounds (1..n then n..1). Everyone sees picks land in real time.
const turnOf = (order, n) => {
  const len = order.length, r = Math.floor(n / len), i = n % len
  return r % 2 === 0 ? order[i] : order[len - 1 - i]
}

// commissioner tools (AspextPro only; the server checks too)
export function Commish({ me, friends, reload }) {
  const [busy, setBusy] = useState(false)
  if (friends.find(f => f.id === me.id)?.username !== 'AspextPro') return null
  const go = async (fn, msg, done) => {
    if (!confirm(msg)) return
    setBusy(true); const { data, error } = await sb.rpc(fn); setBusy(false)
    if (error) alert(error.message); else { alert(done(data)); reload() }
  }
  return <div className="commish">
    <b>🛡️ Commissioner</b>
    <ResetDraft me={me} friends={friends} reload={reload} />
    <button className="pill ghost dlreset" disabled={busy} onClick={() => go('commish_reset_teams', 'Clear EVERY team (all picks, captains and swaps)? Points already scored stay.', n => `Cleared ${n} picks.`)}>🧹 Reset teams</button>
    <button className="pill ghost dlreset" disabled={busy} onClick={() => go('commish_reset_points', 'Reset EVERYONE to 0 points for this season? (It can be undone.)', n => `Reset ${n} scoring entries. Everyone's on 0.`)}>0️⃣ Reset points</button>
  </div>
}

export function ResetDraft({ me, friends, reload }) {
  const [busy, setBusy] = useState(false)
  if (friends.find(f => f.id === me.id)?.username !== 'AspextPro') return null
  const go = async () => {
    if (!confirm('Reset the draft? Every pick so far is wiped and everyone goes back to the lobby.')) return
    setBusy(true); const { error } = await sb.rpc('draft_reset'); setBusy(false)
    if (error) alert(error.message); else reload()
  }
  return <button className="pill ghost dlreset" disabled={busy} onClick={go}>↺ Reset draft</button>
}

export default function Draft({ d, me, friends, chars, info, picks, reload }) {
  const [q, setQ] = useState('')
  const [order, setOrder] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const name = id => friends.find(f => f.id === id)?.username || '?'
  const ava = id => friends.find(f => f.id === id)?.avatar
  const byId = useMemo(() => Object.fromEntries(chars.map(c => [c.id, c])), [chars])
  const call = async (fn, args) => {
    setErr(''); setBusy(true)
    const { error } = await sb.rpc(fn, args)
    setBusy(false)
    if (error) setErr(error.message); else reload()
  }

  if (d.status === 'lobby') {
    const inIt = d.joined.includes(me.id)
    const commish = friends.find(f => f.id === me.id)?.username === 'AspextPro'
    // commissioner's chosen order (defaults to lobby order, keeps up as people join/leave)
    const ord = [...(order || []).filter(u => d.joined.includes(u)), ...d.joined.filter(u => !(order || []).includes(u))]
    const move = (i, k) => { const o = [...ord]; const j = i + k; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; setOrder(o) }
    return <div className="draft">
      <div className="dlhead"><div className="kicker">Fall draft</div><h1>DRAFT LOBBY</h1>
        <p>Everyone joining hits <b>Join</b>, then anyone starts it. Pick order is random, snake style (1→{Math.max(d.joined.length, 2)}, then back), 5 rounds, one character per show.</p></div>
      <div className="dljoined">{d.joined.map(u => <div key={u}>{ava(u) ? <img src={ava(u)} alt="" /> : <span>{name(u)[0]}</span>}<b>{name(u)}</b></div>)}
        {!d.joined.length && <div className="muted">Nobody's in yet.</div>}</div>
      {commish && d.joined.length >= 2 && <div className="dlorder">
        <b>🛡️ Set the pick order</b>
        {ord.map((u, i) => <div key={u}><span>{i + 1}</span><b>{name(u)}</b>
          <button className="pill ghost" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
          <button className="pill ghost" onClick={() => move(i, 1)} disabled={i === ord.length - 1}>↓</button></div>)}
        <button className="flock" disabled={busy} onClick={() => confirm(`Start with this order: ${ord.map(name).join(' → ')}? Everyone will see it was set by the commissioner.`) && call('draft_start_ordered', { p_order: ord })}>Start with my order</button>
      </div>}
      {err && <div className="ferr card pad">{err}</div>}
      <div className="row gap">
        <ResetDraft me={me} friends={friends} reload={reload} />
        {inIt ? <button className="pill ghost" disabled={busy} onClick={() => call('draft_leave')}>Leave</button>
          : <button className="flock" disabled={busy} onClick={() => call('draft_join')}>Join draft</button>}
        {inIt && <button className="flock" disabled={busy || d.joined.length < 2} onClick={() => confirm(`Start the draft with ${d.joined.length} players (${d.joined.map(name).join(', ')})? Nobody can join once it starts.`) && call('draft_start')}>
          {d.joined.length < 2 ? 'Waiting for players…' : `Start draft (${d.joined.length} players)`}</button>}
      </div>
    </div>
  }

  // live
  const order = d.draft_order || []
  const total = order.length * d.rounds
  const turn = turnOf(order, d.pick_no)
  const mine = turn === me.id
  const round = Math.floor(d.pick_no / order.length) + 1
  const left = Math.max(0, 120 - Math.floor((now - new Date(d.turn_started)) / 1000))
  const myPicks = picks.filter(p => p.user_id === me.id).map(p => p.char_id)
  const myShows = new Set(myPicks.map(id => info[id]?.show_key).filter(Boolean))
  const taken = new Set(picks.map(p => p.char_id))
  const shown = chars.filter(c => !taken.has(c.id) && (!q || (c.name + ' ' + (c.media_title || '')).toLowerCase().includes(q.toLowerCase()))).slice(0, 90)
  // board: one column per player, in draft order, picks in the order they were made
  const col = u => picks.filter(p => p.user_id === u).sort((a, b) => new Date(a.picked_at) - new Date(b.picked_at))
  const upNext = [1, 2, 3].map(k => d.pick_no + k < total ? turnOf(order, d.pick_no + k) : null).filter(Boolean)

  return <div className="draft">
    <div className={`dlturn ${mine ? 'me' : ''}`}>
      <div><span>Round {round} of {d.rounds} · pick {d.pick_no + 1} of {total}{d.order_by_commish ? ' · 🛡️ Order set by the commissioner' : ' · 🎲 Random order'}</span>
        <h2>{mine ? "YOU'RE ON THE CLOCK" : `${name(turn).toUpperCase()} IS PICKING`}</h2>
        <small>Up next: {upNext.map(name).join(' → ') || 'last pick'}</small>
        <div><ResetDraft me={me} friends={friends} reload={reload} /></div></div>
      <div className={`dlclock ${left < 20 ? 'low' : ''}`}><b>{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</b>
        {!mine && left === 0 && order.includes(me.id) && <button className="pill" disabled={busy} onClick={() => call('draft_skip')}>Skip them</button>}</div>
    </div>
    {err && <div className="ferr card pad">{err}</div>}

    <div className="dlboard" style={{ gridTemplateColumns: `repeat(${order.length}, 1fr)` }}>
      {order.map(u => <div key={u} className={`dlcol ${u === turn ? 'on' : ''}`}>
        <div className="dlname">{ava(u) && <img src={ava(u)} alt="" />}<b>{name(u)}</b></div>
        {[...Array(d.rounds)].map((_, i) => { const p = col(u)[i]; const c = p && byId[p.char_id]
          return <div key={i} className={`dlslot ${c ? 'full' : ''}`} onClick={() => c && openChar(c.id)}>
            {c ? <><img src={c.image} alt="" referrerPolicy="origin" /><span>{c.name}</span></> : <em>R{i + 1}</em>}</div> })}
      </div>)}
    </div>

    <div className="fbar">
      <input className="search" placeholder={mine ? 'Search and tap a character to draft them…' : 'Scout while you wait…'} value={q} onChange={e => setQ(e.target.value)} />
      <span className="muted small">📺 Active scores from episodes & chapters · 🏛️ Legacy gets hype ×1.5</span>
    </div>
    <div className="fgrid dlgrid">
      {shown.map(c => { const clash = myShows.has(info[c.id]?.show_key)
        return <div key={c.id} className={`fchar ${clash ? 'off' : ''}`} style={{ '--c': c.color || '#7b5cff' }}
          onClick={() => !clash && mine && !busy && call('draft_pick', { p_char: c.id })}>
          <img src={c.image} alt="" loading="lazy" referrerPolicy="origin" />
          {c.form && <i className="fform">{c.form}</i>}
          {info[c.id] && <i className={`ftag ${info[c.id].active ? 'live' : 'legacy'}`}>{info[c.id].active ? '📺 Active' : '🏛️ Legacy ×1.5'}</i>}
          <div className="fcap"><b>{c.name}</b><span>{clash ? 'you have someone from this show' : c.media_title}</span></div>
          {mine && !clash && <i className="dlpick">DRAFT</i>}
        </div> })}
    </div>
  </div>
}
