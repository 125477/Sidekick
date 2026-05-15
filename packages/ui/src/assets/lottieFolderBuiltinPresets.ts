import type { AvatarPreset } from '@sidekick/core'

/**
 * 与 `readdir` 文件名一致 → 用于 `id` 的尾缀（`lottie-json-${slug}`）。
 * 仅在有历史 id 或想固定短 id 时填写；其余文件走 `slugFromFilename`。
 */
const STABLE_ID_SLUG_BY_FILENAME: Record<string, string> = {
  /** 重命名后的文件名 → 与旧版一致的 slug，避免已存 `selectedAvatarId` 失效 */
  'lingban-lottie-cute-ai-star.json': 'cute-ai-star',
  'lingban-lottie-dog.json': 'dog',
  'lingban-lottie-ok.json': 'ok',
  'lingban-lottie-order-placed-dance.json': 'order-placed-dance',
  'lingban-lottie-vela-universal-loop.json': 'vela',
}

/** id 尾缀 slug → 展示名；未列出的用「连字符转空格 + 首字母大写」推断。 */
const DISPLAY_NAME_FROM_SLUG: Record<string, string> = {
  ok: 'OK',
  vela: '光翼',
  'order-placed-dance': 'Order placed Dance',
}

function slugFromFilename(file: string): string {
  const base = file.replace(/\.json$/i, '').trim().toLowerCase()
  return base.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lottie'
}

function displayNameFromSlug(slug: string): string {
  const override = DISPLAY_NAME_FROM_SLUG[slug]
  if (override) return override
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * 根据 `src/static/lotties/` 下的 JSON 文件名生成内置形象（Bodymovin / Lottie JSON）。
 * 扫描由 `packages/ui/scripts/sync-lottie-builtin-presets.mjs` 在 dev/build 前写入的 generated 列表驱动。
 */
export function buildLottieBuiltinPresetsFromFilenames(
  filenames: readonly string[],
): AvatarPreset[] {
  const jsonFiles = filenames.filter((f) => {
    const lower = f.toLowerCase()
    if (!lower.endsWith('.json')) return false
    if (lower === 'manifest.json') return false
    if (lower.endsWith('.generated.json')) return false
    return true
  })
  const unique = [...new Set(jsonFiles)]
  unique.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  return unique.map((file) => {
    const slug =
      STABLE_ID_SLUG_BY_FILENAME[file] ?? slugFromFilename(file)
    return {
      id: `lottie-json-${slug}`,
      name: displayNameFromSlug(slug),
      /** 相对路径：与 Vite `base: './'` 及 Electron `file://` 一致（勿用 `/lotties/`，会指向磁盘根）。 */
      src: `./lotties/${file}`,
      source: 'builtin',
      motionProfile: 'enhanced',
    } satisfies AvatarPreset
  })
}
