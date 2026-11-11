import { sfx } from './sfx.js'

// After a sale: work out the profit from the cash you got back vs the average price you paid, and show it.
export function saleResult(before, after, charId, sold) {
  const avg = Number(before?.holdings?.[charId]?.avg || 0)
  const proceeds = Number(after?.cash || 0) - Number(before?.cash || 0)
  if (!sold || proceeds <= 0) return null
  const profit = proceeds - avg * sold
  return { profit, proceeds, pct: avg ? profit / (avg * sold) : 0, sold, all: !after?.holdings?.[charId]?.qty }
}

export function showSale(r, name) {
  if (!r) return
  const up = r.profit >= 0
  const fmt = n => Math.round(Math.abs(n)).toLocaleString()
  sfx(up ? 'money' : 'loss', { text: up ? `+${fmt(r.profit)}!` : `−${fmt(r.profit)}…` })
  const el = document.createElement('div')
  el.className = `saletoast ${up ? 'up' : 'down'}`
  el.innerHTML = `<b>${up ? '💰 Profit' : '📉 Loss'}: ${up ? '+' : '−'}${fmt(r.profit)} coins</b>
    <span>${r.all ? 'Sold all' : `Sold ${r.sold}`} ${name.replace(/</g, '')} for ${fmt(r.proceeds)} · ${up ? '+' : '−'}${Math.abs(r.pct * 100).toFixed(1)}%</span>`
  document.body.appendChild(el)
  setTimeout(() => el.classList.add('out'), 4200)
  setTimeout(() => el.remove(), 4700)
}
