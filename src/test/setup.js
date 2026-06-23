// Configuración global para los tests (se carga antes de cada archivo de test).
import '@testing-library/jest-dom'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Desmonta los componentes renderizados después de cada test
afterEach(() => {
  cleanup()
})
