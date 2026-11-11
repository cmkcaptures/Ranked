// Weekly TikTok/Shorts clip generator for Ranked.
// 1) pulls this week's highlights (clip_feed) 2) films vertical scenes from clips.html in Chrome 3) converts to MP4
// 4) writes captions.txt. Output: C:\Users\Micke\Ranked-clips\<date>\
// Run: node tools/clips/make.mjs   (from the Ranked folder)
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import ffmpeg from 'ffmpeg-static'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '../..')
const env = Object.fromEntries(fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/).filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))
const date = new Date().toISOString().slice(0, 10)
const out = path.join('C:/Users/Micke/Ranked-clips', date)
fs.mkdirSync(out, { recursive: true })

// 1) highlights
const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/rpc/clip_feed`, { method: 'POST',
  headers: { apikey: env.VITE_SUPABASE_KEY, Authorization: `Bearer ${env.VITE_SUPABASE_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_secret: env.FANTASY_BOT_SECRET }) })
if (!res.ok) throw new Error('clip_feed failed: ' + await res.text())
const feed = await res.json()

// 2) which clips this week
const HOT = [['gojo', 'sukuna'], ['goku', 'saitama'], ['luffy', 'naruto'], ['ichigo', 'gojo'], ['aizen', 'madara'], ['asta', 'yuno'], ['johnny', 'jotaro'],
  ['sukuna', 'ichigo'], ['goku', 'luffy'], ['saitama', 'garou'], ['pochita', 'makima'], ['meruem', 'sukuna'], ['itachi', 'gojo'], ['shanks', 'aizen']]
const week = Math.floor(Date.now() / 6048e5)
const [a1, b1] = HOT[week % HOT.length], [a2, b2] = HOT[(week + 5) % HOT.length]
const name = id => id[0].toUpperCase() + id.slice(1)
const TAGS = '#anime #animetiktok #powerscaling #fyp'
const clips = [
  { file: `vs-${a1}-${b1}`, url: `scene=vs&a=${a1}&b=${b1}`, secs: 13, caption: `${name(a1)} vs ${name(b1)}: who actually wins? Drop your take 👇 ${TAGS} #whowouldwin` },
  { file: `vs-${a2}-${b2}`, url: `scene=vs&a=${a2}&b=${b2}`, secs: 13, caption: `${name(a2)} vs ${name(b2)}. The calculator has spoken. Agree? 👇 ${TAGS} #whowouldwin` },
]
if (feed.shocks?.[0]) clips.push({ file: 'crash', url: 'scene=crash&i=0', secs: 12.5, caption: `${feed.shocks[0].name}'s stock just went ${feed.shocks[0].pct < 0 ? 'into the floor' : 'to the moon'} 💀 anime characters are stocks now ${TAGS} #stockmarket` })
if (feed.cup?.length >= 2) clips.push({ file: 'trading-cup', url: 'scene=cup', secs: 11, caption: `This week's anime stock market champion 🏆 could you beat them? ${TAGS} #trading` })
if (feed.moments?.length >= 2) clips.push({ file: 'fantasy-moments', url: 'scene=moments', secs: 10.5, caption: `Fantasy football but it's anime ⚡ this week's biggest plays ${TAGS} #fantasyfootball` })
if (feed.movers?.length >= 4) clips.push({ file: 'market-movers', url: 'scene=movers', secs: 9.5, caption: `Today's anime stock market 📈📉 who are you buying? ${TAGS} #stocks` })

// 3) serve clips.html with vite and film each scene
const { createServer } = await import(path.join(root, 'node_modules/vite/dist/node/index.js').replace(/\\/g, '/').replace(/^([A-Z]):/, 'file:///$1:'))
const server = await createServer({ root, configFile: false, server: { port: 5199, strictPort: false }, logLevel: 'error', plugins: [(await import(path.join(root, 'node_modules/@vitejs/plugin-react/dist/index.mjs').replace(/\\/g, '/').replace(/^([A-Z]):/, 'file:///$1:'))).default()] })
await server.listen()
const base = `http://localhost:${server.config.server.port}`
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--autoplay-policy=no-user-gesture-required'] })
const lines = []
for (const c of clips) {
  const ctx = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1, recordVideo: { dir: out, size: { width: 1080, height: 1920 } } })
  await ctx.addInitScript(f => { window.__FEED = f }, feed)
  const t0 = Date.now()
  const page = await ctx.newPage()
  await page.goto(`${base}/clips.html?${c.url}`, { waitUntil: 'networkidle' })
  // preload fonts + every image in the feed, then start the scene and remember when it began
  await page.evaluate(async f => {
    const urls = [...new Set([...Object.values(f.images || {}), ...['shocks', 'moments', 'movers'].flatMap(k => (f[k] || []).map(x => x.image))].filter(Boolean))]
    await Promise.all(urls.slice(0, 120).map(u => new Promise(r => { const i = new Image(); i.onload = i.onerror = r; i.src = u })))
    await document.fonts.load('40px Bangers'); await document.fonts.load('900 40px "Noto Sans JP"'); await document.fonts.ready
  }, feed)
  await page.evaluate(() => window.startClip())
  const start = (Date.now() - t0) / 1000 + 0.15
  await page.waitForTimeout(c.secs * 1000)
  const vid = page.video(); await ctx.close()
  const webm = await vid.path(), mp4 = path.join(out, c.file + '.mp4')
  // cut everything before the scene started and encode for TikTok
  execFileSync(ffmpeg, ['-y', '-ss', start.toFixed(2), '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', '-preset', 'medium', '-crf', '20', '-movflags', '+faststart', mp4], { stdio: 'ignore' })
  fs.unlinkSync(webm)
  lines.push(`${c.file}.mp4\n${c.caption}\n`)
  console.log('made', mp4)
}
await browser.close(); await server.close()
fs.writeFileSync(path.join(out, 'captions.txt'), `Ranked clips for ${date}\nPost one a day. Add a trending sound in TikTok before posting.\n\n` + lines.join('\n'))
console.log(`done: ${clips.length} clips in ${out}`)
