import { FALLBACK_QUOTES, shouldDispatchPush } from '@sidekick/core'

const ALARM_NAME = 'sidekick.push'

type ExtensionConfig = {
  enabled: boolean
  intervalMinutes: number
  quietHoursEnabled: boolean
  quietStart: string
  quietEnd: string
}

const DEFAULT_CONFIG: ExtensionConfig = {
  enabled: true,
  intervalMinutes: 3,
  quietHoursEnabled: true,
  quietStart: '22:00',
  quietEnd: '08:00',
}

function randomQuote(): string {
  return FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)] ?? '你已经很棒了。'
}

async function getConfig(): Promise<ExtensionConfig> {
  const result = await chrome.storage.local.get('sidekick.extension.config')
  return { ...DEFAULT_CONFIG, ...(result['sidekick.extension.config'] as Partial<ExtensionConfig> | undefined) }
}

async function ensureAlarm(): Promise<void> {
  const config = await getConfig()
  await chrome.alarms.clear(ALARM_NAME)
  if (!config.enabled) return
  await chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: config.intervalMinutes,
  })
}

chrome.runtime.onInstalled.addListener(() => {
  void ensureAlarm()
})

chrome.alarms.onAlarm.addListener((alarm: chrome.alarms.Alarm) => {
  if (alarm.name !== ALARM_NAME) return
  void (async () => {
    const config = await getConfig()
    if (!shouldDispatchPush(new Date(), config)) return
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon-128.png',
      title: '灵伴',
      message: randomQuote(),
    })
  })()
})
