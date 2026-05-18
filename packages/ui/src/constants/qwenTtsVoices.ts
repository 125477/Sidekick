/**
 * `qwen-tts-2025-05-22` 当前仅支持以下 7 个系统音色（DashScope 接口校验）。
 * 勿添加文档未列出的 id，否则会 400 InvalidParameter。
 */
export const QWEN_TTS_VOICES = [
  { id: 'Chelsie', label: 'Chelsie（千雪）· 女｜甜系、偏二次元' },
  { id: 'Cherry', label: 'Cherry（芊悦）· 女｜阳光、亲切自然' },
  { id: 'Serena', label: 'Serena（苏瑶）· 女｜温柔舒缓' },
  { id: 'Ethan', label: 'Ethan（晨煦）· 男｜标准普通话、阳光温暖' },
  { id: 'Dylan', label: 'Dylan · 男｜年轻、清爽' },
  { id: 'Jada', label: 'Jada · 女｜沉稳、利落' },
  { id: 'Sunny', label: 'Sunny · 女｜明亮、轻快' },
] as const

export const QWEN_TTS_VOICE_IDS = new Set<string>(
  QWEN_TTS_VOICES.map((v) => v.id),
)

export const DEFAULT_QWEN_TTS_VOICE = 'Chelsie' as const
