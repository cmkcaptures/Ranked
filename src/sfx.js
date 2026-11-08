// Manga sound effects (visual only, no audio): onomatopoeia that burst out of the action.
// Always on: Windows reports "reduced motion" whenever animation effects are off, which hid these for most people.
let lastPress = null
let last = { x: innerWidth / 2, y: innerHeight / 2 }
addEventListener('pointerdown', e => { last = { x: e.clientX, y: e.clientY } }, true)

// what each kind of moment "sounds" like
export const SFX = {
  press: ['バン!', 'ドン!', 'ガッ!', 'ズン!'],
  power: ['ゴゴゴ', 'ドドド'],
  crown: ['キラッ!', 'ピカッ!'],
  swap: ['シュッ!', 'ヒュン!'],
  deal: ['ガシッ!', 'グッ!'],
  money: ['チャリン!', 'ジャラ!'],
  loss: ['ガーン…', 'ズーン'],
  win: ['ドーン!!', 'ババーン!'],
  flip: ['クルッ', 'パッ', 'シュッ'],
}
const pick = a => a[Math.floor(Math.random() * a.length)]

export function sfx(kind = 'press', opts = {}) {
  // a real result replaces the generic button punch from the same click
  if (kind !== 'press' && lastPress && Date.now() - lastPress.t < 2000) lastPress.el.remove()
  const text = opts.text || pick(SFX[kind] || SFX.press)
  const { x, y } = opts.at || last
  const big = ['power', 'win'].includes(kind)
  const el = document.createElement('div')
  el.className = `sfx-pop ${kind} ${big ? 'big' : ''}`
  el.textContent = text
  const rot = (Math.random() * 24 - 12).toFixed(1)
  el.style.cssText = `left:${Math.min(innerWidth - 80, Math.max(80, x))}px;top:${Math.max(60, y - (big ? 40 : 24))}px;--r:${rot}deg`
  if (big) {
    const lines = document.createElement('div'); lines.className = 'sfx-lines'
    lines.style.cssText = `--x:${x}px;--y:${y}px`
    document.body.appendChild(lines); setTimeout(() => lines.remove(), 700)
  }
  document.body.appendChild(el)
  lastPress = kind === 'press' ? { el, t: Date.now() } : null
  setTimeout(() => el.remove(), big ? 1300 : 900)
}

// any button on the site gets a small punch (not the sidebar/menu links)
addEventListener('click', e => {
  const b = e.target.closest?.('button, .lb-chip, .b')
  if (!b || b.disabled || b.dataset.nosfx || b.closest('.nav, .mtabs, .mmore, .navtools')) return
  sfx(b.closest('.lb-tabs, .tabs, .lb-seg, .seg') ? 'flip' : 'press')
}, true)

if (import.meta.env.DEV) window.sfx = sfx
