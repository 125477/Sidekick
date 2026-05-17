import type { MutableRefObject, RefObject } from 'react'
import { useEffect, useRef } from 'react'
import { APP_SELF_INTRO_LONG_COPY } from '../constants/appSelfIntroCopy'
import {
  loadAppSelfIntroShown,
  saveAppSelfIntroShown,
} from '../state/appSelfIntroStorage'
import {
  broadcastAppSelfIntroDismissed,
  subscribeAppSelfIntroDismissed,
} from '../state/appSelfIntroSync'

export type UseAppSelfIntroBubbleArgs = {
  isWidgetMode: boolean
  settingsReady: boolean
  blockScheduledPushRef: MutableRefObject<boolean>
  widgetMeasureRef: RefObject<HTMLDivElement | null>
  showToastMessage: (
    message: string,
    opts?: {
      dwellSeconds?: number
      textId?: string | null
      favorite?: boolean
      toastMode?: 'normal' | 'intro'
    },
  ) => Promise<void>
}

async function waitForWidgetMeasure(
  ref: RefObject<HTMLDivElement | null>,
  maxMs = 4000,
): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    const el = ref.current
    if (el) {
      const r = el.getBoundingClientRect()
      if (r.width >= 4 && r.height >= 4) return true
    }
    await new Promise((r) => window.setTimeout(r, 80))
  }
  return false
}

/** 首次打开精灵窗即展示自我介绍，不依赖引导是否完成。 */
export function useAppSelfIntroBubble({
  isWidgetMode,
  settingsReady,
  blockScheduledPushRef,
  widgetMeasureRef,
  showToastMessage,
}: UseAppSelfIntroBubbleArgs) {
  const introFiredRef = useRef(false)
  const showToastRef = useRef(showToastMessage)
  showToastRef.current = showToastMessage

  useEffect(() => {
    if (!isWidgetMode) return
    return subscribeAppSelfIntroDismissed(() => {
      blockScheduledPushRef.current = false
    })
  }, [isWidgetMode, blockScheduledPushRef])

  /** 未看过自我介绍时立即挡住定时推送，避免抢在 intro 前弹出普通句。 */
  useEffect(() => {
    if (!isWidgetMode) return
    let cancelled = false
    void loadAppSelfIntroShown().then((shown) => {
      if (cancelled || shown) return
      blockScheduledPushRef.current = true
    })
    return () => {
      cancelled = true
    }
  }, [isWidgetMode, blockScheduledPushRef])

  useEffect(() => {
    if (!isWidgetMode || !settingsReady) return
    if (introFiredRef.current) return

    let cancelled = false

    const timer = window.setTimeout(() => {
      void (async () => {
        if (cancelled || introFiredRef.current) return
        const shown = await loadAppSelfIntroShown()
        if (cancelled || shown) {
          blockScheduledPushRef.current = false
          return
        }

        await waitForWidgetMeasure(widgetMeasureRef)

        if (cancelled || introFiredRef.current) return

        introFiredRef.current = true
        blockScheduledPushRef.current = true
        try {
          await showToastRef.current(APP_SELF_INTRO_LONG_COPY, {
            dwellSeconds: 0,
            toastMode: 'intro',
          })
        } catch {
          introFiredRef.current = false
          blockScheduledPushRef.current = false
        }
      })()
    }, 900)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [isWidgetMode, settingsReady, blockScheduledPushRef, widgetMeasureRef])
}

export async function dismissAppSelfIntroBubble(
  blockScheduledPushRef: MutableRefObject<boolean>,
): Promise<void> {
  blockScheduledPushRef.current = false
  await saveAppSelfIntroShown()
  broadcastAppSelfIntroDismissed()
  void window.sidekickDesktop?.hideToastWindow?.()
}
