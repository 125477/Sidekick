import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import {
  appendEmotion,
  emotionCnLabelToKind,
  type EmotionKind,
  type EmotionRecord,
} from '@sidekick/core'
import type { SidekickSettings } from '../../state/settingsState'
import type { EmotionMoodTab } from '../../state/uiState'
import {
  deleteMoodJournalEntryById,
  getMoodEntryForDay,
  listMoodJournalEntries,
  localDayKey,
  upsertMoodJournalEntry,
  type MoodJournalEntry,
  type MoodMediaAttachment,
} from '../../state/moodJournalStorage'
import { EmotionQuickFeedback } from './EmotionQuickFeedback'
import {
  EMOTION_CHIP_LABELS,
  EMOTION_LABEL_TO_MOOD_LEVEL,
  emotionChipButtonClass,
  moodEntryDisplayLabel,
  type EmotionChipLabel,
} from './emotionChips'
import { MoodSummaryMediaPicker } from './MoodSummaryMediaPicker'
import { MoodHistoryPanel } from './MoodHistoryPanel'

const EmotionTrendChart = lazy(async () => {
  const m = await import('./EmotionTrendChart')
  return { default: m.EmotionTrendChart }
})

type DailyMoodPanelProps = {
  emotionMoodTab: EmotionMoodTab
  onEmotionMoodTabChange: (tab: EmotionMoodTab) => void
  settings: SidekickSettings
  emotionRecords: EmotionRecord[]
  setEmotionRecords: (records: EmotionRecord[]) => void
  requestCompanionText: (
    keyword?: string,
    emotion?: EmotionKind,
  ) => Promise<void>
}

type SummarySubview = 'form' | 'history'

export function DailyMoodPanel({
  emotionMoodTab,
  onEmotionMoodTabChange,
  settings,
  emotionRecords,
  setEmotionRecords,
  requestCompanionText,
}: DailyMoodPanelProps) {
  const [entries, setEntries] = useState<MoodJournalEntry[]>([])
  const [todayEntry, setTodayEntry] = useState<MoodJournalEntry | null>(null)
  const [moodLabel, setMoodLabel] = useState<EmotionChipLabel>('开心')
  const [note, setNote] = useState('')
  const [attachments, setAttachments] = useState<MoodMediaAttachment[]>([])
  const [saveHint, setSaveHint] = useState<string | null>(null)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [summaryView, setSummaryView] = useState<SummarySubview>('form')

  const refresh = useCallback(async () => {
    const day = localDayKey()
    const [list, t] = await Promise.all([
      listMoodJournalEntries(),
      getMoodEntryForDay(day),
    ])
    setEntries(list)
    setTodayEntry(t)
    if (t) {
      setMoodLabel(moodEntryDisplayLabel(t))
      setNote(t.note)
      setAttachments(t.attachments ?? [])
    } else {
      setMoodLabel('开心')
      setNote('')
      setAttachments([])
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (emotionMoodTab === 'summary') {
      setSummaryView('form')
    }
  }, [emotionMoodTab])

  const handleDeleteEntry = useCallback(
    async (id: string) => {
      const ok = await deleteMoodJournalEntryById(id)
      if (!ok) return
      await refresh()
    },
    [refresh],
  )

  async function handleDeleteToday() {
    if (!todayEntry || busy) return
    const ok = window.confirm('确定删除今日的心情小结吗？此操作不可恢复。')
    if (!ok) return
    setBusy(true)
    setSaveHint(null)
    try {
      await handleDeleteEntry(todayEntry.id)
      setSaveHint('已删除今日记录。')
    } finally {
      setBusy(false)
    }
  }

  async function handleSubmitToday() {
    if (!settings.dailyMoodEnabled) {
      setSaveHint('请先在设置中开启「今日心情」。')
      return
    }
    setBusy(true)
    setSaveHint(null)
    setMediaError(null)
    try {
      await upsertMoodJournalEntry({
        dayKey: localDayKey(),
        moodLevel: EMOTION_LABEL_TO_MOOD_LEVEL[moodLabel],
        moodLabel,
        note,
        attachments,
      })
      setSaveHint('已记下今天的心情。')
      await refresh()
    } catch {
      setSaveHint('提交失败，请稍后再试。')
    } finally {
      setBusy(false)
    }
  }

  const historyCount = entries.length

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      <div className="sk-segmented shrink-0">
        <button
          type="button"
          className={`sk-segmented-btn ${emotionMoodTab === 'moment' ? 'sk-segmented-btn-active' : ''}`}
          onClick={() => onEmotionMoodTabChange('moment')}
        >
          此刻
        </button>
        <button
          type="button"
          className={`sk-segmented-btn ${emotionMoodTab === 'summary' ? 'sk-segmented-btn-active' : ''}`}
          onClick={() => onEmotionMoodTabChange('summary')}
        >
          今日小结
        </button>
      </div>

      {emotionMoodTab === 'moment' ? (
        <div className="flex min-h-0 flex-1 flex-col gap-1">
          <p className="sk-body-sm leading-snug text-[color:var(--sk-text-muted)]">
            点选此刻感受，会记入趋势并换一句更贴近你状态的陪伴话。
          </p>
          <EmotionQuickFeedback
            onSelect={async (label) => {
              const kind = emotionCnLabelToKind(label)
              if (!kind) return
              const next = await appendEmotion({
                id: `emotion-${Date.now()}`,
                emotion: kind,
                createdAt: new Date().toISOString(),
              })
              setEmotionRecords(next.emotion.records)
              void requestCompanionText(undefined, kind)
            }}
          />
          <div className="shrink-0 overflow-hidden rounded-xl border border-slate-200">
            <Suspense
              fallback={
                <section className="flex flex-col px-2 py-1.5" aria-busy="true">
                  <p className="mb-1 h-4 w-24 animate-pulse rounded bg-slate-100" aria-hidden />
                  <div
                    className="shrink-0 rounded-lg bg-slate-50/90"
                    style={{ height: 260 }}
                    aria-hidden
                  />
                </section>
              }
            >
              <EmotionTrendChart records={emotionRecords} />
            </Suspense>
          </div>
        </div>
      ) : summaryView === 'history' ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
            <h3 className="text-sm font-medium text-slate-800">历史记录</h3>
            <button
              type="button"
              className="rounded-full border border-violet-200 px-3 py-1 text-sm text-violet-700 hover:bg-violet-50"
              onClick={() => setSummaryView('form')}
            >
              返回填写
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <MoodHistoryPanel
              entries={entries}
              onDeleteEntry={handleDeleteEntry}
            />
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto">
          {!settings.dailyMoodEnabled ? (
            <p className="sk-body-sm text-amber-700">
              当前未开启「今日心情」。请到设置 → 推送与打扰中打开总开关与提醒。
            </p>
          ) : null}
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="sk-body-sm min-w-0 flex-1 text-[color:var(--sk-text-muted)]">
              一天一记：选今日整体心情，可写日记并添加图片或短视频。
            </p>
            <button
              type="button"
              className="shrink-0 rounded-full border border-violet-300 bg-violet-50 px-3 py-1 text-sm font-medium text-violet-800 hover:bg-violet-100"
              onClick={() => setSummaryView('history')}
            >
              查看历史
              {historyCount > 0 ? `（${historyCount}）` : ''}
            </button>
          </div>
          <section className="rounded-xl">
            <h3 className="mb-3 text-sm font-medium">今天的整体心情是？</h3>
            <div className="flex flex-wrap gap-2">
              {EMOTION_CHIP_LABELS.map((label) => {
                const active = moodLabel === label
                return (
                  <button
                    key={label}
                    type="button"
                    disabled={busy}
                    onClick={() => setMoodLabel(label)}
                    className={emotionChipButtonClass(active)}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </section>
          <label className="grid gap-1">
            <span className="sk-label">日记</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              maxLength={2000}
              disabled={busy}
              placeholder="今天发生了什么、想对自己说什么…"
              className="sk-input min-h-[6rem] resize-y"
            />
          </label>
          <MoodSummaryMediaPicker
            attachments={attachments}
            onChange={setAttachments}
            disabled={busy}
            onError={setMediaError}
          />
          {mediaError ? (
            <p className="text-xs text-amber-700" role="alert">
              {mediaError}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSubmitToday()}
              className="min-w-[7.5rem] rounded-full border border-violet-600 bg-violet-600 px-8 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
            >
              确定
            </button>
            {todayEntry ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleDeleteToday()}
                className="rounded-full border border-rose-200 px-4 py-1.5 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50"
              >
                删除今日记录
              </button>
            ) : null}
            {saveHint ? (
              <span className="text-xs text-slate-500">{saveHint}</span>
            ) : null}
            {todayEntry ? (
              <span className="text-xs text-slate-400">
                今日已有一条记录，再次点击将覆盖更新
              </span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

