import { TIERS, TIER_NAMES, ABILITY } from './vsdata.js'

// Score a matchup. Positive = A favoured. Returns verdict + human reasons.
// rules: tier gap dominates (each step ~1.2), each "plus" (higher/far higher) = 0.5 of a step,
// then speed, fight IQ, stamina, then hax interactions. Disabled abilities are removed first.
export const tierIndex = f => TIERS.indexOf(f.tier) + f.plus * 0.45

export function fight(A, B, opts = {}) {
  const a = { ...A, abil: A.abil.filter(x => !opts.offA?.includes(x)) }
  const b = { ...B, abil: B.abil.filter(x => !opts.offB?.includes(x)) }
  if (opts.noHax) { a.abil = []; b.abil = [] }
  const reasons = []
  const has = (f, k) => f.abil.includes(k)
  let s = 0
  // power
  const tg = tierIndex(a) - tierIndex(b)
  const tierPts = Math.max(-14, Math.min(14, tg * 1.2))
  s += tierPts
  if (Math.abs(tg) >= 0.9) {
    const [hi, lo] = tg > 0 ? [a, b] : [b, a]
    reasons.push({ side: tg > 0 ? 'A' : 'B', w: Math.abs(tierPts), t: `${hi.short} is ${hi.tier}${hi.plus ? '+' : ''} (${TIER_NAMES[hi.tier] || hi.tier} level) vs ${lo.tier} (${TIER_NAMES[lo.tier] || lo.tier}): ${Math.abs(tg) > 6 ? 'a different universe of power' : Math.abs(tg) > 3 ? 'a massive power gap' : 'a clear power edge'}` })
  } else reasons.push({ side: '', w: 0, t: `Both sit around ${a.tier} (${TIER_NAMES[a.tier] || ''} level): power is roughly even` })
  // speed
  const sg = a.spd - b.spd
  if (sg) { const p = Math.max(-4, Math.min(4, sg * 0.9)); s += p
    if (Math.abs(sg) >= 1) reasons.push({ side: sg > 0 ? 'A' : 'B', w: Math.abs(p), t: `${sg > 0 ? a.short : b.short} is ${Math.abs(sg) >= 3 ? 'vastly' : 'noticeably'} faster` }) }
  // iq + stamina (only matters when close)
  const close = Math.abs(tg) < 3
  const ig = (a.iq - b.iq) * (close ? 0.35 : 0.1); s += ig
  if (close && Math.abs(a.iq - b.iq) >= 3) reasons.push({ side: ig > 0 ? 'A' : 'B', w: Math.abs(ig), t: `${ig > 0 ? a.short : b.short} is the far smarter fighter` })
  const st = (a.stam - b.stam) * (close ? 0.25 : 0.05); s += st
  if (close && Math.abs(a.stam - b.stam) >= 3) reasons.push({ side: st > 0 ? 'A' : 'B', w: Math.abs(st), t: `${st > 0 ? a.short : b.short} lasts much longer in a drawn-out fight` })
  // hax, both directions
  const hax = (x, y, side) => {
    const r = (w, t) => { s += side === 'A' ? w : -w; reasons.push({ side: (side === 'A') === (w > 0) ? 'A' : 'B', w: Math.abs(w), t, hax: true }) }
    const near = tierIndex(y) - tierIndex(x) < 4      // hax still matters if you're not hopelessly outclassed
    if (has(y, 'infinity') && !has(x, 'spacecut') && !has(x, 'erase') && !has(x, 'conceptual') && !has(x, 'antimagic') && tierIndex(x) - tierIndex(y) < 4)
      r(side === 'A' ? -3 : -3, `${y.short}'s Infinity means ${x.short} can't land a hit without space-cutting or concept-level attacks`)
    if (has(x, 'infinity') && (has(y, 'spacecut') || has(y, 'erase'))) r(-1.5, `${y.short} can cut straight through ${x.short}'s Infinity`)
    if (has(x, 'erase') && near && !has(y, 'immortal')) r(2.5, `${x.short} can erase ${y.short} outright (existence-level hax)`)
    else if (has(x, 'erase') && near) r(1.2, `${x.short}'s erasure hax pressures even ${y.short}'s immortality`)
    if (has(x, 'futuresight') && near) r(2.2, `${x.short} sees and rewrites the future`)
    if (has(x, 'soul') && !has(y, 'soulres') && near) r(1, `${x.short}'s attacks hit the soul and bypass durability`)
    if (has(x, 'mind') && !has(y, 'mindres') && near) r(1.2, `${x.short} can control or trap ${y.short}'s mind`)
    if (has(x, 'timestop') && !has(y, 'timemove') && near) r(1.8, `${x.short} stops time and ${y.short} can't move in it`)
    if (has(x, 'antimagic') && has(y, 'magic')) r(2.5, `${x.short}'s anti-magic negates ${y.short}'s magic`)
    if (has(x, 'durneg') && near) r(0.8, `${x.short} ignores durability`)
    if (has(x, 'precog') && !has(y, 'precog')) r(0.7, `${x.short} reads attacks before they happen`)
    if (has(x, 'regen') && !has(y, 'erase') && !has(y, 'soul')) r(0.5, `${x.short} regenerates through damage`)
    if (has(x, 'immortal') && !has(y, 'erase') && !has(y, 'sealing') && !has(y, 'soul')) r(0.8, `${y.short} has no clean way to keep ${x.short} dead`)
    if (has(x, 'sealing') && has(y, 'immortal')) r(1.2, `${x.short} can seal ${y.short} even if they can't be killed`)
    if (has(x, 'toon') && near) r(0.8, `${x.short}'s toon force makes them absurdly hard to pin down`)
    if (has(x, 'conceptual') && near) r(1, `${x.short} bends the rules of reality`)
    if (has(x, 'copy') && near && tierIndex(x) >= tierIndex(y) - 1) r(0.6, `${x.short} can copy or absorb what ${y.short} throws at them`)
    if (has(x, 'summon')) r(0.4, `${x.short} brings an army`)
  }
  hax(a, b, 'A'); hax(b, a, 'B')
  if (opts.prep) { const pa = (a.iq - b.iq) * 0.4; s += pa; if (Math.abs(pa) > 0.5) reasons.push({ side: pa > 0 ? 'A' : 'B', w: Math.abs(pa), t: `With prep time, ${pa > 0 ? a.short : b.short}'s planning matters more` }) }
  if (opts.blood) { s *= 1.15 }
  const win = 1 / (1 + Math.exp(-s / 2.4))             // win chance for A
  const abs = Math.abs(s)
  const verdict = abs >= 7 ? 'STOMP' : abs >= 3.5 ? 'DEFINITELY' : abs >= 1.4 ? 'LIKELY' : 'TOSS-UP'
  const winner = abs < 0.4 ? null : s > 0 ? 'A' : 'B'
  const diff = abs >= 7 ? 'Low diff' : abs >= 3.5 ? 'Mid diff' : abs >= 1.4 ? 'High diff' : 'Extreme diff'
  reasons.sort((x, y) => y.w - x.w)
  return { score: s, win, verdict, winner, diff, reasons: reasons.slice(0, 7) }
}
export { ABILITY }
