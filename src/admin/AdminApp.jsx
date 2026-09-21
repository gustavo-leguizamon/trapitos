import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { mensajeDeError } from '../lib/errors'
import { normalizeSpot, SPOT_STATUS } from '../lib/admin'
import AdminLogin from './AdminLogin'
import AdminTools from './AdminTools'
import SpotsTable from './SpotsTable'
import './admin.css'

const POR_PAGINA = 50

// Panel de administración (/admin).
//
// Acá no hay ningún control de acceso de verdad: el bundle es público y la anon
// key también, así que cualquiera puede abrir esta pantalla y llamar a las
// mismas funciones. Lo que hace que solo el admin pueda tocar datos es que
// TODAS las operaciones son funciones admin_* de Postgres con la guarda
// es_admin() adentro (supabase/migrations/phase13_backoffice.sql). Si no sos
// admin, la base responde 403 y no hay nada que la UI pueda hacer al respecto.
export default function AdminApp() {
  const [session, setSession] = useState(null)
  const [sessionLista, setSessionLista] = useState(false)
  const [esAdmin, setEsAdmin] = useState(null) // null = todavía no sabemos
  // Si es_admin() falla (típico: falta correr la migración), el motivo importa:
  // "no sos admin" y "la función no existe" se arreglan de maneras distintas.
  const [adminError, setAdminError] = useState(null)
  const [loginWorking, setLoginWorking] = useState(false)
  const [loginError, setLoginError] = useState(null)

  const [resumen, setResumen] = useState(null)
  const [spots, setSpots] = useState([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [working, setWorking] = useState(null)
  const [anonimosBorrables, setAnonimosBorrables] = useState(null)
  const [message, setMessage] = useState(null)

  const [status, setStatus] = useState('')
  const [buscar, setBuscar] = useState('')
  const [buscarAplicado, setBuscarAplicado] = useState('')
  const [soloReportados, setSoloReportados] = useState(false)
  const [pagina, setPagina] = useState(0)

  // --- Sesión ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLista(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // --- ¿Esta sesión es de un admin? Lo contesta la base, no el front. ---
  // Depende del id del usuario, no del objeto session: cada refresco de token
  // trae una sesión nueva y no hace falta volver a preguntar por lo mismo.
  const userId = session?.user?.id
  useEffect(() => {
    if (!userId) {
      setEsAdmin(null)
      return
    }
    let vigente = true
    supabase.rpc('es_admin').then(({ data, error }) => {
      if (!vigente) return
      setAdminError(error ? mensajeDeError(error, 'No se pudo verificar el permiso') : null)
      setEsAdmin(error ? false : !!data)
    })
    return () => {
      vigente = false
    }
  }, [userId])

  // El buscador escribe libre; la consulta espera a que dejes de tipear.
  useEffect(() => {
    const t = setTimeout(() => {
      setBuscarAplicado(buscar.trim())
      setPagina(0)
    }, 350)
    return () => clearTimeout(t)
  }, [buscar])

  const cargarResumen = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_resumen')
    if (error) return
    setResumen(data?.[0] ?? null)
  }, [])

  const cargarSpots = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('admin_spots', {
      p_status: status || null,
      p_buscar: buscarAplicado || null,
      p_solo_reportados: soloReportados,
      p_limit: POR_PAGINA,
      p_offset: pagina * POR_PAGINA,
    })
    setLoading(false)
    if (error) {
      setMessage(mensajeDeError(error, 'No se pudo cargar el listado'))
      return
    }
    setSpots((data || []).map(normalizeSpot))
  }, [status, buscarAplicado, soloReportados, pagina])

  useEffect(() => {
    if (esAdmin !== true) return
    cargarSpots()
  }, [esAdmin, cargarSpots])

  useEffect(() => {
    if (esAdmin !== true) return
    cargarResumen()
  }, [esAdmin, cargarResumen])

  // --- Login / logout ---
  async function handleLogin({ email, password }) {
    setLoginWorking(true)
    setLoginError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoginWorking(false)
    if (error) setLoginError(mensajeDeError(error, 'No se pudo entrar'))
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setEsAdmin(null)
    setAdminError(null)
    setSpots([])
    setResumen(null)
  }

  // Corre una acción sobre una marca y refresca lo que se ve.
  async function accionSpot(spotId, fn, prefijo, exito) {
    setBusyId(spotId)
    const { error } = await fn()
    setBusyId(null)
    if (error) {
      setMessage(mensajeDeError(error, prefijo))
      return
    }
    setMessage(exito)
    cargarSpots()
    cargarResumen()
  }

  function handleSetStatus(spotId, nuevo) {
    accionSpot(
      spotId,
      () => supabase.rpc('admin_set_status', { p_spot_id: spotId, p_status: nuevo }),
      'No se pudo cambiar el estado',
      'Estado actualizado.'
    )
  }

  function handleEditar(spotId, { calle, descripcion }) {
    accionSpot(
      spotId,
      () =>
        supabase.rpc('admin_editar_spot', {
          p_spot_id: spotId,
          p_calle: calle,
          p_descripcion: descripcion,
        }),
      'No se pudo guardar',
      'Marca actualizada.'
    )
  }

  function handleBorrar(spotId) {
    accionSpot(
      spotId,
      () => supabase.rpc('admin_borrar_spot', { p_spot_id: spotId }),
      'No se pudo borrar',
      'Marca borrada.'
    )
  }

  // Corre una tarea de mantenimiento y cuenta qué hizo.
  async function tarea(clave, fn, prefijo, texto) {
    setWorking(clave)
    const { data, error } = await fn()
    setWorking(null)
    if (error) {
      setMessage(mensajeDeError(error, prefijo))
      return
    }
    setMessage(texto(data))
    cargarSpots()
    cargarResumen()
  }

  const tools = {
    onExpirar: () =>
      tarea(
        'expirar',
        () => supabase.rpc('admin_expirar_trapitos'),
        'No se pudo correr la caducidad',
        (n) => `Caducaron ${n} marcas.`
      ),
    onRevisar: () =>
      tarea(
        'revisar',
        () => supabase.rpc('admin_revisar_reportes_abuso'),
        'No se pudo revisar los reportes',
        (n) => `Se ocultaron ${n} marcas.`
      ),
    onContarAnonimos: async (dias) => {
      setWorking('contar')
      const { data, error } = await supabase.rpc('admin_anonimos_borrables', { p_dias: dias })
      setWorking(null)
      if (error) {
        setMessage(mensajeDeError(error, 'No se pudo contar'))
        return
      }
      setAnonimosBorrables(Number(data ?? 0))
    },
    onLimpiarAnonimos: (dias) =>
      tarea(
        'limpiar',
        () => supabase.rpc('admin_limpiar_anonimos', { p_dias: dias }),
        'No se pudo limpiar',
        (n) => {
          setAnonimosBorrables(null)
          return `Se borraron ${n} cuentas anónimas.`
        }
      ),
  }

  // --- Pantallas ---
  if (!sessionLista) return <div className="admin-cargando">Cargando…</div>

  if (!session) {
    return <AdminLogin onSubmit={handleLogin} working={loginWorking} error={loginError} />
  }

  if (esAdmin === null) return <div className="admin-cargando">Verificando permisos…</div>

  if (esAdmin === false) {
    return (
      <div className="admin-login">
        <div className="admin-login-card">
          <h1>Sin permisos</h1>
          <p className="admin-login-sub">
            Esta sesión no es de un administrador. Si te equivocaste de cuenta, salí y volvé a
            entrar.
          </p>
          {adminError && (
            <p className="admin-login-error" role="alert">
              {adminError}
            </p>
          )}
          <button onClick={handleLogout}>Salir</button>
          <a className="admin-login-back" href="/">
            ← Volver al mapa
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="admin">
      <header className="admin-header">
        <div>
          <h1>Trapitos — administración</h1>
          {resumen && (
            <p className="admin-resumen">
              ✅ {resumen.activos} activos · ♻️ {resumen.inactivos} caducados · 🚫{' '}
              {resumen.ocultos} ocultos · ⚠️ {resumen.reportados} con reportes · 👤{' '}
              {resumen.anonimos} cuentas anónimas
            </p>
          )}
        </div>
        <div className="admin-header-actions">
          <span className="admin-quien">{session.user.email}</span>
          <a href="/">Ver el mapa</a>
          <button onClick={handleLogout}>Salir</button>
        </div>
      </header>

      <section className="admin-filtros">
        <label htmlFor="filtro-buscar">Buscar</label>
        <input
          id="filtro-buscar"
          type="search"
          placeholder="calle o detalle"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
        />

        <label htmlFor="filtro-status">Estado</label>
        <select
          id="filtro-status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPagina(0)
          }}
        >
          <option value="">Todos</option>
          {SPOT_STATUS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>

        <label className="admin-check">
          <input
            type="checkbox"
            checked={soloReportados}
            onChange={(e) => {
              setSoloReportados(e.target.checked)
              setPagina(0)
            }}
          />
          Solo con reportes
        </label>

        <button onClick={cargarSpots} disabled={loading}>
          {loading ? 'Cargando…' : 'Refrescar'}
        </button>
      </section>

      <SpotsTable
        spots={spots}
        loading={loading}
        busyId={busyId}
        onSetStatus={handleSetStatus}
        onEditar={handleEditar}
        onBorrar={handleBorrar}
      />

      <div className="admin-paginado">
        <button disabled={pagina === 0} onClick={() => setPagina((p) => Math.max(0, p - 1))}>
          ← Anteriores
        </button>
        <span>página {pagina + 1}</span>
        <button disabled={spots.length < POR_PAGINA} onClick={() => setPagina((p) => p + 1)}>
          Siguientes →
        </button>
      </div>

      <AdminTools {...tools} working={working} anonimosBorrables={anonimosBorrables} />

      {message && (
        <div className="admin-toast" onClick={() => setMessage(null)}>
          {message}
        </div>
      )}
    </div>
  )
}
