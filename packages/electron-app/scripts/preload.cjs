const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('sidekickDesktop', {
  openPanelWindow(panel, opts) {
    if (opts && typeof opts === 'object' && opts.emotionTab) {
      return ipcRenderer.invoke('sidekick:open-panel', { panel, emotionTab: opts.emotionTab })
    }
    return ipcRenderer.invoke('sidekick:open-panel', panel)
  },
  showSystemNotification(payload) {
    return ipcRenderer.invoke('sidekick:show-system-notification', payload)
  },
  showCornerNotification(payload) {
    return ipcRenderer.invoke('sidekick:show-corner-notification', payload)
  },
  hideCornerNotification() {
    return ipcRenderer.invoke('sidekick:hide-corner-notification')
  },
  openCornerNotificationTarget() {
    return ipcRenderer.invoke('sidekick:corner-notification-open-target')
  },
  updateMoodReminderSnapshot(snapshot) {
    ipcRenderer.send('sidekick:update-mood-reminder-snapshot', snapshot)
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
  beginDragTrail(payload) {
    return ipcRenderer.invoke('sidekick:begin-drag-trail', payload ?? {})
  },
  pushDragTrailPoint(payload) {
    ipcRenderer.send('sidekick:drag-trail-point', payload)
  },
  endDragTrail() {
    ipcRenderer.send('sidekick:end-drag-trail')
  },
  onDragTrailPoint(callback) {
    const channel = 'sidekick:drag-trail-point'
    const listener = (_event, payload) => {
      if (!payload || typeof payload !== 'object') return
      const x = Number(payload.x)
      const y = Number(payload.y)
      if (!Number.isFinite(x) || !Number.isFinite(y)) return
      callback({ x, y })
    }
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
  onDragTrailPoints(callback) {
    const channel = 'sidekick:drag-trail-points'
    const listener = (_event, batch) => {
      if (!Array.isArray(batch) || batch.length === 0) return
      const points = []
      for (const raw of batch) {
        if (!raw || typeof raw !== 'object') continue
        const x = Number(raw.x)
        const y = Number(raw.y)
        if (Number.isFinite(x) && Number.isFinite(y)) points.push({ x, y })
      }
      if (points.length > 0) callback(points)
    }
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
  onDragTrailShift(callback) {
    const channel = 'sidekick:drag-trail-shift'
    const listener = (_event, payload) => {
      if (!payload || typeof payload !== 'object') return
      const dx = Number(payload.dx)
      const dy = Number(payload.dy)
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return
      callback({ dx, dy })
    }
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
  onDragTrailReset(callback) {
    const channel = 'sidekick:drag-trail-reset'
    const listener = () => callback()
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
  onDragTrailResetSampler(callback) {
    const channel = 'sidekick:drag-trail-reset-sampler'
    const listener = () => callback()
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
  onDragTrailSync(callback) {
    const channel = 'sidekick:drag-trail-sync'
    const listener = (_event, payload) => {
      if (!payload || typeof payload !== 'object') return
      callback(payload)
    }
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
  resizePanelWindow(payload) {
    return ipcRenderer.invoke('sidekick:resize-panel', payload)
  },
  setSpriteAnchor(anchor) {
    if (!anchor || typeof anchor !== 'object') return Promise.resolve()
    const { _sync, ...rest } = anchor
    if (_sync === true) {
      return ipcRenderer.invoke('sidekick:set-sprite-anchor', rest)
    }
    ipcRenderer.send('sidekick:set-sprite-anchor-push', rest)
    return Promise.resolve()
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
  onSystemResume(callback) {
    const channel = 'sidekick:system-resume'
    const listener = () => callback()
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
  onMoodReminderTick(callback) {
    const channel = 'sidekick:mood-reminder-tick'
    const listener = () => callback()
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
})
