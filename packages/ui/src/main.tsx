import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { configureDefaultAvatars } from '@sidekick/core'
import { bootstrapThemeOnDocument } from './state/themeBootstrap'
import './tailwind.css'

bootstrapThemeOnDocument()
import { DEFAULT_AVATARS } from './assets/defaultAvatars'
import App from './App.tsx'

configureDefaultAvatars(DEFAULT_AVATARS)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
