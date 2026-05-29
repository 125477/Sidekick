import {
  requestDashScopeTextWithFallback,
  type DashScopeTextRequest,
} from '../clients/dashscopeTextClient'
import type { EmotionKind } from '../schema/data'
import { stripCompanionLineCornerQuotes } from '../prompts/companionOutputGate'
import {
  companionRegenerateLineFailsInterestQuoteMode,
  companionInterestTagsRequireQuote,
  pickCompanionInterestRegenerateLine,
} from '../fallback/companionInterestRegenerateLines'
import { companionRegenerateModelLineUnacceptable } from '../prompts/companionRegenerateGate'
import { companionLineEqualsArchetypeExemplar } from '../prompts/companionArchetypes'
import {
  buildRegenerateRetrySuffix,
  pickRegenerateStructuredFallback,
  shouldRetryRegenerateAgainstTarget,
} from './regenerateCompanionLine'
import {
  buildCompanionSystemPrompt,
  buildCompanionUserPromptWithInterests,
  buildCompanionTriggerContextLines,
  buildRegenerateChatSystemPrompt,
  buildRegenerateChatUserPrompt,
  companionStyleForEmotion,
  parseCompanionInterestTags,
  type CompanionCopyStyle,
  type CompanionCopyTrigger,
} from '../prompts/textPrompt'
import {
  logCompanionRegenerate,
  maskDashScopeApiKey,
} from '../debug/logCompanionRegenerate'
import { companionCopyStillBanned, refineCompanionCopyLine } from './companionCopyQualityPasses'
import { getCompanionText, type CompanionTextResult } from './getCompanionText'

export type GenerateCompanionCopyInput = {
  apiKey: string | undefined
  model: string | undefined
  style: CompanionCopyStyle
  keyword: string | undefined
  allowEmoji: boolean
  maxChars: number
  emotion?: EmotionKind
  avoidRecentOutputs?: string[]
  invokeDashScope?: (input: DashScopeTextRequest) => Promise<string>
  modelFallbackEnv?: string
  chatCompletionsUrl?: string
  companionInterests?: string[]
  companionLightFeedbackHints?: string[]
  trigger?: CompanionCopyTrigger
  yesterdayContextText?: string | null
  momentContextText?: string | null
  similarToLine?: string | null
  replaceTargetLine?: string
  seed?: number
  maxQualityRetries?: number
}

function stripEmojisFromText(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\uFE0F/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function finalizeCompanionText(
  text: string,
  maxChars: number,
  allowEmoji: boolean,
): string {
  const raw = allowEmoji ? text : stripEmojisFromText(text)
  const normalized = stripCompanionLineCornerQuotes(
    raw.replace(/\s+/g, ' ').trim(),
  )
  return normalized.length <= maxChars
    ? normalized
    : `${normalized.slice(0, Math.max(1, maxChars - 1))}…`
}

function isRegenerateChatTrigger(
  trigger: CompanionCopyTrigger | undefined,
): trigger is 'regenerate' | 'similar' {
  return trigger === 'regenerate' || trigger === 'similar'
}

/** 换句：略高 temperature + seed 抖动，避免同 prompt 骨架连刷同一句。 */
function regenerateChatTemperature(seed?: number): number {
  const jitter =
    seed != null
      ? (Math.abs(seed) % 15) / 100
      : Math.floor(Math.random() * 8) / 100
  return Math.min(0.97, 0.88 + jitter)
}

function normalizeCompanionLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export async function generateCompanionCopy(
  input: GenerateCompanionCopyInput,
): Promise<CompanionTextResult> {
  const effectiveStyle: CompanionCopyStyle =
    input.emotion != null
      ? companionStyleForEmotion(input.emotion)
      : input.style
  const isRegenerateChat = isRegenerateChatTrigger(input.trigger)

  const qualityCtx = {
    maxChars: input.maxChars,
    style: effectiveStyle,
    now: new Date(),
  }

  const systemPrompt = isRegenerateChat
    ? buildRegenerateChatSystemPrompt({
        maxChars: input.maxChars,
        allowEmoji: input.allowEmoji,
        style: effectiveStyle,
        now: new Date(),
        trigger: input.trigger as 'regenerate' | 'similar',
        ...(input.seed !== undefined ? { seed: input.seed } : {}),
        ...(input.companionInterests?.length
          ? { companionInterests: input.companionInterests }
          : {}),
      })
    : buildCompanionSystemPrompt({
        style: effectiveStyle,
        keyword: input.keyword,
        allowEmoji: input.allowEmoji,
        maxChars: input.maxChars,
        now: new Date(),
        ...(input.emotion !== undefined ? { emotion: input.emotion } : {}),
        ...(input.avoidRecentOutputs?.length ? { recentOutputsGuard: true } : {}),
        ...(input.companionInterests?.length
          ? { companionInterests: input.companionInterests }
          : {}),
        ...(input.companionLightFeedbackHints?.length
          ? { companionLightFeedbackHints: input.companionLightFeedbackHints }
          : {}),
      })

  let userPrompt: string
  if (isRegenerateChat) {
    userPrompt = buildRegenerateChatUserPrompt({
      maxChars: input.maxChars,
      trigger: input.trigger as 'regenerate' | 'similar',
      style: effectiveStyle,
      ...(input.companionInterests?.length
        ? { companionInterests: input.companionInterests }
        : {}),
      ...(input.companionLightFeedbackHints?.length
        ? { companionLightFeedbackHints: input.companionLightFeedbackHints }
        : {}),
      ...(input.emotion !== undefined ? { emotion: input.emotion } : {}),
      ...(input.avoidRecentOutputs?.length
        ? { avoidRecentOutputs: input.avoidRecentOutputs }
        : {}),
      ...(input.replaceTargetLine != null
        ? { replaceTargetLine: input.replaceTargetLine }
        : {}),
      ...(input.similarToLine != null
        ? { similarToLine: input.similarToLine }
        : {}),
      ...(input.seed !== undefined ? { seed: input.seed } : {}),
    })
  } else {
    const { tags: interestTags } = parseCompanionInterestTags(
      input.companionInterests,
    )
    const triggerLines = buildCompanionTriggerContextLines({
      ...(input.trigger !== undefined ? { trigger: input.trigger } : {}),
      ...(input.momentContextText != null
        ? { momentContextText: input.momentContextText }
        : {}),
      ...(input.similarToLine != null ? { similarToLine: input.similarToLine } : {}),
      ...(input.yesterdayContextText != null
        ? { yesterdayContextText: input.yesterdayContextText }
        : {}),
    })
    const userPromptBase = buildCompanionUserPromptWithInterests(
      input.keyword,
      input.emotion,
      input.avoidRecentOutputs && input.avoidRecentOutputs.length > 0
        ? { avoidRecentOutputs: input.avoidRecentOutputs }
        : undefined,
      interestTags,
      input.trigger,
    )
    userPrompt =
      triggerLines.length > 0
        ? `${triggerLines.join('\n')}\n${userPromptBase}`
        : userPromptBase
  }

  const requestModelLine = async (
    userPromptLine: string,
    temperature?: number,
  ): Promise<string> => {
    const regenTemperature = isRegenerateChat
      ? (temperature ?? regenerateChatTemperature(input.seed))
      : undefined
    const req: DashScopeTextRequest = {
      apiKey: input.apiKey,
      model: input.model,
      systemPrompt,
      userPrompt: userPromptLine,
      ...(isRegenerateChat
        ? {
            quickModelFallbackOnly: true,
            regenerateChatNoExpand: true,
            ...(regenTemperature !== undefined
              ? { temperature: regenTemperature }
              : {}),
          }
        : {}),
      ...(input.chatCompletionsUrl !== undefined
        ? { chatCompletionsUrl: input.chatCompletionsUrl }
        : {}),
      ...(input.trigger ? { copyTrigger: input.trigger } : {}),
    }
    const apiStarted = Date.now()
    if (isRegenerateChat) {
      logCompanionRegenerate('dashscope/chat/completions → request', {
        via: input.invokeDashScope ? 'electron-ipc' : 'renderer-fetch',
        url:
          req.chatCompletionsUrl ??
          'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        model: req.model ?? 'qwen-turbo',
        temperature: regenTemperature,
        apiKey: maskDashScopeApiKey(input.apiKey),
        seed: input.seed,
        replaceTarget: input.replaceTargetLine?.slice(0, 96),
        userPromptTail: userPromptLine.slice(-280),
      })
    }
    let raw: string
    let modelUsed: string | undefined
    try {
      if (input.invokeDashScope) {
        raw = await input.invokeDashScope(req)
      } else {
        const res = await requestDashScopeTextWithFallback(req, {
          fetchRemoteModelList: false,
          ...(input.modelFallbackEnv
            ? { envFallbackList: input.modelFallbackEnv }
            : {}),
        })
        raw = res.content
        modelUsed = res.model
      }
    } catch (err) {
      if (isRegenerateChat) {
        logCompanionRegenerate('dashscope/chat/completions ← error', {
          ms: Date.now() - apiStarted,
          message: err instanceof Error ? err.message : String(err),
        })
      }
      throw err
    }
    if (isRegenerateChat) {
      logCompanionRegenerate('dashscope/chat/completions ← response', {
        ms: Date.now() - apiStarted,
        model: modelUsed ?? req.model,
        content: raw,
      })
    }
    return finalizeCompanionText(raw, input.maxChars, input.allowEmoji)
  }

  const maxExtra =
    typeof input.maxQualityRetries === 'number' ? input.maxQualityRetries : 0
  const refineOpts = isRegenerateChat
    ? { maxExtraRetries: maxExtra, strictFinish: true }
    : typeof input.maxQualityRetries === 'number'
      ? { maxExtraRetries: input.maxQualityRetries }
      : undefined

  const requestAndRefine = async (): Promise<string> => {
    let line = await requestModelLine(userPrompt)
    if (maxExtra > 0) {
      try {
        line = await refineCompanionCopyLine(
          line,
          qualityCtx,
          (suffix) => requestModelLine(`${userPrompt}\n${suffix}`),
          refineOpts,
        )
      } catch {
        /* 保留最后一版模型产出，质检不过也不丢 API 句 */
      }
    }
    const { tags: interestTags } = parseCompanionInterestTags(input.companionInterests)
    if (
      companionInterestTagsRequireQuote(interestTags) &&
      companionRegenerateLineFailsInterestQuoteMode(line)
    ) {
      try {
        line = await requestModelLine(
          `${userPrompt}\n【硬约束·重写】用户选了兴趣标签，须写一句可念出的歌词/影视台词/书本金句；禁止散文套句（在这/片刻/灵魂/安宁/栖息/宁静/静谧）。`,
        )
      } catch {
        /* keep line */
      }
      if (companionRegenerateLineFailsInterestQuoteMode(line)) {
        line = pickCompanionInterestRegenerateLine({
          interestTags,
          maxChars: input.maxChars,
          style: effectiveStyle,
          ...(input.seed !== undefined ? { seed: input.seed } : {}),
          ...(input.avoidRecentOutputs?.length
            ? { avoidRecent: input.avoidRecentOutputs }
            : {}),
        })
      }
    }
    const normalized = line.replace(/\s+/g, ' ').trim()
    if (!normalized) {
      throw new Error('empty companion copy')
    }
    if (companionCopyStillBanned(line, qualityCtx)) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn('[sidekick] 陪伴句质检未过，仍上屏模型产出', line)
      }
    }
    return line
  }

  const pickRegeneratePoolLine = () =>
    pickRegenerateStructuredFallback({
      trigger: input.trigger ?? 'regenerate',
      maxChars: input.maxChars,
      style: effectiveStyle,
      ...(input.seed !== undefined ? { seed: input.seed } : {}),
      ...(input.avoidRecentOutputs?.length
        ? { avoidRecent: input.avoidRecentOutputs }
        : {}),
      ...(input.replaceTargetLine != null
        ? { replaceTarget: input.replaceTargetLine }
        : {}),
      ...(input.companionInterests?.length
        ? {
            companionInterests: input.companionInterests,
            hasInterests: true,
          }
        : {}),
    })

  async function resolveRegenerateModelLine(): Promise<CompanionTextResult> {
    const replaceTarget = normalizeCompanionLine(input.replaceTargetLine ?? '')
    const avoidRecent = (input.avoidRecentOutputs ?? [])
      .map(normalizeCompanionLine)
      .filter(Boolean)
    const regenStarted = Date.now()
    const gateCtx = {
      maxChars: input.maxChars,
      style: effectiveStyle,
      now: new Date(),
    }

    logCompanionRegenerate('resolveRegenerateModelLine start', {
      replaceTarget,
      avoidRecent,
      seed: input.seed,
      interestTags: parseCompanionInterestTags(input.companionInterests).tags,
    })

    const pickFallback = (reason: string) => {
      const line = pickRegeneratePoolLine()
      logCompanionRegenerate('resolveRegenerateModelLine → fallback', {
        text: line,
        replaceTarget,
        reason,
      })
      return {
        text: finalizeCompanionText(line, input.maxChars, input.allowEmoji),
        source: 'fallback' as const,
      }
    }

    let modelLine = ''
    try {
      modelLine = await requestModelLine(
        userPrompt,
        regenerateChatTemperature(input.seed),
      )
    } catch (err) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(
          `[sidekick] 换句模型请求失败 (${Date.now() - regenStarted}ms)，使用结构化兜底`,
          err instanceof Error ? err.message : err,
        )
      }
      return pickFallback('api-error')
    }

    const firstLine = modelLine

    if (companionLineEqualsArchetypeExemplar(modelLine)) {
      try {
        modelLine = await requestModelLine(
          `${userPrompt}\n【硬约束】禁止照抄结构示范或最近句原文；须全新措辞；已选兴趣则须织入音乐/影视/书籍语感。`,
          regenerateChatTemperature(
            input.seed != null ? input.seed + 1_048_583 : undefined,
          ),
        )
      } catch {
        /* 保留首句 */
      }
    }

    if (shouldRetryRegenerateAgainstTarget(modelLine, replaceTarget)) {
      try {
        modelLine = await requestModelLine(
          `${userPrompt}\n${buildRegenerateRetrySuffix({
            replaceTarget,
            avoidRecent,
          })}`,
          regenerateChatTemperature(
            input.seed != null ? input.seed + 1_048_583 : undefined,
          ),
        )
      } catch {
        /* 保留首句 */
      }
    }

    if (
      shouldRetryRegenerateAgainstTarget(modelLine, replaceTarget) &&
      !shouldRetryRegenerateAgainstTarget(firstLine, replaceTarget)
    ) {
      modelLine = firstLine
    }

    if (shouldRetryRegenerateAgainstTarget(modelLine, replaceTarget)) {
      return pickFallback('target-skeleton-repeat')
    }

    if (companionLineEqualsArchetypeExemplar(modelLine)) {
      return pickFallback('echoed-archetype-exemplar')
    }

    const { tags: interestTags } = parseCompanionInterestTags(
      input.companionInterests,
    )
    if (
      interestTags.length > 0 &&
      companionRegenerateLineFailsInterestQuoteMode(modelLine)
    ) {
      try {
        modelLine = await requestModelLine(
          `${userPrompt}\n【硬约束·重写】须写一句与语气一致的歌词/影视台词/书本金句（可念、有辨识度）；禁止散文（晚风/午后/心灵/慢慢流淌/放下也是一种/每一次呼吸/慢慢归位）；禁止休息许可套句。`,
          regenerateChatTemperature(
            input.seed != null ? input.seed + 2_097_583 : undefined,
          ),
        )
      } catch {
        /* 保留首句 */
      }
      if (companionRegenerateLineFailsInterestQuoteMode(modelLine)) {
        return pickFallback('generic-heal-not-quote')
      }
    }

    if (companionRegenerateModelLineUnacceptable(modelLine, gateCtx)) {
      logCompanionRegenerate('resolveRegenerateModelLine quality note (show model)', {
        line: normalizeCompanionLine(modelLine),
      })
    }

    const finalized = finalizeCompanionText(modelLine, input.maxChars, input.allowEmoji)
    logCompanionRegenerate('resolveRegenerateModelLine ok', {
      source: 'model',
      text: finalized,
    })
    return {
      text: finalized,
      source: 'model',
    }
  }

  if (isRegenerateChat) {
    return resolveRegenerateModelLine()
  }

  const result = await getCompanionText(
    async () => requestAndRefine(),
    {
      maxChars: input.maxChars,
      pickFallback: () => pickRegeneratePoolLine(),
    },
  )

  return {
    ...result,
    text: finalizeCompanionText(result.text, input.maxChars, input.allowEmoji),
  }
}
