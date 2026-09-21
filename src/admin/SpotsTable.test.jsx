import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SpotsTable from './SpotsTable'
import { normalizeSpot } from '../lib/admin'

const spot = normalizeSpot({
  id: 's1',
  lat: -34.6,
  lng: -58.4,
  calle: 'Mitre y San Martín',
  descripcion: 'frente al banco',
  status: 'activo',
  created_at: '2026-01-01T00:00:00Z',
  last_activity: new Date().toISOString(),
  confirma_count: '3',
  desmiente_count: '1',
  abuse_count: '2',
  abuse_motivos: [{ motivo: 'spam', cantidad: 2 }],
  autor_id: 'u1',
  autor_anonimo: true,
  autor_creado_at: new Date().toISOString(),
})

function setup(props = {}) {
  const handlers = {
    onSetStatus: vi.fn(),
    onEditar: vi.fn(),
    onBorrar: vi.fn(),
  }
  render(<SpotsTable spots={[spot]} {...handlers} {...props} />)
  return handlers
}

describe('SpotsTable', () => {
  it('muestra el lugar, los votos y los reportes de la marca', () => {
    setup()
    expect(screen.getByText('Mitre y San Martín')).toBeInTheDocument()
    expect(screen.getByText('frente al banco')).toBeInTheDocument()
    expect(screen.getByText(/👍 3 · 👎 1/)).toBeInTheDocument()
    expect(screen.getByText(/Spam ×2/)).toBeInTheDocument()
    expect(screen.getByText(/cuenta anónima/)).toBeInTheDocument()
  })

  it('avisa cuando el filtro no trae nada', () => {
    render(<SpotsTable spots={[]} onSetStatus={vi.fn()} onEditar={vi.fn()} onBorrar={vi.fn()} />)
    expect(screen.getByText(/no hay marcas/i)).toBeInTheDocument()
  })

  it('los botones de estado piden el cambio que corresponde', async () => {
    const user = userEvent.setup()
    const { onSetStatus } = setup()
    await user.click(screen.getByRole('button', { name: 'Ocultar' }))
    expect(onSetStatus).toHaveBeenCalledWith('s1', 'oculto')
  })

  it('no ofrece el estado en el que ya está', () => {
    setup()
    expect(screen.queryByRole('button', { name: /publicar|reactivar/i })).not.toBeInTheDocument()
  })

  it('borrar pide confirmación antes de avisar', async () => {
    const user = userEvent.setup()
    const { onBorrar } = setup()

    await user.click(screen.getByRole('button', { name: 'Borrar' }))
    expect(onBorrar).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: /borrar de verdad/i }))
    expect(onBorrar).toHaveBeenCalledWith('s1')
  })

  it('se puede desistir del borrado', async () => {
    const user = userEvent.setup()
    const { onBorrar } = setup()

    await user.click(screen.getByRole('button', { name: 'Borrar' }))
    await user.click(screen.getByRole('button', { name: 'No' }))

    expect(onBorrar).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Borrar' })).toBeInTheDocument()
  })

  it('editar manda el texto corregido', async () => {
    const user = userEvent.setup()
    const { onEditar } = setup()

    await user.click(screen.getByRole('button', { name: 'Editar' }))
    const calle = screen.getByLabelText('Calle')
    await user.clear(calle)
    await user.type(calle, 'Belgrano 100')
    await user.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(onEditar).toHaveBeenCalledWith('s1', {
      calle: 'Belgrano 100',
      descripcion: 'frente al banco',
    })
  })

  it('bloquea las acciones de la fila que está trabajando', () => {
    setup({ busyId: 's1' })
    expect(screen.getByRole('button', { name: 'Ocultar' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Borrar' })).toBeDisabled()
  })
})
