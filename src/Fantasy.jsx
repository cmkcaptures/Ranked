import { useEffect, useMemo, useRef, useState } from 'react'
import { sb, fetchAll, logActivity } from './cloud.js'
import { openChar } from './CharProfile.jsx'
import Draft, { ResetDraft, Commish } from './Draft.jsx'
import { sfx } from './sfx.js'
import DraftReplay from './DraftReplay.jsx'
import { Scoreboard, SlideTabs, Race, SquadCard, ChipCard } from './LeagueUI.jsx'

// Fantasy League: pick 5 characters per anime season, score points from real-world hype + squad-logged moments.
const SEASONS = ['WINTER', 'SPRING', 'SUMMER', 'FALL']
const CHIPS = { triple: ['👑', 'Triple Captain', 'your captain scores x3 this week'], boost: ['🪑', 'Bench Boost', 'all 6 count this week, nobody benched'], wildcard: ['🃏', 'Wildcard', 'unlimited swaps this week'] }
export const norm = t => (t || '').toLowerCase().replace(/[^a-z0-9]/g, '')
export function fantasySeason(d = new Date()) {
  const q = Math.floor(d.getUTCMonth() / 3), y = d.getUTCFullYear()
  const start = Date.UTC(y, q * 3, 1), end = Date.UTC(q === 3 ? y + 1 : y, (q * 3 + 3) % 12, 1)
  return { key: `${SEASONS[q]}-${y}`, label: `${SEASONS[q][0] + SEASONS[q].slice(1).toLowerCase()} ${y}`, week: Math.floor((d - start) / 604800000) + 1, end }
}
const seasonLabel = k => { const [s, y] = k.split('-'); return `${s[0] + s.slice(1).toLowerCase()} ${y}` }

const KINDS = {
  episode: ['📺', 'New episode'], chapter: ['📖', 'New chapter'], wiki: ['📈', 'Wikipedia spike'], fans: ['💜', 'New AniList fans'],
  trending: ['🔥', 'Show trending'], break: ['💤', 'On break'], vote: ['🗳️', 'Won the squad vote'], hype: ['📊', 'Weekly hype ranking'], bench: ['🪑', 'Benched (lowest of your 6)'], news: ['📰', 'Big news'], trailer: ['🎬', 'New trailer'],
  transform: ['⚡', 'Transformation / power-up'], debut: ['🌟', 'New form debut'], vault: ['🐷', 'Piggy bank smashed'], cup: ['🏆', 'Mid-season Cup champion'], streak: ['🔥', 'Scoring streak'], synergy: ['🤝', 'Team synergy'], underdog: ['🔵', 'Underdog boost'], epbonus: ['📺', 'Episode bonus'], win: ['🏆', 'Won a fight'], appear: ['👀', 'Appeared'], lose: ['💥', 'Lost a fight'],
  death: ['💀', 'Died'], revive: ['✨', 'Came back'],
}
const pts = n => (n > 0 ? '+' : '') + n

// round-robin pairing that rotates every week
function matchups(ids, week) {
  const list = [...ids].sort()
  if (list.length < 2) return []
  if (list.length % 2) list.push(null)
  const fixed = list[0], rest = list.slice(1), r = (week - 1) % rest.length
  const rot = [fixed, ...rest.slice(r), ...rest.slice(0, r)]
  const out = []
  for (let i = 0; i < rot.length / 2; i++) { const a = rot[i], b = rot[rot.length - 1 - i]; if (a && b) out.push([a, b]) }
  return out
}

export default function Fantasy({ me, friends, openProfile }) {
  const S = fantasySeason()
  const [chars, setChars] = useState([])
  const [info, setInfo] = useState({})
  const [picks, setPicks] = useState([])
  const [draft, setDraft] = useState(null)
  const [events, setEvents] = useState([])
  const [votes, setVotes] = useState([])
  const [swaps, setSwaps] = useState([])
  const [caps, setCaps] = useState([])
  const [trades, setTrades] = useState([])
  const [chipRows, setChipRows] = useState([])
  const [vaults, setVaults] = useState([])
  const [streaks, setStreaks] = useState([])
  const [claims, setClaims] = useState([])
  const [tab, setTab] = useState('table')
  const [replay, setReplay] = useState(false)
  const [err, setErr] = useState('')
  const [tick, setTick] = useState(0)
  const reload = () => setTick(t => t + 1)

  useEffect(() => {
    if (!sb) return
    fetchAll(() => sb.from('characters').select('id, name, image, media_title, color, form').order('favourites', { ascending: false })).then(cs => {
      setChars(cs)
      fetchAll(() => sb.rpc('fantasy_char_info', { p_ids: cs.map(c => c.id) })).then(rows => setInfo(Object.fromEntries(rows.map(r => [r.id, r])))).catch(() => {})
    }).catch(() => {})
  }, [])
  useEffect(() => {
    if (!sb) return
    sb.from('fantasy_picks').select('*').eq('season', S.key).then(({ data }) => setPicks(data || []))
    sb.from('fantasy_draft').select('*').eq('season', S.key).maybeSingle().then(({ data }) => setDraft(data || null))
    fetchAll(() => sb.from('fantasy_events').select('*').order('created_at', { ascending: false })).then(setEvents).catch(() => {})
    sb.from('fantasy_votes').select('*').eq('season', S.key).eq('week', S.week).then(({ data }) => setVotes(data || []))
    sb.from('fantasy_swaps').select('*').eq('season', S.key).then(({ data }) => setSwaps(data || []))
    sb.from('fantasy_captains').select('*').eq('season', S.key).then(({ data }) => setCaps(data || []))
    sb.from('fantasy_trades').select('*').eq('season', S.key).order('created_at', { ascending: false }).then(({ data }) => setTrades(data || []))
    sb.from('fantasy_chips').select('*').eq('season', S.key).then(({ data }) => setChipRows(data || []))
    sb.from('fantasy_vaults').select('*').eq('season', S.key).then(({ data }) => setVaults(data || []))
    sb.from('fantasy_streaks').select('*').eq('season', S.key).then(({ data }) => setStreaks(data || []))
    sb.from('fantasy_claims').select('*').eq('season', S.key).order('created_at', { ascending: false }).then(({ data }) => setClaims(data || []))
  }, [tick])
  useEffect(() => {
    if (!sb) return
    const ch = sb.channel('fantasy').on('postgres_changes', { event: '*', schema: 'public', table: 'fantasy_events' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fantasy_picks' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fantasy_draft' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fantasy_trades' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fantasy_chips' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fantasy_claims' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fantasy_vaults' }, reload).subscribe()
    return () => { sb.removeChannel(ch) }
  }, [])

  const byId = useMemo(() => Object.fromEntries(chars.map(c => [c.id, c])), [chars])
  const who = id => friends.find(f => f.id === id)
  const name = id => who(id)?.username || 'someone'
  const run = async (fn, args, after) => {
    setErr('')
    const { error } = await sb.rpc(fn, args)
    if (error) { setErr(error.message); sfx('loss') } else { sfx({ fantasy_play_chip: 'power', fantasy_set_captain: 'crown', fantasy_swap: 'swap', fantasy_claim: 'swap', fantasy_add_bench: 'swap', trade_offer: 'deal', trade_respond: args?.p_accept ? 'win' : 'press' }[fn] || 'press'); after?.(); reload() }
  }

  const live = events.filter(e => e.status === 'confirmed')
  const cur = live.filter(e => e.season === S.key)
  const teams = useMemo(() => {
    const t = {}
    for (const p of picks) (t[p.user_id] ||= { user: p.user_id, chars: [], total: 0, week: 0 }).chars.push(p.char_id)
    for (const e of cur) { const x = t[e.team_user]; if (!x) continue; x.total += e.points; if (e.week === S.week) x.week += e.points }
    return Object.values(t).sort((a, b) => b.total - a.total)
  }, [picks, events])
  const charPts = useMemo(() => { const m = {}; for (const e of cur) if (e.char_id) m[e.char_id] = (m[e.char_id] || 0) + e.points; return m }, [events])
  // form guide: each character's points per week this season
  const form = useMemo(() => { const m = {}; for (const e of cur) if (e.char_id) { (m[e.char_id] ||= {})[e.week] = ((m[e.char_id] || {})[e.week] || 0) + e.points } return m }, [events])
  // who's on the bench right now: on a 6-character team, whoever has the fewest points this week (decided for real at week's end)
  const weekPts = useMemo(() => { const m = {}; for (const e of cur) if (e.char_id && e.week === S.week) m[e.char_id] = (m[e.char_id] || 0) + e.points; return m }, [events])
  const benchOf = t => !t || t.chars.length < 6 ? null : [...t.chars].sort((a, b) => (weekPts[a] || 0) - (weekPts[b] || 0) || (charPts[a] || 0) - (charPts[b] || 0))[0]
  const dead = useMemo(() => {
    const m = {}
    for (const e of [...cur].reverse()) if (e.kind === 'death') m[e.char_id] = true; else if (e.kind === 'revive') delete m[e.char_id]
    return m
  }, [events])
  const mine = teams.find(t => t.user === me?.id)
  // captain = latest pick at or before this week (carries over if you don't pick)
  const capOf = u => caps.filter(c => c.user_id === u && c.week <= S.week).sort((a, b) => b.week - a.week)[0]?.char_id
  const capLocked = caps.some(c => c.user_id === me?.id && c.week === S.week)
  const takenBy = Object.fromEntries(picks.map(p => [p.char_id, p.user_id]))
  // 🐷 piggy banks: only count for the owner who saved them up
  const vault = Object.fromEntries(vaults.filter(v => v.amount > 0 && takenBy[v.char_id] === v.user_id).map(v => [v.char_id, v.amount]))
  // rank movement: where each team stood before this week's points
  const streak = Object.fromEntries(streaks.filter(x => x.streak > 0 && takenBy[x.char_id] === x.user_id).map(x => [x.char_id, x.streak]))
  const lastRank = Object.fromEntries([...teams].sort((a, b) => (b.total - b.week) - (a.total - a.week)).map((t, i) => [t.user, i + 1]))
  // bottom 2 at the start of the week (4+ teams): +25%/+10% underdog boost and a second swap
  const myStart = lastRank[me?.id] || 0
  const mercy = teams.length >= 4 && myStart > teams.length - 2 ? (myStart === teams.length ? 'last' : 'second') : false
  const topWeek = teams.length ? Math.max(...teams.map(t => t.week)) : 0
  // waivers: dropped in the last 24h -> claims only, lowest in the table wins
  const waivers = {}
  for (const w of swaps) { const until = new Date(w.created_at).getTime() + 86400000; if (until > Date.now() && !takenBy[w.out_char]) waivers[w.out_char] = Math.max(waivers[w.out_char] || 0, until) }
  const chipNow = u => chipRows.find(c => c.user_id === u && c.week === S.week)?.chip

  if (!sb || !me) return <div className="card pad muted">Sign in to play the Fantasy League.</div>
  const daysLeft = Math.ceil((S.end - Date.now()) / 86400000)

  return (
    <div className="fantasy lb">
      {mine ? <Scoreboard S={S} mine={mine} rank={teams.findIndex(t => t.user === me.id) + 1} count={teams.length} captain={byId[capOf(me.id)]}
        chip={chipNow(me.id) && CHIPS[chipNow(me.id)]} feed={cur.filter(e => e.char_id).slice(0, 12)} byId={byId} KINDS={KINDS} /> :
      <div className="fhero">
        <div className="fhero-l">
          <div className="fkick"><span>Fantasy League</span>{S.label}</div>
          <h1 className="fweek">Week <b>{S.week}</b></h1>
          <div className="fchips">
            <span><b>{daysLeft}</b> days left</span>
            <span><b>{teams.length}</b> team{teams.length === 1 ? '' : 's'}</span>
            {mine && <span><b>#{teams.findIndex(t => t.user === me.id) + 1}</b> your rank</span>}
            {chipNow(me.id) && <span className="fchipon"><b>{CHIPS[chipNow(me.id)][0]}</b> {CHIPS[chipNow(me.id)][1]} on</span>}
          </div>
        </div>
        {mine ? <div className="fscore"><b>{mine.total}</b><span>points</span><em className={mine.week < 0 ? 'down' : 'up'}>{pts(mine.week)} this week</em></div>
          : <div className="fscore"><b>5</b><span>picks to make</span><em>draft is open</em></div>}
        <div className="fhero-art">{(mine ? mine.chars : chars.filter(c => c.form).slice(0, 5).map(c => c.id)).map((id, i) => byId[id] &&
          <img key={id} src={byId[id].image} alt="" referrerPolicy="origin" />)}</div>
      </div>}
      {err && <div className="card pad ferr">{err}</div>}

      {draft && draft.status !== 'done' ? <Draft d={draft} me={me} friends={friends} chars={chars} info={info} picks={picks} reload={reload} />
      : !mine ? <Picker chars={chars} info={info} takenBy={takenBy} name={name} onLock={ids => run('fantasy_pick', { p_chars: ids }, () =>
        logActivity('fantasy_team', { season: S.label, names: ids.map(i => byId[i]?.name), cover: byId[ids[0]]?.image }))} /> : <>
        <Commish me={me} friends={friends} reload={reload} />
        <SlideTabs tab={tab} setTab={setTab} tabs={[['table', '🏆 Standings'], ['team', '⚽ My team'], ['moments', '⚡ Moments'], ['trades', `🔄 Trades${trades.some(t => t.status === 'pending' && t.to_user === me.id) ? ` (${trades.filter(t => t.status === 'pending' && t.to_user === me.id).length})` : ''}`], ['cup', '🏆 Cup'], ['vote', "🗳️ Who's hyper?"], ['rules', '📜 Scoring']]} />
        <Deadline S={S} swaps={swaps} trades={trades} byId={byId} name={name} />
        {tab === 'table' && <button className="pill ghost rp-open" onClick={() => setReplay(true)}>🎬 Draft-day replay</button>}
        {replay && <DraftReplay S={S} draft={draft} chars={chars} charPts={charPts} who={who} onClose={() => setReplay(false)} />}
        {tab === 'table' && <Standings weekPts={weekPts} lastRank={lastRank} topWeek={topWeek} chipNow={chipNow} form={form} week={S.week} capOf={capOf} benchOf={benchOf} teams={teams} byId={byId} who={who} me={me} charPts={charPts} dead={dead} vault={vault} openProfile={openProfile} events={live} S={S} />}
        {tab === 'team' && <MyTeam form={form} week={S.week} benched={benchOf(mine)} team={mine} info={info} byId={byId} chars={chars} takenBy={takenBy} name={name} charPts={charPts} dead={dead} vault={vault}
          events={cur.filter(e => e.team_user === me.id)} swapped={!isDeadline() && swaps.filter(s => s.user_id === me.id && s.week === S.week).length >= (mercy ? 2 : 1)} mercy={mercy} streak={streak}
          captain={capOf(me.id)} capLocked={capLocked} onCaptain={id => run('fantasy_set_captain', { p_char: id })}
          onSwap={(o, i) => run('fantasy_swap', { p_out: o, p_in: i })} onBench={id => run('fantasy_add_bench', { p_char: id })}
          chips={chipRows.filter(c => c.user_id === me.id)} chipWeek={S.week} onChip={c => run('fantasy_play_chip', { p_chip: c })}
          waivers={waivers} onClaim={(o, i) => run('fantasy_claim', { p_char: i, p_out: o })} myClaims={claims.filter(c => c.user_id === me.id)} onUnclaim={id => run('fantasy_claim_cancel', { p_id: id })}
          order={[...teams].reverse()} who={who} me={me} />}
        {tab === 'trades' && <Trades me={me} picks={picks} byId={byId} name={name} trades={trades} run={run} />}
        {tab === 'moments' && <Moments events={cur.filter(e => e.source === 'bot')} byId={byId} name={name} />}
        {tab === 'vote' && <Vote S={S} teams={teams} byId={byId} name={name} me={me} votes={votes} reload={reload} setErr={setErr} />}
        {tab === 'cup' && <Cup S={S} teams={teams} events={cur} who={who} me={me} openProfile={openProfile} />}
        {tab === 'rules' && <Rules />}
      </>}
    </div>
  )
}

function CharTile({ c, sub, on, off, onClick, children, big, capt, tag }) {
  if (!c) return null
  return <div className={`fchar ${on ? 'on' : ''} ${off ? 'off' : ''} ${big ? 'big' : ''}`} onClick={off ? undefined : onClick} style={{ '--c': c.color || '#7b5cff' }}>
    <img src={c.image} alt="" loading="lazy" referrerPolicy="origin" />
    {c.form && <i className="fform">{c.form}</i>}
    {on && <i className="fcheck">✓</i>}
    {capt && <i className="fcapt">👑 ×2</i>}
    {tag && <i className={`ftag ${tag.active ? 'live' : 'legacy'}`}>{tag.active ? '📺 Active' : '🏛️ Legacy ×1.5'}</i>}
    <div className="fcap"><b>{c.name}</b><span>{sub ?? c.media_title}</span></div>
    {children}
  </div>
}

function Picker({ chars, info, takenBy, name, onLock }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState([])
  const shown = chars.filter(c => !q || norm(c.name + c.media_title).includes(norm(q))).slice(0, 120)
  const showOf = id => info[id]?.show_key
  // already have someone from this show (and it isn't this character)
  const clash = id => sel.some(x => x !== id && showOf(x) && showOf(x) === showOf(id))
  const toggle = id => setSel(s => s.includes(id) ? s.filter(x => x !== id) : s.length < 5 && !clash(id) ? [...s, id] : s)
  const byId = Object.fromEntries(chars.map(c => [c.id, c]))
  const forms = chars.filter(c => c.form).length
  return <div className="fpick">
    <div className="fintro">
      <h2>Draft your 5</h2>
      <p>Any 5 characters, <b>one per show</b>. Each one can only be on one team, so first come first served. <b>📺 Active</b> characters (anime airing or manga releasing) score from episodes, chapters and fights. <b>🏛️ Legacy</b> characters score from hype and news at <b>×1.5</b>. One swap a week.</p>
    </div>
    <div className="fbar">
      <input className="search" placeholder="Search characters or anime…" value={q} onChange={e => setQ(e.target.value)} />
      <span className="muted small">{chars.length} characters · {forms} in their strongest form</span>
    </div>
    <div className="fgrid">
      {shown.map(c => <CharTile key={c.id} c={c} on={sel.includes(c.id)} off={!!takenBy[c.id] || (!sel.includes(c.id) && clash(c.id))} tag={info[c.id]}
        sub={takenBy[c.id] ? `taken by ${name(takenBy[c.id])}` : !sel.includes(c.id) && clash(c.id) ? 'you have someone from this show' : c.media_title} onClick={() => toggle(c.id)} />)}
    </div>
    <div className="fdraft">
      <div className="fslots">
        {[0, 1, 2, 3, 4].map(i => { const c = byId[sel[i]]; return <div key={i} className={`fslot ${c ? 'full' : ''}`} onClick={() => c && toggle(c.id)} title={c ? 'Remove' : ''}>
          {c ? <><img src={c.image} alt="" referrerPolicy="origin" /><b>{c.name}</b></> : <span>{i + 1}</span>}</div> })}
      </div>
      <button className="flock" disabled={sel.length !== 5} onClick={() => onLock(sel)}>{sel.length === 5 ? 'Lock in team' : `${5 - sel.length} more to pick`}</button>
    </div>
  </div>
}

function Standings({ weekPts, lastRank, topWeek, chipNow, form, week, capOf, benchOf, teams, byId, who, me, charPts, dead, vault, openProfile, events, S }) {
  // hall of fame: winner of each finished season
  const past = {}
  for (const e of events) if (e.season !== S.key) ((past[e.season] ||= {})[e.team_user] = (past[e.season][e.team_user] || 0) + e.points)
  const champs = Object.entries(past).map(([s, t]) => { const [u, p] = Object.entries(t).sort((a, b) => b[1] - a[1])[0]; return { s, u, p } }).sort((a, b) => b.s.localeCompare(a.s))
  const feed = events.filter(e => e.season === S.key).slice(0, 25)
  return <div className="rank">
    <section>
      <Race teams={teams} who={who} me={me} lastRank={lastRank} topWeek={topWeek} capOf={capOf} benchOf={benchOf} chipNow={chipNow} CHIPS={CHIPS}
        byId={byId} charPts={charPts} weekPts={weekPts} dead={dead} vault={vault} events={events.filter(e => e.season === S.key)} openProfile={openProfile} KINDS={KINDS} />
    </section>
    <aside>
      <h3>Latest points</h3>
      <div className="card">{feed.map(e => <div key={e.id} className="lrow">
        <span>{KINDS[e.kind]?.[0]}</span>
        <div className="grow small"><b>{byId[e.char_id]?.name || who(e.team_user)?.username}</b> {KINDS[e.kind]?.[1].toLowerCase()}<div className="muted">{e.note}</div></div>
        <b className={e.points < 0 ? 'down' : 'up'}>{pts(e.points)}</b>
      </div>)}{!feed.length && <div className="pad muted small">Points land as episodes and chapters drop.</div>}</div>
      <h3>Hall of fame</h3>
      <div className="card">{champs.map(c => <div key={c.s} className="lrow"><span>🏆</span><div className="grow">{who(c.u)?.username}<div className="muted small">{seasonLabel(c.s)}</div></div><b>{c.p}</b></div>)}
        {!champs.length && <div className="pad muted small">The first champion is crowned when {S.label} ends.</div>}</div>
    </aside>
  </div>
}

function MyTeam({ mercy, streak = {}, vault = {}, chips, chipWeek, onChip, waivers, onClaim, myClaims, onUnclaim, order, who, me, form, week, benched, team, info, byId, chars, takenBy, name, charPts, dead, events, swapped, onSwap, onBench, captain, capLocked, onCaptain }) {
  const [out, setOut] = useState(null)
  const [benchOpen, setBenchOpen] = useState(false)
  const [q, setQ] = useState('')
  const wildcard = chips.some(c => c.chip === 'wildcard' && c.week === chipWeek)
  const usedThisWeek = chips.find(c => c.week === chipWeek)
  const pending = myClaims.filter(c => c.status === 'pending')
  const hrs = t => Math.max(1, Math.round((t - Date.now()) / 3600000))
  return <div className="rank">
    <section>
      <div className="lb-chiprow">{Object.entries(CHIPS).map(([k, [ic, nm, desc]]) => { const u = chips.find(c => c.chip === k)
        const live = u && u.week === chipWeek
        return <ChipCard key={k} ic={ic} name={nm} desc={desc} state={live ? 'live' : u ? 'used' : ''} disabled={!!u || !!usedThisWeek || (k === 'boost' && team.chars.length < 6)}
          label={live ? 'Active this week' : u ? `Used wk ${u.week}` : k === 'boost' && team.chars.length < 6 ? 'Needs a bench player' : usedThisWeek ? 'One chip per week' : 'Play it'}
          onClick={() => confirm(`Play ${nm} for week ${chipWeek}? You only get it once a season.`) && onChip(k)} /> })}</div>
      <div className="fcapbar">
        <b>👑 Captain</b>
        <span>{captain ? <>{byId[captain]?.name} scores <b>{chips.some(c => c.chip === 'triple' && c.week === chipWeek) ? 'triple' : 'double'}</b> this week</> : 'Pick a captain: their points count double'}</span>
        <em>{capLocked ? 'Locked for this week' : 'One pick per week, then it locks'}</em>
      </div>
      <div className={`sq-grid n${team.chars.length}`}>
        {[...team.chars].sort((a, b) => (b === captain) - (a === captain) || (charPts[b] || 0) - (charPts[a] || 0)).map((id, i) =>
          <SquadCard key={id} delay={i * 80} c={byId[id]} pts={charPts[id] || 0} wk={(form[id] || {})[week] || 0} events={events.filter(e => e.char_id === id)} KINDS={KINDS}
            captain={captain === id ? (chips.some(c => c.chip === 'triple' && c.week === chipWeek) ? 'x3' : 'x2') : null} benched={benched === id} dead={dead[id]} tag={info[id]} vault={vault[id]} streak={streak[id]}
            form={<Form f={form[id]} week={week} />}
            actions={<>
              {!capLocked && captain !== id && <button className="btn sm primary" onClick={() => onCaptain(id)}>👑 Make captain</button>}
              {(!swapped || wildcard) && <button className="btn sm" onClick={() => setOut(out === id ? null : id)}>{out === id ? 'Cancel swap' : '🔄 Swap out'}</button>}
            </>} />)}
        {(() => { const mvp = [...team.chars].sort((a, b) => ((form[b] || {})[week] || 0) - ((form[a] || {})[week] || 0))[0]; const wk = team.chars.reduce((n, id) => n + ((form[id] || {})[week] || 0), 0)
          return <div className="sq-stat"><small>Week {week}</small><b>{wk > 0 ? '+' : ''}{wk}</b><span>team points this week</span>
            {byId[mvp] && <div className="mvp" onClick={() => openChar(mvp)}><img src={byId[mvp].image} alt="" referrerPolicy="origin" /><div><small>⭐ MVP</small><b>{byId[mvp].name}</b></div></div>}</div> })()}
      </div>
      {team.chars.length < 6 ? <div className="fbench" onClick={() => setBenchOpen(o => !o)}>
        <b>🪑 Add your bench player</b><span>A free 6th character. Each week only your best 5 count: your lowest scorer is benched automatically, so the bench covers anyone who goes quiet or dies.</span>
      </div> : <p className="muted small">🪑 6 characters: each week your lowest scorer is benched automatically, and your best 5 count.</p>}
      {benchOpen && team.chars.length < 6 && <div className="card pad">
        <h3>Pick your bench player</h3>
        <input className="search" placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} />
        <div className="fgrid">{chars.filter(c => !takenBy[c.id] && !team.chars.some(x => info[x]?.show_key && info[x].show_key === info[c.id]?.show_key) && (!q || norm(c.name + c.media_title).includes(norm(q)))).slice(0, 40).map(c =>
          <CharTile key={c.id} c={c} tag={info[c.id]} onClick={() => confirm(`Add ${c.name} as your bench player?`) && (onBench(c.id), setBenchOpen(false))} />)}</div>
      </div>}
      {mercy && <div className="fmercy">🔵 <b>Underdog week:</b> you started the week in the bottom 2, so you get <b>+{mercy === 'last' ? 25 : 10}%</b> bonus points and <b>2 swaps</b> this week.</div>}
      {swapped && !wildcard && <p className="muted small">You've used this week's swap{mercy ? 's' : ''}.</p>}
      {wildcard && <p className="muted small">🃏 Wildcard on: unlimited swaps this week.</p>}
      {pending.length > 0 && <div className="card pad"><h3>⏳ Your waiver claims</h3>{pending.map(c => <div key={c.id} className="lrow small">
        <span>⏳</span><div className="grow"><b>{byId[c.char_id]?.name}</b> for {byId[c.out_char]?.name}<div className="muted">decided in ~{hrs(waivers[c.char_id] || Date.now())}h</div></div>
        <button className="pill ghost" onClick={() => onUnclaim(c.id)}>Cancel</button></div>)}</div>}
      {out && <div className="card pad">
        <h3>Swap out {byId[out]?.name} for…</h3>
        <input className="search" placeholder="Search…" value={q} onChange={e => setQ(e.target.value)} />
        <div className="fgrid">{chars.filter(c => !takenBy[c.id] && !team.chars.some(x => x !== out && info[x]?.show_key && info[x].show_key === info[c.id]?.show_key) && (!q || norm(c.name + c.media_title).includes(norm(q)))).slice(0, 40).map(c =>
          <CharTile key={c.id} c={c} sub={waivers[c.id] ? `⏳ waivers · ${hrs(waivers[c.id])}h left` : undefined}
            onClick={() => { if (waivers[c.id]) { confirm(`${c.name} is on waivers. Put in a claim? Lowest in the table gets them when it ends.`) && onClaim(out, c.id) } else onSwap(out, c.id); setOut(null) }} />)}</div>
        <p className="muted small">⏳ Dropped in the last 24h = on waivers. Claim them and whoever is lowest in the table gets them.</p>
      </div>}
    </section>
    <aside>
      <h3>Waiver priority</h3>
      <div className="card">{order.map((t, i) => <div key={t.user} className={`lrow small ${t.user === me.id ? 'meline' : ''}`}><span>{i + 1}</span><div className="grow">{who(t.user)?.username || '?'}</div><b>{t.total}</b></div>)}</div>
      <h3>Your points log</h3>
      <div className="card">{events.slice(0, 40).map(e => <div key={e.id} className="lrow">
        <span>{KINDS[e.kind]?.[0]}</span><div className="grow small"><b>{byId[e.char_id]?.name || 'Team'}</b> {KINDS[e.kind]?.[1].toLowerCase()}<div className="muted">wk {e.week} · {e.note}</div></div>
        <b className={e.points < 0 ? 'down' : 'up'}>{pts(e.points)}</b></div>)}
        {!events.length && <div className="pad muted small">Nothing yet. Points come in as your characters' shows air.</div>}</div>
    </aside>
  </div>
}

// fights, power-ups, deaths and appearances are found automatically each day from episode/chapter recaps
function Moments({ events, byId, name }) {
  return <div>
    <p className="muted">Fights, power-ups, deaths and appearances are picked up automatically every day from episode and chapter recaps. Nothing to log.</p>
    <div className="fmoments">
      {events.map(e => { const c = byId[e.char_id]; return <div key={e.id} className={`fmoment ${e.points < 0 ? 'neg' : ''}`}>
        {c && <img src={c.image} alt="" referrerPolicy="origin" onClick={() => openChar(c.id)} />}
        <div className="grow">
          <div className="fmk">{KINDS[e.kind]?.[0]} {KINDS[e.kind]?.[1]} <b className={e.points < 0 ? 'down' : 'up'}>{pts(e.points)}</b></div>
          <b className="fmn">{c?.name}</b> <span className="muted small">· {name(e.team_user)}'s team · wk {e.week}</span>
          <div className="small">{e.note}{e.link && <> · <a href={e.link} target="_blank" rel="noreferrer">source</a></>}</div>
        </div>
      </div> })}
      {!events.length && <div className="card pad muted">No moments yet. They show up here as drafted characters' episodes and chapters drop.</div>}
    </div>
  </div>
}

function Vote({ S, teams, byId, name, me, votes, reload, setErr }) {
  const games = matchups(teams.map(t => t.user), S.week)
  const team = id => teams.find(t => t.user === id)
  const cast = async (a, b, pick) => {
    const { error } = await sb.from('fantasy_votes').upsert({ season: S.key, week: S.week, a_user: a, b_user: b, voter: me.id, pick })
    if (error) setErr(error.message); else reload()
  }
  return <div>
    <p className="muted">This week's matchups. Vote for whose 5 have been more hyped. The winner of each gets +5 when the week ends. You can't vote in your own matchup.</p>
    {games.map(([a, b]) => { const mineVote = votes.find(v => v.a_user === a && v.b_user === b && v.voter === me.id)?.pick
      const n = u => votes.filter(v => v.a_user === a && v.b_user === b && v.pick === u).length
      const inIt = me.id === a || me.id === b
      return <div key={a + b} className="card fmatch">
        {[a, b].map((u, i) => <div key={u} className={`fside ${mineVote === u ? 'on' : ''}`}>
          <b>{name(u)}</b>
          <div className="fmini">{team(u).chars.map(id => byId[id] && <span key={id}><img src={byId[id].image} alt="" title={byId[id].name} referrerPolicy="origin" /></span>)}</div>
          {inIt ? <span className="muted small">{n(u)} vote{n(u) === 1 ? '' : 's'}</span> : <button className="btn sm primary" onClick={() => cast(a, b, u)}>{mineVote === u ? 'Voted ✓' : 'Hyper'} · {n(u)}</button>}
        </div>)}
        <div className="bvs">VS</div>
      </div> })}
    {!games.length && <div className="card pad muted">Needs at least 2 teams.</div>}
  </div>
}

function Rules() {
  const story = [['📺', 'Their show airs a new episode', '+10'], ['📖', 'Their manga drops a new chapter', '+8'], ['⚡', 'Transformation or power-up', '+20'], ['🌟', 'New form debut: a transformation shown for the very first time (on top of the +20, outside the weekly cap)', '+30'],
    ['🏆', 'Wins a proper fight', '+8'], ['👀', 'Appears in a new episode/chapter', '+3'], ['💥', 'Loses a fight', '−5'], ['💀', 'Dies (then scores 0 until they come back)', '−20']]
  const hype = [['📊', 'Weekly hype ranking: every drafted character ranked by how much their hype grew vs their own usual week', '+30 (1st) → +5 (last)'],
    ['🏛️', 'Legacy bonus: show not airing and manga not releasing', 'hype ×1.5'], ['📰', 'Big news: new season/film announced, added to a game, poll win, anniversary', '+15'], ['🎬', 'New trailer: an official trailer, PV or teaser for a show, film or game they’re in', '+20']]
  const piggy = [['🐷', 'Every quiet week (show not airing, manga not releasing) your character’s piggy bank fills up, faster the longer you hold them', '5 → 11 → 18 → 27 → 37 → 49 → 60'],
    ['💥', 'Big news, a new trailer, or their story comes back (new season, chapter, fight)? The piggy bank smashes and pays out everything at once', 'max 60'],
    ['🔒', 'Trade or drop them and the piggy bank is lost. Captain doesn’t double it, and it’s outside the weekly cap', 'hold to win']]
  const T = (title, rows, note) => <div className="card pad"><h3>{title}</h3>{note && <p className="muted small">{note}</p>}{rows.map(([i, l, p]) => <div key={l} className="lrow"><span>{i}</span><div className="grow">{l}</div><b>{p}</b></div>)}</div>
  return <div className="frules">
    {T('📺 Story points', story, 'Only for Active characters (anime airing or manga releasing). Found automatically from recaps every night. Capped at 30 per character per week.')}
    {T('🐷 Piggy bank (for your investments)', piggy, 'Old-show legends don’t score every week, so they save up instead and cash out when big news drops.')}
    {T('🔥 Hype points', hype, 'Every character, airing or not. Ranked against their own normal, so a quiet legend only has to beat their own usual week.')}
    {T('Squad', [['🗳️', "Win your weekly \"who's hyper?\" matchup", '+5'], ['👑', 'Captain scores double all week (pick once a week, carries over)', '×2']])}
    {T('Catch-up boosts', [['🔥', 'Streak: each week a character scores story points their streak grows. Pays +2, +4, +6, +8, then +10 a week. Miss a week and it resets', 'up to +10'], ['🤝', 'Synergy: 3 or more of your characters score story points in the same week', '+10'], ['📺', 'Episode bonus: every new episode pays an extra +2 (outside the weekly cap)', '+2'], ['🔵', 'Underdog: last place at the start of a week gets +25% of that week’s points, second-last +10%', '+25%'], ['🆘', 'Mercy swap: the bottom 2 teams get 2 swaps a week instead of 1', '2 swaps']])}
    {T('Bench & trades', [['🪑', 'Bench: a free 6th character. Only your best 5 count each week (lowest is benched automatically)', 'best 5'], ['🔄', 'Trade one of yours for one of a mate\'s (they accept or decline). Points already scored stay where they are', '1 for 1']])}
    {T('🎴 Chips (once a season each, one per week)', Object.values(CHIPS).map(([i, n, d]) => [i, `${n}: ${d}`, '1x']))}
    {T('⏳ Waivers', [['⏳', 'Anyone dropped goes on waivers for 24 hours. Put in a claim; when it ends the lowest team in the table gets them', 'worst first']])}
    <p className="muted small">One character per show (no stacking two from the same anime). Seasons follow the anime seasons, one swap a week, plus a free swap while your team has two from the same show. Most points when the season ends takes the crown.</p>
  </div>
}

// one-for-one trades: offer one of yours for one of theirs; they accept or decline
function Trades({ me, picks, byId, name, trades, run }) {
  const [give, setGive] = useState('')
  const [get, setGet] = useState('')
  const mine = picks.filter(p => p.user_id === me.id)
  const theirs = picks.filter(p => p.user_id !== me.id).sort((a, b) => name(a.user_id).localeCompare(name(b.user_id)))
  const incoming = trades.filter(t => t.status === 'pending' && t.to_user === me.id)
  const outgoing = trades.filter(t => t.status === 'pending' && t.from_user === me.id)
  const done = trades.filter(t => t.status !== 'pending').slice(0, 20)
  const C = id => byId[id] ? <span className="tchar"><img src={byId[id].image} alt="" referrerPolicy="origin" />{byId[id].name}</span> : '?'
  return <div className="rank">
    <section>
      <div className="card pad">
        <h3>Make an offer</h3>
        <label className="lbl">You give</label>
        <select value={give} onChange={e => setGive(e.target.value)}><option value="">Pick one of yours…</option>
          {mine.map(p => byId[p.char_id] && <option key={p.char_id} value={p.char_id}>{byId[p.char_id].name}</option>)}</select>
        <label className="lbl">You get</label>
        <select value={get} onChange={e => setGet(e.target.value)}><option value="">Pick someone else's…</option>
          {theirs.map(p => byId[p.char_id] && <option key={p.char_id} value={p.char_id}>{name(p.user_id)}: {byId[p.char_id].name}</option>)}</select>
        <button className="flock" disabled={!give || !get} onClick={() => run('trade_offer', { p_give: +give, p_get: +get }, () => { setGive(''); setGet('') })}>Send offer</button>
      </div>
      <h3>Offers for you</h3>
      {incoming.map(t => <div key={t.id} className="ttrade in">
        <div><b>{name(t.from_user)}</b> offers {C(t.give_char)} for your {C(t.get_char)}</div>
        <div className="row gap"><button className="pill" onClick={() => confirm('Accept this trade?') && run('trade_respond', { p_id: t.id, p_accept: true })}>✅ Accept</button>
          <button className="pill ghost" onClick={() => run('trade_respond', { p_id: t.id, p_accept: false })}>❌ Decline</button></div>
      </div>)}
      {!incoming.length && <div className="muted small">No offers right now.</div>}
      <h3>Your offers</h3>
      {outgoing.map(t => <div key={t.id} className="ttrade">
        <div>Your {C(t.give_char)} for <b>{name(t.to_user)}</b>'s {C(t.get_char)}</div>
        <button className="pill ghost" onClick={() => run('trade_cancel', { p_id: t.id })}>Cancel</button>
      </div>)}
      {!outgoing.length && <div className="muted small">You haven't offered anything.</div>}
    </section>
    <aside>
      <h3>Trade log</h3>
      <div className="card">{done.map(t => <div key={t.id} className="lrow small">
        <span>{t.status === 'accepted' ? '✅' : t.status === 'declined' ? '❌' : '➖'}</span>
        <div className="grow"><b>{name(t.from_user)}</b> {byId[t.give_char]?.name} ↔ <b>{name(t.to_user)}</b> {byId[t.get_char]?.name}<div className="muted">{t.status}</div></div>
      </div>)}{!done.length && <div className="pad muted small">No trades yet.</div>}</div>
    </aside>
  </div>
}

// last 5 weeks of points as little bars; this week highlighted. Hover/tap a bar for the number.
function Form({ f = {}, week, mini }) {
  const weeks = [4, 3, 2, 1, 0].map(k => week - k).filter(w => w >= 1)
  const vals = weeks.map(w => f[w] || 0)
  const max = Math.max(30, ...vals.map(Math.abs))
  return <div className={`fform-guide ${mini ? 'mini' : ''}`} onClick={e => e.stopPropagation()} title={weeks.map((w, i) => `Wk ${w}: ${vals[i]}`).join(' · ')}>
    {!mini && <span>Form</span>}
    <div className="ffg-bars">{weeks.map((w, i) => <i key={w} className={`${w === week ? 'now' : ''} ${vals[i] < 0 ? 'neg' : ''}`}
      style={{ height: `${Math.max(vals[i] ? 12 : 4, Math.abs(vals[i]) / max * 100)}%` }} title={`Week ${w}: ${vals[i]} pts`} />)}</div>
  </div>
}

// Mid-season Cup: knockout from week 7. Seeds = table before week 7. R1 (wk 7): 3v6, 4v5. Semis (wk 8): 1 v lowest survivor, 2 v the other.
// Final (wk 9). Most league points that week wins the tie (higher seed wins a draw). Champion +25.
const CUP_START = 7
function Cup({ S, teams, events, who, me, openProfile }) {
  const a = CUP_START
  const wk = (u, w) => events.filter(e => e.team_user === u && e.week === w && e.kind !== 'cup').reduce((n, e) => n + e.points, 0)
  const seeds = [...teams].map(t => ({ u: t.user, before: events.filter(e => e.team_user === t.user && e.week < a).reduce((n, e) => n + e.points, 0) }))
    .sort((x, y) => y.before - x.before || (x.u < y.u ? -1 : 1)).map(x => x.u)
  if (seeds.length < 4) return <div className="card pad muted">The cup needs at least 4 teams.</div>
  const seedOf = u => seeds.indexOf(u) + 1
  const decided = w => S.week > w
  const tie = (x, y, w) => { if (!x || !y) return { x, y, w, win: null }; const px = wk(x, w), py = wk(y, w)
    const win = !decided(w) ? null : px > py ? x : py > px ? y : (seedOf(x) < seedOf(y) ? x : y); return { x, y, w, px, py, win } }
  const r1 = seeds.length >= 6 ? [tie(seeds[2], seeds[5], a), tie(seeds[3], seeds[4], a)] : [{ x: seeds[2], win: seeds[2], bye: true }, { x: seeds[3], win: seeds[3], bye: true }]
  const surv = r1.map(t => t.win)
  const [lo, hi] = surv.every(Boolean) ? [...surv].sort((p, q) => seedOf(q) - seedOf(p)) : [null, null]
  const sf = [tie(seeds[0], lo, a + 1), tie(seeds[1], hi, a + 1)]
  const fin = tie(sf[0].win, sf[1].win, a + 2)
  const champ = fin.win
  const status = S.week < a ? `Starts week ${a}. Seeds lock when week ${a - 1} ends.` : S.week <= a + 2 ? `Live: ${['Round 1', 'Semi-finals', 'Final'][S.week - a]} (week ${S.week})` : 'Finished'
  const Side = ({ u, p, won, live }) => u ? <div className={`cup-side ${won ? 'won' : won === false ? 'out' : ''} ${u === me.id ? 'me' : ''}`} onClick={() => openProfile(u)}>
    <i>{seedOf(u)}</i><b>{who(u)?.username || '?'}</b>{p !== undefined && <em className={live ? 'live' : ''}>{p}</em>}</div> : <div className="cup-side tbd"><b>TBD</b></div>
  const Tie = ({ t, label }) => <div className="cup-tie"><small>{label}</small>
    {t.bye ? <><Side u={t.x} /><div className="cup-bye">bye</div></> : <><Side u={t.x} p={t.px} won={t.win ? t.win === t.x : undefined} live={S.week === t.w} /><Side u={t.y} p={t.py} won={t.win ? t.win === t.y : undefined} live={S.week === t.w} /></>}</div>
  return <div className="cup">
    <div className="cup-head"><div><h2>Mid-season Cup</h2><p className="muted">{status} Each tie is won by whoever scores more league points that week. The champion gets <b>+25</b>.</p></div>
      {champ && <div className="cup-champ">🏆 <b>{who(champ)?.username}</b><span>Champion</span></div>}</div>
    <div className="cup-bracket">
      <div className="cup-col"><h4>Round 1 · wk {a}</h4>{r1.map((t, i) => <Tie key={i} t={t} label={t.bye ? 'Bye' : `Seed ${seedOf(t.x)} v ${seedOf(t.y)}`} />)}
        <div className="cup-tie byes"><small>Byes to the semis</small><Side u={seeds[0]} /><Side u={seeds[1]} /></div></div>
      <div className="cup-col"><h4>Semi-finals · wk {a + 1}</h4>{sf.map((t, i) => <Tie key={i} t={t} label={`Semi ${i + 1}`} />)}</div>
      <div className="cup-col"><h4>Final · wk {a + 2}</h4><Tie t={fin} label="Final" /></div>
    </div>
  </div>
}

// ⏰ Transfer Deadline Day: first Saturday of the month (UK). Unlimited swaps, no waivers, live ticker of every move.
const isDeadline = (d = new Date()) => d.getDay() === 6 && d.getDate() <= 7
function nextDeadline(d = new Date()) {
  for (let i = 0; i < 40; i++) { const x = new Date(d); x.setDate(d.getDate() + i); x.setHours(0, 0, 0, 0); if (isDeadline(x) && (i > 0 || isDeadline(d))) return x }
}
function Deadline({ S, swaps, trades, byId, name }) {
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick(x => x + 1), 30000); return () => clearInterval(t) }, [])
  const now = new Date(), on = isDeadline(now)
  const seen = useRef(null)
  const today = d => new Date(d).toDateString() === now.toDateString()
  const moves = on ? [...swaps.filter(s => today(s.created_at)).map(s => ({ t: s.created_at, txt: `✍️ ${name(s.user_id)} signs ${byId[s.in_char]?.name || '?'} · releases ${byId[s.out_char]?.name || '?'}` })),
    ...trades.filter(t => t.status === 'accepted' && today(t.decided_at)).map(t => ({ t: t.decided_at, txt: `🔄 DEAL DONE: ${name(t.from_user)} ⇄ ${name(t.to_user)} · ${byId[t.give_char]?.name} for ${byId[t.get_char]?.name}` }))]
    .sort((a, b) => new Date(b.t) - new Date(a.t)) : []
  useEffect(() => { if (seen.current !== null && moves.length > seen.current) sfx('win', { text: 'ドン!', at: { x: innerWidth / 2, y: 140 } }); seen.current = moves.length }, [moves.length])
  if (!on) { const n = nextDeadline(now); const days = Math.ceil((n - now) / 864e5)
    return days <= 7 ? <div className="dl-soon">⏰ <b>Transfer Deadline Day</b> in {days} day{days > 1 ? 's' : ''} ({n.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}): unlimited swaps, no waivers.</div> : null }
  const end = new Date(now); end.setHours(24, 0, 0, 0); const left = end - now
  return <div className="dl">
    <div className="dl-head"><b>⏰ TRANSFER DEADLINE DAY</b><span>Unlimited swaps · no waivers · window shuts in <em>{Math.floor(left / 36e5)}h {Math.floor(left % 36e5 / 6e4)}m</em></span></div>
    <div className="dl-ticker"><div>{(moves.length ? moves : [{ txt: 'No moves yet. Who blinks first?' }]).concat(moves.length ? moves : []).map((m, i) => <span key={i}>{m.txt}</span>)}</div></div>
  </div>
}
