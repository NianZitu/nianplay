// Same theme as the desktop (colors, radii), scanning the phone UI and the shared renderer code.
// Paths are absolute: Tailwind resolves `content` from the current working directory, not from
// this file, and the build runs from the repo root.
import path from 'path'
import { fileURLToPath } from 'url'
import base from '../tailwind.config.js'

const here = path.dirname(fileURLToPath(import.meta.url)).replace(/\\/g, '/')
const root = path.resolve(here, '..').replace(/\\/g, '/')

export default {
  ...base,
  content: [`${here}/index.html`, `${here}/src/**/*.{js,jsx}`, `${root}/src/renderer/**/*.{js,jsx}`],
}
