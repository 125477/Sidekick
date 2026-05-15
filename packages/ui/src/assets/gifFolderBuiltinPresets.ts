import type { AvatarPreset } from '@sidekick/core'

const STABLE_ID_SLUG_BY_FILENAME: Record<string, string> = {
  'lingban-gif-ambient-1.gif': 'gifsos-20260512-114511',
  'lingban-gif-ambient-2.gif': 'gifsos-20260514-170342',
}

const DISPLAY_NAME_FROM_SLUG: Record<string, string> = {
  'gifsos-20260512-114511': '氛围动效一',
  'gifsos-20260514-170342': '氛围动效二',
}

function slugFromFilename(file: string): string {
  const base = file.replace(/\.gif$/i, '').trim().toLowerCase()
  return base.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'gif'
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
 * 根据 `src/static/gif/` 下的 GIF 文件名生成内置形象（`<img>` 解码动画）。
 * 列表由 `packages/ui/scripts/sync-gif-builtin-presets.mjs` 在 dev/build 前写入。
 */
export function buildGifBuiltinPresetsFromFilenames(
  filenames: readonly string[],
): AvatarPreset[] {
  const gifFiles = filenames.filter((f) => /\.gif$/i.test(f))
  const unique = [...new Set(gifFiles)]
  unique.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  return unique.map((file) => {
    const slug = STABLE_ID_SLUG_BY_FILENAME[file] ?? slugFromFilename(file)
    return {
      id: `gif-file-${slug}`,
      name: displayNameFromSlug(slug),
      src: `./gif/${file}`,
      source: 'builtin',
      motionProfile: 'template',
    } satisfies AvatarPreset
  })
}
