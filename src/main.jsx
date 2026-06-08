import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './cardFlipFix.css'
import './logoHover.css'
import './mobileCommunity.css'
import './mobileCommunityPerf.js'
import './detailNoteEnhancer.js'
import './cliqueMediaRouter.js'
import './cliqueCategorySorter.js'
import './mobileNavInjector.js'
import './mobileBottomNav.css'
import './mobileExploreOverrides.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
