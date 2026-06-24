import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SpotPopup from './SpotPopup'

// Fijamos la franja "actual" para que la preselección sea determinista en los tests.
vi.mock('../lib/schedule', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, franjaFromDate: () => 'tarde' }
})

const baseSpot = {
  id: 'abc',
  calle: 'Mitre y San Martín',
  descripcion: 'frente al banco',
  confirma_count: 3,
  desmiente_count: 0,
}

describe('SpotPopup', () => {
  it('muestra calle, descripción y conteo de votos', () => {
    render(<SpotPopup spot={baseSpot} canVote onReport={vi.fn()} />)
    expect(screen.getByText('Mitre y San Martín')).toBeInTheDocument()
    expect(screen.getByText('frente al banco')).toBeInTheDocument()
    expect(screen.getByText(/👍 3/)).toBeInTheDocument()
    expect(screen.getByText(/👎 0/)).toBeInTheDocument()
  })

  it('marca como confiable cuando hay muchas confirmaciones', () => {
    render(<SpotPopup spot={baseSpot} canVote onReport={vi.fn()} />)
    expect(screen.getByText(/confiable/i)).toBeInTheDocument()
  })

  it('marca como dudoso cuando los desmentidos ganan', () => {
    const spot = { ...baseSpot, confirma_count: 0, desmiente_count: 3 }
    render(<SpotPopup spot={spot} canVote onReport={vi.fn()} />)
    expect(screen.getByText(/dudoso/i)).toBeInTheDocument()
  })

  it('"Ya no está" reporta el desmentido directamente', async () => {
    const user = userEvent.setup()
    const onReport = vi.fn()
    render(<SpotPopup spot={baseSpot} canVote onReport={onReport} />)

    await user.click(screen.getByRole('button', { name: /ya no está/i }))
    expect(onReport).toHaveBeenCalledWith('abc', 'desmiente')
  })

  it('"Confirmo" abre el selector; "Confirmar" reporta con las franjas elegidas', async () => {
    const user = userEvent.setup()
    const onReport = vi.fn()
    render(<SpotPopup spot={baseSpot} canVote onReport={onReport} />)

    // Al tocar Confirmo todavía no reporta: muestra el selector de franjas
    await user.click(screen.getByRole('button', { name: /confirmo/i }))
    expect(onReport).not.toHaveBeenCalled()
    expect(screen.getByText(/en qué horario/i)).toBeInTheDocument()

    // Recién al tocar "Confirmar" reporta con un array de franjas (la actual viene sugerida)
    await user.click(screen.getByRole('button', { name: /^confirmar$/i }))
    expect(onReport).toHaveBeenCalledTimes(1)
    const [spotId, tipo, franjas] = onReport.mock.calls[0]
    expect(spotId).toBe('abc')
    expect(tipo).toBe('confirma')
    expect(Array.isArray(franjas)).toBe(true)
    expect(franjas.length).toBeGreaterThanOrEqual(1)
  })

  it('permite elegir varias franjas antes de confirmar', async () => {
    const user = userEvent.setup()
    const onReport = vi.fn()
    render(<SpotPopup spot={baseSpot} canVote onReport={onReport} />)

    await user.click(screen.getByRole('button', { name: /confirmo/i }))
    // Sumamos madrugada y noche a lo ya sugerido y confirmamos
    await user.click(screen.getByRole('button', { name: /madrugada/i }))
    await user.click(screen.getByRole('button', { name: /noche/i }))
    await user.click(screen.getByRole('button', { name: /^confirmar$/i }))

    const franjas = onReport.mock.calls[0][2]
    expect(franjas).toEqual(expect.arrayContaining(['madrugada', 'noche']))
  })

  it('se puede cancelar el selector de franja', async () => {
    const user = userEvent.setup()
    const onReport = vi.fn()
    render(<SpotPopup spot={baseSpot} canVote onReport={onReport} />)

    await user.click(screen.getByRole('button', { name: /confirmo/i }))
    await user.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(onReport).not.toHaveBeenCalled()
    // Vuelve a mostrar los botones de voto
    expect(screen.getByRole('button', { name: /confirmo/i })).toBeInTheDocument()
  })

  it('oculta los botones y muestra invitación si no puede votar', () => {
    render(<SpotPopup spot={baseSpot} canVote={false} onReport={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /confirmo/i })).not.toBeInTheDocument()
    expect(screen.getByText(/participar.*votar/i)).toBeInTheDocument()
  })

  it('muestra la última actividad cuando hay last_activity', () => {
    const reciente = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    render(<SpotPopup spot={{ ...baseSpot, last_activity: reciente }} canVote onReport={vi.fn()} />)
    expect(screen.getByText(/visto hace 3 días/i)).toBeInTheDocument()
  })

  it('avisa "por caducar" cuando la marca está cerca del límite', () => {
    const viejo = new Date(Date.now() - 85 * 24 * 60 * 60 * 1000).toISOString()
    render(<SpotPopup spot={{ ...baseSpot, last_activity: viejo }} canVote onReport={vi.fn()} />)
    expect(screen.getByText(/por caducar/i)).toBeInTheDocument()
  })

  it('no muestra antigüedad si falta last_activity', () => {
    render(<SpotPopup spot={baseSpot} canVote onReport={vi.fn()} />)
    expect(screen.queryByText(/visto/i)).not.toBeInTheDocument()
  })

  it('muestra los horarios típicos ordenados por cantidad', () => {
    const spot = { ...baseSpot, horarios: { manana: 1, tarde: 4 } }
    render(<SpotPopup spot={spot} canVote onReport={vi.fn()} />)
    const linea = screen.getByText(/suele estar/i)
    expect(linea).toHaveTextContent('🌇 Tarde (4)')
    expect(linea).toHaveTextContent('🌅 Mañana (1)')
    // La tarde (4) va antes que la mañana (1)
    expect(linea.textContent.indexOf('Tarde')).toBeLessThan(linea.textContent.indexOf('Mañana'))
  })

  it('no muestra horarios si no hay datos', () => {
    render(<SpotPopup spot={baseSpot} canVote onReport={vi.fn()} />)
    expect(screen.queryByText(/suele estar/i)).not.toBeInTheDocument()
  })

  it('muestra la reputación del autor cuando viene en el spot', () => {
    // 5*2 + 15*3 = 55 -> experto
    const spot = { ...baseSpot, autor: { spotsCreados: 5, confirmacionesRecibidas: 15 } }
    render(<SpotPopup spot={spot} canVote onReport={vi.fn()} />)
    const linea = screen.getByText(/cargado por/i)
    expect(linea).toHaveTextContent(/experto/i)
  })

  it('no muestra autor si el spot no lo trae', () => {
    render(<SpotPopup spot={baseSpot} canVote onReport={vi.fn()} />)
    expect(screen.queryByText(/cargado por/i)).not.toBeInTheDocument()
  })
})
