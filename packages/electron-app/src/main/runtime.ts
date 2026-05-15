import { FALLBACK_QUOTES, shouldDispatchPush, type SchedulerConfig } from '@sidekick/core'
import type { NotifyPort, TimerPort } from './ports'

export type RuntimeDeps = {
  timerPort: TimerPort
  notifyPort: NotifyPort
}

function randomQuote(): string {
  return FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)] ?? '今天也要对自己温柔一点。'
}

export function startDesktopScheduler(
  config: SchedulerConfig,
  deps: RuntimeDeps,
): () => void {
  const stop = deps.timerPort.start(config.intervalMinutes, () => {
    if (!shouldDispatchPush(new Date(), config)) return
    deps.notifyPort.toast(randomQuote())
  })
  return stop
}
