// Genera los íconos PNG de la PWA a partir de un SVG vectorial (sin texto, para
// que renderice igual en cualquier entorno). Correr con: node scripts/generate-icons.mjs
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public')
mkdirSync(outDir, { recursive: true })

const AMBER = '#f59e0b'
const WHITE = '#ffffff'

// Una "P" (de 🅿️) dibujada con rectángulos redondeados, sobre fondo ámbar.
function pShapes() {
  return `
    <rect x="150" y="110" width="210" height="180" rx="90" fill="${WHITE}"/>
    <rect x="150" y="110" width="86" height="300" rx="20" fill="${WHITE}"/>
    <rect x="232" y="168" width="92" height="66" rx="33" fill="${AMBER}"/>
  `
}

// Ícono normal: fondo redondeado a sangre + P grande.
function normalSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="110" fill="${AMBER}"/>
    ${pShapes()}
  </svg>`
}

// Ícono maskable: fondo a sangre completo + P más chica (zona segura ~80%).
function maskableSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <rect width="512" height="512" fill="${AMBER}"/>
    <g transform="translate(256 256) scale(0.62) translate(-256 -256)">
      ${pShapes()}
    </g>
  </svg>`
}

async function gen(svg, size, name) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(join(outDir, name))
  console.log('✓', name)
}

await gen(normalSvg(), 192, 'pwa-192x192.png')
await gen(normalSvg(), 512, 'pwa-512x512.png')
await gen(maskableSvg(), 512, 'maskable-512x512.png')
await gen(normalSvg(), 180, 'apple-touch-icon.png')
await gen(normalSvg(), 48, 'favicon.png')
console.log('Íconos generados en public/')
