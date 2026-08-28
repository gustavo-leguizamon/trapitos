import React from 'react'
import ReactDOM from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import ConfigMissing from './components/ConfigMissing'
import { missingEnvVars } from './supabaseClient'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      {missingEnvVars.length ? <ConfigMissing missing={missingEnvVars} /> : <App />}
    </ErrorBoundary>
  </React.StrictMode>
)
