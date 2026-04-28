import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SVG_PATH = join(__dirname, '..', 'public', 'vite.svg')
const OUT_DIR = join(__dirname, '..', 'public', 'icons')

mkdirSync(OUT_DIR, { recursive: true })

const svgBuffer = readFileSync(SVG_PATH)

const icons = [
  { name: 'favicon-16.png',   size: 16  },
  { name: 'favicon-32.png',   size: 32  },
  { name: 'apple-touch-icon-180.png', size: 180 },
  { name: 'icon-192.png',     size: 192 },
  { name: 'icon-512.png',     size: 512 },
]

// Standard icons
for (const { name, size } of icons) {
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(join(OUT_DIR, name))
  console.log(`✓ ${name}`)
}

// Maskable 512x512 — safe zone is 80% of canvas (409px), icon centred with padding
const maskableSize = 512
const iconSize = Math.round(maskableSize * 0.7) // icon = 70% → leaves comfortable safe zone

const resizedIcon = await sharp(svgBuffer)
  .resize(iconSize, iconSize)
  .png()
  .toBuffer()

await sharp({
  create: {
    width: maskableSize,
    height: maskableSize,
    channels: 4,
    background: { r: 94, g: 184, b: 196, alpha: 1 }, // #5eb8c4
  },
})
  .composite([{
    input: resizedIcon,
    gravity: 'centre',
  }])
  .png()
  .toFile(join(OUT_DIR, 'icon-512-maskable.png'))
console.log('✓ icon-512-maskable.png')

console.log(`\nAll icons generated in public/icons/`)
