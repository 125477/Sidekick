import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
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
import {
  fetchMoodJournalGuideQuestions,
  fetchMoodJournalPolish,
} from '../../app/moodJournalAgent'
import type { FetchCompanionCopyOptions } from '../../app/companionCopy'
import {
  formatJournalClosureMoment,
  formatStreakMoment,
} from '../../app/companionProactivePush'
import {
  computeMoodJournalStreak,
  shouldStreakNudgeAfterSave,
} from '../../app/moodJournalStreak'
import {
  canFireStreakNudge,
  markStreakNudgeFired,
} from '../../state/companionProactiveStorage'
import {
  loadMoodJournalGuideForDay,
  saveMoodJournalGuideForDay,
} from '../../state/moodJournalGuideStorage'
import { IconToolbarRefresh } from '../toast/EmotionToastToolbarIcons'

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
  pushProactiveCompanion?: (
    fetchOptions: FetchCompanionCopyOptions,
  ) => Promise<string | null>
}

type SummarySubview = 'form' | 'history'

export function DailyMoodPanel({
  emotionMoodTab,
  onEmotionMoodTabChange,
  settings,
  emotionRecords,
  setEmotionRecords,
  requestCompanionText,
  pushProactiveCompanion,
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
  const [guideQuestions, setGuideQuestions] = useState<string[] | null>(null)
  const [guideBusy, setGuideBusy] = useState(false)
  const [polishBusy, setPolishBusy] = useState(false)
  const [aiHint, setAiHint] = useState<string | null>(null)
  const guideEnsuredDayRef = useRef<string | null>(null)
  const guideFetchGenRef = useRef(0)

  const noteTrimmed = note.replace(/\s+/g, ' ').trim()
  const polishDisabled =
    busy || guideBusy || polishBusy || !noteTrimmed || !settings.dailyMoodEnabled

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

  const fetchGuideQuestions = useCallback(
    async (options?: { force?: boolean }) => {
      if (!settings.dailyMoodEnabled || guideBusy || busy) return
      const day = localDayKey()
      if (!options?.force) {
        const cached = loadMoodJournalGuideForDay(day)
        if (cached?.length) {
          setGuideQuestions(cached)
          guideEnsuredDayRef.current = day
          return
        }
      }
      const gen = ++guideFetchGenRef.current
      setGuideBusy(true)
      setAiHint(null)
      try {
        const result = await fetchMoodJournalGuideQuestions(settings, {
          moodLabel,
          noteDraft: note,
        })
        if (gen !== guideFetchGenRef.current) return
        setGuideQuestions(result.questions)
        saveMoodJournalGuideForDay(result.questions, moodLabel, day)
        guideEnsuredDayRef.current = day
        if (result.source === 'local') {
          setAiHint('未配置 API 或智能体，已显示本地引导问题。')
        }
      } catch {
        if (gen !== guideFetchGenRef.current) return
        setAiHint('引导问题生成失败，请稍后再试。')
        if (options?.force) setGuideQuestions(null)
      } finally {
        if (gen === guideFetchGenRef.current) setGuideBusy(false)
      }
    },
    [settings, moodLabel, note, guideBusy, busy],
  )

  useEffect(() => {
    if (emotionMoodTab !== 'summary' || !settings.dailyMoodEnabled) return
    if (summaryView !== 'form') return
    const day = localDayKey()
    if (guideEnsuredDayRef.current === day) return
    const cached = loadMoodJournalGuideForDay(day)
    if (cached?.length) {
      setGuideQuestions(cached)
      guideEnsuredDayRef.current = day
      return
    }
    void fetchGuideQuestions()
  }, [
    emotionMoodTab,
    settings.dailyMoodEnabled,
    summaryView,
    fetchGuideQuestions,
  ])

  useEffect(() => {
    if (emotionMoodTab !== 'summary') {
      guideEnsuredDayRef.current = null
    }
  }, [emotionMoodTab])

  async function handlePolishNote() {
    if (!settings.dailyMoodEnabled || polishBusy || busy || !noteTrimmed) return
    const draft = noteTrimmed
    setPolishBusy(true)
    setAiHint(null)
    try {
      const result = await fetchMoodJournalPolish({ moodLabel, noteDraft: note })
      setNote(result.text)
      if (result.source === 'local' && result.text === draft) {
        setAiHint('润色需要配置 VITE_BAILIAN_MOOD_POLISH_APP_ID 或 API Key。')
      }
    } catch {
      setAiHint('润色失败，请稍后再试。')
    } finally {
      setPolishBusy(false)
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
      const list = await listMoodJournalEntries()
      setEntries(list)
      const t = await getMoodEntryForDay(localDayKey())
      setTodayEntry(t)
      if (pushProactiveCompanion) {
        void pushProactiveCompanion({
          trigger: 'journal-closure',
          momentContextText: formatJournalClosureMoment(moodLabel, note),
        })
        const streak = computeMoodJournalStreak(list)
        if (
          shouldStreakNudgeAfterSave(streak) &&
          (await canFireStreakNudge())
        ) {
          void (async () => {
            const line = await pushProactiveCompanion({
              trigger: 'streak-nudge',
              momentContextText: formatStreakMoment(streak.current),
            })
            if (line) await markStreakNudgeFired()
          })()
        }
      }
    } catch {
      setSaveHint('提交失败，请稍后再试。')
    } finally {
      setBusy(false)
    }
  }

  const historyCount = entries.length

  return (
    <div className="sk-emotion-page">
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
        <div className="flex min-h-0 flex-1 flex-col gap-[var(--sk-emotion-section-gap)]">
          <div className="sk-emotion-intro-stack">
            <p className="sk-emotion-lead">
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
          </div>
          <div className="sk-emotion-surface shrink-0 overflow-hidden">
            <Suspense
              fallback={
                <section className="flex flex-col px-2 py-1.5" aria-busy="true">
                  <p
                    className="mb-1 h-4 w-24 animate-pulse rounded border border-[color:var(--sk-callout-border)]"
                    aria-hidden
                  />
                  <div
                    className="sk-emotion-trend-chart shrink-0 rounded-lg"
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
        <div className="sk-emotion-history-shell min-h-0 flex-1">
          <div className="sk-emotion-history-head shrink-0">
            <h3 className="sk-emotion-heading mb-0">历史记录</h3>
            <button
              type="button"
              className="sk-emotion-link"
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
        <div className="sk-emotion-panel-stack">
          {!settings.dailyMoodEnabled ? (
            <p
              className="sk-body-sm rounded-[var(--sk-radius-md)] border border-[color:var(--sk-callout-border)] px-3 py-2 text-[color:var(--sk-accent-on-subtle)]"
              role="status"
            >
              当前未开启「今日心情」。请到设置 → 推送与打扰中打开总开关与提醒。
            </p>
          ) : null}

          <div className="sk-emotion-intro-stack">
            <div className="sk-emotion-topbar">
              <p className="sk-emotion-lead">一天一记 · 选心情、写几句、可附图</p>
              <button
                type="button"
                className="sk-emotion-link"
                onClick={() => setSummaryView('history')}
              >
                查看历史{historyCount > 0 ? `（${historyCount}）` : ''}
              </button>
            </div>

            <div className="sk-emotion-block">
              <h3 className="sk-emotion-heading">今天的整体心情</h3>
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
            </div>
          </div>

          {guideBusy && !guideQuestions?.length ? (
            <div className="sk-emotion-loading" aria-busy="true">
              <span
                className="h-4 w-4 shrink-0 rounded-full border-2 border-[color:var(--sk-accent)] border-t-transparent motion-safe:animate-spin motion-reduce:animate-pulse motion-reduce:border-t-current"
                aria-hidden
              />
              正在准备写日记引导…
            </div>
          ) : null}

          {guideQuestions?.length ? (
            <aside className="sk-emotion-inspiration" aria-label="写日记引导">
              <div className="sk-emotion-inspiration-head">
                <span className="sk-emotion-inspiration-title">可以这样写</span>
                <button
                  type="button"
                  disabled={busy || guideBusy || polishBusy}
                  onClick={() => void fetchGuideQuestions({ force: true })}
                  className="sk-btn-primary inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-xs transition-colors duration-200 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50"
                  title="换一批引导问题"
                  aria-label="换一批引导问题"
                >
                  <IconToolbarRefresh className="h-3.5 w-3.5 shrink-0" />
                  {guideBusy ? '生成中…' : '换一批'}
                </button>
              </div>
              <ol className="sk-emotion-inspiration-list">
                {guideQuestions.map((q, i) => (
                  <li key={`${i}-${q.slice(0, 12)}`} className="sk-emotion-inspiration-item">
                    <span className="sk-emotion-inspiration-num" aria-hidden>
                      {i + 1}.
                    </span>
                    <span>{q}</span>
                  </li>
                ))}
              </ol>
            </aside>
          ) : null}

          <div className="sk-emotion-composer">
            <div className="sk-emotion-composer-head">
              <span className="sk-emotion-composer-title">写下今天</span>
              <button
                type="button"
                disabled={polishDisabled}
                onClick={() => void handlePolishNote()}
                className="sk-emotion-chip-outline-btn cursor-pointer text-xs disabled:cursor-not-allowed disabled:opacity-40"
                title={noteTrimmed ? '润色正文' : '先写几句再润色'}
              >
                {polishBusy ? '润色中…' : '润色'}
              </button>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={6}
              maxLength={2000}
              disabled={busy || polishBusy}
              placeholder="今天发生了什么、想对自己说什么…"
              className="sk-emotion-textarea"
              aria-label="今日日记正文"
            />
            {aiHint ? (
              <p className="sk-emotion-composer-hint" role="status">
                {aiHint}
              </p>
            ) : null}
            <div className="sk-emotion-composer-media">
              <MoodSummaryMediaPicker
                embedded
                attachments={attachments}
                onChange={setAttachments}
                disabled={busy}
                onError={setMediaError}
              />
              {mediaError ? (
                <p className="mt-2 text-xs text-[color:var(--sk-accent-on-subtle)]" role="alert">
                  {mediaError}
                </p>
              ) : null}
            </div>
          </div>

          <div className="sk-emotion-actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSubmitToday()}
              className="sk-btn-primary sk-emotion-submit cursor-pointer rounded-full px-8 text-sm font-medium transition-colors duration-200 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              确定
            </button>
            {todayEntry ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleDeleteToday()}
                className="sk-emotion-chip-outline-btn cursor-pointer text-sm text-[color:var(--sk-text-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                删除今日记录
              </button>
            ) : null}
            {saveHint ? (
              <span className="sk-muted text-xs" role="status">
                {saveHint}
              </span>
            ) : null}
            {todayEntry ? (
              <span className="sk-muted text-xs opacity-80">
                再次保存将覆盖今日记录
              </span>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

