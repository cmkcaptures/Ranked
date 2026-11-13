// 🔭 Scout: AspextPro-only League helper. Live data (form, who's free) + hand-written intel on what's coming.
// Update INTEL as news drops. `who` matches a character name exactly.
export const SCOUT_USER = 'aspextpro'

const INTEL = [
  { who: 'Garou', boost: 90, show: 'One-Punch Man', when: 'Jan 2027', conf: 'Med', up: '🔥🔥🔥',
    why: 'Season 3 part 2 is listed for Winter 2027. That run is the Monster Association finale, where Garou gets multiple new forms. That means transformation (+20) and new-form debut (+30) points stacked on episodes.' },
  { who: 'Saitama', boost: 60, show: 'One-Punch Man', when: 'Jan 2027', conf: 'Med', up: '🔥🔥',
    why: 'Safer One-Punch Man pick: wins fights and appears every episode, plus a trailer bump before it airs. Lower ceiling than Garou.' },
  { who: 'Shin Asakura', boost: 70, show: 'Sakamoto Days', when: 'Jan 2027', conf: 'Med', up: '🔥🔥',
    why: 'Season 2 is listed for January on Netflix, and the manga is still weekly, so he gets chapter (+8) and episode (+10) points every week. Sakamoto himself is on Dayn’s team.' },
  { who: 'Yoichi Isagi', boost: 35, show: 'Blue Lock', when: 'Now', conf: 'High', up: '🔥',
    why: 'The manga is weekly and he is the lead in nearly every chapter, so he scores steady chapter, appearance and win points. No anime boost is confirmed yet.' },
  { who: 'Frieren', boost: 25, show: 'Frieren', when: 'Any time', conf: 'Low', up: '🔥',
    why: 'She has a huge fanbase, so hype points stay high. Any news of the next season would mean +15/+20. The manga goes on hiatus a lot.' },
  { who: 'Subaru Natsuki', boost: 20, show: 'Re:Zero', when: 'Now', conf: 'Med', up: '🔥',
    why: 'Like-for-like replacement for Rem, since one character per show means you can swap within Re:Zero. He is in every Re:Zero scene and Rem barely appears.' },
]

const EVENTS = [
  ['Mid Dec 2026', 'Jump Festa 2027', 'Big wave of trailers and news for Jump shows. Dandadan Season 3 (2027) could drop a trailer here: Momo +20. Make sure your captain is a Jump character that week.'],
  ['Late Dec 2026', 'Winter 2027 trailers', 'Final trailers before January shows. Good for anyone on a One-Punch Man, Sakamoto Days or Mashle team.'],
  ['Early Jan 2027', 'Winter season starts', 'Shangri-La Frontier S3, Sakamoto Days S2, Mashle S3 and One-Punch Man S3 part 2 are all listed. Episodes = +10 a week each.'],
]

export function Scout({ team, chars, byId, takenBy, info, form, week, charPts, who, teams, me, onSwapTip }) {
  const recent = id => [0, 1, 2].reduce((n, k) => n + ((form[id] || {})[week - k] || 0), 0)
  const showOf = id => info[id]?.show_key
  // projection: next 4 weeks = recent weekly average x4 (inactive halves) + intel boost
  const boostOf = Object.fromEntries(INTEL.map(x => [x.who, x.boost || 0]))
  const proj = id => { const c = byId[id] || chars.find(x => x.id === id), avg = recent(id) / 3
    return Math.round(avg * 4 * (info[id]?.active === false ? 0.5 : 1) + (boostOf[c?.name] || 0)) }
  // drop score: low recent form, inactive, low season = worst
  const mine = [...team.chars].map(id => ({ id, c: byId[id], r: recent(id), s: charPts[id] || 0, act: info[id]?.active !== false, p: proj(id) }))
    .sort((a, b) => (a.act - b.act) || (a.p - b.p) || (a.s - b.s))
  const free = id => !takenBy[id]
  const byName = Object.fromEntries(chars.map(c => [c.name, c]))
  const picks = INTEL.map(x => ({ ...x, c: byName[x.who] })).filter(x => x.c)
  // hot free agents: free, active, best last 3 weeks
  const hot = chars.filter(c => free(c.id) && info[c.id]?.active !== false && recent(c.id) > 0).sort((a, b) => recent(b.id) - recent(a.id)).slice(0, 6)
  const order = [...teams].sort((a, b) => b.total - a.total), myRank = order.findIndex(t => t.user === me.id) + 1
  const gap = myRank > 1 ? order[0].total - order[myRank - 1].total : 0
  const worst = mine[0]
  const best = picks.filter(x => free(x.c.id)).sort((a, b) => proj(b.c.id) - proj(a.c.id))[0]
  const teamProj = mine.reduce((n, m) => n + m.p, 0)

  return <div className="scout">
    <div className="lg-panel sc-head">
      <div><small>🔭 SCOUT · ONLY YOU CAN SEE THIS · TEAM PROJECTED ~{teamProj} NEXT 4 WKS</small><b>You’re #{myRank}{gap ? `, ${gap} pts off 1st` : ', top of the table'}</b>
        <p>{worst ? <>Best move right now: drop <em>{worst.c?.name}</em> (~{worst.p} projected){best ? <> for <em className="g">{best.c.name}</em> (~{proj(best.c.id)} projected).</> : '.'}</> : null}</p></div>
    </div>

    <div className="sc-grid">
      <div className="lg-panel"><div className="lg-ph">🗑️ Drop list <span className="lg-phr">worst first</span></div>
        {mine.map((m, i) => m.c && <div key={m.id} className={`sc-row ${i === 0 ? 'bad' : ''}`}>
          <img src={m.c.image} alt="" referrerPolicy="origin" />
          <div><b>{m.c.name}</b><small>{m.s} season · {m.r} last 3 wks{!m.act ? ' · not airing' : ''}</small></div><span className="sc-proj">~{m.p}<small>next 4 wks</small></span>
          <em>{i === 0 ? 'DROP' : i === 1 ? 'watch' : 'keep'}</em></div>)}
      </div>

      <div className="lg-panel"><div className="lg-ph">🚀 Pick-ups <span className="lg-phr">about to blow up</span></div>
        {picks.map(x => { const taken = !free(x.c.id), clash = team.chars.some(id => id !== worst?.id && showOf(id) && showOf(id) === showOf(x.c.id))
          return <div key={x.who} className={`sc-pick ${taken ? 'gone' : ''}`}>
            <img src={x.c.image} alt="" referrerPolicy="origin" />
            <div><b>{x.c.name} <i>{x.up}</i></b><small>{x.show} · {x.when} · confidence {x.conf}{taken ? ` · ❌ taken by ${who(takenBy[x.c.id])?.username || '?'}` : clash ? ' · ⚠️ clashes with a show you have' : ' · ✅ free'}</small><p>{x.why}</p></div><span className="sc-proj up">~{proj(x.c.id)}<small>next 4 wks</small></span>
          </div> })}
      </div>
    </div>

    <div className="sc-grid">
      <div className="lg-panel"><div className="lg-ph">📈 Hot free agents <span className="lg-phr">last 3 weeks</span></div>
        {hot.length ? hot.map(c => <div key={c.id} className="sc-row"><img src={c.image} alt="" referrerPolicy="origin" /><div><b>{c.name}</b><small>{c.media_title}</small></div><span className="sc-proj up">~{proj(c.id)}<small>next 4 wks</small></span></div>)
          : <p className="sc-empty">Nobody free is scoring right now. Go by the intel.</p>}
      </div>
      <div className="lg-panel"><div className="lg-ph">📅 Coming up</div>
        {EVENTS.map(([d, t, w]) => <div key={t} className="sc-ev"><span>{d}</span><div><b>{t}</b><small>{w}</small></div></div>)}
      </div>
    </div>
    <p className="sc-note">Intel is my best read of announced schedules and the manga. Dates can slip, so treat it as tips, not certainties.</p>
  </div>
}
