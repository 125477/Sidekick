import localforage from 'localforage'

const store = localforage.createInstance({
  name: 'sidekick',
  storeName: 'panelBackground',
})

const MEDIA_KEY = 'media.v1'

export type PanelBackgroundMedia = {
  id: string
  type: 'image' | 'video'
  mimeType: string
  dataUrl: string
  name: string
  updatedAt: string
}

export async function loadPanelBackground(): Promise<PanelBackgroundMedia | null> {
  const raw = await store.getItem<unknown>(MEDIA_KEY)
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (
    typeof o.id !== 'string' ||
    (o.type !== 'image' && o.type !== 'video') ||
    typeof o.mimeType !== 'string' ||
    typeof o.dataUrl !== 'string' ||
    typeof o.name !== 'string' ||
    typeof o.updatedAt !== 'string'
  ) {
    return null
  }
  return {
    id: o.id,
    type: o.type,
    mimeType: o.mimeType,
    dataUrl: o.dataUrl,
    name: o.name,
    updatedAt: o.updatedAt,
  }
}

export async function savePanelBackground(
  media: PanelBackgroundMedia | null,
): Promise<void> {
  if (media == null) {
    await store.removeItem(MEDIA_KEY)
    return
  }
  await store.setItem(MEDIA_KEY, media)
}
