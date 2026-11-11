import { useEffect, useState } from 'react'
import { sfx } from './sfx.js'
import './times.css'

// "Stop the presses": a newspaper popup for anyone who hasn't seen the latest update.
// ADD A NEW EDITION AT THE TOP every time features ship. id must be unique and increase (date-based).
export const UPDATES = [
  {
    id: '2026-11-15', headline: 'SHARE YOUR FIGHTS: RANKED OPENS ITS DOORS',
    items: [
      ['📤 Share any matchup', 'Every VS Arena fight now has its own link. Hit Share result and send your mates the verdict.', 'VS Arena → Share result'],
      ['🌍 Arena is public', 'Anyone can open a VS link without an account, so your shared fights work for everyone.', 'VS Arena'],
      ['🚪 New front door', 'New visitors get a proper landing page, and sign-up no longer needs an AniList account.', 'Sign-up page'],
    ],
  },
  {
    id: '2026-11-14', headline: 'WHO WOULD WIN? THE VS ARENA IS OPEN',
    items: [
      ['⚔️ VS Arena', 'Put any two of 46 fighters head to head (Goku, Luffy, Gojo, Sukuna, Ichigo, Aizen, Naruto, Saitama and more) and get a verdict: STOMP, DEFINITELY, LIKELY or TOSS-UP, with the reasons why.', 'Sidebar → VS Arena'],
      ['📜 Real powerscaling', 'Every era and form is tiered from the VS Battles Wiki, with hax like Infinity, erasure, soul attacks, time stop and anti-magic weighed in, plus r/PowerScaling takes.', 'VS Arena'],
      ['🎛️ Pick the exact version', 'Filter by period of the series, form or transformation, and switch individual abilities off. Toggle bloodlust, prep time or a stats-only fight.', 'VS Arena'],
    ],
  },
  {
    id: '2026-11-13', headline: 'THE MARKET COMES ALIVE: NEW TRADING TERMINAL OPENS',
    items: [
      ['📈 New trading terminal', 'The Market is now a three-panel exchange: watchlist on the left, big chart and trade panel in the middle, live feeds on the right.', 'Market'],
      ['⚡ Live-ticking prices', 'Prices move every couple of seconds between server updates and flash green or red on every move. Trades still fill at the real price.', 'Market'],
      ['▦ Heatmap', 'See the whole market as a wall of tiles, sized by value and coloured by today’s move.', 'Market → Heatmap'],
      ['🔴 Live trade tape', 'Every squad buy, sell and short streams in as it happens, with sound effects for big trades.', 'Market → right panel'],
      ['🏁 Top movers', 'Today’s biggest gainers and losers across the top, updating live.', 'Market'],
    ],
  },
  {
    id: '2026-11-12', headline: 'RIVALS RIPPLE, DEADLINE DAY ARRIVES AND THE PRESS IS BORN',
    items: [
      ['⚔️ Families & rivals', 'When a story moment moves a character\'s price, their family (same show) moves 30% as far the same way, and their rival moves 15% the OPPOSITE way. Goku up = Vegeta down.', 'Tap any character → Family & rivals'],
      ['📰 The Ranked Times', 'A newspaper printed automatically every week: top scorer, flop, biggest climber, moment of the week, crashes, best trade, worst panic sell, transfer news.', 'Sidebar → The Times'],
      ['⏰ Transfer Deadline Day', 'First Saturday of every month, all day: unlimited swaps, no waivers, and every signing is announced to the whole squad live.', 'League → banner on the day'],
      ['🗞️ This newspaper', 'Every time something new lands, you\'ll get one of these the next time you visit.', ''],
    ],
  },
  {
    id: '2026-11-11', headline: 'SHORT SELLERS ENTER THE MARKET AS THE SQUAD VOTES ITS FIRST IPO',
    items: [
      ['📉 Short selling', 'Bet a character\'s price goes DOWN. Collateral is locked; if the price doubles you get wiped. Max 10 open.', 'Market → any character → Short'],
      ['🗳️ IPO voting', 'Nominate anyone not on the market and vote. Sunday 8pm the top pick (2+ votes) IPOs 48h later, and voters get the first 24h of pre-orders.', 'Market → IPO vote'],
      ['🏆 Mid-season Cup', 'Knockout over weeks 7–9, seeded by the table. Win your tie by scoring more that week. Champion gets +25.', 'League → Cup'],
      ['🎬 Draft-day replay', 'Watch the whole draft back pick by pick, with 💎 steals and 🧱 busts.', 'League → Standings → Draft-day replay'],
      ['🗂️ Notifications page', 'Every notification, filtered by League, Market, Squad and Achievements.', 'Bell → See all'],
      ['☀️ Paper mode', 'Flip the whole site to a light manga-paper look and back.', 'Sidebar → ☀ button'],
      ['💰 Sale profit', 'Selling shows exactly how much you made or lost.', 'Market'],
      ['🔍 Detective Conan', 'Gin, Vermouth, Amuro, Kogoro and 9 more joined the market.', 'Market'],
    ],
  },
  {
    id: '2026-11-09', headline: 'STORY SHOCKS ROCK THE MARKET; WEEKLY TEAMS GET THEIR REVENGE',
    items: [
      ['🚨 Live story shocks', 'Deaths, power-ups and news move prices instantly, with a live alert and one-tap Panic sell / Buy the dip.', 'Anywhere'],
      ['🌟 New form debut', 'A transformation shown for the first time ever: +30 on top of the +20, outside the weekly cap.', 'League → Scoring'],
      ['🔥 Catch-up boosts', 'Scoring streaks (up to +10/wk), team synergy (+10), +2 per episode, underdog boost for the bottom two and a mercy swap.', 'League → Scoring'],
      ['🐷 Piggy banks', 'Characters whose show is off air save points each week and pay out big on news or trailers.', 'League → My team'],
      ['🎁 Anime Wrapped', 'Your season as a swipeable manga story.', 'Sidebar → Wrapped'],
      ['ドン! Sound effects', 'Manga sound effects burst out of every big action.', 'Everywhere'],
      ['🎨 Manga redesign', 'The whole site got a new look: sidebar, ink panels and comic lettering.', 'Everywhere'],
    ],
  },
]

export default function UpdatePaper({ me }) {
  const [show, setShow] = useState(null)
  useEffect(() => {
    if (!me) return
    let seen = null
    try { seen = localStorage.getItem('ranked.seenUpdate') } catch {}
    const fresh = UPDATES.filter(u => !seen || u.id > seen)
    // brand-new visitors just get the latest two editions
    const list = seen ? fresh : UPDATES.slice(0, 2)
    if (list.length) { setShow(list); setTimeout(() => sfx('win', { text: '号外!', at: { x: innerWidth / 2, y: innerHeight * .25 } }), 600) }
  }, [me?.id])
  const close = () => { try { localStorage.setItem('ranked.seenUpdate', UPDATES[0].id) } catch {}; setShow(null) }
  if (!show) return null
  const lead = show[0]
  return <div className="upd-bg" onClick={close}>
    <article className="upd-paper" onClick={e => e.stopPropagation()}>
      <header className="t-mast">
        <div className="t-ears"><span>Extra! Extra!</span><span>{show.length > 1 ? `${show.length} editions you missed` : 'Special edition'}</span><span>Free</span></div>
        <h1>The Ranked Times</h1>
        <div className="t-date">Stop the presses · {new Date(lead.id).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })} · 号外</div>
      </header>
      {show.map((u, i) => <section key={u.id} className="t-lead">
        {i > 0 && <div className="upd-ed">Earlier edition · {new Date(u.id).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}</div>}
        <div className="t-kicker">{i === 0 ? 'Breaking' : 'You missed'}</div>
        <h2>{u.headline}</h2>
        <div className="upd-list">{u.items.map(([t, d, where]) => <div key={t} className="upd-item"><h3>{t}</h3><p>{d}</p>{where && <span className="where">→ {where}</span>}</div>)}</div>
      </section>)}
      <div className="upd-close"><button onClick={close} data-nosfx="1">Got it, let me in</button></div>
    </article>
  </div>
}
