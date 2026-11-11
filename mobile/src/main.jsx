import React from 'react'
import ReactDOM from 'react-dom/client'
import './mobile.css'
import { initPlatform } from './platform'

// The platform layer (storage, window.electron, media URLs) must be ready before the shared
// renderer code (PlayerContext, AuthContext) runs.
initPlatform().then(async () => {
  const { default: App } = await import('./ui/App')
  ReactDOM.createRoot(document.getElementById('root')).render(<App />)
}).catch(err => {
  document.getElementById('root').textContent = `Erro ao iniciar o NianPlay: ${err?.message || err}`
  console.error(err)
})
