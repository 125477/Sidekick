export type MergeAvatarPromptInput = {
  systemAvatarPrefix: string
  userInput: string
  stylePresetId?: string
}

const STYLE_PRESETS: Record<string, string> = {
  healing: '治愈系、柔和色调、主体清晰、低噪点',
  qcute: 'Q版可爱比例、圆润线条、亲和表情',
  simple: '背景简洁、主体居中、干净边缘',
}

export function mergeAvatarPrompt(input: MergeAvatarPromptInput): {
  finalPrompt: string
  negative: string
} {
  const style = input.stylePresetId ? STYLE_PRESETS[input.stylePresetId] : ''
  const finalPrompt = [input.systemAvatarPrefix, style, input.userInput]
    .filter(Boolean)
    .join('，')
  return {
    finalPrompt,
    negative: '杂乱背景, 大块纯色无主体, 低清晰度, 肢体畸形, 水印, 文字',
  }
}
