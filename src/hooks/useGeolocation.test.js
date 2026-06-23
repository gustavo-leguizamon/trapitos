import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useGeolocation } from './useGeolocation'

describe('useGeolocation', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('devuelve la posición cuando el GPS responde', async () => {
    const watchPosition = vi.fn((success) => {
      success({ coords: { latitude: -34.71, longitude: -58.25 } })
      return 1
    })
    vi.stubGlobal('navigator', { geolocation: { watchPosition, clearWatch: vi.fn() } })

    const { result } = renderHook(() => useGeolocation())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.position).toEqual({ lat: -34.71, lng: -58.25 })
    expect(result.current.error).toBeNull()
  })

  it('reporta error cuando el usuario rechaza el permiso', async () => {
    const watchPosition = vi.fn((_success, failure) => {
      failure({ message: 'User denied Geolocation' })
      return 1
    })
    vi.stubGlobal('navigator', { geolocation: { watchPosition, clearWatch: vi.fn() } })

    const { result } = renderHook(() => useGeolocation())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.position).toBeNull()
    expect(result.current.error).toBe('User denied Geolocation')
  })

  it('reporta error si el dispositivo no soporta geolocalización', async () => {
    vi.stubGlobal('navigator', {})

    const { result } = renderHook(() => useGeolocation())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toMatch(/no soporta/i)
  })
})
