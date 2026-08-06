import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { App } from './App'

// Ordre imposé : tokens (valeurs) → rôles applicatifs → composants du design
// system → global de l'app. Chaque couche ne lit que les précédentes.
import './styles/tokens.css'
import './styles/semantic.css'
import './styles/organic.css'
import './styles/app.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
