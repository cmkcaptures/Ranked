import { createRoot } from 'react-dom/client'
import '../styles.css'
import '../theme.css'
import Fantasy from '../Fantasy.jsx'
import { me, friends } from './mock.js'
createRoot(document.getElementById('root')).render(<Fantasy me={me} friends={friends} openProfile={() => {}} />)
