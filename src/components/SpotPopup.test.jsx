import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SpotPopup from './SpotPopup'

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

  it('llama a onReport con el tipo correcto al votar', async () => {
    const user = userEvent.setup()
    const onReport = vi.fn()
    render(<SpotPopup spot={baseSpot} canVote onReport={onReport} />)

    await user.click(screen.getByRole('button', { name: /confirmo/i }))
    expect(onReport).toHaveBeenCalledWith('abc', 'confirma')

    await user.click(screen.getByRole('button', { name: /ya no está/i }))
    expect(onReport).toHaveBeenCalledWith('abc', 'desmiente')
  })

  it('oculta los botones y muestra invitación si no puede votar', () => {
    render(<SpotPopup spot={baseSpot} canVote={false} onReport={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /confirmo/i })).not.toBeInTheDocument()
    expect(screen.getByText(/participar.*votar/i)).toBeInTheDocument()
  })
})
