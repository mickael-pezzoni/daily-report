import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'

// Mandatory order: tokens (values) → application roles → design system
// components → app global. Each layer only reads the previous ones.
//
// ⚠️ These imports must stay BEFORE the `App` import. The bundler emits CSS
// in the order it encounters modules: importing `App` first would make all
// the *.module.css files come out before this layer, and `.card` — a plain
// class, like the modules' — would overwrite their overrides instead of
// being overwritten by them.
import './styles/tokens.css'
import './styles/semantic.css'
import './styles/organic.css'
import './styles/app.css'

// Also before `App`, but for a different reason: i18next's initialization is
// synchronous, and components read their labels from their very first
// render. The catalogs are in the bundle, so there's nothing to wait for.
import './i18n'

import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
