// Genera los íconos PNG de la PWA a partir de un SVG vectorial (sin texto, para
// que renderice igual en cualquier entorno). Correr con: npm run icons
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public')
mkdirSync(outDir, { recursive: true })

const BLUE = '#1c5d8c'
const WHITE = '#ffffff'

// Pin de mapa (blanco) con un auto de frente (blanco) dentro de un círculo azul.
// Coordenadas absolutas sobre un lienzo de 512x512.
function art() {
  return `
    <!-- Pin: círculo + triángulo tangente que forma la gota -->
    <path d="M147 281 L256 448 L365 281 Z" fill="${WHITE}"/>
    <circle cx="256" cy="208" r="132" fill="${WHITE}"/>
    <!-- Hueco azul del pin -->
    <circle cx="256" cy="200" r="94" fill="${BLUE}"/>

    <!-- Auto de frente (blanco), centrado en (256,200) -->
    <g fill="${WHITE}">
      <!-- techo / cabina -->
      <rect x="214" y="158" width="84" height="46" rx="20"/>
      <!-- cuerpo -->
      <rect x="190" y="190" width="132" height="50" rx="18"/>
      <!-- ruedas asomando -->
      <rect x="200" y="236" width="28" height="14" rx="6"/>
      <rect x="284" y="236" width="28" height="14" rx="6"/>
    </g>
    <!-- Detalles azules (recortes que muestran el círculo de fondo) -->
    <g fill="${BLUE}">
      <!-- parabrisas -->
      <rect x="226" y="166" width="60" height="26" rx="11"/>
      <!-- faros -->
      <rect x="198" y="198" width="26" height="13" rx="6"/>
      <rect x="288" y="198" width="26" height="13" rx="6"/>
      <!-- parrilla -->
      <rect x="232" y="216" width="48" height="9" rx="4"/>
    </g>
  `
}

// Ícono normal: fondo azul redondeado + arte grande.
function normalSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <rect width="512" height="512" rx="104" fill="${BLUE}"/>
    ${art()}
  </svg>`
}

// Ícono maskable: fondo azul a sangre completo + arte más chico (zona segura ~80%).
function maskableSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
    <rect width="512" height="512" fill="${BLUE}"/>
    <g transform="translate(256 256) scale(0.7) translate(-256 -256)">
      ${art()}
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
