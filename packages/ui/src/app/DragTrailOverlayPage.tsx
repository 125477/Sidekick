import { useEffect, useRef } from 'react'
import {
  createDragTrailSampler,
  drawDragStars,
  pruneStars,
  shiftParticles,
  type DragStarParticle,
} from '../components/sprite/spriteDragStarTrailCore'

/** ~24fps；小窗全量 clear 比脏矩形 union 在 Win 上更稳 */
const PAINT_INTERVAL_MS = 42

export function DragTrailOverlayPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const particlesRef = useRef<DragStarParticle[]>([])
  const samplerRef = useRef(createDragTrailSampler())
  const paintTimerRef = useRef<number | null>(null)
  const reducedMotionRef = useRef(false)
  const sizeRef = useRef({ w: 0, h: 0 })

  const stopLoop = () => {
    if (paintTimerRef.current != null) {
      window.clearInterval(paintTimerRef.current)
      paintTimerRef.current = null
    }
  }

  const paintFrame = () => {
    if (document.visibilityState === 'hidden') return
    const ctx = ctxRef.current
    if (!ctx) return

    const now = performance.now()
    const particles = particlesRef.current
    const { w, h } = sizeRef.current
    if (w <= 0 || h <= 0) return

    pruneStars(particles, now)

    if (particles.length === 0) {
      stopLoop()
      return
    }

    ctx.clearRect(0, 0, w, h)
    drawDragStars(ctx, particles, now)
  }

  const ensureLoop = () => {
    if (paintTimerRef.current != null) return
    paintFrame()
    paintTimerRef.current = window.setInterval(paintFrame, PAINT_INTERVAL_MS)
  }

  const resizeCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', {
      alpha: true,
      desynchronized: true,
    })
    if (!ctx) return
    ctxRef.current = ctx
    const w = window.innerWidth
    const h = window.innerHeight
    sizeRef.current = { w, h }
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }

  const ingestPoints = (points: Array<{ x: number; y: number }>) => {
    if (reducedMotionRef.current || points.length === 0) return
    const now = performance.now()
    const particles = particlesRef.current
    const sampler = samplerRef.current
    for (const { x, y } of points) {
      sampler.push(particles, x, y, now)
    }
    ensureLoop()
  }

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => {
      reducedMotionRef.current = mq.matches
    }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const d = window.sidekickDesktop
    if (!d) return undefined

    const unsubPoints =
      d.onDragTrailPoints?.((points) => ingestPoints(points)) ??
      d.onDragTrailPoint?.(({ x, y }) => ingestPoints([{ x, y }]))
    const unsubReset = d.onDragTrailReset?.(() => {
      particlesRef.current.length = 0
      samplerRef.current.reset()
      const ctx = ctxRef.current
      const { w, h } = sizeRef.current
      if (ctx && w > 0 && h > 0) ctx.clearRect(0, 0, w, h)
      stopLoop()
    })
    const unsubSampler = d.onDragTrailResetSampler?.(() => {
      samplerRef.current.reset()
    })
    const unsubShift = d.onDragTrailShift?.(({ dx, dy }) => {
      shiftParticles(particlesRef.current, dx, dy)
    })
    const unsubSync = d.onDragTrailSync?.(() => {
      resizeCanvas()
    })

    return () => {
      unsubPoints?.()
      unsubReset?.()
      unsubSampler?.()
      unsubShift?.()
      unsubSync?.()
      stopLoop()
    }
  }, [])

  useEffect(() => {
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => {
      window.removeEventListener('resize', resizeCanvas)
      stopLoop()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 block h-full w-full"
    />
  )
}
