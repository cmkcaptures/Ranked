import { useEffect, useMemo, useState } from 'react'
import { sb } from './cloud.js'
import { title } from './api.js'

const SEASONS = ['WINTER', 'SPRING', 'SUMMER', 'FALL']
export function currentSeason(d = new Date()) {
  return { season: SEASONS[Math.floor(d.getMonth() / 3)], year: d.getFullYear() }
}
const countdown = s => s < 3600 ? `${Math.floor(s / 60)}m` : s < 86400 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`

async function fetchSeason({ season, year }) {
  const r = await fetch('https://graphql.anilist.co', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `query($s:MediaSeason,$y:Int){ Page(perPage:40){ media(season:$s, seasonYear:$y, type:ANIME, isAdult:false, sort:POPULARITY_DESC){
      id title { romaji english } coverImage { large medium color } episodes averageScore genres format status nextAiringEpisode { episode timeUntilAiring } } } }`, variables: { s: season, y: year } }),
  }).then(r => r.json())
  return r.data.Page.media
}

// Rank this season's shows; your order is saved in user_state.extra.season[KEY], and the squad
// ranking is a points tally (1st = most points) across everyone's lists.
export default function Season({ list, extra, setExtra, me, openAnime }) {
  const [cur, setCur] = useState(currentSeason())
  const key = `${cur.season}-${cur.year}`
  const [shows, setShows] = useState(null)
  const [squad, setSquad] = useState([])
  const order = extra.season?.[key] || []
  const setOrder = o => setExtra({ ...extra, season: { ...(extra.season || {}), [key]: o } })

  useEffect(() => { setShows(null); fetchSeason(cur).then(setShows).catch(() => setShows([])) }, [key])
  useEffect(() => {
    if (!sb || !me) return
    sb.from('user_state').select('user_id, extra').then(({ data }) => {
      const pts = {}
      for (const r of data || []) {
        const o = r.extra?.season?.[key] || []
        o.forEach((id, i) => { pts[id] = (pts[id] || 0) + Math.max(1, 10 - i) })
      }
      setSquad(Object.entries(pts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, p]) => [Number(id), p]))
    })
  }, [key, order.length])

  const byId = useMemo(() => Object.fromEntries((shows || []).map(m => [m.id, m])), [shows])
  const status = useMemo(() => Object.fromEntries(list.map(e => [e.media.id, e])), [list])
  const shift = d => { const n = cur.year * 4 + SEASONS.indexOf(cur.season) + d; setCur({ season: SEASONS[n % 4], year: Math.floor(n / 4) }) }
  const move = (i, d) => { const o = [...order]; const j = i + d; if (j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; setOrder(o) }

  const [f, setF] = useState('all')
  const airing = (shows || []).filter(m => m.status === 'RELEASING').length
  const shown = (shows || []).filter(m => f === 'all' || (f === 'airing' ? m.status === 'RELEASING' : f === 'mine' ? status[m.id] : order.includes(m.id)))
  const top = Math.max(1, ...squad.map(x => x[1]))
  const [drag, setDrag] = useState(null)
  return (
    <div className="pg2">
      <div className="shead"><button className="arrow" onClick={() => shift(-1)}>‹</button><h1>{cur.season} <b>{cur.year}</b></h1><button className="arrow" onClick={() => shift(1)}>›</button>
        <div className="info">{shows ? `${shows.length} shows · ${airing} airing now` : 'loading…'}<br />tap + to rank a show</div></div>
      <div className="chips">{[['all', 'All'], ['airing', 'Airing'], ['mine', 'On my list'], ['ranked', 'Ranked']].map(([k, l]) => <button key={k} className={`chip ${f === k ? 'on' : ''}`} onClick={() => setF(k)}>{l}</button>)}</div>
      <div className="pg-cols">
        {!shows ? <div className="panel empty">Loading the season…</div> :
          <div className="sgrid">{shown.map(m => { const e = status[m.id], ranked = order.indexOf(m.id)
            return <div key={m.id} className="pc" onClick={() => openAnime(m.id)}>
              <div className="cv" style={{ backgroundImage: `url(${m.coverImage.large})` }}>
                {ranked >= 0 && <span className="rk">{ranked + 1}</span>}
                {m.nextAiringEpisode && <div className="cdn">EP {m.nextAiringEpisode.episode} in <b>{countdown(m.nextAiringEpisode.timeUntilAiring)}</b></div>}
                <button className={`add ${ranked >= 0 ? 'in' : ''}`} onClick={ev => { ev.stopPropagation(); ranked >= 0 ? setOrder(order.filter(x => x !== m.id)) : setOrder([...order, m.id]) }}>{ranked >= 0 ? '−' : '+'}</button></div>
              <div className="t">{title(m)}</div>
              <div className="m">{m.averageScore ? `${m.averageScore}% · ` : ''}{e ? e.status.toLowerCase() : m.status === 'RELEASING' ? 'airing' : m.status.toLowerCase().replace(/_/g, ' ')}</div></div> })}
            {!shown.length && <div className="panel empty">Nothing here.</div>}</div>}
        <div>
          <div className="panel nl"><div className="ph">Your ranking <small>DRAG TO REORDER</small></div>
            {order.map((id, i) => byId[id] && <div key={id} className="r" draggable onDragStart={() => setDrag(i)} onDragOver={e => e.preventDefault()}
              onDrop={() => { if (drag == null || drag === i) return; const o = [...order]; const [x] = o.splice(drag, 1); o.splice(i, 0, x); setOrder(o); setDrag(null) }}>
              <span className="n">{i + 1}</span><img src={byId[id].coverImage.medium} alt="" /><span>{title(byId[id])}</span>
              <button className="x" onClick={() => move(i, -1)}>↑</button><button className="x" onClick={() => move(i, 1)}>↓</button><button className="x" onClick={() => setOrder(order.filter(x => x !== id))}>×</button></div>)}
            {!order.length && <div className="empty">Add shows from the grid to rank this season.</div>}</div>
          {sb && me && <div className="panel pg-bars" style={{ marginTop: 16 }}><div className="ph">Squad ranking</div>
            {squad.map(([id, p]) => byId[id] && <div key={id} className="r"><small>{title(byId[id])}</small><div className="pgb"><i style={{ width: `${p / top * 100}%` }} /></div><b>{p}</b></div>)}
            {!squad.length && <div className="empty">Nobody has ranked this season yet.</div>}</div>}
        </div>
      </div>
    </div>
  )
}
