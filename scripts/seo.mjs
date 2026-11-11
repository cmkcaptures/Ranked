// Builds static, Google-indexable "X vs Y: who would win?" pages from the VS Arena data into dist/.
// Runs after `vite build` (see package.json), so every deploy regenerates them automatically.
import fs from 'node:fs'
import path from 'node:path'
import { FIGHTERS, TIER_NAMES } from '../src/vsdata.js'
import { fight } from '../src/vsengine.js'

const SITE = 'https://cmkcaptures.github.io/Ranked/'
const OUT = path.resolve('dist')
const today = new Date().toISOString().slice(0, 10)
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const peak = f => f.forms[f.forms.length - 1]
const urls = []

const css = `*{box-sizing:border-box}body{margin:0;background:#1f1d22;color:#e9e2d0;font:16px/1.55 Inter,system-ui,sans-serif}
a{color:#ffd84a}main{max-width:900px;margin:0 auto;padding:24px 18px 60px}
.k{font:800 11px Inter;letter-spacing:2px;text-transform:uppercase;color:#e8202f}
h1{font:400 clamp(38px,7vw,64px)/1 Bangers,Impact,sans-serif;letter-spacing:2px;margin:6px 0 12px}
h2{font:400 28px Bangers,Impact,sans-serif;letter-spacing:1.5px;margin:28px 0 10px}
.v{display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding:16px;border:3px solid #e9e2d0;background:#2b2830;box-shadow:6px 6px 0 #000}
.v b{font:400 34px Bangers,Impact,sans-serif;letter-spacing:1px}.st{font:400 22px Bangers,Impact,sans-serif;padding:2px 12px;border:3px solid #ffd84a;color:#ffd84a;transform:rotate(-4deg);display:inline-block}
.odds{flex:1 1 100%;height:12px;background:#e8202f;border:2px solid #fff}.odds i{display:block;height:100%;background:#3d8bff}
.g{display:grid;grid-template-columns:1fr 1fr;gap:14px}.c{padding:14px;border:2px solid #ffffff30;background:#2b2830}
.c h3{margin:0 0 6px;font:400 24px Bangers,Impact,sans-serif;letter-spacing:1px}.c p{margin:4px 0;font-size:14px}
ul{padding-left:20px}li{margin:6px 0}.cta{display:inline-block;margin:18px 0;padding:12px 22px;background:#e8202f;color:#fff;font:400 22px Bangers,Impact,sans-serif;letter-spacing:1.5px;text-decoration:none;border:3px solid #e9e2d0;box-shadow:5px 5px 0 #000}
.rel{display:flex;flex-wrap:wrap;gap:8px}.rel a{padding:6px 10px;border:2px solid #ffffff30;text-decoration:none;color:#e9e2d0;font-size:14px}
footer{margin-top:36px;font-size:12px;color:#77706a}@media(max-width:640px){.g{grid-template-columns:1fr}}`
const page = ({ title, desc, canon, body, jsonld }) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${canon}">
<meta property="og:type" content="article"><meta property="og:site_name" content="Ranked"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${canon}">
<meta name="twitter:card" content="summary"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}">
<link href="https://fonts.googleapis.com/css2?family=Bangers&family=Inter:wght@400;600;800&display=swap" rel="stylesheet"><style>${css}</style>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}</head><body><main>${body}
<footer>Ranked: the anime ranking, fantasy league and VS Arena for you and your mates. Tiers from the VS Battles Wiki, community takes from r/PowerScaling. <a href="${SITE}">Open Ranked</a> · <a href="${SITE}vs/">All matchups</a></footer></main></body></html>`
const write = (rel, html) => { const p = path.join(OUT, rel, 'index.html'); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, html); urls.push(SITE + rel + '/') }

// ---------- one page per pair (peak forms) ----------
const pairs = []
for (let i = 0; i < FIGHTERS.length; i++) for (let j = i + 1; j < FIGHTERS.length; j++) pairs.push([FIGHTERS[i], FIGHTERS[j]])
for (const [A, B] of pairs) {
  const fa = peak(A), fb = peak(B)
  const r = fight({ ...fa, short: A.name }, { ...fb, short: B.name }, { blood: true })
  const win = r.winner === 'A' ? A : r.winner === 'B' ? B : null, lose = win === A ? B : A
  const pct = Math.round(Math.max(r.win, 1 - r.win) * 100)
  const slug = `${A.id}-vs-${B.id}`
  const title = `${A.name} vs ${B.name}: Who Would Win? | Ranked VS Arena`
  const verdictLine = win ? `${win.name} beats ${lose.name}: ${r.verdict.toLowerCase()} (${pct}%, ${r.diff.toLowerCase()}).` : `${A.name} vs ${B.name} is a toss-up.`
  const desc = `${verdictLine} ${A.name} (${fa.name}, ${fa.tier}) vs ${B.name} (${fb.name}, ${fb.tier}): powerscaling breakdown with tiers, speed, hax and feats.`
  const live = `${SITE}#/vs/${A.id}.${fa.id}~${B.id}.${fb.id}`
  const card = (F, f) => `<div class="c"><h3>${esc(F.name)}</h3><p><b>Version:</b> ${esc(f.name)} (${esc(f.era)})</p><p><b>Tier:</b> ${esc(f.tier)}${f.plus ? '+' : ''}: ${esc(TIER_NAMES[f.tier] || '')} level</p>
    <p><b>Key feats:</b> ${f.feats.map(esc).join('; ')}</p>${f.weak.length ? `<p><b>Weaknesses:</b> ${f.weak.map(esc).join('; ')}</p>` : ''}<p><i>Community take: ${esc(f.note)}</i></p></div>`
  const related = [...FIGHTERS.filter(x => x.id !== A.id && x.id !== B.id).sort((x, y) => (x.series === A.series || x.series === B.series ? -1 : 0) - (y.series === A.series || y.series === B.series ? -1 : 0)).slice(0, 10)]
  const pairUrl = (x, y) => { const [p, q] = FIGHTERS.indexOf(x) < FIGHTERS.indexOf(y) ? [x, y] : [y, x]; return `${SITE}vs/${p.id}-vs-${q.id}/` }
  const body = `<div class="k">${esc(A.series)} vs ${esc(B.series)}</div><h1>${esc(A.name)} vs ${esc(B.name)}: who would win?</h1>
  <div class="v"><span class="st">${r.verdict}</span><b>${win ? esc(win.name) + ' wins' : 'Dead even'}</b><span>${pct}% · ${esc(r.diff)}</span><div class="odds"><i style="width:${Math.round(r.win * 100)}%"></i></div></div>
  <a class="cta" href="${live}">⚔️ Change forms & abilities live</a>
  <h2>Why</h2><ul>${r.reasons.map(x => `<li>${esc(x.t)}</li>`).join('')}</ul>
  <h2>Tale of the tape</h2><div class="g">${card(A, fa)}${card(B, fb)}</div>
  ${A.forms.length + B.forms.length > 2 ? `<h2>Other versions</h2><p>${esc(A.name)}: ${A.forms.map(f => esc(f.name)).join(', ')}. ${esc(B.name)}: ${B.forms.map(f => esc(f.name)).join(', ')}. Pick any combo in the <a href="${live}">live VS Arena</a>.</p>` : ''}
  <h2>More matchups</h2><div class="rel">${related.map(x => `<a href="${pairUrl(A, x)}">${esc(A.name)} vs ${esc(x.name)}</a><a href="${pairUrl(B, x)}">${esc(B.name)} vs ${esc(x.name)}</a>`).join('')}</div>`
  const jsonld = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: `Who would win, ${A.name} or ${B.name}?`, acceptedAnswer: { '@type': 'Answer', text: `${verdictLine} ${r.reasons.slice(0, 3).map(x => x.t).join('. ')}.` } }] }
  write(`vs/${slug}`, page({ title, desc, canon: `${SITE}vs/${slug}/`, body, jsonld }))
}

// ---------- hub page per fighter ----------
for (const F of FIGHTERS) {
  const rows = FIGHTERS.filter(x => x.id !== F.id).map(O => { const r = fight({ ...peak(F), short: F.name }, { ...peak(O), short: O.name }, { blood: true })
    const [p, q] = FIGHTERS.indexOf(F) < FIGHTERS.indexOf(O) ? [F, O] : [O, F]; return { O, r, url: `${SITE}vs/${p.id}-vs-${q.id}/` } })
  const wins = rows.filter(x => x.r.winner === 'A').length
  const body = `<div class="k">${esc(F.series)}</div><h1>Who can ${esc(F.name)} beat?</h1>
  <p>${esc(F.name)} at their peak (${esc(peak(F).name)}, tier ${esc(peak(F).tier)}) beats <b>${wins}</b> of ${rows.length} fighters in the Ranked VS Arena. Versions covered: ${F.forms.map(f => esc(f.name) + ' (' + esc(f.era) + ')').join(', ')}.</p>
  <ul>${rows.sort((a, b) => b.r.score - a.r.score).map(({ O, r, url }) => `<li><a href="${url}">${esc(F.name)} vs ${esc(O.name)}</a>: ${r.winner === 'A' ? 'wins' : r.winner === 'B' ? 'loses' : 'toss-up'} (${r.verdict.toLowerCase()})</li>`).join('')}</ul>
  <a class="cta" href="${SITE}#/vs/${F.id}.${peak(F).id}~${(F.id === 'goku' ? FIGHTERS[1] : FIGHTERS[0]).id}.${peak(F.id === 'goku' ? FIGHTERS[1] : FIGHTERS[0]).id}">⚔️ Try ${esc(F.name)} in the VS Arena</a>`
  write(`vs/${F.id}`, page({ title: `Who Can ${F.name} Beat? Every Matchup Ranked | Ranked VS Arena`, desc: `${F.name} (${F.series}) vs ${rows.length} anime fighters: wins, losses and the powerscaling behind each one.`, canon: `${SITE}vs/${F.id}/`, body }))
}

// ---------- index ----------
const bySeries = {}; for (const F of FIGHTERS) (bySeries[F.series] ||= []).push(F)
write('vs', page({ title: 'Anime VS Battles: Who Would Win? Every Matchup | Ranked', desc: `Who would win? ${pairs.length} anime matchups across ${Object.keys(bySeries).length} series, scored with powerscaling tiers, speed and hax.`, canon: `${SITE}vs/`,
  body: `<div class="k">Ranked VS Arena</div><h1>Anime "who would win" matchups</h1><p>${pairs.length} fights between ${FIGHTERS.length} of the strongest characters in anime, from Goku and Luffy to Gojo, Sukuna, Aizen and Saitama.</p>
  <a class="cta" href="${SITE}#/vs">⚔️ Open the live VS Arena</a>
  ${Object.entries(bySeries).map(([s, fs]) => `<h2>${esc(s)}</h2><div class="rel">${fs.map(F => `<a href="${SITE}vs/${F.id}/">${esc(F.name)}</a>`).join('')}</div>`).join('')}` }))

// ---------- sitemap + robots ----------
urls.unshift(SITE)
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${u}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`)
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${SITE}sitemap.xml\n`)
console.log(`SEO: ${pairs.length} matchup pages, ${FIGHTERS.length} fighter hubs, sitemap with ${urls.length} URLs`)
