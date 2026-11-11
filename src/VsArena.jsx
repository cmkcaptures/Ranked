import { useEffect, useMemo, useState } from 'react'
import { sb } from './cloud.js'
import { sfx } from './sfx.js'
import { searchCharacters } from './api.js'
import { FIGHTERS, TIERS, TIER_NAMES, ABILITY } from './vsdata.js'
import { fight, tierIndex } from './vsengine.js'
import './vs.css'

const SERIES = [...new Set(FIGHTERS.map(f => f.series))]
const pick = () => FIGHTERS[Math.floor(Math.random() * FIGHTERS.length)]

// images: our market characters first, AniList search for anyone missing
function useImages() {
  const [img, setImg] = useState({})
  useEffect(() => {
    let cancel = false
    const names = FIGHTERS.map(f => f.search)
    const go = async () => {
      const found = {}
      if (sb) { const { data } = await sb.from('characters').select('name, image').in('name', names); for (const r of data || []) found[r.name] = r.image }
      if (!cancel) setImg({ ...found })
      for (const f of FIGHTERS) if (!found[f.search]) {
        try { const r = await searchCharacters(f.search); if (r?.[0]) { found[f.search] = r[0].image.large; if (!cancel) setImg({ ...found }) } } catch {}
        await new Promise(r => setTimeout(r, 700))
      }
    }
    go(); return () => { cancel = true }
  }, [])
  return img
}

function Picker({ side, sel, setSel, img, form, setForm, off, setOff }) {
  const [series, setSeries] = useState('All')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const list = FIGHTERS.filter(f => (series === 'All' || f.series === series) && (!q || (f.name + f.series).toLowerCase().includes(q.toLowerCase())))
  const fo = sel.forms.find(x => x.id === form) || sel.forms[sel.forms.length - 1]
  const eras = [...new Set(sel.forms.map(x => x.era))]
  return <div className={`vs-pick ${side}`}>
    <button className="vs-who" onClick={() => setOpen(o => !o)} data-nosfx="1">
      <div className="vs-art" key={sel.id + fo.id}>{img[sel.search] && <img src={img[sel.search]} alt="" referrerPolicy="origin" />}<i className="vs-shine" /></div>
      <div className="vs-name"><small>{sel.series}</small><b>{sel.name}</b><span>{fo.name}</span><em className="vs-change">{open ? 'close ▲' : 'change fighter ▼'}</em></div>
    </button>
    {open && <div className="vs-roster">
      <div className="vs-roster-top"><input className="search" placeholder="Search fighters…" value={q} onChange={e => setQ(e.target.value)} autoFocus />
        <select className="search" value={series} onChange={e => setSeries(e.target.value)}><option>All</option>{SERIES.map(s => <option key={s}>{s}</option>)}</select></div>
      <div className="vs-grid">{list.map(f => <button key={f.id} className={f.id === sel.id ? 'on' : ''} data-nosfx="1"
        onClick={() => { setSel(f); setForm(f.forms[f.forms.length - 1].id); setOff([]); setOpen(false); sfx('press', { text: 'ドン!' }) }}>
        {img[f.search] ? <img src={img[f.search]} alt="" referrerPolicy="origin" /> : <span className="vs-ph">{f.name[0]}</span>}<b>{f.name}</b></button>)}</div>
    </div>}
    <div className="vs-col"><h5>Period of the series</h5>
      <div className="vs-chips">{eras.map(e => { const fs = sel.forms.filter(x => x.era === e); const on = fs.some(x => x.id === fo.id)
        return <button key={e} className={on ? 'on' : ''} onClick={() => { setForm(fs[fs.length - 1].id); setOff([]) }}>{e}</button> })}</div></div>
    <div className="vs-col"><h5>Form / transformation</h5>
      <div className="vs-chips">{sel.forms.map(x => <button key={x.id} className={x.id === fo.id ? 'on' : ''} onClick={() => { setForm(x.id); setOff([]); sfx('power', { text: 'ゴゴゴ' }) }}>{x.name}</button>)}</div></div>
    <div className="vs-col"><h5>Abilities & moves <small>(tap to turn off)</small></h5>
      <div className="vs-chips abil">{fo.abil.length ? fo.abil.map(a => <button key={a} className={off.includes(a) ? 'off' : 'on'} onClick={() => setOff(o => o.includes(a) ? o.filter(x => x !== a) : [...o, a])}>{ABILITY[a] || a}</button>)
        : <span className="muted small">Pure stats, no special hax</span>}</div></div>
  </div>
}

function Bar({ label, a, b, max, fmt = v => v }) {
  const pa = Math.max(4, a / max * 100), pb = Math.max(4, b / max * 100)
  return <div className="vs-bar"><span className={a >= b ? 'win' : ''}>{fmt(a)}</span>
    <div className="vs-track"><i className="l" style={{ width: `${pa / 2}%` }} /><i className="r" style={{ width: `${pb / 2}%` }} /><b>{label}</b></div>
    <span className={b >= a ? 'win' : ''}>{fmt(b)}</span></div>
}

// #/vs/gojo.present~sukuna.full opens that exact matchup (used by share links and the Google pages)
const fromHash = () => {
  const m = decodeURIComponent(location.hash).match(/#\/vs\/([a-z0-9-]+)\.([a-z0-9-]+)~([a-z0-9-]+)\.([a-z0-9-]+)/)
  if (!m) return null
  const a = FIGHTERS.find(f => f.id === m[1]), b = FIGHTERS.find(f => f.id === m[3])
  return a && b ? { a, b, fa: a.forms.some(x => x.id === m[2]) ? m[2] : a.forms.at(-1).id, fb: b.forms.some(x => x.id === m[4]) ? m[4] : b.forms.at(-1).id } : null
}
export default function VsArena() {
  const img = useImages()
  const init = fromHash()
  const [A, setA] = useState(() => init?.a || FIGHTERS.find(f => f.id === 'gojo'))
  const [B, setB] = useState(() => init?.b || FIGHTERS.find(f => f.id === 'sukuna'))
  const [fa, setFa] = useState(init?.fa || 'present'), [fb, setFb] = useState(init?.fb || 'full')
  const [copied, setCopied] = useState(false)
  const [offA, setOffA] = useState([]), [offB, setOffB] = useState([])
  const [opt, setOpt] = useState({ noHax: false, prep: false, blood: true })
  const [bang, setBang] = useState(0)
  const formA = A.forms.find(x => x.id === fa) || A.forms[A.forms.length - 1]
  const formB = B.forms.find(x => x.id === fb) || B.forms[B.forms.length - 1]
  const r = useMemo(() => fight({ ...formA, short: A.name }, { ...formB, short: B.name }, { ...opt, offA, offB }), [formA, formB, opt, offA, offB])
  useEffect(() => { setBang(x => x + 1); const t = setTimeout(() => sfx(r.verdict === 'STOMP' || r.verdict === 'DEFINITELY' ? 'win' : r.verdict === 'TOSS-UP' ? 'power' : 'press',
    { text: r.verdict === 'STOMP' ? 'ワンパン!' : r.verdict === 'TOSS-UP' ? 'ゴゴゴ' : 'ドン!', at: { x: innerWidth / 2, y: 260 } }), 650); return () => clearTimeout(t) }, [formA.id, formB.id, A.id, B.id])
  const winName = r.winner === 'A' ? A.name : r.winner === 'B' ? B.name : null
  const pctA = Math.round(r.win * 100)
  const random = () => { let a = pick(), b = pick(); while (b.id === a.id) b = pick(); setA(a); setB(b); setFa(a.forms[a.forms.length - 1].id); setFb(b.forms[b.forms.length - 1].id); setOffA([]); setOffB([]) }
  const link = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}vs/${A.id}-vs-${B.id}/`
  const share = async () => {
    const text = `${winName ? `${winName} beats ${winName === A.name ? B.name : A.name}` : `${A.name} vs ${B.name} is dead even`} (${r.verdict}, ${Math.max(pctA, 100 - pctA)}%). Fight me 👇`
    const url = `${location.origin}${location.pathname}#/vs/${A.id}.${formA.id}~${B.id}.${formB.id}`
    try { if (navigator.share) await navigator.share({ title: `${A.name} vs ${B.name}: who would win?`, text, url }); else { await navigator.clipboard.writeText(`${text}\n${url}`); setCopied(true); setTimeout(() => setCopied(false), 2000) } } catch {}
    sfx('crown', { text: 'シェア!' })
  }
  useEffect(() => { const h = `#/vs/${A.id}.${formA.id}~${B.id}.${formB.id}`; if (location.hash !== h) window.history.replaceState(window.history.state, '', h) }, [A.id, B.id, formA.id, formB.id])
  const swap = () => { setA(B); setB(A); setFa(fb); setFb(fa); setOffA(offB); setOffB(offA) }
  const tI = f => TIERS.indexOf(f.tier) + 1 + f.plus * 0.45
  return <div className="vsa">
    <div className="vs-hero">
      <div className="vs-title"><small>ランクド・バトル</small><h1>VS Arena</h1><p>Who would win? Scored from VS Battles Wiki tiers per era & form, series feats and r/PowerScaling consensus.</p></div>
      <div className="vs-btns"><button className="pill" onClick={random}>🎲 Random fight</button><button className="pill ghost" onClick={swap}>⇄ Swap sides</button><button className="pill" onClick={share}>{copied ? '✓ Copied' : '📤 Share result'}</button></div>
    </div>

    <div className="vs-stage">
      <Picker side="left" sel={A} setSel={setA} img={img} form={fa} setForm={setFa} off={offA} setOff={setOffA} />
      <div className="vs-mid" key={bang}>
        <div className="vs-emblem"><span>V</span><span>S</span></div>
        <div className={`vs-stamp v-${r.verdict.toLowerCase().replace(/[^a-z]/g, '')}`}>{r.verdict}</div>
        <div className="vs-winner">{winName ? <><small>{r.verdict === 'TOSS-UP' ? 'slight edge' : 'winner'}</small><b>{winName}</b><em>{r.diff}</em></> : <b>Dead even</b>}</div>
        <div className="vs-odds"><span>{pctA}%</span><div><i style={{ width: `${pctA}%` }} /></div><span>{100 - pctA}%</span></div>
      </div>
      <Picker side="right" sel={B} setSel={setB} img={img} form={fb} setForm={setFb} off={offB} setOff={setOffB} />
    </div>

    <div className="vs-opts">{[['blood', '🩸 Bloodlusted'], ['prep', '🧠 Prep time'], ['noHax', '🚫 Stats only (no hax)']].map(([k, l]) =>
      <button key={k} className={opt[k] ? 'on' : ''} onClick={() => setOpt(o => ({ ...o, [k]: !o[k] }))}>{l}</button>)}</div>

    <div className="vs-body" key={'b' + bang}>
      <section className="vs-stats">
        <h3>Tale of the tape</h3>
        <div className="vs-tiers"><div><b>{formA.tier}{formA.plus ? '+' : ''}</b><small>{TIER_NAMES[formA.tier]} level</small></div><i>tier</i><div><b>{formB.tier}{formB.plus ? '+' : ''}</b><small>{TIER_NAMES[formB.tier]} level</small></div></div>
        <Bar label="Power" a={tI(formA)} b={tI(formB)} max={TIERS.length} fmt={v => v.toFixed(0)} />
        <Bar label="Speed" a={formA.spd} b={formB.spd} max={12} />
        <Bar label="Fight IQ" a={formA.iq} b={formB.iq} max={10} />
        <Bar label="Stamina" a={formA.stam} b={formB.stam} max={12} />
        <Bar label="Hax" a={formA.abil.filter(x => !offA.includes(x)).length} b={formB.abil.filter(x => !offB.includes(x)).length} max={7} />
      </section>
      <section className="vs-why">
        <h3>Why</h3>
        {r.reasons.map((x, i) => <div key={i} className={`vs-reason ${x.side === 'A' ? 'a' : x.side === 'B' ? 'b' : ''} ${x.hax ? 'hax' : ''}`} style={{ animationDelay: `${i * 90}ms` }}>
          <i>{x.side === 'A' ? '◀' : x.side === 'B' ? '▶' : '='}</i><span>{x.t}</span>{x.hax && <em>HAX</em>}</div>)}
      </section>
      <section className="vs-intel">
        {[[A, formA, 'a'], [B, formB, 'b']].map(([f, fo, k]) => <div key={k} className={`vs-card ${k}`}>
          <h4>{f.name} <small>{fo.name}</small></h4>
          <div className="vs-feats">{fo.feats.map(t => <span key={t}>⚡ {t}</span>)}</div>
          {fo.weak.length > 0 && <div className="vs-weak">{fo.weak.map(t => <span key={t}>⚠️ {t}</span>)}</div>}
          <blockquote>💬 {fo.note}</blockquote>
        </div>)}
      </section>
    </div>
    <p className="vs-foot">Tiers from the VS Battles Wiki (per form, Nov 2026); community takes from r/PowerScaling & r/whowouldwin. A starting point for arguments, not the last word.</p>
  </div>
}
