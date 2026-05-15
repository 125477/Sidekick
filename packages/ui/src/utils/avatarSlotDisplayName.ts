/** 与 core `localStore` 中内置形象序号命名规则一致，供「自定义形象」区按序展示「形象一」…。 */
function cnNumeralUnder100(n: number): string {
  const d = '零一二三四五六七八九'
  if (n <= 0 || n > 99) return String(n)
  if (n < 10) return d[n]!
  if (n === 10) return '十'
  if (n < 20) return '十' + d[n % 10]!
  const tens = Math.floor(n / 10)
  const ones = n % 10
  if (ones === 0) return d[tens]! + '十'
  return d[tens]! + '十' + d[ones]!
}

/** `index0` 从 0 起：0 → 形象一，1 → 形象二。 */
export function customAvatarSlotDisplayName(index0: number): string {
  return `形象${cnNumeralUnder100(index0 + 1)}`
}
