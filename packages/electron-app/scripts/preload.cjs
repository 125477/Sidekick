const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('sidekickDesktop', {
  openPanelWindow(panel) {
    return ipcRenderer.invoke('sidekick:open-panel', panel)
  },
  openOnboardingWindow() {
    return ipcRenderer.invoke('sidekick:open-onboarding')
  },
  notifyOnboardingComplete() {
    return ipcRenderer.invoke('sidekick:onboarding-complete')
  },
  onOnboardingFinished(callback) {
    const channel = 'sidekick:onboarding-finished'
    const listener = () => callback()
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
  showToastWindow(payload) {
    return ipcRenderer.invoke('sidekick:show-toast', payload)
  },
  setToastAnchorPreference(payload) {
    return ipcRenderer.invoke('sidekick:set-toast-anchor-preference', payload)
  },
  hideToastWindow() {
    return ipcRenderer.invoke('sidekick:hide-toast')
  },
  /** 独立气泡窗：锁定后点击穿透；传 `null` 关闭。`rect` 为视口内 getBoundingClientRect（与主进程 getContentBounds 合成屏幕坐标）。 */
  reportToastPassthroughInteractRect(rect) {
    ipcRenderer.send('sidekick:toast-passthrough-interact-rect', rect)
  },
  setWidgetPointerPassthrough(enabled) {
    ipcRenderer.send('sidekick:widget-pointer-passthrough', enabled === true)
  },
  setSpriteInteractionLocked(locked) {
    return ipcRenderer.invoke('sidekick:set-sprite-interaction-locked', locked === true)
  },
  getSpriteInteractionLocked() {
    return ipcRenderer.invoke('sidekick:get-sprite-interaction-locked')
  },
  onSpriteInteractionLocked(callback) {
    const channel = 'sidekick:sprite-interaction-locked'
    const listener = (_event, locked) => callback(locked === true)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
  /**
   * 独立气泡窗（mode=toast）：主进程在不重载页面的情况下同步 `anchor` / `placement`，避免切换「从上方/从下方」时整页 `loadURL` 卡顿。
   */
  onDetachedToastPlacementSync(callback) {
    const channel = 'sidekick:detached-toast-placement'
    const listener = (_event, payload) => {
      if (!payload || typeof payload !== 'object') return
      const anchor = payload.anchor === 'bottom' ? 'bottom' : 'top'
      const p = payload.placement
      const placement = p === 'below' ? 'below' : p === 'above' ? 'above' : null
      if (!placement) return
      callback({ anchor, placement })
    }
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
  resizeToastWindow(payload) {
    return ipcRenderer.invoke('sidekick:resize-toast', payload)
  },
  resizeWidgetWindow(payload) {
    return ipcRenderer.invoke('sidekick:resize-widget', payload)
  },
  /** 挂件精灵窗：在 `no-drag` 热区内用指针增量移动窗口（与 CSS `drag` 二选一，避免吞点击）。 */
  moveWidgetBy(payload) {
    return ipcRenderer.invoke('sidekick:move-widget-by', payload)
  },
  resizePanelWindow(payload) {
    return ipcRenderer.invoke('sidekick:resize-panel', payload)
  },
  setSpriteAnchor(anchor) {
    return ipcRenderer.invoke('sidekick:set-sprite-anchor', anchor)
  },
  onWidgetMoved(callback) {
    const channel = 'sidekick:widget-moved'
    const listener = () => callback()
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
  getWorkArea() {
    return ipcRenderer.invoke('sidekick:get-work-area')
  },
  requestRegenerateCopy() {
    ipcRenderer.send('sidekick:toast-regenerate-request')
    return Promise.resolve()
  },
  onRegenerateCopyRequested(callback) {
    const channel = 'sidekick:regenerate-copy'
    const listener = () => callback()
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
  dashscopeChat(payload) {
    return ipcRenderer.invoke('sidekick:dashscope-chat', payload)
  },
  dashscopeTts(payload) {
    return ipcRenderer.invoke('sidekick:dashscope-tts', payload)
  },
  quitApp() {
    return ipcRenderer.invoke('sidekick:quit-app')
  },
  /** 挂件精灵窗：在独立小窗展示菜单，避免在窄挂件内被裁切。 */
  openWidgetSpriteMenu(bounds) {
    return ipcRenderer.invoke('sidekick:open-widget-sprite-menu', bounds)
  },
  closeWidgetSpriteMenu(opts) {
    return ipcRenderer.invoke('sidekick:close-widget-sprite-menu', opts ?? {})
  },
  submitWidgetSpriteMenuAction(action) {
    return ipcRenderer.invoke('sidekick:widget-sprite-menu-submit', action)
  },
  onWidgetSpriteMenuPick(callback) {
    const channel = 'sidekick:widget-sprite-menu-pick'
    const listener = (_event, action) => callback(action)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
  onWidgetSpriteMenuClosed(callback) {
    const channel = 'sidekick:widget-sprite-menu-closed'
    const listener = () => callback()
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
})
