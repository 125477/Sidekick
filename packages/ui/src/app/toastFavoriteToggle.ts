import { appendText, toggleTextFavorite } from '@sidekick/core'

/** 气泡收藏：无 textId 时先写入文案历史再切换收藏状态。 */
export async function toggleToastFavorite(opts: {
  message: string
  textId: string | null | undefined
}): Promise<{ id: string; favorite: boolean } | null> {
  const msg = opts.message.replace(/\s+/g, ' ').trim()
  if (!msg) return null

  let id = opts.textId?.trim() || null
  if (!id) {
    const next = await appendText({
      id: `text-${Date.now()}`,
      content: msg,
      createdAt: new Date().toISOString(),
      source: 'model',
      favorite: true,
    })
    id = next.texts.history[0]?.id ?? null
    if (!id) return null
    return { id, favorite: true }
  }

  const data = await toggleTextFavorite(id)
  const row = data.texts.history.find((t) => t.id === id)
  if (!row) return null
  return { id: row.id, favorite: row.favorite }
}
