// 🔭 Scout: AspextPro-only League helper. Live data (form, who's free) + hand-written intel.
// Knowledge last refreshed 2026-11-13. Update SHOWS / INTEL as news drops.
export const SCOUT_USER = 'aspextpro'
const D = s => new Date(s + 'T12:00:00Z').getTime()
const WK = 7 * 86400000
const dm = s => new Date(D(s)).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

// What each show is doing. `end` = last episode we expect in this run; `back` = when it returns.
const SHOWS = [
  { re: /steel ball run/i, name: 'Steel Ball Run', end: '2026-12-04', back: 'TBA (3rd stage not dated)', note: 'Netflix weekly on Fridays since 25 Sep, 11 episodes. Manga is finished, so once it ends, all that’s left is hype points.' },
  { re: /apothecary/i, name: 'Apothecary Diaries S3', end: '2026-12-18', back: 'Apr 2027 (part 2)', note: 'Part 1 is airing until mid-Dec, then a break until April. A film is also announced, so possible trailer points.' },
  { re: /one piece/i, name: 'One Piece', end: null, back: null, note: 'Elbaf arc. The anime is capped at about 26 episodes a year now, so it has breaks, but the manga is weekly and Loki is central to Elbaf.' },
  { re: /dan ?da ?dan/i, name: 'Dandadan', end: null, back: 'S3 in 2027', note: 'Manga is weekly. Season 3 is confirmed for 2027, so a trailer at Jump Festa (Dec) is likely.' },
  { re: /dragon ball/i, name: 'Dragon Ball', end: null, back: null, note: 'Super: Beerus remake is airing from Oct. No manga chapters for Goku most months, so he relies on episodes and hype.' },
  { re: /re:? ?zero/i, name: 'Re:Zero', end: null, back: 'S4 not dated', note: 'Season 4 has no date. Rem barely appears in the current story.' },
  { re: /black clover/i, name: 'Black Clover S2', end: '2027-03-20', back: null, note: 'Back from Oct 2026, 24 episodes, so it runs to about March. Spade Kingdom arc: lots of fights and new forms.' },
  { re: /tokyo revengers/i, name: 'Tokyo Revengers', end: '2026-12-25', back: null, note: 'Final arc (War of the Three Titans) airing this season.' },
  { re: /blue box/i, name: 'Blue Box S2', end: '2026-12-25', back: null, note: 'Airing since 4 Oct, and the manga is still weekly.' },
  { re: /one.?punch/i, name: 'One-Punch Man', end: null, back: 'Jan 2027 (S3 part 2)', note: 'Monster Association finale. Garou’s big new forms happen here.' },
  { re: /sakamoto/i, name: 'Sakamoto Days', end: null, back: 'Jan 2027 (S2)', note: 'Season 2 is listed for January on Netflix. The manga is weekly.' },
  { re: /mashle/i, name: 'Mashle', end: null, back: 'Jan 2027 (S3)', note: 'Divine Visionary exam arc.' },
  { re: /shangri/i, name: 'Shangri-La Frontier', end: null, back: '10 Jan 2027 (S3)', note: 'The most firmly dated show of the winter season.' },
  { re: /blue lock/i, name: 'Blue Lock', end: null, back: null, note: 'Manga is weekly, which means steady chapter points.' },
]
const showInfo = t => SHOWS.find(s => s.re.test(t || ''))

const INTEL = [
  { who: 'Garou', boost: 90, when: 'Jan 2027', conf: 'Med', up: 3, why: 'One-Punch Man S3 part 2 should cover the Monster Association finale, where Garou gets several new forms in a row. That means transformation (+20) and new-form debut (+30) on top of episodes. Grab him before January, before anyone else notices.' },
  { who: 'Noelle Silva', boost: 70, when: 'Now → Mar', conf: 'High', up: 3, why: 'Black Clover S2 is airing now with 24 episodes. The Spade arc is where she gets her Valkyrie armour: new-form debut (+30) and transformations. Asta and Yuno are taken; she isn’t.' },
  { who: 'Shin Asakura', boost: 70, when: 'Jan 2027', conf: 'Med', up: 2, why: 'Sakamoto Days S2 in January, and the manga is weekly, so chapter and episode points every week. Sakamoto himself is on Dayn’s team.' },
  { who: 'Takemichi Hanagaki', boost: 45, when: 'Now → Dec', conf: 'High', up: 2, why: 'Lead of Tokyo Revengers’ final arc, which is airing now. He appears in every episode, which means appearance, fight and episode points until about Christmas. A short-term rental.' },
  { who: 'Mereoleona Vermillion', boost: 45, when: 'Now → Mar', conf: 'Med', up: 2, why: 'Black Clover backup if Noelle gets taken. She has big fights in the Spade arc.' },
  { who: 'Saitama', boost: 60, when: 'Jan 2027', conf: 'Med', up: 2, why: 'Safer One-Punch Man pick: he wins fights and is in every episode. Lower ceiling than Garou.' },
  { who: 'Yoichi Isagi', boost: 35, when: 'Now', conf: 'High', up: 1, why: 'Blue Lock manga is weekly and he leads nearly every chapter, so he scores steadily.' },
  { who: 'Chinatsu Kano', boost: 30, when: 'Now → Dec', conf: 'Med', up: 1, why: 'Blue Box S2 is airing, and the manga is weekly. Low drama, but steady points.' },
  { who: 'Frieren', boost: 25, when: 'Any time', conf: 'Low', up: 1, why: 'Huge fanbase, so hype points stay high. News of a next season would be +15/+20, but the manga goes on hiatus often.' },
  { who: 'Subaru Natsuki', boost: 20, when: 'Now', conf: 'Med', up: 1, why: 'Like-for-like swap for Rem within Re:Zero. He is in every scene of the story.' },
]

const EVENTS = [
  ['4 Dec', 'Steel Ball Run run ends', 'Johnny loses his weekly episode points after this. Plan to swap him or move your captain off him.'],
  ['Mid Dec', 'Jump Festa 2027', 'Big trailer and news wave for Jump shows. Dandadan S3 (2027) could drop a trailer: Momo +20. Captain a Jump character that week.'],
  ['18 Dec', 'Apothecary Diaries break', 'Part 1 ends and Maomao goes quiet until April 2027.'],
  ['Late Dec', 'Winter trailers', 'Final trailers for One-Punch Man, Sakamoto Days, Mashle and Shangri-La Frontier.'],
  ['10 Jan', 'Shangri-La Frontier S3', 'First of the winter shows.'],
  ['Early Jan', 'Winter season starts', 'Sakamoto Days S2, Mashle S3 and One-Punch Man S3 part 2 are listed. +10 an episode each week.'],
]

export function Scout({ team, chars, byId, takenBy, info, form, week, charPts, who, teams, me }) {
  const now = Date.now()
  const recent = id => [0, 1, 2].reduce((n, k) => n + ((form[id] || {})[week - k] || 0), 0)
  const showOf = id => info[id]?.show_key
  const charOf = id => byId[id] || chars.find(x => x.id === id)
  const boostOf = Object.fromEntries(INTEL.map(x => [x.who, x.boost]))
  // projection (next 4 wks): recent pace, cut when the show stops airing inside the window, + intel boost
  const proj = id => { const c = charOf(id), sh = showInfo(c?.media_title)
    let pace = recent(id) / 3 * 4
    if (sh?.end) { const left = Math.max(0, Math.min(4, (D(sh.end) - now) / WK)); pace *= 0.3 + 0.7 * left / 4 }
    else if (info[id]?.active === false) pace *= 0.5
    return Math.round(pace + (boostOf[c?.name] || 0)) }
  const nextWk = id => { const sh = showInfo(charOf(id)?.media_title); return recent(id) / 3 * (!sh?.end || D(sh.end) > now ? 1 : 0.3) }

  const mine = team.chars.map(id => ({ id, c: byId[id], sh: showInfo(byId[id]?.media_title), r: recent(id), s: charPts[id] || 0, p: proj(id) })).sort((a, b) => a.p - b.p)
  const free = id => !takenBy[id]
  const byName = Object.fromEntries(chars.map(c => [c.name, c]))
  const picks = INTEL.map(x => ({ ...x, c: byName[x.who] })).filter(x => x.c).map(x => ({ ...x, p: proj(x.c.id), sh: showInfo(x.c.media_title) }))
    .sort((a, b) => free(b.c.id) - free(a.c.id) || b.p - a.p)
  const hot = chars.filter(c => free(c.id) && info[c.id]?.active !== false && recent(c.id) > 0).sort((a, b) => recent(b.id) - recent(a.id)).slice(0, 6)
  const order = [...teams].sort((a, b) => b.total - a.total), myRank = order.findIndex(t => t.user === me.id) + 1
  const gap = myRank > 1 ? order[0].total - order[myRank - 1].total : 0
  const worst = mine[0]
  const best = picks.find(x => free(x.c.id) && !team.chars.some(id => id !== worst?.id && showOf(id) && showOf(id) === showOf(x.c.id)))
  const teamProj = mine.reduce((n, m) => n + m.p, 0)
  const cap = [...mine].sort((a, b) => nextWk(b.id) - nextWk(a.id))[0]
  const rivals = order.filter(t => t.user !== me.id).slice(0, 3).map(t => ({ t, p: t.chars.reduce((n, id) => n + proj(id), 0),
    star: [...t.chars].sort((a, b) => proj(b) - proj(a))[0] }))
  const swing = best && worst ? best.p - worst.p : 0

  return <div className="scout">
    <div className="lg-panel sc-head">
      <div><small>🔭 SCOUT · ONLY YOU CAN SEE THIS · INTEL UPDATED 13 NOV</small><b>You’re #{myRank}{gap ? `, ${gap} pts off 1st` : ', top of the table'}</b>
        <p>{worst && <>Best move: drop <em>{worst.c?.name}</em> (~{worst.p}){best ? <> for <em className="g">{best.c.name}</em> (~{best.p}) = <em className="g">+{swing}</em> over 4 weeks.</> : '.'}</>}</p>
        {cap && <p>👑 Captain this week: <em className="g">{cap.c?.name}</em>. Best weekly pace on your team{cap.sh?.end ? `, airing until ${dm(cap.sh.end)}` : ''}.</p>}
      </div>
      <div className="sc-kpis"><div><b>~{teamProj}</b><small>your next 4 wks</small></div>{rivals[0] && <div><b>~{rivals[0].p}</b><small>{who(rivals[0].t.user)?.username}</small></div>}</div>
    </div>

    <div className="sc-grid">
      <div className="lg-panel"><div className="lg-ph">🗑️ Your team <span className="lg-phr">worst first</span></div>
        {mine.map((m, i) => m.c && <div key={m.id} className={`sc-row ${i === 0 ? 'bad' : ''}`}>
          <img src={m.c.image} alt="" referrerPolicy="origin" />
          <div><b>{m.c.name}</b><small>{m.s} season · {m.r} last 3 wks</small>{m.sh && <small className="sc-sh">📺 {m.sh.name}{m.sh.end ? ` · ends ${dm(m.sh.end)}` : ''}{m.sh.back ? ` · back ${m.sh.back}` : ''}</small>}</div>
          <span className="sc-proj">~{m.p}<small>{i === 0 ? 'DROP' : i === 1 ? 'watch' : 'keep'}</small></span></div>)}
      </div>

      <div className="lg-panel"><div className="lg-ph">🚀 Pick-ups <span className="lg-phr">about to blow up</span></div>
        {picks.map(x => { const taken = !free(x.c.id), clash = team.chars.some(id => id !== worst?.id && showOf(id) && showOf(id) === showOf(x.c.id))
          return <div key={x.who} className={`sc-pick ${taken ? 'gone' : ''}`}>
            <img src={x.c.image} alt="" referrerPolicy="origin" />
            <div><b>{x.c.name} <i>{'🔥'.repeat(x.up)}</i></b><small>{x.sh?.name || x.c.media_title} · {x.when} · confidence {x.conf}{taken ? ` · ❌ ${who(takenBy[x.c.id])?.username || '?'}` : clash ? ' · ⚠️ clashes with your show' : ' · ✅ free'}</small><p>{x.why}</p></div>
            <span className="sc-proj up">~{x.p}<small>next 4 wks</small></span>
          </div> })}
      </div>
    </div>

    <div className="sc-grid three">
      <div className="lg-panel"><div className="lg-ph">⚔️ Rivals</div>
        {rivals.map(({ t, p, star }) => <div key={t.user} className="sc-row">{byId[star] && <img src={byId[star].image} alt="" referrerPolicy="origin" />}
          <div><b>{who(t.user)?.username || '?'} · {t.total}</b><small>Danger man: {byId[star]?.name} (~{proj(star)})</small></div>
          <span className={`sc-proj ${p > teamProj ? 'dn' : 'up'}`}>~{p}<small>next 4 wks</small></span></div>)}
      </div>
      <div className="lg-panel"><div className="lg-ph">📈 Hot free agents <span className="lg-phr">last 3 wks</span></div>
        {hot.length ? hot.map(c => <div key={c.id} className="sc-row"><img src={c.image} alt="" referrerPolicy="origin" /><div><b>{c.name}</b><small>{c.media_title}</small></div><span className="sc-proj up">~{proj(c.id)}<small>next 4 wks</small></span></div>)
          : <p className="sc-empty">Nobody free is scoring right now. Go by the intel.</p>}
      </div>
      <div className="lg-panel"><div className="lg-ph">📅 Coming up</div>
        {EVENTS.map(([d, t, w]) => <div key={t} className="sc-ev"><span>{d}</span><div><b>{t}</b><small>{w}</small></div></div>)}
      </div>
    </div>

    <details className="lg-panel sc-kb"><summary className="lg-ph">📚 Show knowledge</summary>
      {SHOWS.map(s => <div key={s.name} className="sc-ev"><span>{s.end ? `→ ${dm(s.end)}` : s.back ? 'soon' : 'ongoing'}</span><div><b>{s.name}{s.back ? ` · back ${s.back}` : ''}</b><small>{s.note}</small></div></div>)}
    </details>
    <p className="sc-note">Projections are the last 3 weeks’ pace × 4, cut when a show stops airing within the 4 weeks, plus the expected boost from upcoming events. Captain ×2 isn’t included. Intel is my best read of announced schedules and the manga, and dates can slip.</p>
  </div>
}
