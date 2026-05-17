import localforage from 'localforage'

const store = localforage.createInstance({
  name: 'sidekick',
  storeName: 'settings',
})

const APP_SELF_INTRO_SHOWN_KEY = 'sidekick.appSelfIntroShown.v1'

export async function loadAppSelfIntroShown(): Promise<boolean> {
  const v = await store.getItem<string>(APP_SELF_INTRO_SHOWN_KEY)
  return v === '1'
}

export async function saveAppSelfIntroShown(): Promise<void> {
  await store.setItem(APP_SELF_INTRO_SHOWN_KEY, '1')
}
