import { useEffect, useState } from 'react'

export type WidgetDockSide = 'right'
export type WidgetDockPhase =
  | 'free'
  | 'docking'
  | 'docked'
  | 'expanding'
  | 'expanded'

export type WidgetDockVisual = {
  side: WidgetDockSide | null
  phase: WidgetDockPhase
}

const FREE_DOCK: WidgetDockVisual = { side: null, phase: 'free' }

export function useWidgetDockVisual(enabled: boolean): WidgetDockVisual {
  const [dock, setDock] = useState<WidgetDockVisual>(FREE_DOCK)

  useEffect(() => {
    if (!enabled) {
      setDock(FREE_DOCK)
      return
    }
    const subscribe = window.sidekickDesktop?.onWidgetDockVisual
    if (!subscribe) return
    return subscribe((payload) => {
      setDock(payload)
    })
  }, [enabled])

  return dock
}

export function widgetDockTransformOrigin(
  side: WidgetDockSide | null,
): string {
  if (side === 'right') return 'right center'
  return 'center center'
}

export function widgetDockScale(phase: WidgetDockPhase): number {
  if (phase === 'docked' || phase === 'docking') return 0.86
  if (phase === 'expanding' || phase === 'expanded') return 1
  return 1
}

export function widgetDockPeekOpacity(phase: WidgetDockPhase): number {
  if (phase === 'docked' || phase === 'docking') return 0.92
  return 1
}
