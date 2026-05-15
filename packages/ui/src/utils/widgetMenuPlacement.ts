/**
 * Widget layout: sprite is bottom-**right** (`justify-end pr-3`). There is almost no horizontal
 * space *inside the window* to the right of the sprite — opening with `left-full` paints the menu
 * past the transparent window edge (invisible / clipped).
 *
 * Always open the menu **into** the window with `right-full` (panel to the **left** of the sprite).
 *
 * **Important:** `SpriteMenu` is `position: absolute` relative to its offset parent. That parent
 * must stay **narrow** (sprite column only). If the widget root wraps the sprite in `w-full`, the
 * offset parent becomes the full window width and `right-full` places the entire menu outside the
 * left edge of the frame (clipped / invisible).
 */
/** 与左侧展开一致；菜单高度随内容，由外层 ResizeObserver 拉高精灵窗，不在菜单内滚动。 */
export function widgetMenuPlacementClasses(): string {
  return 'bottom-0 right-full mr-1.5 overflow-visible'
}
