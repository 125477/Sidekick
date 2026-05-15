export type TimerPort = {
  start: (minutes: number, callback: () => void) => () => void
}

export type NotifyPort = {
  toast: (message: string) => void
}

export type WindowPort = {
  showPanel: (panel: 'skin' | 'settings' | 'emotion' | 'fortune') => void
}

export function createIntervalTimerPort(): TimerPort {
  return {
    start(minutes, callback) {
      const id = setInterval(callback, minutes * 60 * 1000)
      return () => clearInterval(id)
    },
  }
}
