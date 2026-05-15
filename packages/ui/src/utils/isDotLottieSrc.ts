/** 与 Lottie 类似：按 URL 判断是否为内置/上传的视频形象（`<video>` 渲染）。 */
export function isVideoAvatarSrc(src: string): boolean {
  if (/^data:video\//i.test(src)) return true
  const base = src.split(/[?#]/)[0] ?? src
  return /\.(mp4|webm|ogg|mov|m4v)$/i.test(base)
}

/**
 * Raster / GIF / SVG avatars: use <img> (browser decodes & animates GIF).
 * 视频走 `<video>`，不归此类。
 */
export function isRasterAvatarSrc(src: string): boolean {
  if (isVideoAvatarSrc(src)) return false
  if (/^data:image\/(png|jpe?g|gif|webp|svg\+xml|bmp|avif)/i.test(src)) {
    return true
  }
  const base = src.split(/[?#]/)[0] ?? src
  return /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(base)
}

/**
 * True when `src` should be rendered with DotLottie (`.lottie`, lottie.host, or Bodymovin `.json` URL).
 * Raster URLs (including `.gif`) are excluded so they always use `<img>`.
 */
export function isDotLottieSrc(src: string): boolean {
  if (isVideoAvatarSrc(src)) return false
  if (isRasterAvatarSrc(src)) return false
  const base = src.split(/[?#]/)[0] ?? src
  return (
    /\.lottie$/i.test(base) ||
    src.includes('lottie.host/') ||
    /\.json$/i.test(base)
  )
}
