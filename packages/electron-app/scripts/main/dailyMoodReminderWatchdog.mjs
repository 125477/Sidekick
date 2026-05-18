import { evaluateMoodReminderFromMain } from './moodReminderState.mjs'
import { state } from './state.mjs'

const MOOD_REMINDER_TICK_MS = 10_000

/** 主进程定时评估今日心情提醒；并 ping 各窗体刷新 snapshot。 */
export function registerDailyMoodReminderWatchdog() {
  const tick = () => {
    void evaluateMoodReminderFromMain()
    const windows = [state.spriteWindow, state.panelWindow]
    for (const win of windows) {
      if (!win || win.isDestroyed()) continue
      win.webContents.send('sidekick:mood-reminder-tick')
    }
  }
  tick()
  setInterval(tick, MOOD_REMINDER_TICK_MS)
}
