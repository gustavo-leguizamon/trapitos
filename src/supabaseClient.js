import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Variables que faltan configurar. Si hay alguna no llamamos a createClient:
// tira "supabaseUrl is required." al evaluar el módulo, o sea antes de que
// React monte nada, y eso deja la pantalla en blanco sin explicación (el
// ErrorBoundary sólo atrapa errores de render). En ese caso main.jsx muestra
// <ConfigMissing /> en lugar de la app.
export const missingEnvVars = [
  !supabaseUrl && 'VITE_SUPABASE_URL',
  !supabaseAnonKey && 'VITE_SUPABASE_ANON_KEY',
].filter(Boolean)

if (missingEnvVars.length) {
  // Aviso claro en consola si falta configurar el .env
  console.warn(
    `Faltan ${missingEnvVars.join(' y ')}. Copiá .env.example a .env y completalos.`
  )
}

// null cuando falta configuración: en ese caso App no se monta, así que nadie lo usa.
export const supabase = missingEnvVars.length
  ? null
  : createClient(supabaseUrl, supabaseAnonKey)
