import type { AvatarPreset } from '@sidekick/core'

const STABLE_ID_SLUG_BY_FILENAME: Record<string, string> = {
  'party-animation-gif-download-12340042.mp4': 'party-loop',
}

const DISPLAY_NAME_FROM_SLUG: Record<string, string> = {
  'party-loop': '派对循环',
}

function slugFromFilename(file: string): string {
  const base = file.replace(/\.(mp4|webm|ogg|mov|m4v)$/i, '').trim().toLowerCase()
  return base.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'video'
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
 * 根据 `src/static/video/` 下的视频文件名生成内置形象（静音循环，Sprite 内 `<video>` 渲染）。
 * 列表由 `packages/ui/scripts/sync-video-builtin-presets.mjs` 在 dev/build 前写入。
 */
export function buildVideoBuiltinPresetsFromFilenames(
  filenames: readonly string[],
): AvatarPreset[] {
  const videoFiles = filenames.filter((f) => {
    const lower = f.toLowerCase()
    return /\.(mp4|webm|ogg|mov|m4v)$/i.test(lower)
  })
  const unique = [...new Set(videoFiles)]
  unique.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
  return unique.map((file) => {
    const slug = STABLE_ID_SLUG_BY_FILENAME[file] ?? slugFromFilename(file)
    return {
      id: `video-file-${slug}`,
      name: displayNameFromSlug(slug),
      src: `./video/${file}`,
      source: 'builtin',
      motionProfile: 'enhanced',
    } satisfies AvatarPreset
  })
}
