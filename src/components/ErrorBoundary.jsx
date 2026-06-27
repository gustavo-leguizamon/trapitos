import { Component } from 'react'

// Atrapa errores de render para que un fallo no deje la pantalla en blanco.
// Muestra el mensaje y el stack en pantalla (útil en el celular, donde no hay
// consola a mano) y ofrece recargar la app.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    this.setState({ info })
    // Queda también en consola por si se puede inspeccionar.
    console.error('ErrorBoundary atrapó:', error, info)
  }

  render() {
    const { error, info } = this.state
    if (!error) return this.props.children

    return (
      <div
        style={{
          padding: 16,
          fontFamily: 'system-ui, sans-serif',
          fontSize: 14,
          color: '#111',
          background: '#fff',
          height: '100%',
          overflow: 'auto',
        }}
      >
        <h2 style={{ marginTop: 0 }}>Se rompió algo 😵</h2>
        <p>Mostramos el error para poder diagnosticarlo:</p>
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            background: '#f5f5f5',
            border: '1px solid #ddd',
            borderRadius: 8,
            padding: 12,
          }}
        >
          {String(error?.stack || error?.message || error)}
          {info?.componentStack ? '\n\nComponente:' + info.componentStack : ''}
        </pre>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '10px 16px',
            border: 'none',
            borderRadius: 8,
            background: '#1f2937',
            color: '#fff',
            fontSize: 15,
          }}
        >
          Recargar
        </button>
      </div>
    )
  }
}
