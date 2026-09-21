import { useState } from 'react'

// Login del panel: email + contraseña de un usuario real (no anónimo).
// No decide nada de permisos — con la sesión abierta, quien dice si sos admin
// es la base (es_admin()). Este formulario solo consigue la sesión.
export default function AdminLogin({ onSubmit, working, error }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    if (working) return
    onSubmit({ email: email.trim(), password })
  }

  return (
    <div className="admin-login">
      <form className="admin-login-card" onSubmit={handleSubmit}>
        <h1>Panel de administración</h1>
        <p className="admin-login-sub">Trapitos — acceso restringido</p>

        <label htmlFor="admin-email">Email</label>
        <input
          id="admin-email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label htmlFor="admin-password">Contraseña</label>
        <input
          id="admin-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit" disabled={working || !email.trim() || !password}>
          {working ? 'Entrando…' : 'Entrar'}
        </button>

        {error && (
          <p className="admin-login-error" role="alert">
            {error}
          </p>
        )}

        <a className="admin-login-back" href="/">
          ← Volver al mapa
        </a>
      </form>
    </div>
  )
}
