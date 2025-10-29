import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'  // ← これが重要
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)