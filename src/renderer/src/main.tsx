import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import UpdateOverlay from './components/UpdateOverlay'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
    <UpdateOverlay />
  </React.StrictMode>
)
