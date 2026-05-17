import type { MoodMediaAttachment } from './moodJournalStorage'

const MAX_ATTACHMENTS = 8
const MAX_BYTES = 12 * 1024 * 1024

export async function fileToMoodAttachment(
  file: File,
): Promise<MoodMediaAttachment> {
  if (file.size > MAX_BYTES) {
    throw new Error('FILE_TOO_LARGE')
  }
  const type = file.type.startsWith('video/')
    ? 'video'
    : file.type.startsWith('image/')
      ? 'image'
      : null
  if (!type) {
    throw new Error('UNSUPPORTED_TYPE')
  }
  const dataUrl = await readFileAsDataUrl(file)
  return {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    mimeType: file.type || (type === 'video' ? 'video/mp4' : 'image/jpeg'),
    dataUrl,
    name: file.name,
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('read failed'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsDataURL(file)
  })
}

export function canAddMoodAttachments(
  current: MoodMediaAttachment[],
  nextCount = 1,
): boolean {
  return current.length + nextCount <= MAX_ATTACHMENTS
}

export const MOOD_MEDIA_ACCEPT =
  'image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,.gif,.mp4,.webm'
