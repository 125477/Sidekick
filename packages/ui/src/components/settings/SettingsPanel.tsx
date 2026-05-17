import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { CompanionCopyStyle } from '@sidekick/core'
import { APP_DISPLAY_NAME } from '../../constants/brand'
import { PanelBackgroundPicker } from '../panel/PanelBackgroundPicker'
import { defaultSettings, type SidekickSettings } from '../../state/settingsState'
import {
  COMPANION_INTEREST_TAG_OPTIONS,
  buildCompanionInterestsPayload,
  parseCompanionInterestNote,
} from '../../constants/companionInterestTags'

/**
 * Qwen3-TTS-Flash 系统音色：`id` 为接口必填英文名；`label` 仅作界面展示（中文说明）。
 */
const QWEN_TTS_VOICES: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'Cherry', label: 'Cherry（芊悦）· 女｜阳光、亲切自然' },
  { id: 'Serena', label: 'Serena（苏瑶）· 女｜温柔舒缓' },
  { id: 'Chelsie', label: 'Chelsie（千雪）· 女｜甜系、偏二次元' },
  { id: 'Momo', label: 'Momo（茉兔）· 女｜活泼搞怪' },
  { id: 'Vivian', label: 'Vivian（十三）· 女｜俏皮、小暴躁感' },
  { id: 'Maia', label: 'Maia（四月）· 女｜知性温柔' },
  { id: 'Bella', label: 'Bella（萌宝）· 女｜萝莉感' },
  { id: 'Jennifer', label: 'Jennifer（詹妮弗）· 女｜偏美语、质感女声' },
  { id: 'Katerina', label: 'Katerina（卡捷琳娜）· 女｜御姐、韵律感' },
  { id: 'Ethan', label: 'Ethan（晨煦）· 男｜标准普通话、阳光温暖' },
  { id: 'Moon', label: 'Moon（月白）· 男｜清爽帅气' },
  { id: 'Kai', label: 'Kai（凯）· 男｜干净、松弛' },
  { id: 'Nofish', label: 'Nofish（不吃鱼）· 男｜平实、偏设计师口吻' },
  { id: 'Ryan', label: 'Ryan（甜茶）· 男｜节奏强、戏感' },
  { id: 'Aiden', label: 'Aiden（艾登）· 男｜美语、偏大男孩' },
  { id: 'Dylan', label: 'Dylan · 男｜年轻、清爽' },
  { id: 'Sunny', label: 'Sunny · 女｜明亮、轻快' },
  { id: 'Luna', label: 'Luna · 女｜柔和、安静' },
  { id: 'Jada', label: 'Jada · 女｜沉稳、利落' },
]

const QWEN_VOICE_MANUAL = '__manual__'

const qwenPresetSet = new Set(QWEN_TTS_VOICES.map((v) => v.id))

const COPY_STYLE_OPTIONS: CompanionCopyStyle[] = [
  '治愈',
  '励志',
  '搞笑',
  '助眠',
  '职场解压',
]

type SettingsPanelProps = {
  settings: SidekickSettings
  onSettingsChange: (next: SidekickSettings) => void
  imageGenRemaining?: number
  onRestoreDefaults: () => void
  /** 桌面端打开独立引导窗；纯 Web 则切回全屏引导。 */
  onOpenFirstRunGuide?: () => void
  /** 以 intro 气泡重温产品介绍。 */
  onReplayAppIntro?: () => void
  /** 重复点击当前已选中的「气泡位置」分段时触发，用于预览气泡短暂退场再进场；切换另一项时不要调用（避免多余整组件 remount）。 */
  onToastAnchorInteraction?: (anchor: SidekickSettings['toastAnchor']) => void
}

type SettingTab = 'push' | 'copy' | 'speech' | 'avatar' | 'ai' | 'general'

/** 侧栏顺序：按日常使用频率（文案与形象 → 推送 → 通用 → 进阶）。 */
const TABS: Array<{ id: SettingTab; label: string }> = [
  { id: 'copy', label: '文案展示' },
  { id: 'avatar', label: '形象' },
  { id: 'push', label: '推送' },
  { id: 'general', label: '通用' },
  { id: 'speech', label: '语音' },
  { id: 'ai', label: 'AI' },
]

function openTimePicker(input: HTMLInputElement) {
  if (typeof input.showPicker === 'function') {
    try {
      void input.showPicker()
    } catch {
      /* 非用户手势或浏览器不支持时忽略 */
    }
  }
}

type SettingsTimeFieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

function SettingsTabHeading({ children }: { children: ReactNode }) {
  return (
    <header className="sk-settings-page-heading">
      <h2 className="sk-settings-page-heading-title">{children}</h2>
    </header>
  )
}

function SettingsSubsection({
  title,
  children,
}: {
  /** 省略时不显示分组标题，仅保留卡片容器。 */
  title?: string
  children: ReactNode
}) {
  const showTitle = Boolean(title?.trim())
  return (
    <section
      className={`sk-settings-card ${showTitle ? 'sk-settings-card--titled' : ''}`}
    >
      {showTitle ? (
        <h3 className="sk-settings-card-title">
          {title}
        </h3>
      ) : null}
      <div className="sk-settings-card-body">{children}</div>
    </section>
  )
}

type SettingsSwitchProps = {
  id: string
  checked: boolean
  onCheckedChange: (next: boolean) => void
  'aria-labelledby'?: string
  disabled?: boolean
}

function SettingsSwitch({
  id,
  checked,
  onCheckedChange,
  'aria-labelledby': ariaLabelledBy,
  disabled = false,
}: SettingsSwitchProps) {
  return (
    <label htmlFor={id} className={`sk-switch ${disabled ? 'pointer-events-none' : ''}`}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onCheckedChange(event.target.checked)}
        aria-checked={checked}
        aria-labelledby={ariaLabelledBy}
        className="sr-only"
      />
      <span aria-hidden className="sk-switch-track" />
      <span aria-hidden className="sk-switch-thumb" />
    </label>
  )
}

function SettingsSwitchRow({
  id,
  labelId,
  label,
  checked,
  onCheckedChange,
  disabled = false,
}: {
  id: string
  labelId: string
  label: string
  checked: boolean
  onCheckedChange: (next: boolean) => void
  disabled?: boolean
}) {
  return (
    <div
      className={`sk-settings-row ${disabled ? 'opacity-50' : ''}`}
      aria-disabled={disabled || undefined}
    >
      <span id={labelId} className="sk-settings-row-label">
        {label}
      </span>
      <SettingsSwitch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-labelledby={labelId}
        disabled={disabled}
      />
    </div>
  )
}

/** 整框（含标签、边框区域）点击均可弹出系统时间选择器（Chromium 常仅图标可点）。 */
function SettingsTimeField({
  id,
  label,
  value,
  onChange,
  disabled = false,
}: SettingsTimeFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleOpen = () => {
    if (disabled) return
    const el = inputRef.current
    if (!el) return
    el.focus()
    openTimePicker(el)
  }

  return (
    <div className={`grid gap-1 ${disabled ? 'sk-time-stack-muted' : ''}`}>
      <label
        htmlFor={id}
        className={`sk-label select-none ${disabled ? 'sk-label-disabled' : 'cursor-pointer'}`}
        onClick={() => {
          if (disabled) return
          window.requestAnimationFrame(() => {
            const el = inputRef.current
            if (!el) return
            el.focus()
            openTimePicker(el)
          })
        }}
      >
        {label}
      </label>
      <div
        className={`sk-time-shell ${disabled ? 'sk-time-shell-disabled' : ''}`}
        onClick={handleOpen}
        aria-disabled={disabled || undefined}
      >
        <input
          ref={inputRef}
          id={id}
          type="time"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="sk-time-input"
        />
      </div>
    </div>
  )
}

export function SettingsPanel({
  settings,
  onSettingsChange,
  imageGenRemaining,
  onRestoreDefaults,
  onOpenFirstRunGuide,
  onReplayAppIntro,
  onToastAnchorInteraction,
}: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingTab>('copy')

  useEffect(() => {
    const label = TABS.find((t) => t.id === activeTab)?.label ?? '设置'
    document.title = label
    return () => {
      document.title = APP_DISPLAY_NAME
    }
  }, [activeTab])

  const update = <K extends keyof SidekickSettings>(
    key: K,
    value: SidekickSettings[K],
  ) => {
    onSettingsChange({ ...settings, [key]: value })
  }

  return (
    <div className="sk-settings-layout">
      <nav className="sk-settings-nav">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`sk-settings-nav-btn ${activeTab === tab.id ? 'sk-settings-nav-btn-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="sk-settings-content">
        {activeTab === 'push' && (
          <div className="grid gap-4 text-sm text-[var(--sk-text-body)]">
            <SettingsTabHeading>推送设置</SettingsTabHeading>

            <SettingsSubsection title="定时与频率">
              <SettingsSwitchRow
                id="settings-push-enabled"
                labelId="settings-push-enabled-lbl"
                label="推送文案"
                checked={settings.pushEnabled}
                onCheckedChange={(v) => update('pushEnabled', v)}
              />
              <label className="grid gap-1">
                <span className="sk-label">间隔（分钟）</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={settings.pushIntervalMinutes}
                  onChange={(event) =>
                    update('pushIntervalMinutes', Number(event.target.value))
                  }
                  className="sk-input"
                />
              </label>
            </SettingsSubsection>

            <SettingsSubsection title="推送、勿扰与专注">
              <p className="sk-body-sm font-medium">允许推送</p>
              <div className="grid grid-cols-2 gap-2">
                <SettingsTimeField
                  id="sidekick-time-push-start"
                  label="开始"
                  value={settings.pushStart}
                  onChange={(v) => update('pushStart', v)}
                />
                <SettingsTimeField
                  id="sidekick-time-push-end"
                  label="结束"
                  value={settings.pushEnd}
                  onChange={(v) => update('pushEnd', v)}
                />
              </div>
              <div className="sk-divider" />
              <p className="sk-body-sm font-medium">专注模式</p>
              <label className="grid gap-1">
                <span className="sk-label">默认时长（分钟）</span>
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={settings.focusPresetMinutes}
                  onChange={(event) =>
                    update(
                      'focusPresetMinutes',
                      Math.min(180, Math.max(5, Number(event.target.value) || 25)),
                    )
                  }
                  className="sk-input"
                />
              </label>
              {settings.focusSessionUntilEpochMs != null &&
              Date.now() < settings.focusSessionUntilEpochMs ? (
                <p className="text-xs text-violet-700">
                  专注进行中，至{' '}
                  {new Date(settings.focusSessionUntilEpochMs).toLocaleTimeString(
                    'zh-CN',
                    { hour: '2-digit', minute: '2-digit' },
                  )}
                  ，期间暂停定时陪伴推送。
                </p>
              ) : (
                <p className="sk-muted text-xs">当前未在专注时段。</p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700"
                  onClick={() =>
                    onSettingsChange({
                      ...settings,
                      focusSessionUntilEpochMs:
                        Date.now() + settings.focusPresetMinutes * 60_000,
                    })
                  }
                >
                  开始专注
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() =>
                    onSettingsChange({
                      ...settings,
                      focusSessionUntilEpochMs: null,
                    })
                  }
                >
                  结束专注
                </button>
              </div>
              <p className="sk-muted text-xs leading-relaxed">
                专注是你主动开始的一段会话，期间暂停定时陪伴推送。
              </p>
              <div className="sk-divider" />
              <SettingsSwitchRow
                id="settings-quiet-enabled"
                labelId="settings-quiet-enabled-lbl"
                label="启用勿扰时段"
                checked={settings.quietHoursEnabled}
                onCheckedChange={(v) => update('quietHoursEnabled', v)}
              />
              <div className="grid grid-cols-2 gap-2">
                <SettingsTimeField
                  id="sidekick-time-quiet-start"
                  label="勿扰开始"
                  value={settings.quietStart}
                  onChange={(v) => update('quietStart', v)}
                  disabled={!settings.quietHoursEnabled}
                />
                <SettingsTimeField
                  id="sidekick-time-quiet-end"
                  label="勿扰结束"
                  value={settings.quietEnd}
                  onChange={(v) => update('quietEnd', v)}
                  disabled={!settings.quietHoursEnabled}
                />
              </div>
              <p className="sk-muted text-xs leading-relaxed">
                勿扰按每天重复的时段生效，可与专注模式同时配置。
              </p>
              <div className="sk-divider" />
              <p className="sk-body-sm font-medium">今日心情</p>
              <SettingsSwitchRow
                id="settings-daily-mood-enabled"
                labelId="settings-daily-mood-enabled-lbl"
                label="启用今日心情（小结与本地日记）"
                checked={settings.dailyMoodEnabled}
                onCheckedChange={(v) => update('dailyMoodEnabled', v)}
              />
              <SettingsSwitchRow
                id="settings-daily-mood-reminder"
                labelId="settings-daily-mood-reminder-lbl"
                label="到点系统通知提醒"
                checked={settings.dailyMoodReminderEnabled}
                onCheckedChange={(v) => update('dailyMoodReminderEnabled', v)}
                disabled={!settings.dailyMoodEnabled}
              />
              <SettingsTimeField
                id="sidekick-daily-mood-reminder"
                label="提醒时间"
                value={settings.dailyMoodReminderTime}
                onChange={(v) => update('dailyMoodReminderTime', v)}
                disabled={
                  !settings.dailyMoodEnabled || !settings.dailyMoodReminderEnabled
                }
              />
              <p className="sk-muted text-xs leading-relaxed">
                通知点击会打开情绪反馈并定位到「今日小结」；记录仅存本机 IndexedDB。
              </p>
            </SettingsSubsection>

            <SettingsSubsection title="推送后形象">
              <SettingsSwitchRow
                id="settings-push-auto-avatar"
                labelId="settings-push-auto-avatar-lbl"
                label="推送后自动切换形象"
                checked={settings.pushAutoSwitchAvatar}
                onCheckedChange={(v) => update('pushAutoSwitchAvatar', v)}
              />
              <p className="sk-muted leading-relaxed">
                开启后，仅在推送
                新的陪伴句成功展示后
                才切换到下一形象
              </p>
            </SettingsSubsection>
          </div>
        )}

        {activeTab === 'copy' && (
          <div className="grid gap-4 text-sm text-[var(--sk-text-body)]">
            <SettingsTabHeading>文案展示</SettingsTabHeading>

            <SettingsSubsection title="语气类型">
              <p className="sk-muted leading-relaxed">
                决定推送与点精灵时的语气；与「情绪反馈」联动时仍以情绪优先。
              </p>
              <label className="grid gap-1">
                <span className="sk-label">语气类型</span>
                <select
                  value={settings.textStyle}
                  onChange={(event) =>
                    update(
                      'textStyle',
                      event.target.value as SidekickSettings['textStyle'],
                    )
                  }
                  className="sk-select"
                >
                  {COPY_STYLE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
            </SettingsSubsection>

            <SettingsSubsection title="停留与关闭">
              <SettingsSwitchRow
                id="settings-toast-always"
                labelId="settings-toast-always-lbl"
                label="一直显示（手动关闭）"
                checked={settings.toastAlwaysVisible}
                onCheckedChange={(v) => update('toastAlwaysVisible', v)}
              />
              <label
                className={`grid gap-1 ${settings.toastAlwaysVisible ? 'opacity-50' : ''}`}
              >
                <span className="sk-label">停留时长（秒）</span>
                <input
                  type="number"
                  min={60}
                  step={10}
                  value={settings.dwellSeconds}
                  onChange={(event) =>
                    update(
                      'dwellSeconds',
                      Math.max(
                        60,
                        Number(event.target.value) || defaultSettings.dwellSeconds,
                      ),
                    )
                  }
                  disabled={settings.toastAlwaysVisible}
                  aria-disabled={settings.toastAlwaysVisible}
                  className="sk-input disabled:cursor-not-allowed"
                />
              </label>
            </SettingsSubsection>

            <SettingsSubsection title="气泡位置">
              <div className="sk-segmented">
                <button
                  type="button"
                  className={`sk-segmented-btn ${settings.toastAnchor === 'top' ? 'sk-segmented-btn-active' : ''}`}
                  onClick={() => {
                    if (settings.toastAnchor === 'top') {
                      onToastAnchorInteraction?.('top')
                    }
                    update('toastAnchor', 'top')
                  }}
                >
                  从上方弹出
                </button>
                <button
                  type="button"
                  className={`sk-segmented-btn ${settings.toastAnchor === 'bottom' ? 'sk-segmented-btn-active' : ''}`}
                  onClick={() => {
                    if (settings.toastAnchor === 'bottom') {
                      onToastAnchorInteraction?.('bottom')
                    }
                    update('toastAnchor', 'bottom')
                  }}
                >
                  从下方弹出
                </button>
              </div>
            </SettingsSubsection>

            <SettingsSubsection title="兴趣偏好（可选）">
              <p className="sk-muted leading-relaxed">
                生成陪伴句时会轻微参考，不必每句都写兴趣本身。
              </p>
              <div className="flex flex-wrap gap-1.5">
                {COMPANION_INTEREST_TAG_OPTIONS.map((t) => {
                  const { tags, note } = parseCompanionInterestNote(
                    settings.companionInterests,
                  )
                  const on = tags.includes(t)
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        const nextTags = on
                          ? tags.filter((x) => x !== t)
                          : [...tags, t]
                        update(
                          'companionInterests',
                          buildCompanionInterestsPayload(nextTags, note),
                        )
                      }}
                      className={`sk-chip ${on ? 'sk-chip-active' : ''}`}
                    >
                      {t}
                    </button>
                  )
                })}
              </div>
              <label className="grid gap-1">
                <span className="sk-label">补充一句（可选）</span>
                <textarea
                  value={
                    parseCompanionInterestNote(settings.companionInterests).note
                  }
                  onChange={(event) => {
                    const { tags: tgs } = parseCompanionInterestNote(
                      settings.companionInterests,
                    )
                    update(
                      'companionInterests',
                      buildCompanionInterestsPayload(tgs, event.target.value),
                    )
                  }}
                  rows={2}
                  maxLength={120}
                  placeholder="例如：最近在听爵士、重温某部电影"
                  className="sk-textarea resize-none"
                />
              </label>
            </SettingsSubsection>
          </div>
        )}

        {activeTab === 'speech' && (
          <div className="grid gap-4 text-sm text-[var(--sk-text-body)]">
            <SettingsTabHeading>语音播报</SettingsTabHeading>
            <SettingsSubsection title="播报开关">
              <SettingsSwitchRow
                id="settings-tts-enabled"
                labelId="settings-tts-enabled-lbl"
                label="生成后自动播报"
                checked={settings.companionTtsEnabled}
                onCheckedChange={(v) => update('companionTtsEnabled', v)}
              />
            </SettingsSubsection>
            <SettingsSubsection title="音色与语速">
              <label className="grid gap-1">
                <span className="sk-label">音色</span>
                <select
                  value={
                    qwenPresetSet.has(settings.companionTtsVoice.trim())
                      ? settings.companionTtsVoice.trim()
                      : QWEN_VOICE_MANUAL
                  }
                  onChange={(event) => {
                    const v = event.target.value
                    if (v === QWEN_VOICE_MANUAL) {
                      update('companionTtsVoice', '')
                    } else {
                      update('companionTtsVoice', v)
                    }
                  }}
                  className="sk-select max-w-full"
                >
                  {QWEN_TTS_VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                  <option value={QWEN_VOICE_MANUAL}>
                    其他（手动输入英文 id）
                  </option>
                </select>
              </label>
              {!qwenPresetSet.has(settings.companionTtsVoice.trim()) ? (
                <label className="grid gap-1">
                  <span className="sk-label">自定义英文 id</span>
                  <input
                    type="text"
                    value={settings.companionTtsVoice}
                    onChange={(event) =>
                      update('companionTtsVoice', event.target.value)
                    }
                    placeholder="与文档一致，区分大小写"
                    className="sk-input"
                  />
                </label>
              ) : null}
              <label className="grid gap-1">
                <span className="sk-label">语速（0.5～2）</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0.5}
                    max={2}
                    step={0.05}
                    value={settings.companionTtsSpeechRate}
                    onChange={(event) =>
                      update('companionTtsSpeechRate', Number(event.target.value))
                    }
                    className="sk-range min-w-0 flex-1"
                  />
                  <span className="sk-tabular-nums-muted">
                    {settings.companionTtsSpeechRate.toFixed(2)}
                  </span>
                </div>
              </label>
            </SettingsSubsection>
          </div>
        )}

        {activeTab === 'avatar' && (
          <div className="grid gap-4 text-sm text-[var(--sk-text-body)]">
            <SettingsTabHeading>形象设置</SettingsTabHeading>
            <SettingsSubsection title="显示大小">
              <label className="grid gap-1">
                <span className="sk-label">大小（%）</span>
                <input
                  type="range"
                  min={60}
                  max={140}
                  value={settings.avatarSize}
                  onChange={(event) => update('avatarSize', Number(event.target.value))}
                  className="sk-range w-full"
                />
              </label>
              <label className="grid gap-1">
                <span className="sk-label">透明度（%）</span>
                <input
                  type="range"
                  min={40}
                  max={100}
                  value={settings.avatarOpacity}
                  onChange={(event) =>
                    update('avatarOpacity', Number(event.target.value))
                  }
                  className="sk-range w-full"
                />
              </label>
            </SettingsSubsection>
            <SettingsSubsection title="当前与额度">
              <p className="sk-body-sm">当前皮肤：默认皮肤 A</p>
              {imageGenRemaining !== undefined ? (
                <p className="sk-muted">剩余文生图次数：{imageGenRemaining}</p>
              ) : null}
            </SettingsSubsection>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="grid gap-4 text-sm text-[var(--sk-text-body)]">
            <SettingsTabHeading>AI 设置</SettingsTabHeading>
            <SettingsSubsection title="文案生成">
              <label className="grid gap-1">
                <span className="sk-label">
                  文案 temperature：{settings.textTemperature.toFixed(1)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={settings.textTemperature}
                  onChange={(event) =>
                    update('textTemperature', Number(event.target.value))
                  }
                  className="sk-range w-full"
                />
                <span className="sk-muted leading-relaxed">
                  用于生成气泡里的陪伴短句：越高措辞越多样、偶发更跳脱；越低越稳，句子之间会更像、变化少。
                </span>
              </label>
              <label className="grid gap-1">
                <span className="sk-label">文案最大字数</span>
                <input
                  type="number"
                  min={10}
                  max={60}
                  value={settings.textMaxChars}
                  onChange={(event) =>
                    update('textMaxChars', Number(event.target.value))
                  }
                  className="sk-input"
                />
              </label>
            </SettingsSubsection>
            <SettingsSubsection title="输出习惯">
              <div className="sk-settings-row">
                <div className="min-w-0 pr-2">
                  <span id="settings-allow-emoji-lbl" className="sk-settings-row-label">
                    允许表情符号
                  </span>
                  <p className="sk-muted mt-0.5 leading-relaxed">
                    关闭后会在提示里倾向让模型尽量不使用 Emoji。
                  </p>
                </div>
                <SettingsSwitch
                  id="settings-allow-emoji"
                  checked={settings.allowEmoji}
                  onCheckedChange={(v) => update('allowEmoji', v)}
                  aria-labelledby="settings-allow-emoji-lbl"
                />
              </div>
            </SettingsSubsection>
          </div>
        )}

        {activeTab === 'general' && (
          <div className="grid gap-4 text-sm text-[var(--sk-text-body)]">
            <SettingsTabHeading>通用设置</SettingsTabHeading>
            <PanelBackgroundPicker
              enabled={settings.panelBackgroundEnabled}
              onEnabledChange={(v) => update('panelBackgroundEnabled', v)}
              overlayOpacity={settings.panelBackgroundOverlayOpacity}
              onOverlayOpacityChange={(v) =>
                update('panelBackgroundOverlayOpacity', v)
              }
              imageOpacity={settings.panelBackgroundImageOpacity}
              onImageOpacityChange={(v) =>
                update('panelBackgroundImageOpacity', v)
              }
              blurPx={settings.panelBackgroundBlurPx}
              onBlurPxChange={(v) => update('panelBackgroundBlurPx', v)}
            />
            <SettingsSubsection title="外观与语言">
              <SettingsSwitchRow
                id="settings-dark-mode"
                labelId="settings-dark-mode-lbl"
                label="夜间模式"
                checked={settings.darkMode}
                onCheckedChange={(v) => update('darkMode', v)}
              />
              <label className="grid gap-1">
                <span className="sk-label">语言</span>
                <select
                  value={settings.language}
                  onChange={(event) =>
                    update('language', event.target.value as SidekickSettings['language'])
                  }
                  className="sk-select"
                >
                  <option value="zh-CN">中文</option>
                  <option value="en-US">English</option>
                </select>
              </label>
            </SettingsSubsection>
            {onOpenFirstRunGuide ? (
              <div className="sk-callout">
                <p className="sk-muted leading-relaxed">
                  首次引导仅在未标记完成时自动出现；可随时重新打开，修改形象、语气与兴趣偏好。
                </p>
                <button
                  type="button"
                  onClick={onOpenFirstRunGuide}
                  className="sk-callout-btn"
                >
                  重新打开首次引导
                </button>
              </div>
            ) : null}
            {onReplayAppIntro ? (
              <div className="sk-callout">
                <p className="sk-muted leading-relaxed">
                  在陪伴气泡中查看灵伴的功能介绍（与首次引导无关）。
                </p>
                <button
                  type="button"
                  onClick={onReplayAppIntro}
                  className="sk-callout-btn"
                >
                  重温产品介绍
                </button>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onRestoreDefaults}
                className="sk-btn-primary"
              >
                恢复默认
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
