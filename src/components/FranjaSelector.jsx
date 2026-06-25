import { FRANJAS, franjaLabel, franjaFromDate } from '../lib/schedule'

// Selector múltiple de franjas horarias (toggle). `value` es un array de franjas.
// La franja correspondiente a la hora actual se marca como "· ahora".
export default function FranjaSelector({ value = [], onChange }) {
  const ahora = franjaFromDate()

  function toggle(f) {
    if (value.includes(f)) onChange(value.filter((x) => x !== f))
    else onChange([...value, f])
  }

  return (
    <div className="franja-options">
      {FRANJAS.map((f) => {
        const selected = value.includes(f)
        return (
          <button
            type="button"
            key={f}
            className={selected ? 'franja selected' : 'franja'}
            aria-pressed={selected}
            onClick={() => toggle(f)}
          >
            {franjaLabel(f)}
            {f === ahora ? <span className="franja-now">ahora</span> : ''}
          </button>
        )
      })}
    </div>
  )
}
