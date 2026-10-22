// Renders the PWA icons from the favicon so they never drift apart.
import { readFileSync, writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'

const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8')
const render = (src, size, out) => {
  const png = new Resvg(src, { fitTo: { mode: 'width', value: size } }).render().asPng()
  writeFileSync(new URL(`../public/${out}`, import.meta.url), png)
}
render(svg, 192, 'icon-192.png')
render(svg, 512, 'icon-512.png')
// Maskable: full-bleed background, artwork inside the 80% safe zone.
const inner = svg.replace(/<svg[^>]*>/, '').replace('</svg>', '').replace(/<rect[^>]*\/>/, '')
const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#1d2a3a"/><g transform="translate(6.4 6.4) scale(.8)">${inner}</g></svg>`
render(maskable, 512, 'icon-maskable-512.png')
console.log('icons written')
