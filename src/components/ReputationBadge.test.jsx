import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ReputationBadge from './ReputationBadge'

describe('ReputationBadge', () => {
  it('muestra "Nuevo" y puntaje 0 sin stats', () => {
    render(<ReputationBadge stats={null} />)
    expect(screen.getByText(/nuevo/i)).toBeInTheDocument()
    expect(screen.getByText(/· 0/)).toBeInTheDocument()
  })

  it('calcula el nivel a partir de los agregados', () => {
    // 5 confirmaciones * 3 = 15 + 2 spots * 2 = 4 -> 19 -> colaborador
    render(
      <ReputationBadge stats={{ spotsCreados: 2, confirmacionesRecibidas: 5, votosEmitidos: 0 }} />
    )
    expect(screen.getByText(/colaborador/i)).toBeInTheDocument()
    expect(screen.getByText(/· 19/)).toBeInTheDocument()
  })

  it('llega a experto con suficiente puntaje', () => {
    render(<ReputationBadge stats={{ spotsCreados: 5, confirmacionesRecibidas: 15 }} />)
    // 5*2 + 15*3 = 10 + 45 = 55 -> experto
    expect(screen.getByText(/experto/i)).toBeInTheDocument()
  })
})
