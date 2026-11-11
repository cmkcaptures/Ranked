import { useEffect, useState } from 'react'
import { sb } from './cloud.js'

export default function Lobby() {
  const [mode, setMode] = useState('in')
  const [f, setF] = useState({ email: '', password: '', username: '', anilist: '' })
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const set = k => e => setF({ ...f, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault(); setBusy(true); setMsg('')
    if (mode === 'in') {
      const { error } = await sb.auth.signInWithPassword({ email: f.email, password: f.password })
      if (error) setMsg(error.message)
    } else {
      if (!/^[A-Za-z0-9_]{2,20}$/.test(f.username)) { setMsg('Username: 2–20 letters, numbers or _'); setBusy(false); return }
      const { data: taken } = await sb.rpc('username_taken', { p_name: f.username })
      if (taken) { setMsg('That username is taken'); setBusy(false); return }
      const { data, error } = await sb.auth.signUp({
        email: f.email, password: f.password,
        options: { data: { username: f.username, anilist_name: f.anilist || null }, emailRedirectTo: location.origin + location.pathname },
      })
      if (error) setMsg(error.message)
      else if (!data.session) setMsg('Check your email to confirm, then sign in.')
    }
    setBusy(false)
  }

  return (
    <div className="landing">
      <section className="ld-hero">
        <div className="ld-copy">
          <div className="ld-logo"><i>R</i><b>RANKED</b></div>
          <h1>Your anime life,<br /><em>turned into a game.</em></h1>
          <p>Rank your favourites, settle "who would win" arguments, draft a fantasy league with your mates and trade characters like stocks when episodes drop.</p>
          <div className="ld-cta"><button className="pill" onClick={() => { setMode('up'); document.querySelector('.lobbybox input')?.focus() }}>Join free</button>
            <a className="pill ghost" href="#/vs" onClick={() => setTimeout(() => location.reload(), 0)}>⚔️ Try the VS Arena (no account)</a></div>
          <div className="ld-feats">
            {[['⚔️', 'VS Arena', '46 fighters, every form. Who would win, with real powerscaling.'], ['🏆', 'Fantasy League', 'Draft characters; score when they power up, win fights or trend.'],
              ['📈', 'Character Market', 'Buy, sell and short characters. Prices crash when they die.'], ['🎁', 'Wrapped & rankings', 'Your season as a manga story, your all-time top 10.']].map(([i, t, d]) =>
              <div key={t}><b>{i} {t}</b><span>{d}</span></div>)}
          </div>
        </div>
        <div className="lobbybox">
        <div className="kicker">Rank it. Rate it. Trade it.</div>
        <div className="tabs">
          <button className={mode === 'in' ? 'on' : ''} onClick={() => setMode('in')}>Sign in</button>
          <button className={mode === 'up' ? 'on' : ''} onClick={() => setMode('up')}>Join the squad</button>
        </div>
        <form onSubmit={submit}>
          {mode === 'up' && <>
            <input className="search" placeholder="Username (what friends see)" value={f.username} onChange={set('username')} required />
            <input className="search" placeholder="AniList username (optional: imports your list)" value={f.anilist} onChange={set('anilist')} />
          </>}
          <input className="search" type="email" placeholder="Email" value={f.email} onChange={set('email')} required autoComplete="email" />
          <input className="search" type="password" placeholder="Password (6+ characters)" minLength={6} value={f.password} onChange={set('password')} required
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
          {msg && <div className="lmsg">{msg}</div>}
          <button className="pill lgo" disabled={busy}>{busy ? '…' : mode === 'in' ? 'Drop in' : 'Create free account'}</button>
          {mode === 'up' && <div className="ld-note">No AniList needed. You can link it any time.</div>}
        </form>
      </div>
    </section>
    </div>
  )
}

// logged-out visitors from Google or a shared link: the VS Arena with a join bar
export function PublicVs() {
  const [Arena, setArena] = useState(null)
  useEffect(() => { import('./VsArena.jsx').then(m => setArena(() => m.default)) }, [])
  return <div className="pubvs">
    <div className="pub-bar"><div className="ld-logo sm"><i>R</i><b>RANKED</b></div><span>Free fantasy league, character market & anime rankings with your mates.</span>
      <a className="pill" href="#/home" onClick={() => setTimeout(() => location.reload(), 0)}>Join free</a></div>
    <main className="wrap pubwrap">{Arena ? <Arena /> : <div className="loading">Loading the arena…</div>}</main>
  </div>
}
