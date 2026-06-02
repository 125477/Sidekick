import { computeMoodJournalStreak } from '../../app/moodJournalStreak'
import type { MoodJournalEntry } from '../../state/moodJournalStorage'

type MoodJournalStreakBadgeProps = {
  entries: MoodJournalEntry[]
}

export function MoodJournalStreakBadge({ entries }: MoodJournalStreakBadgeProps) {
  const streak = computeMoodJournalStreak(entries)
  if (streak.current < 1) return null

  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/80 bg-violet-50/90 px-3 py-1 text-xs font-medium text-violet-800 dark:border-violet-500/30 dark:bg-violet-950/40 dark:text-violet-200"
      aria-label={`已连续 ${streak.current} 天记录今日小结`}
    >
      <span aria-hidden className="text-sm leading-none">
        🔥
      </span>
      <span>
        已连续 {streak.current} 天
        {streak.includesToday ? '' : '（今日尚未写）'}
      </span>
    </div>
  )
}
