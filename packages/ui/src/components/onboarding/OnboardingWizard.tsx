import { useMemo, useState } from 'react'
import type { AvatarPreset, CompanionCopyStyle } from '@sidekick/core'
import { AvatarPresetGallery } from '../skinning/AvatarPresetGallery'
import { COMPANION_INTEREST_TAG_OPTIONS } from '../../constants/companionInterestTags'
import { defaultSettings } from '../../state/settingsState'

type OnboardingStep = 'avatar' | 'copy' | 'interests' | 'finish'

const STEPS: Array<{ id: OnboardingStep; label: string }> = [
  { id: 'avatar', label: '形象' },
  { id: 'copy', label: '文案类型' },
  { id: 'interests', label: '兴趣（可选）' },
  { id: 'finish', label: '完成' },
]

const STYLE_OPTIONS: CompanionCopyStyle[] = [
  '治愈',
  '励志',
  '搞笑',
  '助眠',
  '职场解压',
]

const INTEREST_PRESETS = COMPANION_INTEREST_TAG_OPTIONS

export type OnboardingWizardProps = {
  presets: AvatarPreset[]
  initialAvatarId: string
  initialTextStyle: CompanionCopyStyle
  initialInterests: string[]
  onComplete: (payload: {
    selectedAvatarId: string
    textStyle: CompanionCopyStyle
    companionInterests: string[]
  }) => void | Promise<void>
}

export function OnboardingWizard({
  presets,
  initialAvatarId,
  initialTextStyle,
  initialInterests,
  onComplete,
}: OnboardingWizardProps) {
  const [step, setStep] = useState<OnboardingStep>('avatar')
  const [selectedAvatarId, setSelectedAvatarId] = useState(initialAvatarId)
  const [textStyle, setTextStyle] = useState<CompanionCopyStyle>(initialTextStyle)
  const [tags, setTags] = useState<Set<string>>(() => new Set(initialInterests))
  const [interestNote, setInterestNote] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const stepIndex = useMemo(
    () => STEPS.findIndex((s) => s.id === step),
    [step],
  )

  const toggleTag = (t: string) => {
    setTags((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  const goNext = () => {
    const i = stepIndex
    if (i < STEPS.length - 1) setStep(STEPS[i + 1]!.id)
  }

  const goPrev = () => {
    const i = stepIndex
    if (i > 0) setStep(STEPS[i - 1]!.id)
  }

  const buildInterests = (): string[] => {
    const base = [...tags]
    const note = interestNote.replace(/\s+/g, ' ').trim()
    if (note) base.push(`补充：${note}`)
    return base
  }

  const handleFinish = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await onComplete({
        selectedAvatarId,
        textStyle,
        companionInterests: buildInterests(),
      })
    } finally {
      setSubmitting(false)
    }
  }

  const skipButtonClass =
    'rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:border-violet-300 hover:bg-violet-50/60 hover:text-violet-800 disabled:opacity-50'

  const handleSkipDefaults = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const defaultAvatarId =
        presets[0]?.id ??
        presets.find((p) => p.id === initialAvatarId)?.id ??
        initialAvatarId
      await onComplete({
        selectedAvatarId: defaultAvatarId,
        textStyle: defaultSettings.textStyle,
        companionInterests: [],
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid h-full min-h-0 w-full grid-cols-[140px_1fr] gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-lg sm:grid-cols-[160px_1fr] sm:gap-4 sm:p-4">
      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-xl bg-slate-50 p-1.5 sm:p-2">
        <div className="min-h-0 flex-1">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              className={`mb-1 w-full rounded-lg px-2 py-1.5 text-left text-xs sm:px-3 sm:py-2 sm:text-sm ${
                step === s.id ? 'bg-white shadow-sm' : 'text-slate-600'
              }`}
              onClick={() => setStep(s.id)}
            >
              {i + 1}. {s.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="min-h-0 overflow-y-auto rounded-xl border border-slate-100 p-3 sm:p-4">
        {step === 'avatar' && (
          <div className="grid gap-3 text-sm">
            <p className="font-medium text-slate-800">选择陪伴形象</p>
            {/* 说明文案已按产品要求暂时注释
            <p className="text-xs leading-relaxed text-slate-600">
              选好后才会在桌面显示精灵；之后可在菜单「换肤」里随时更换。
            </p>
            */}
            <AvatarPresetGallery
              sectionTitle="默认形象"
              presets={presets.filter((p) => p.source === 'builtin')}
              selectedAvatarId={selectedAvatarId}
              onSelect={setSelectedAvatarId}
            />
            <AvatarPresetGallery
              sectionTitle="自定义形象"
              presets={presets.filter(
                (p) => p.source === 'upload' || p.source === 'generated',
              )}
              selectedAvatarId={selectedAvatarId}
              onSelect={setSelectedAvatarId}
              emptyHint="暂无自定义形象；在换肤中上传后会显示在此处。"
              orderedSlotDisplayNames
            />
            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleSkipDefaults()}
                className={skipButtonClass}
              >
                跳过，使用默认
              </button>
              <button
                type="button"
                className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 sm:text-sm"
                onClick={goNext}
              >
                下一步
              </button>
            </div>
          </div>
        )}

        {step === 'copy' && (
          <div className="grid gap-3 text-sm">
            <p className="font-medium text-slate-800">文案类型</p>
            {/* <p className="text-xs leading-relaxed text-slate-600">
              决定日常推送与点精灵时的语气走向；之后可在「设置 → 文案展示」里修改。
            </p> */}
            <label className="grid gap-1">
              <span className="text-slate-700">语气类型</span>
              <select
                value={textStyle}
                onChange={(e) =>
                  setTextStyle(e.target.value as CompanionCopyStyle)
                }
                className="rounded-lg border border-slate-200 px-2 py-2 text-slate-800"
              >
                {STYLE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                onClick={goPrev}
              >
                上一步
              </button>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleSkipDefaults()}
                  className={skipButtonClass}
                >
                  跳过，使用默认
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
                  onClick={goNext}
                >
                  下一步
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'interests' && (
          <div className="grid gap-3 text-sm">
            <p className="font-medium text-slate-800">兴趣（可选）</p>
            {/*
              所选兴趣会并入通义千问（DashScope）system 提示，见 packages/core 内 buildCompanionSystemPrompt / generateCompanionCopy。
              原说明段：若填写，生成陪伴句时会轻微参考你的偏好……
            */}
            <div className="flex flex-wrap gap-1.5">
              {INTEREST_PRESETS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleTag(t)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    tags.has(t)
                      ? 'border-violet-400 bg-violet-50 text-violet-800'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <label className="grid gap-1">
              <span className="text-slate-700">补充一句（可选）</span>
              <textarea
                value={interestNote}
                onChange={(e) => setInterestNote(e.target.value)}
                rows={2}
                maxLength={120}
                placeholder=""
                className="resize-none rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-800 placeholder:text-slate-400"
              />
            </label>
            {/* 原 placeholder：例如：最近在听周杰伦、重温《星际穿越》 */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                onClick={goPrev}
              >
                上一步
              </button>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleSkipDefaults()}
                  className={skipButtonClass}
                >
                  跳过，使用默认
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700"
                  onClick={goNext}
                >
                  下一步
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'finish' && (
          <div className="grid gap-3 text-sm">
            <p className="font-medium text-slate-800">开始使用</p>
            {/* 确认前摘要列表与说明已暂时注释
            <ul className="list-inside list-disc text-xs text-slate-600">
              <li>
                形象：
                <span className="font-medium text-slate-800">
                  {presets.find((p) => p.id === selectedAvatarId)?.name ?? '—'}
                </span>
              </li>
              <li>
                文案类型：<span className="font-medium text-slate-800">{textStyle}</span>
              </li>
              <li>
                兴趣：
                <span className="font-medium text-slate-800">
                  {buildInterests().length ? buildInterests().join('、') : '未填写'}
                </span>
              </li>
            </ul>
            <p className="text-xs text-slate-500">
              确认后将保存选择并显示桌面精灵；推送与点精灵将按上述偏好工作。
            </p>
            */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                onClick={goPrev}
              >
                上一步
              </button>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleSkipDefaults()}
                  className={skipButtonClass}
                >
                  跳过，使用默认
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  className="rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                  onClick={() => void handleFinish()}
                >
                  {submitting ? '保存中…' : '完成并显示精灵'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
