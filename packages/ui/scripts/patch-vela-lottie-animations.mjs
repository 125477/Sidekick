/**
 * Patch lingban-lottie-vela-universal-loop.json (fr=100, op=3000).
 * - Lottie: layers[] bottom → top; overlay layers must be LAST.
 * - Run: node packages/ui/scripts/patch-vela-lottie-animations.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const jsonPath = path.join(
  __dirname,
  '../src/static/lotties/lingban-lottie-vela-universal-loop.json',
)

const OVERLAY_NAMES = new Set([
  'Think pulse',
  'Head sweep gloss',
  'Ambient halo',
])

const easeInOut = {
  o: { x: [0.42, 0.42], y: [0, 0] },
  i: { x: [0.58, 0.58], y: [1, 1] },
}

const linear = {
  o: { x: [0], y: [0] },
  i: { x: [1], y: [1] },
}

function breathScaleKeyframes() {
  const half = 200
  const k = []
  for (let t = 0; t < 3000; t += half) {
    const v = (t / half) % 2 === 0 ? [88, 88] : [114, 114]
    k.push({ t, s: v, ...easeInOut })
  }
  k.push({ t: 3000, s: [88, 88], ...easeInOut })
  return k
}

/** Whole robot scale — very readable (±6%). */
function aiBotScaleKeyframes() {
  const b = 228.313135218247
  const half = 150
  const k = []
  for (let t = 0; t < 3000; t += half) {
    const lo = (t / half) % 2 === 0
    const m = lo ? 0.94 : 1.06
    k.push({ t, s: [b * m, b * m], ...easeInOut })
  }
  k.push({ t: 3000, s: [b * 0.94, b * 0.94], ...easeInOut })
  return k
}

/** Gentle vertical bob (±10px), 3s half = 6s full cycle. */
function aiBotPositionKeyframes() {
  const baseX = 353.0300903320312
  const baseY = 371.7738037109375
  const amp = 10
  const half = 300
  const k = []
  for (let t = 0; t < 3000; t += half) {
    const up = (t / half) % 2 === 0
    k.push({ t, s: [baseX, up ? baseY - amp : baseY + amp], ...easeInOut })
  }
  k.push({ t: 3000, s: [baseX, baseY - amp], ...easeInOut })
  return k
}

function pulseKeyframes() {
  const period = 160
  const scaleK = []
  const opacityK = []
  for (let base = 0; base < 3000; base += period) {
    scaleK.push(
      { t: base, s: [0, 0], ...linear },
      { t: base + 3, s: [195, 195], ...linear },
      { t: base + 45, s: [195, 195], ...linear },
      { t: base + 46, s: [0, 0], ...linear },
    )
    opacityK.push(
      { t: base, s: [100], ...linear },
      { t: base + 3, s: [100], ...linear },
      { t: base + 45, s: [0], ...linear },
      { t: base + 46, s: [0], ...linear },
    )
  }
  return { scaleK, opacityK }
}

function sweepKeyframes() {
  const period = 120
  const dur = 28
  const posK = []
  const opacityK = []
  const start = [268, 292]
  const end = [448, 432]
  for (let base = 0; base < 3000; base += period) {
    posK.push(
      { t: base, s: [...start], ...easeInOut },
      { t: base + dur, s: [...end], ...easeInOut },
    )
    opacityK.push(
      { t: base, s: [35], ...easeInOut },
      { t: base + Math.floor(dur / 2), s: [92], ...easeInOut },
      { t: base + dur, s: [35], ...easeInOut },
    )
  }
  return { posK, opacityK }
}

function ambientOpacityKeyframes() {
  const k = []
  const period = 240
  for (let t = 0; t <= 3000; t += period / 2) {
    const low = (t / (period / 2)) % 2 === 0
    k.push({ t, s: [low ? 12 : 38], ...easeInOut })
  }
  return k
}

const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
const layers = data.layers
if (!Array.isArray(layers)) {
  console.error('No root layers')
  process.exit(1)
}

data.layers = layers.filter((l) => !OVERLAY_NAMES.has(l.nm))

const breath = breathScaleKeyframes()
for (const layer of data.layers) {
  if (layer.ty === 0 && (layer.nm === 'Rectangle Copy 34' || layer.nm === 'Rectangle Copy 35')) {
    layer.ks = layer.ks || {}
    layer.ks.s = { a: 1, k: breath, ix: 2 }
  }
}

const bot = data.layers.find((l) => l.nm === 'AI.bot')
if (bot?.ks) {
  bot.ks.s = { a: 1, k: aiBotScaleKeyframes(), ix: 2 }
  bot.ks.p = { a: 1, k: aiBotPositionKeyframes(), ix: 2 }
}

const { scaleK, opacityK } = pulseKeyframes()
const pulseLayer = {
  ddd: 0,
  ind: 41,
  ty: 4,
  nm: 'Think pulse',
  sr: 1,
  ks: {
    p: { a: 0, k: [354, 362], ix: 2 },
    a: { a: 0, k: [0, 0], ix: 2 },
    s: { a: 0, k: [100, 100], ix: 2 },
    r: { a: 0, k: 0, ix: 2 },
    o: { a: 0, k: 100, ix: 2 },
    sk: { a: 0, k: 0, ix: 2 },
    sa: { a: 0, k: 0, ix: 2 },
  },
  ao: 0,
  shapes: [
    {
      ty: 'gr',
      nm: 'pulse ring',
      it: [
        {
          ty: 'el',
          d: 1,
          s: { a: 0, k: [130, 130], ix: 2 },
          p: { a: 0, k: [0, 0], ix: 2 },
          nm: 'pulse ellipse',
        },
        {
          ty: 'fl',
          c: { a: 0, k: [0.45, 0.82, 1], ix: 2 },
          o: { a: 0, k: 100, ix: 2 },
          r: 1,
          bm: 0,
        },
        {
          ty: 'tr',
          p: { a: 0, k: [0, 0], ix: 2 },
          a: { a: 0, k: [0, 0], ix: 2 },
          s: { a: 1, k: scaleK, ix: 2 },
          r: { a: 0, k: 0, ix: 2 },
          o: { a: 1, k: opacityK, ix: 2 },
          sk: { a: 0, k: 0, ix: 2 },
          sa: { a: 0, k: 0, ix: 2 },
        },
      ],
      bm: 0,
    },
  ],
  ip: 0,
  op: 3001,
  st: 0,
  bm: 0,
}

const { posK, opacityK: sweepOpacityK } = sweepKeyframes()
const sweepLayer = {
  ddd: 0,
  ind: 42,
  ty: 4,
  nm: 'Head sweep gloss',
  sr: 1,
  ks: {
    p: { a: 1, k: posK, ix: 2 },
    a: { a: 0, k: [0, 0], ix: 2 },
    s: { a: 0, k: [100, 100], ix: 2 },
    r: { a: 0, k: 42, ix: 2 },
    o: { a: 1, k: sweepOpacityK, ix: 2 },
    sk: { a: 0, k: 0, ix: 2 },
    sa: { a: 0, k: 0, ix: 2 },
  },
  ao: 0,
  shapes: [
    {
      ty: 'gr',
      nm: 'gloss bar',
      it: [
        {
          ty: 'rc',
          d: 1,
          s: { a: 0, k: [220, 36], ix: 2 },
          p: { a: 0, k: [0, 0], ix: 2 },
          r: { a: 0, k: 18, ix: 2 },
        },
        {
          ty: 'fl',
          c: { a: 0, k: [1, 1, 1], ix: 2 },
          o: { a: 0, k: 72, ix: 2 },
          r: 1,
          bm: 0,
        },
        {
          ty: 'tr',
          p: { a: 0, k: [0, 0], ix: 2 },
          a: { a: 0, k: [0, 0], ix: 2 },
          s: { a: 0, k: [100, 100], ix: 2 },
          r: { a: 0, k: 0, ix: 2 },
          o: { a: 0, k: 100, ix: 2 },
          sk: { a: 0, k: 0, ix: 2 },
          sa: { a: 0, k: 0, ix: 2 },
        },
      ],
      bm: 0,
    },
  ],
  ip: 0,
  op: 3001,
  st: 0,
  bm: 0,
}

const ambientLayer = {
  ddd: 0,
  ind: 43,
  ty: 4,
  nm: 'Ambient halo',
  sr: 1,
  ks: {
    p: { a: 0, k: [353.5, 353.5], ix: 2 },
    a: { a: 0, k: [0, 0], ix: 2 },
    s: { a: 0, k: [100, 100], ix: 2 },
    r: { a: 0, k: 0, ix: 2 },
    o: { a: 1, k: ambientOpacityKeyframes(), ix: 2 },
    sk: { a: 0, k: 0, ix: 2 },
    sa: { a: 0, k: 0, ix: 2 },
  },
  ao: 0,
  shapes: [
    {
      ty: 'gr',
      nm: 'soft disc',
      it: [
        {
          ty: 'el',
          d: 1,
          s: { a: 0, k: [420, 420], ix: 2 },
          p: { a: 0, k: [0, 0], ix: 2 },
        },
        {
          ty: 'gf',
          o: { a: 0, k: 100, ix: 2 },
          r: 1,
          bm: 0,
          g: {
            p: 2,
            k: {
              a: 0,
              k: [
                0, 0.45, 0.78, 1, 1, 0.45, 0.78, 1, 0, 0.15, 1, 0.85,
              ],
              ix: 2,
            },
          },
          s: { a: 0, k: [0, 0], ix: 2 },
          e: { a: 0, k: [210, 0], ix: 2 },
          t: 2,
        },
        {
          ty: 'tr',
          p: { a: 0, k: [0, 0], ix: 2 },
          a: { a: 0, k: [0, 0], ix: 2 },
          s: { a: 0, k: [100, 100], ix: 2 },
          r: { a: 0, k: 0, ix: 2 },
          o: { a: 0, k: 100, ix: 2 },
          sk: { a: 0, k: 0, ix: 2 },
          sa: { a: 0, k: 0, ix: 2 },
        },
      ],
      bm: 0,
    },
  ],
  ip: 0,
  op: 3001,
  st: 0,
  bm: 0,
}

data.layers.push(ambientLayer, pulseLayer, sweepLayer)

fs.writeFileSync(jsonPath, JSON.stringify(data))
console.log(
  'Patched',
  jsonPath,
  'layers',
  data.layers.length,
  '(AI.bot scale+bob, rings 88–114%, ambient + pulse + sweep on top)',
)
