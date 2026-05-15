import type { EmotionToastProps } from './emotionToastTypes'
import { EmotionToastCard } from './EmotionToastCard'
import { useEmotionToastChrome } from './useEmotionToastChrome'

export type { EmotionToastProps } from './emotionToastTypes'

export function EmotionToast(props: EmotionToastProps) {
  const chrome = useEmotionToastChrome(props)
  if (!props.visible) return null
  return <EmotionToastCard {...props} chrome={chrome} />
}
