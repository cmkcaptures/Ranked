import { sb } from './cloud.js'

// Anonymous visit logging for the owner's stats page: random per-browser id, which page, which site sent them.
// No names, emails or IPs are stored.
let vid
try { vid = localStorage.getItem('ranked.vid') || Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('ranked.vid', vid) } catch { vid = 'anon-' + Math.random().toString(36).slice(2) }
const host = r => { try { const h = new URL(r).hostname.replace(/^www\./, ''); return h && !h.includes('cmkcaptures.github.io') ? h : null } catch { return null } }
let first = true, lastPage = ''
async function log() {
  if (!sb) return
  const page = (location.hash.match(/^#\/([a-z0-9]+)/) || [, location.hash ? 'other' : 'landing'])[1]
  if (page === lastPage) return
  lastPage = page
  const { data } = await sb.auth.getSession().catch(() => ({ data: {} }))
  const src = first ? (host(document.referrer) || (new URLSearchParams(location.search).get('ref')) || 'direct') : null
  first = false
  sb.from('page_views').insert({ vid, page, src, user_id: data?.session?.user?.id || null }).then(() => {}, () => {})
}
log()
addEventListener('hashchange', log)
