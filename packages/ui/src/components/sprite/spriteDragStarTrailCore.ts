export type DragStarColor =
  | 'white'
  | 'violet'
  | 'pink'
  | 'gold'
  | 'sky'
  | 'mint'

export type DragStarParticle = {
  x: number
  y: number
  born: number
  lifeMs: number
  size: number
  color: DragStarColor
}

const MIN_SAMPLE_DIST_PX = 14
const MAX_PARTICLES = 56
const LIFE_MS_MIN = 900
const LIFE_MS_MAX = 1600
const STAMP_SIZE = 20

const starStamps = new Map<DragStarColor, CanvasImageSource>()

const STAMP_PALETTES: Record<
  DragStarColor,
  readonly [string, string, string]
> = {
  white: ['rgba(255,255,255,1)', 'rgba(255,252,245,0.95)', 'rgba(255,255,255,0)'],
  violet: ['rgba(255,255,255,0.98)', 'rgba(221,214,254,0.92)', 'rgba(167,139,250,0)'],
  pink: ['rgba(255,255,255,0.96)', 'rgba(251,207,232,0.9)', 'rgba(244,114,182,0)'],
  gold: ['rgba(255,255,245,1)', 'rgba(253,230,138,0.92)', 'rgba(251,191,36,0)'],
  sky: ['rgba(255,255,255,0.96)', 'rgba(186,230,253,0.9)', 'rgba(56,189,248,0)'],
  mint: ['rgba(255,255,255,0.96)', 'rgba(167,243,208,0.9)', 'rgba(52,211,153,0)'],
}

function randomLifeMs(): number {
  return LIFE_MS_MIN + Math.random() * (LIFE_MS_MAX - LIFE_MS_MIN)
}

function jitterPx(span: number): number {
  return (Math.random() - 0.5) * span
}

function pickStarColor(): DragStarColor {
  const r = Math.random()
  if (r < 0.34) return 'white'
  if (r < 0.52) return 'violet'
  if (r < 0.68) return 'pink'
  if (r < 0.8) return 'gold'
  if (r < 0.9) return 'sky'
  return 'mint'
}

function getStarStamp(color: DragStarColor): CanvasImageSource {
  const cached = starStamps.get(color)
  if (cached) return cached
  const c = document.createElement('canvas')
  c.width = STAMP_SIZE
  c.height = STAMP_SIZE
  const ctx = c.getContext('2d')
  if (!ctx) {
    starStamps.set(color, c)
    return c
  }
  const cx = STAMP_SIZE / 2
  const cy = STAMP_SIZE / 2
  const r = STAMP_SIZE * 0.48
  const [core, mid, edge] = STAMP_PALETTES[color]
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
  g.addColorStop(0, core)
  g.addColorStop(0.42, mid)
  g.addColorStop(1, edge)
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  starStamps.set(color, c)
  return c
}

function makeStar(x: number, y: number, born: number): DragStarParticle {
  return {
    x,
    y,
    born,
    lifeMs: randomLifeMs(),
    size: 2.6 + Math.random() * 2.8,
    color: pickStarColor(),
  }
}

function sampleDensity(): number {
  return Math.random() < 0.78 ? 1 : 2
}

export function spawnStarsAlongSegment(
  from: { x: number; y: number } | null,
  to: { x: number; y: number },
  now: number,
): DragStarParticle[] {
  const count = sampleDensity()
  const stars: DragStarParticle[] = []
  for (let i = 0; i < count; i += 1) {
    if (!from) {
      stars.push(makeStar(to.x + jitterPx(12), to.y + jitterPx(12), now))
      continue
    }
    const t = Math.random()
    const x = from.x + (to.x - from.x) * t + jitterPx(14)
    const y = from.y + (to.y - from.y) * t + jitterPx(14)
    stars.push(makeStar(x, y, now))
  }
  return stars
}

export type DragTrailSampler = {
  last: { x: number; y: number } | null
  push(
    particles: DragStarParticle[],
    x: number,
    y: number,
    now: number,
  ): void
}

export function createDragTrailSampler(): DragTrailSampler & {
  reset: () => void
} {
  const sampler: DragTrailSampler & { reset: () => void } = {
    last: null,
    push(particles, x, y, now) {
      const prev = sampler.last
      if (prev) {
        const dist = Math.hypot(x - prev.x, y - prev.y)
        if (dist < MIN_SAMPLE_DIST_PX) return
      }
      const spawned = spawnStarsAlongSegment(prev, { x, y }, now)
      if (spawned.length > 0) {
        particles.push(...spawned)
        if (particles.length > MAX_PARTICLES) {
          particles.splice(0, particles.length - MAX_PARTICLES)
        }
      }
      sampler.last = { x, y }
    },
    reset() {
      sampler.last = null
    },
  }
  return sampler
}

export function starOpacity(now: number, star: DragStarParticle): number {
  const age = now - star.born
  if (age >= star.lifeMs) return 0
  const t = age / star.lifeMs
  const fade = (1 - t) * (1 - t)
  return Math.max(0.55, fade)
}

export function pruneStars(
  particles: DragStarParticle[],
  now: number,
): void {
  let write = 0
  for (let i = 0; i < particles.length; i += 1) {
    const p = particles[i]!
    if (now - p.born < p.lifeMs) {
      particles[write] = p
      write += 1
    }
  }
  particles.length = write
}

export function shiftParticles(
  particles: DragStarParticle[],
  dx: number,
  dy: number,
): void {
  if (dx === 0 && dy === 0) return
  for (const p of particles) {
    p.x += dx
    p.y += dy
  }
}

export function drawDragStars(
  ctx: CanvasRenderingContext2D,
  particles: DragStarParticle[],
  now: number,
): void {
  if (particles.length === 0) return
  for (const star of particles) {
    const opacity = starOpacity(now, star)
    if (opacity <= 0.02) continue
    const dim = star.size * 2
    const boost = star.color === 'white' ? 1.05 : 1.12
    ctx.globalAlpha = Math.min(1, opacity * boost)
    const stamp = getStarStamp(star.color)
    ctx.drawImage(stamp, star.x - dim / 2, star.y - dim / 2, dim, dim)
  }
  ctx.globalAlpha = 1
}
