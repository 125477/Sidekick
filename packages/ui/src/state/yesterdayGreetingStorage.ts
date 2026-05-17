import localforage from 'localforage'

const store = localforage.createInstance({
  name: 'sidekick',
  storeName: 'settings',
})

const KEY = 'sidekick.yesterdayGreeting.dayKey.v1'

export async function loadLastYesterdayGreetingDayKey(): Promise<string | null> {
  const v = await store.getItem<string>(KEY)
  return typeof v === 'string' && v.length > 0 ? v : null
}

export async function saveLastYesterdayGreetingDayKey(dayKey: string): Promise<void> {
  await store.setItem(KEY, dayKey)
}
