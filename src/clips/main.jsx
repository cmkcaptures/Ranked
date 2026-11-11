import { createRoot } from 'react-dom/client'
import Clip from './Clip.jsx'
// scenes are designed at 540x960; scale them to fill the recorder's viewport (1080x1920)
document.body.style.zoom = String(window.innerWidth / 540)
document.body.style.background = '#151418'
// the recorder calls window.startClip() once fonts and images are loaded, so animations start on cue
window.startClip = () => createRoot(document.getElementById('root')).render(<Clip />)
if (!window.__FEED) window.startClip()
