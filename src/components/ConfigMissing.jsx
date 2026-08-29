// Se muestra en vez de la app cuando falta el .env. Sin esto la app quedaba en
// blanco: createClient tira al importar el módulo y no llega a montar nada.
export default function ConfigMissing({ missing = [] }) {
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
      <h2 style={{ marginTop: 0 }}>Falta configurar la app ⚙️</h2>
      <p>No están definidas estas variables de entorno:</p>
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
        {missing.join('\n')}
      </pre>
      <p>Para arreglarlo:</p>
      <ol style={{ paddingLeft: 20, lineHeight: 1.6 }}>
        <li>
          Copiá <code>.env.example</code> a <code>.env</code> en la raíz del proyecto.
          Ojo con el punto del principio: si el archivo queda como <code>env</code>,
          Vite no lo lee.
        </li>
        <li>
          Completá los valores desde Supabase Dashboard &gt; Project Settings &gt; API.
        </li>
        <li>Reiniciá el servidor de desarrollo.</li>
      </ol>
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
