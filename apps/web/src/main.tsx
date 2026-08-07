import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'

// Ordre imposé : tokens (valeurs) → rôles applicatifs → composants du design
// system → global de l'app. Chaque couche ne lit que les précédentes.
//
// ⚠️ Ces imports doivent rester AVANT celui de `App`. Le bundler émet le CSS
// dans l'ordre où il rencontre les modules : importer `App` en premier ferait
// sortir tous les *.module.css avant cette couche, et `.card` — une classe
// simple, comme celles des modules — écraserait leurs surcharges au lieu d'être
// écrasée par elles.
import './styles/tokens.css'
import './styles/semantic.css'
import './styles/organic.css'
import './styles/app.css'

import { App } from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
