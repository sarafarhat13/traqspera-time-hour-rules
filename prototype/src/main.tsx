import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@trimble-oss/moduswebcomponents/modus-wc-styles.css'
import '@trimble-oss/moduswebcomponents/modus-icons.css'
import './index.css'
import App from './App.tsx'

document.documentElement.setAttribute('data-theme', 'modus-modern-light')
document.documentElement.setAttribute('data-mode', 'light')
document.documentElement.classList.add('light')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
