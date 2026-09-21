import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import ConfigMissing from './components/ConfigMissing'
import { missingEnvVars } from './supabaseClient'
import { isAdminPath } from './lib/admin'

// El panel de administración va en /admin y se carga aparte (import dinámico):
// así el chunk no viaja en la app pública, que es la que se abre en el celular.
// No hace falta un router: son dos pantallas que no navegan entre sí.
const AdminApp = lazy(() => import('./admin/AdminApp'))

const esPanel = isAdminPath(window.location.pathname)

// El CSS del panel llega con su chunk, así que este cartel va con estilo propio.
const cargandoStyle = {
  display: 'grid',
  placeItems: 'center',
  height: '100%',
  background: '#1f2937',
  color: '#e5e7eb',
}

function Raiz() {
  if (missingEnvVars.length) return <ConfigMissing missing={missingEnvVars} />
  if (esPanel) {
    return (
      <Suspense fallback={<div style={cargandoStyle}>Cargando panel…</div>}>
        <AdminApp />
      </Suspense>
    )
  }
  return <App />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Raiz />
    </ErrorBoundary>
  </React.StrictMode>
)
