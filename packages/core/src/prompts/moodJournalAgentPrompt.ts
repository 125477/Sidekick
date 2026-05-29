/** 今日小结 · 写日记助手 / 润色 — 百炼智能体变量与短 prompt（控制台 system 见 docs）。 */

export type MoodJournalGuideAgentParamsInput = {
  moodLabel: string
  noteDraft: string
  interests?: string[]
  interestNote?: string
  /** 「换一批」时传入屏上旧问题，要求模型换角度。 */
  previousQuestions?: string[]
  refreshSeed?: number
}

export type MoodJournalPolishAgentParamsInput = {
  moodLabel: string
  noteDraft: string
}

export function formatMoodJournalInterests(tags: string[] | undefined): string {
  const list = (tags ?? []).map((s) => s.trim()).filter(Boolean)
  return list.length > 0 ? list.join('、') : '无'
}

function formatMoodJournalGuideAvoidQuestions(
  previous: string[] | undefined,
): string {
  const list = (previous ?? [])
    .map((q) => q.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  if (list.length === 0) return '无'
  return list.map((q, i) => `${i + 1}. ${q}`).join('\n')
}

/** 百炼「写日记助手」应用 → `user_prompt_params`。 */
export function buildMoodJournalGuideAgentParams(
  input: MoodJournalGuideAgentParamsInput,
): Record<string, string> {
  const draft = input.noteDraft.replace(/\s+/g, ' ').trim()
  return {
    mood_label: input.moodLabel.trim() || '未选择',
    note_draft: draft.length > 0 ? draft.slice(0, 400) : '（用户尚未填写）',
    interests: formatMoodJournalInterests(input.interests),
    interest_note:
      input.interestNote?.replace(/\s+/g, ' ').trim().slice(0, 120) || '无',
    avoid_questions: formatMoodJournalGuideAvoidQuestions(input.previousQuestions),
    refresh_seed: String(input.refreshSeed ?? Date.now()),
  }
}

/** 百炼「写日记助手」`input.prompt`。 */
export function buildMoodJournalGuideAgentPrompt(
  input?: Pick<MoodJournalGuideAgentParamsInput, 'previousQuestions' | 'refreshSeed'>,
): string {
  const parts = [
    '请根据本轮动态上下文，输出恰好 3 条中文写日记引导问题。',
    '格式：每行一条，行首为「1.」「2.」「3.」；不要其它说明、不要 Markdown。',
    '仅简体中文，禁止英文。',
  ]
  const previous = (input?.previousQuestions ?? [])
    .map((q) => q.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  if (previous.length > 0) {
    parts.push(
      '【换一批】须与下列旧问题明显不同，禁止重复或只改一两个字：',
      ...previous.map((q, i) => `${i + 1}. ${q}`),
    )
  }
  if (input?.refreshSeed != null) {
    parts.push(`salt=${input.refreshSeed}`)
  }
  return parts.join('')
}

export function buildMoodJournalGuideChatUserPrompt(input: {
  previousQuestions?: string[]
  refreshSeed?: number
}): string {
  const previous = (input.previousQuestions ?? [])
    .map((q) => q.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const seed = input.refreshSeed ?? Date.now()
  if (previous.length === 0) {
    return `请输出 3 条引导问题。salt=${seed}`
  }
  return [
    '请输出 3 条引导问题；须与下列旧问题明显不同，禁止重复或近义改写：',
    ...previous.map((q, i) => `${i + 1}. ${q}`),
    `salt=${seed}`,
  ].join('\n')
}

export function normalizeMoodJournalGuideQuestionKey(text: string): string {
  return text
    .replace(/\s+/g, '')
    .replace(/[？?！!。．.…]/g, '')
    .toLowerCase()
}

export function moodJournalGuideQuestionsEquivalent(
  a: string[],
  b: string[],
): boolean {
  if (a.length !== b.length || a.length === 0) return false
  return a.every(
    (q, i) =>
      normalizeMoodJournalGuideQuestionKey(q) ===
      normalizeMoodJournalGuideQuestionKey(b[i] ?? ''),
  )
}

/** 百炼「日记润色」应用 → `user_prompt_params`。 */
export function buildMoodJournalPolishAgentParams(
  input: MoodJournalPolishAgentParamsInput,
): Record<string, string> {
  const draft = input.noteDraft.replace(/\s+/g, ' ').trim()
  return {
    mood_label: input.moodLabel.trim() || '未选择',
    note_draft: draft.length > 0 ? draft.slice(0, 1800) : '（空）',
  }
}

/** 百炼「日记润色」`input.prompt`。 */
export function buildMoodJournalPolishAgentPrompt(): string {
  return [
    '请润色用户日记草稿：保留原意与第一人称，语气温柔、通顺；',
    '只输出润色后的正文，不要标题、不要引号包裹、不要前后说明。',
    '若草稿为空或只有标点，输出「可以先写一两句今天印象最深的事。」。',
    '仅简体中文，禁止英文。',
  ].join('')
}

/** 从智能体返回文本解析 3 条引导问题。 */
export function parseMoodJournalGuideQuestions(raw: string): string[] {
  const lines = raw
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^\s*[\d①②③一二三四][.、．:：)\]]\s*/u, '')
        .replace(/^[-*•]\s*/, '')
        .trim(),
    )
    .filter(Boolean)

  const uniq: string[] = []
  for (const line of lines) {
    if (uniq.includes(line)) continue
    uniq.push(line)
    if (uniq.length >= 3) break
  }

  if (uniq.length >= 3) return uniq.slice(0, 3)

  const chunks = raw
    .split(/[？?；;|｜]/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 4)
  for (const c of chunks) {
    const q = c.endsWith('？') || c.endsWith('?') ? c : `${c}？`
    if (!uniq.includes(q)) uniq.push(q)
    if (uniq.length >= 3) break
  }

  return uniq.slice(0, 3)
}

export function normalizeMoodJournalPolishText(raw: string, maxChars = 2000): string {
  let text = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n')
    .replace(/^["'「『【]+/, '')
    .replace(/["'」』】]+$/, '')
    .trim()
  if (text.length > maxChars) {
    text = `${text.slice(0, Math.max(1, maxChars - 1))}…`
  }
  return text
}

/** chat 回退：写日记助手 system（与百炼控制台等价）。 */
export function buildMoodJournalGuideChatSystemPrompt(): string {
  return [
    '你是桌面陪伴产品「灵伴」的写日记助手，只做一件事：根据用户今日心情与已有草稿，给出 3 条简短的写日记引导问题。',
    '不要聊天、不要写完整日记、不要给建议清单以外的内容。',
    '',
    '【动态上下文】',
    '- 今日心情标签：{{mood_label}}',
    '- 用户已写草稿（可能为空）：{{note_draft}}',
    '- 兴趣标签：{{interests}}',
    '- 兴趣补充：{{interest_note}}',
    '',
    '【要求】',
    '- 恰好 3 条问题，帮助用户展开今日小结；与 mood_label 情绪一致，温柔不评判。',
    '- 若 note_draft 非空：至少 1 条追问草稿里已提到的细节；另 2 条可拓展感受或小事。',
    '- 若 note_draft 为空：3 条由浅入深，从「今天整体」到「一件小事」到「想对自己说的话」。',
    '- 每条 12–28 个汉字，必须以「？」结尾。',
    '- 兴趣仅轻量参考，勿喧宾夺主。',
    '',
    '【输出格式】',
    '只输出 3 行，行首分别为 1. 2. 3. ，不要其它文字。仅简体中文。',
  ].join('\n')
}

/** chat 回退：润色 system。 */
export function buildMoodJournalPolishChatSystemPrompt(): string {
  return [
    '你是「灵伴」今日小结的日记润色助手。用户已选今日心情并写好草稿，你只做润色，不改事实、不添加虚构事件。',
    '',
    '【动态上下文】',
    '- 今日心情：{{mood_label}}',
    '- 日记草稿：{{note_draft}}',
    '',
    '【要求】',
    '- 保留第一人称与核心事实；语气温柔、口语通顺，可微调标点与连接词。',
    '- 与 mood_label 情绪协调；禁止说教、诊断、命令句（你应该/必须）。',
    '- 草稿为空时：只输出一句温和邀请语「可以先写一两句今天印象最深的事。」',
    '- 长度不超过原文字数的 1.2 倍，且不超过 800 字。',
    '',
    '【输出】',
    '只输出润色后正文，无标题、无引号、无说明。仅简体中文。',
  ].join('\n')
}

function applyTemplateVars(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '')
}

export function buildMoodJournalGuideChatSystemPromptResolved(
  params: Record<string, string>,
): string {
  return applyTemplateVars(buildMoodJournalGuideChatSystemPrompt(), params)
}

export function buildMoodJournalPolishChatSystemPromptResolved(
  params: Record<string, string>,
): string {
  return applyTemplateVars(buildMoodJournalPolishChatSystemPrompt(), params)
}
