import { useEffect, useMemo, useRef, useState } from 'react'
import { gql, title } from './api.js'
import './extras.css'

const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }
const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d } catch { return d } }

/* ================= Head-to-head: smart pairs, keyboard, gut-vs-score ================= */
export function AnimeH2H({ list, elo, setElo, openAnime }) {
  const pool = useMemo(() => list.filter(e => e.status === 'COMPLETED' || e.status === 'CURRENT'), [list])
  const r = id => elo[id]?.r ?? 1500, n = id => elo[id]?.n ?? 0
  const pick = () => {
    if (pool.length < 2) return []
    // the least-compared show, against someone close in rating (with a little randomness)
    const by = [...pool].sort((a, b) => n(a.media.id) - n(b.media.id) + Math.random() * 2 - 1)
    const a = by[0].media
    const rest = pool.filter(e => e.media.id !== a.id).sort((x, y) => Math.abs(r(x.media.id) - r(a.id)) - Math.abs(r(y.media.id) - r(a.id)))
    const b = rest[Math.floor(Math.random() * Math.min(5, rest.length))].media
    return Math.random() < .5 ? [a, b] : [b, a]
  }
  const [pair, setPair] = useState(pick)
  const [flash, setFlash] = useState(null)
  useEffect(() => { if (!pair.length) setPair(pick()) }, [pool])
  function choose(i) {
    const win = pair[i], lose = pair[1 - i]
    const ea = 1 / (1 + 10 ** ((r(lose.id) - r(win.id)) / 400)), k = n(win.id) < 5 ? 48 : 32
    setElo({ ...elo, [win.id]: { r: r(win.id) + k * (1 - ea), n: n(win.id) + 1 }, [lose.id]: { r: r(lose.id) - k * (1 - ea), n: n(lose.id) + 1 } })
    setFlash(i); setTimeout(() => { setFlash(null); setPair(pick()) }, 280)
  }
  useEffect(() => {
    const h = e => { if (e.target.tagName === 'INPUT' || pair.length < 2) return
      if (e.key === 'ArrowLeft') choose(0); else if (e.key === 'ArrowRight') choose(1); else if (e.key.toLowerCase() === 's') setPair(pick()) }
    addEventListener('keydown', h); return () => removeEventListener('keydown', h)
  })
  const ranked = pool.filter(e => elo[e.media.id]).sort((a, b) => r(b.media.id) - r(a.media.id))
  const votes = Object.values(elo).reduce((a, b) => a + b.n, 0) / 2
  const need = pool.length * 3, conf = Math.min(100, Math.round(votes / Math.max(1, need) * 100))
  // gut vs score: where your picks disagree with your own AniList score
  const scored = ranked.filter(e => e.score && n(e.media.id) >= 3)
  const byScore = [...scored].sort((a, b) => b.score - a.score).map(e => e.media.id)
  const gaps = scored.map((e, i) => ({ e, gut: i + 1, sc: byScore.indexOf(e.media.id) + 1 })).map(x => ({ ...x, d: x.sc - x.gut }))
  const under = gaps.filter(x => x.d >= 3).sort((a, b) => b.d - a.d).slice(0, 3), over = gaps.filter(x => x.d <= -3).sort((a, b) => a.d - b.d).slice(0, 3)

  return <div className="pg2 x-h2h">
    <div className="shead"><h1>Head <b>to head</b></h1><div className="info">{votes} picks · ← → to pick, S to skip</div></div>
    <div className="x-conf"><span>Ranking confidence</span><i><em style={{ width: `${conf}%` }} /></i><b>{conf}%</b><small>{conf < 100 ? `${Math.max(0, need - votes)} more picks to lock it in` : 'locked in 🔒'}</small></div>
    <div className="pg-cols">
      <div>{pair.length === 2 ? <div className="x-arena">
        {pair.map((m, i) => <button key={m.id} className={`x-side ${flash === i ? 'win' : flash === 1 - i ? 'lose' : ''}`} onClick={() => choose(i)}>
          <div className="x-cv" style={{ backgroundImage: `url(${m.coverImage.extraLarge || m.coverImage.large})` }}><span>{Math.round(r(m.id))}</span></div>
          <b>{title(m)}</b><small>{i ? '→' : '←'} pick</small></button>)}
        <div className="x-vs">VS</div>
      </div> : <div className="panel empty">Finish a couple of shows to start.</div>}
        <div className="center"><button className="btn ghost" onClick={() => setPair(pick())}>Skip</button></div>
        {(under.length > 0 || over.length > 0) && <div className="panel x-gut"><div className="ph">Your gut vs your scores</div>
          {under.map(x => <p key={x.e.media.id}>📈 <b className="linkish" onClick={() => openAnime?.(x.e.media.id)}>{title(x.e.media)}</b>: you keep picking it (#{x.gut}) but only scored it {x.e.score}. Rate it higher?</p>)}
          {over.map(x => <p key={x.e.media.id}>📉 <b className="linkish" onClick={() => openAnime?.(x.e.media.id)}>{title(x.e.media)}</b>: scored {x.e.score}, but it loses a lot (#{x.gut}). Overrated by you?</p>)}
        </div>}
      </div>
      <div className="panel nl"><div className="ph">True ranking <small>FROM YOUR PICKS</small></div>
        {ranked.slice(0, 20).map((e, i) => <div key={e.media.id} className="r" onClick={() => openAnime?.(e.media.id)}><span className="n">{i + 1}</span><img src={e.media.coverImage.medium || e.media.coverImage.large} alt="" /><span>{title(e.media)}</span><i>{Math.round(r(e.media.id))}</i></div>)}
        {!ranked.length && <div className="empty">Pick a few matchups to build it.</div>}</div>
    </div>
  </div>
}

/* ================= Blind Taste Test ================= */
const BLIND_Q = `query($p:Int){ Page(page:$p, perPage:50){ media(type:ANIME, sort:POPULARITY_DESC, isAdult:false, format_in:[TV,MOVIE,ONA]){
  id title { romaji english native } synonyms coverImage { extraLarge large } description(asHtml:false) genres averageScore format seasonYear episodes
  studios(isMain:true){ nodes { name } } tags { name rank isMediaSpoiler } } } }`
const mask = (txt, m) => {
  let s = (txt || '').replace(/<[^>]+>/g, '').replace(/\(Source:[^)]*\)/gi, '').trim()
  const words = [m.title.english, m.title.romaji, ...(m.synonyms || [])].filter(Boolean).flatMap(t => t.split(/[\s:!?.,-]+/)).filter(w => w.length > 3)
  for (const w of new Set(words)) s = s.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '█████')
  return s.length > 420 ? s.slice(0, 420) + '…' : s
}
export function BlindTest({ list, openAnime }) {
  const [pool, setPool] = useState([]), [cur, setCur] = useState(null), [opts, setOpts] = useState([])
  const [guess, setGuess] = useState(70), [pickT, setPickT] = useState(null), [done, setDone] = useState(false), [err, setErr] = useState('')
  const [st, setSt] = useState(() => load('ranked.blind', { rounds: 0, pts: 0, streak: 0, best: 0 }))
  const mine = useMemo(() => new Set(list.map(e => e.media.id)), [list])
  useEffect(() => { Promise.all([1, 2, 3, 4].map(p => gql(BLIND_Q, { p: p + Math.floor(Math.random() * 4) * 4 })))
    .then(ds => setPool(ds.flatMap(d => d.Page.media).filter(m => m.averageScore && m.description))).catch(e => setErr(e.message)) }, [])
  const next = () => {
    if (pool.length < 4) return
    const m = pool[Math.floor(Math.random() * pool.length)]
    const wrong = pool.filter(x => x.id !== m.id && x.genres?.some(g => m.genres.includes(g))).sort(() => Math.random() - .5).slice(0, 3)
    setCur(m); setOpts([m, ...wrong].sort(() => Math.random() - .5)); setGuess(70); setPickT(null); setDone(false)
  }
  useEffect(() => { if (pool.length && !cur) next() }, [pool])
  const lock = () => {
    const diff = Math.abs(guess - cur.averageScore), sp = Math.max(0, 50 - diff * 5), tp = pickT === cur.id ? 50 : 0, tot = sp + tp
    const s = { rounds: st.rounds + 1, pts: st.pts + tot, streak: tp ? st.streak + 1 : 0, best: Math.max(st.best, tp ? st.streak + 1 : 0), last: { sp, tp, diff } }
    setSt(s); store('ranked.blind', s); setDone(true)
  }
  if (err) return <div className="panel empty">{err}</div>
  if (!cur) return <div className="loading">Hiding the titles…</div>
  const tags = (cur.tags || []).filter(t => !t.isMediaSpoiler && t.rank >= 60).slice(0, 6)
  return <div className="pg2 x-blind">
    <div className="shead"><h1>Blind <b>taste test</b></h1><div className="info">{st.pts} pts · {st.rounds} rounds<br />🔥 streak {st.streak} · best {st.best}</div></div>
    <div className="pg-cols">
      <div className="panel x-card">
        <div className={`x-mystery ${done ? 'open' : ''}`} style={done ? { backgroundImage: `url(${cur.coverImage.extraLarge || cur.coverImage.large})` } : {}}>{done ? '' : '?'}</div>
        <div>
          <div className="kick"><b>{cur.format?.replace('_', ' ')}</b> {cur.seasonYear} · {cur.episodes ?? '?'} eps · {cur.studios?.nodes?.[0]?.name || 'unknown studio'}</div>
          <div className="g">{cur.genres.map(g => <span key={g}>{g}</span>)}</div>
          {tags.length > 0 && <div className="x-tags">{tags.map(t => <i key={t.name}>{t.name}</i>)}</div>}
          <p className="x-syn">{done ? (cur.description || '').replace(/<[^>]+>/g, '').slice(0, 420) : mask(cur.description, cur)}</p>
        </div>
      </div>
      <div>
        <div className="panel"><div className="ph">1 · What is it? <small>+50</small></div>
          <div className="x-opts">{opts.map(o => <button key={o.id} disabled={done} className={`${pickT === o.id ? 'on' : ''} ${done && o.id === cur.id ? 'right' : ''} ${done && pickT === o.id && o.id !== cur.id ? 'wrong' : ''}`} onClick={() => setPickT(o.id)}>{title(o)}</button>)}</div></div>
        <div className="panel" style={{ marginTop: 14 }}><div className="ph">2 · Guess its AniList score <small>UP TO +50</small></div>
          <div className="x-guess"><b>{guess}%</b><input type="range" min="30" max="95" value={guess} disabled={done} onChange={e => setGuess(+e.target.value)} /></div>
          {!done ? <button className="btn" disabled={!pickT} onClick={lock}>{pickT ? 'Lock it in' : 'Pick a title first'}</button>
            : <div className="x-res"><h3>{pickT === cur.id ? '✅ Got it' : '❌ Nope'}: <span className="linkish" onClick={() => openAnime(cur.id)}>{title(cur)}</span></h3>
              <p>Real score <b>{cur.averageScore}%</b>, you said {guess}% ({st.last.diff === 0 ? 'bang on!' : `${st.last.diff} off`}). <b>+{st.last.sp + st.last.tp}</b> pts.</p>
              {mine.has(cur.id) ? <p className="muted">It's on your list. You should have known 👀</p> : <p className="muted">Not on your list yet. Open it to add it.</p>}
              <button className="btn" onClick={next}>Next mystery →</button></div>}
        </div>
      </div>
    </div>
  </div>
}

/* ================= Manga-ahead alerts ================= */
const ALERT_Q = `query($ids:[Int]){ Page(perPage:50){ media(id_in:$ids){ id status source title { romaji english } coverImage { large }
  relations { edges { relationType node { id type format status title { romaji english } coverImage { large } season seasonYear
    startDate { year month day } nextAiringEpisode { episode timeUntilAiring } chapters } } } } } }`
const SEAS = { WINTER: 'Winter', SPRING: 'Spring', SUMMER: 'Summer', FALL: 'Autumn' }
export function useMangaAlerts(list) {
  const [alerts, setAlerts] = useState(() => load('ranked.alerts.cache', { t: 0, a: [] }).a)
  useEffect(() => {
    const c = load('ranked.alerts.cache', { t: 0, a: [] })
    if (!list.length || Date.now() - c.t < 6 * 36e5) return
    const have = new Set(list.map(e => e.media.id))
    const ids = list.filter(e => ['COMPLETED', 'CURRENT', 'PAUSED'].includes(e.status)).map(e => e.media.id)
    ;(async () => {
      const out = [], seen = new Set()
      for (let k = 0; k < ids.length; k += 50) {
        const d = await gql(ALERT_Q, { ids: ids.slice(k, k + 50) })
        for (const m of d.Page.media) for (const { relationType: rt, node: x } of m.relations.edges) {
          if (x.type === 'ANIME' && ['SEQUEL', 'SIDE_STORY', 'SPIN_OFF'].includes(rt) && !have.has(x.id) && !seen.has(x.id)) {
            if (x.status === 'NOT_YET_RELEASED') { seen.add(x.id)
              const when = x.season && x.seasonYear ? `${SEAS[x.season]} ${x.seasonYear}` : x.startDate?.year ? `${x.startDate.year}` : 'date TBA'
              out.push({ id: `ann-${x.id}`, kind: 'announced', pri: 3, from: title(m), anime: x.id, img: x.coverImage.large, head: `${title(x)} is coming`, sub: `${rt === 'SEQUEL' ? 'Next season' : 'New ' + x.format?.toLowerCase().replace('_', ' ')} · ${when}` })
            } else if (x.status === 'RELEASING') { seen.add(x.id)
              out.push({ id: `air-${x.id}`, kind: 'airing', pri: 4, from: title(m), anime: x.id, img: x.coverImage.large, head: `${title(x)} is airing now`, sub: x.nextAiringEpisode ? `Episode ${x.nextAiringEpisode.episode} soon · you haven't started it` : 'You haven\'t started it' })
            }
          }
          if (x.type === 'MANGA' && rt === 'SOURCE' && m.status === 'FINISHED' && !m.relations.edges.some(e => e.relationType === 'SEQUEL' && e.node.type === 'ANIME' && e.node.status !== 'FINISHED') && x.status === 'RELEASING' && !seen.has(x.id)) {
            seen.add(x.id); out.push({ id: `mg-${x.id}`, kind: 'manga', pri: 1, from: title(m), anime: m.id, img: m.coverImage.large, head: `The ${title(m)} manga is still going`, sub: 'The anime has stopped, but the story continues. Read ahead or wait for an announcement' })
          }
          if (x.type === 'MANGA' && rt === 'SOURCE' && x.status === 'FINISHED' && m.status === 'FINISHED' && !seen.has(x.id) && !m.relations.edges.some(e => e.relationType === 'SEQUEL' && e.node.type === 'ANIME')) {
            seen.add(x.id); out.push({ id: `end-${x.id}`, kind: 'ended', pri: 0, from: title(m), anime: m.id, img: m.coverImage.large, head: `${title(m)}: the manga has ended`, sub: x.chapters ? `${x.chapters} chapters total. A final season could still happen` : 'A final season could still happen' })
          }
        }
      }
      out.sort((a, b) => b.pri - a.pri); store('ranked.alerts.cache', { t: Date.now(), a: out }); setAlerts(out)
    })().catch(() => {})
  }, [list.length])
  return alerts
}
export function MangaAlerts({ list, openAnime }) {
  const alerts = useMangaAlerts(list)
  const [seen, setSeen] = useState(() => new Set(load('ranked.alerts.seen', [])))
  const [all, setAll] = useState(false)
  const isNew = a => !seen.has(a.id)
  const fresh = alerts.filter(isNew).length
  const markAll = () => { const s = new Set([...seen, ...alerts.map(a => a.id)]); setSeen(s); store('ranked.alerts.seen', [...s]) }
  const shown = all ? alerts : alerts.filter(a => a.pri >= 1).slice(0, 6)
  if (!alerts.length) return null
  const IC = { announced: '📢', airing: '🔴', manga: '📖', ended: '🏁' }
  return <div className="panel x-alerts"><div className="ph">📡 Coming from your list {fresh > 0 && <span className="x-new">{fresh} new</span>}
    <small>{fresh > 0 && <button className="linkish" onClick={markAll}>mark seen</button>} <button className="linkish" onClick={() => setAll(!all)}>{all ? 'fewer' : `all ${alerts.length}`}</button></small></div>
    <div className="x-al">{shown.map(a => <div key={a.id} className={`x-a ${a.kind} ${isNew(a) ? 'new' : ''}`} onClick={() => openAnime(a.anime)}>
      <img src={a.img} alt="" /><div><b>{IC[a.kind]} {a.head}</b><small>{a.sub}</small><em>from {a.from}</em></div></div>)}</div></div>
}

/* ================= Ranked Radio: The Times as a voiced slideshow ================= */
export function RadioPlayer({ slides, onClose }) {
  const [i, setI] = useState(0), [voice, setVoice] = useState(false), [play, setPlay] = useState(true)
  const s = slides[i], t = useRef()
  useEffect(() => {
    clearTimeout(t.current); speechSynthesis?.cancel()
    if (!s) return
    if (voice && 'speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(`${s.head}. ${s.body || ''}`); u.rate = 1.05; u.pitch = 1
      u.onend = () => { if (play) t.current = setTimeout(() => setI(x => x + 1), 900) }
      speechSynthesis.speak(u)
    } else if (play) t.current = setTimeout(() => setI(x => x + 1), 6000)
    return () => clearTimeout(t.current)
  }, [i, voice, play])
  useEffect(() => () => speechSynthesis?.cancel(), [])
  if (!s) return <div className="x-radio" onClick={onClose}><div className="x-rs end"><div className="x-onair">📻 RANKED RADIO</div><h2>That's the week.</h2><p>Same time next week. Tap to close.</p></div></div>
  return <div className="x-radio">
    <div className="x-bars">{slides.map((_, k) => <i key={k} className={k < i ? 'done' : k === i ? 'now' : ''} style={k === i && play && !voice ? { animationDuration: '6s' } : {}} />)}</div>
    <div className="x-rs" key={i} onClick={() => setI(i + 1)}>
      {s.img && <div className="x-rimg" style={{ backgroundImage: `url(${s.img})` }} />}
      <div className="x-onair"><span className="dot" /> ON AIR · {s.seg}</div>
      <h2>{s.head}</h2>{s.body && <p>{s.body}</p>}
    </div>
    <div className="x-rctl">
      <button onClick={() => setI(Math.max(0, i - 1))}>⏮</button>
      <button onClick={() => setPlay(!play)}>{play ? '⏸' : '▶'}</button>
      <button onClick={() => setI(i + 1)}>⏭</button>
      <button className={voice ? 'on' : ''} onClick={() => setVoice(!voice)}>{voice ? '🔊 Voice on' : '🔈 Voice off'}</button>
      <button onClick={onClose}>✕</button>
    </div>
  </div>
}
