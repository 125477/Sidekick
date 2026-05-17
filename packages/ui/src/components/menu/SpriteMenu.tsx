import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { widgetMenuPlacementClasses } from '../../utils/widgetMenuPlacement'

export type MenuAction =
  | 'skin'
  | 'settings'
  | 'emotion'
  | 'fortune'
  | 'more'
  | 'exit'

type SpriteMenuProps = {
  open: boolean
  widgetMode?: boolean
  /**
   * 传入则用作菜单面板的 `absolute …` 定位片段，覆盖默认的精灵列 / widget 侧逻辑。
   * 用于气泡工具栏留白区内嵌菜单等。
   */
  menuPositionClass?: string
  zIndexClass?: string
  onClose: () => void
  onAction: (action: MenuAction) => void
}

/** 按日常使用频率：互动功能在上，换肤/设置偏下，退出置底。 */
const ITEMS: Array<{ id: MenuAction; label: string }> = [
  { id: 'emotion', label: '情绪反馈' },
  { id: 'skin', label: '换肤' },
  { id: 'settings', label: '设置' },
  { id: 'fortune', label: '每日抽签' },
  { id: 'more', label: '更多...' },
  { id: 'exit', label: '退出' },
]

const MENU_ACTION_IDS = new Set<MenuAction>(ITEMS.map((i) => i.id))

/** 浏览器 `postMessage` 等场景校验菜单 action。 */
export function parseMenuActionFromMessage(raw: unknown): MenuAction | null {
  if (typeof raw !== 'string') return null
  return MENU_ACTION_IDS.has(raw as MenuAction) ? (raw as MenuAction) : null
}

export function SpriteMenuPanel({
  onPick,
  className = '',
}: {
  onPick: (action: MenuAction) => void
  className?: string
}) {
  return (
    <div
      className={`flex w-[172px] flex-col overflow-hidden rounded-2xl border border-[color:var(--sk-content-border)] bg-[color:var(--sk-content-surface)] p-0 shadow-[var(--sk-frame-shadow)] [-webkit-app-region:no-drag] divide-y divide-[color:var(--sk-divider)] ${className}`}
    >
      {ITEMS.map((item, index) => {
        const n = ITEMS.length
        const cornerClass =
          n === 1
            ? 'rounded-2xl'
            : index === 0
              ? 'rounded-t-2xl'
              : index === n - 1
                ? 'rounded-b-2xl'
                : 'rounded-none'
        return (
          <button
            key={item.id}
            type="button"
            className={`${cornerClass} flex h-9 w-full cursor-pointer items-center border-0 bg-transparent py-0 pl-5 pr-3 text-left text-sm leading-none text-[color:var(--sk-text-body)] transition-colors hover:bg-[color:var(--sk-card-bg)] focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--sk-focus-ring)] [-webkit-app-region:no-drag]`}
            onClick={() => onPick(item.id)}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

export function SpriteMenu({
  open,
  widgetMode = false,
  menuPositionClass,
  zIndexClass = 'z-40',
  onClose,
  onAction,
}: SpriteMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  /** When opening left would clip past the window edge, open to the sprite's right instead. */
  const [widgetOpenRight, setWidgetOpenRight] = useState(false)
  const trimmedCustomPlacement = menuPositionClass?.trim() ?? ''
  const customPlacement = trimmedCustomPlacement.length > 0

  useLayoutEffect(() => {
    if (!open || !widgetMode || customPlacement) {
      setWidgetOpenRight(false)
      return
    }
    setWidgetOpenRight(false)
    requestAnimationFrame(() => {
      const el = menuRef.current
      if (!el) return
      if (el.getBoundingClientRect().left < 6) {
        setWidgetOpenRight(true)
      }
    })
  }, [open, widgetMode, customPlacement])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  /** 遮罩在精灵列的 stacking context 里时，点主界面左侧等区域可能点不到遮罩；用捕获阶段兜底。 */
  useEffect(() => {
    if (!open) return
    const onPointerDownCapture = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (menuRef.current?.contains(target)) return
      if (
        target instanceof Element &&
        target.closest('[data-sprite-menu-trigger]')
      ) {
        return
      }
      onClose()
    }
    document.addEventListener('pointerdown', onPointerDownCapture, true)
    return () =>
      document.removeEventListener('pointerdown', onPointerDownCapture, true)
  }, [open, onClose])

  if (!open) return null

  const resolvedMenuPositionClass = customPlacement
    ? trimmedCustomPlacement
    : widgetMode
      ? widgetOpenRight
        ? 'bottom-0 left-full ml-1.5 overflow-visible'
        : widgetMenuPlacementClasses()
      : 'bottom-36 right-0'

  return (
    <>
      <button
        type="button"
        aria-label="关闭菜单"
        className={`${
          customPlacement ? 'absolute' : 'fixed'
        } inset-0 cursor-default [-webkit-app-region:no-drag] ${
          customPlacement ? 'z-40' : zIndexClass
        }`}
        onClick={onClose}
      />
      <div
        ref={menuRef}
        className={`absolute ${resolvedMenuPositionClass} ${
          customPlacement ? 'z-50' : zIndexClass
        }`}
      >
        <SpriteMenuPanel onPick={onAction} />
      </div>
    </>
  )
}
