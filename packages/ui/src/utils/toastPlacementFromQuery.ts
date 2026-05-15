/**
 * Toast window (`mode=toast`) reads placement from the URL built by Electron main.
 * Keep parsing in one place so shell padding, tail SVG, and main-process geometry stay aligned.
 */
export function parseTailDownFromQuery(search: string): boolean | undefined {
  const raw = new URLSearchParams(search).get('tailDown')
  if (raw === '1') return true
  if (raw === '0') return false
  return undefined
}

export function parseBubblePlacementFromQuery(search: string): 'above' | 'below' {
  const params = new URLSearchParams(search)
  const p = params.get('placement')?.toLowerCase()
  if (p === 'above' || p === 'below') return p
  const anchor = params.get('anchor')?.toLowerCase()
  return anchor === 'bottom' ? 'below' : 'above'
}

/**
 * 尾巴是否朝下（指向精灵）。仅以 `placement` 为准：与主进程 `computeToastPlacement` 写入的
 * `placement=above|below` 一致；忽略 URL 里可能与版式矛盾的 `tailDown`（`false` 会阻断 `??` 回退）。
 */
export function resolveTailPointsDown(search: string): boolean {
  return parseBubblePlacementFromQuery(search) === 'above'
}
