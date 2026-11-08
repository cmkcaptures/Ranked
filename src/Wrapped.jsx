import { useEffect, useMemo, useRef, useState } from 'react'
import { sb } from './cloud.js'
import { fantasySeason } from './Fantasy.jsx'
import { sfx } from './sfx.js'
import { title } from './api.js'
import './wrapped.css'

// Anime Wrapped: a swipeable manga-style story of your season. Tap right/left (or swipe, or arrow keys) to move.
const PERSONA = {
  Action: ['Shonen Protagonist', 'You live for the fight scenes and the power-ups.'],
  Romance: ['Hopeless Romantic', 'Confessions under cherry blossoms are your cardio.'],
  Comedy: ['Comic Relief', 'The group chat\'s gag character, and proud of it.'],
  Drama: ['Main Character Energy', 'You feel every flashback in your soul.'],
  Fantasy: ['Isekai Veteran', 'Truck-kun has nothing on your watchlist.'],
  'Sci-Fi': ['Mecha Pilot', 'Get in the robot. You already did.'],
  Mystery: ['Great Detective', 'You called the twist three episodes early.'],
  Psychological: ['Mastermind', 'Just as planned.'],
  'Slice of Life': ['Comfy Enjoyer', 'Tea, vibes and zero plot. Perfect.'],
  Sports: ['Team Captain', 'Hype training arcs fuel you.'],
  Supernatural: ['Spirit Medium', 'Curses, yokai and ghosts on speed dial.'],
  Adventure: ['Straw Hat Crew', 'Every season is a new island.'],
}

export default function Wrapped({ me, list, rankings, friends, onClose }) {
  const S = fantasySeason()
  const start = Date.UTC(...{ WINTER: [new Date().getUTCFullYear(), 0], SPRING: [new Date().getUTCFullYear(), 3], SUMMER: [new Date().getUTCFullYear(), 6], FALL: [new Date().getUTCFullYear(), 9] }[S.key.split('-')[0]], 1) / 1000
  const [league, setLeague] = useState(null)
  const [wallet, setWallet] = useState(null)
  const [i, setI] = useState(0)

  useEffect(() => {
    if (!sb || !me) return
    Promise.all([
      sb.from('fantasy_events').select('*').eq('season', S.key).eq('status', 'confirmed'),
      sb.from('fantasy_picks').select('*').eq('season', S.key),
    ]).then(async ([{ data: ev }, { data: picks }]) => {
      ev = ev || []; picks = picks || []
      const tot = {}; for (const e of ev) tot[e.team_user] = (tot[e.team_user] || 0) + e.points
      const order = Object.entries(tot).sort((a, b) => b[1] - a[1])
      const mine = ev.filter(e => e.team_user === me.id)
      const byChar = {}; for (const e of mine) if (e.char_id) byChar[e.char_id] = (byChar[e.char_id] || 0) + e.points
      const best = Object.entries(byChar).sort((a, b) => b[1] - a[1])[0]
      const moment = [...mine].filter(e => e.char_id).sort((a, b) => b.points - a.points)[0]
      const ids = [best?.[0], moment?.char_id].filter(Boolean)
      const { data: cs } = ids.length ? await sb.from('characters').select('id, name, image').in('id', ids) : { data: [] }
      const c = Object.fromEntries((cs || []).map(x => [x.id, x]))
      setLeague({ total: tot[me.id] || 0, rank: order.findIndex(([u]) => u === me.id) + 1, of: order.length,
        best: best && { ...c[best[0]], pts: best[1] }, moment: moment && { ...moment, c: c[moment.char_id] }, has: picks.some(p => p.user_id === me.id) })
    }).catch(() => setLeague({}))
    sb.from('wallets').select('*').eq('user_id', me.id).maybeSingle().then(async ({ data }) => {
      if (!data) return setWallet({})
      const ids = Object.keys(data.holdings || {}).map(Number).filter(Boolean)
      const { data: cs } = ids.length ? await sb.from('characters').select('id, name, image, price').in('id', ids) : { data: [] }
      const qty = h => typeof h === 'object' ? (h?.qty ?? h?.q ?? 0) : +h || 0
      const worth = (cs || []).reduce((n, c) => n + qty(data.holdings[c.id]) * (+c.price || 0), 0) + (+data.cash || 0)
      const top = (cs || []).map(c => ({ ...c, val: qty(data.holdings[c.id]) * (+c.price || 0) })).sort((a, b) => b.val - a.val)[0]
      setWallet({ worth: Math.round(worth), gain: Math.round(worth - 10000), top })
    }).catch(() => setWallet({}))
  }, [me?.id])

  // this season's watching, from your AniList list
  const stats = useMemo(() => {
    const season = list.filter(e => (e.updatedAt || 0) >= start || (e.updatedAt || 0) === 0 && e.status === 'CURRENT')
    const eps = season.reduce((n, e) => n + (e.progress || 0), 0)
    const mins = season.reduce((n, e) => n + (e.progress || 0) * (e.media.duration || 24), 0)
    const done = season.filter(e => e.status === 'COMPLETED')
    const g = {}; for (const e of season) for (const x of e.media.genres || []) g[x] = (g[x] || 0) + 1
    const genres = Object.entries(g).sort((a, b) => b[1] - a[1]).slice(0, 5)
    const fav = [...season].filter(e => e.score).sort((a, b) => b.score - a.score)[0] || [...season].sort((a, b) => (b.progress || 0) - (a.progress || 0))[0]
    const top1 = list.find(e => e.media.id === rankings?.['10']?.[0])
    return { shows: season.length, eps, hours: Math.round(mins / 60), done: done.length, genres, fav, top1 }
  }, [list])

  const persona = PERSONA[stats.genres[0]?.[0]] || ['Certified Weeb', 'A little bit of everything, all of the time.']
  const slides = [
    { k: 'intro', sfx: 'power' },
    { k: 'watch' },
    stats.genres.length && { k: 'genres' },
    stats.fav && { k: 'fav' },
    stats.top1 && { k: 'top1' },
    league?.has && { k: 'league', sfx: 'win' },
    league?.moment?.c && { k: 'moment', sfx: 'power' },
    wallet?.worth && { k: 'market', sfx: 'money' },
    { k: 'persona', sfx: 'win' },
    { k: 'outro' },
  ].filter(Boolean)
  const n = slides.length, cur = slides[Math.min(i, n - 1)]
  const go = d => setI(x => { const y = Math.max(0, Math.min(n - 1, x + d)); if (y !== x && slides[y].sfx) setTimeout(() => sfx(slides[y].sfx, { at: { x: innerWidth / 2, y: innerHeight * .35 } }), 250); return y })
  useEffect(() => { setTimeout(() => sfx('power', { at: { x: innerWidth / 2, y: innerHeight * .35 } }), 400) }, [])
  useEffect(() => {
    const k = e => { if (e.key === 'ArrowRight' || e.key === ' ') go(1); if (e.key === 'ArrowLeft') go(-1); if (e.key === 'Escape') onClose() }
    addEventListener('keydown', k); return () => removeEventListener('keydown', k)
  }, [n])
  const touch = useRef(null)

  const share = async () => {
    const text = `My ${S.label} Anime Wrapped on Ranked:\n📺 ${stats.eps} episodes · ${stats.hours}h\n🏷️ Top genre: ${stats.genres[0]?.[0] || '-'}\n` +
      (league?.has ? `🏆 League: ${league.total} pts, #${league.rank} of ${league.of}\n` : '') + `🎭 I'm a ${persona[0]}\n${location.origin}${location.pathname}`
    try { if (navigator.share) await navigator.share({ text }); else { await navigator.clipboard.writeText(text); sfx('crown', { text: 'コピー!' }) } } catch {}
  }

  const cover = e => e?.media?.coverImage?.extraLarge || e?.media?.coverImage?.large
  const maxG = stats.genres[0]?.[1] || 1
  const body = {
    intro: <div className="wr-c"><div className="wr-kick">CH. {S.week} · {S.label}</div><h1>Your Anime<br /><em>Wrapped</em></h1><div className="wr-bub">Ready to see how your season went, {me?.username}?</div><div className="wr-sfx">ゴゴゴ</div></div>,
    watch: <div className="wr-c"><div className="wr-kick">The shows you watched this season add up to</div><div className="wr-big">{stats.eps}</div><h2>episodes</h2>
      <div className="wr-row"><div><b>{stats.hours}h</b><span>watch time</span></div><div><b>{stats.shows}</b><span>shows</span></div><div><b>{stats.done}</b><span>finished</span></div></div>
      <div className="wr-bub sm">{stats.hours > 100 ? 'Touch grass? Never heard of it.' : stats.hours > 40 ? 'A respectable binge.' : 'Quality over quantity.'}</div></div>,
    genres: <div className="wr-c"><div className="wr-kick">Your top genres</div>
      <div className="wr-bars">{stats.genres.map(([g, c], j) => <div key={g} style={{ animationDelay: `${j * 120}ms` }}><span>#{j + 1} {g}</span><i><em style={{ width: `${c / maxG * 100}%` }} /></i><b>{c}</b></div>)}</div></div>,
    fav: <div className="wr-c split"><div className="wr-cover"><img src={cover(stats.fav)} alt="" /></div><div><div className="wr-kick">Show of the season</div><h1 className="sm">{stats.fav?.media ? title(stats.fav.media) : ""}</h1>
      {stats.fav?.score ? <div className="wr-stamp">{stats.fav.score}/10</div> : <div className="wr-stamp">{stats.fav?.progress} eps</div>}</div></div>,
    top1: <div className="wr-c split"><div className="wr-cover gold"><img src={cover(stats.top1)} alt="" /></div><div><div className="wr-kick">Still your #1 of all time</div><h1 className="sm">{stats.top1?.media ? title(stats.top1.media) : ""}</h1><div className="wr-bub sm">Nothing this season could dethrone it.</div></div></div>,
    league: <div className="wr-c"><div className="wr-kick">Fantasy League</div><div className="wr-big">{league?.total}</div><h2>points</h2>
      <div className="wr-row"><div><b>#{league?.rank}</b><span>of {league?.of}</span></div>{league?.best?.name && <div className="wr-mini"><img src={league.best.image} alt="" referrerPolicy="origin" /><span><b>{league.best.name}</b>MVP · {league.best.pts} pts</span></div>}</div></div>,
    moment: <div className="wr-c split"><div className="wr-cover"><img src={league?.moment?.c?.image} alt="" referrerPolicy="origin" /></div><div><div className="wr-kick">Your biggest moment</div><h1 className="sm">{league?.moment?.c?.name}</h1>
      <div className="wr-bub sm">{league?.moment?.note}</div><div className="wr-stamp red">+{league?.moment?.points}</div></div></div>,
    market: <div className="wr-c"><div className="wr-kick">Character Market</div><div className="wr-big">{wallet?.worth?.toLocaleString()}</div><h2>coins net worth</h2>
      <div className={`wr-stamp ${wallet?.gain >= 0 ? '' : 'red'}`}>{wallet?.gain >= 0 ? '+' : ''}{wallet?.gain?.toLocaleString()} since you started</div>
      {wallet?.top && <div className="wr-mini c"><img src={wallet.top.image} alt="" referrerPolicy="origin" /><span><b>{wallet.top.name}</b>your biggest bag</span></div>}</div>,
    persona: <div className="wr-c"><div className="wr-kick">Your anime personality</div><h1>{persona[0]}</h1><div className="wr-bub">{persona[1]}</div><div className="wr-sfx r">ドン!</div></div>,
    outro: <div className="wr-c"><div className="wr-kick">That's a wrap!</div><h1 className="sm">See you next season, {me?.username}</h1>
      <div className="wr-card"><div><b>{stats.eps}</b>eps</div><div><b>{stats.hours}h</b>watched</div><div><b>{stats.genres[0]?.[0] || '-'}</b>top genre</div>{league?.has && <div><b>#{league.rank}</b>league</div>}<div className="w"><b>{persona[0]}</b></div></div>
      <div className="wr-btns" onClick={e => e.stopPropagation()}><button className="pill" onClick={share}>Share it</button><button className="pill ghost" onClick={onClose}>Done</button></div></div>,
  }

  return <div className="wr" onTouchStart={e => touch.current = e.touches[0].clientX}
    onTouchEnd={e => { const d = e.changedTouches[0].clientX - (touch.current ?? 0); if (Math.abs(d) > 40) go(d < 0 ? 1 : -1) }}>
    <div className="wr-prog">{slides.map((s, j) => <i key={s.k} className={j < i ? 'done' : j === i ? 'on' : ''} />)}</div>
    <button className="wr-x" onClick={onClose} data-nosfx="1">✕</button>
    <div className="wr-tap l" onClick={() => go(-1)} /><div className="wr-tap r" onClick={() => go(1)} />
    <div key={cur.k} className={`wr-slide s-${cur.k}`}>{(league === null && ['league', 'moment'].includes(cur.k)) ? <div className="wr-c"><h2>Loading…</h2></div> : body[cur.k]}</div>
    <div className="wr-hint">{i < n - 1 ? 'tap to continue →' : ''}</div>
  </div>
}
