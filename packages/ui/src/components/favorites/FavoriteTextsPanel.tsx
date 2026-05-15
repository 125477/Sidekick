import { useCallback, useEffect, useRef, useState } from 'react'
import { loadData, removeTextFromHistory, subscribeTextsChanged, type TextRecord } from '@sidekick/core'

type FavoriteTextsPanelProps = {
  /** 独立 panel 窗：占满可用高度并滚动列表 */
  fillAvailable?: boolean
}

export function FavoriteTextsPanel({
  fillAvailable = false,
}: FavoriteTextsPanelProps) {
  const [rows, setRows] = useState<TextRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null)
  const copyResetTimerRef = useRef<number | null>(null)

  const loadFavoriteRows = useCallback((opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    void loadData()
      .then((d) => setRows(d.texts.history.filter((t) => t.favorite)))
      .finally(() => {
        if (!opts?.silent) setLoading(false)
      })
  }, [])

  useEffect(() => {
    void loadFavoriteRows()
  }, [loadFavoriteRows])

  useEffect(() => {
    return subscribeTextsChanged(() => {
      void loadFavoriteRows({ silent: true })
    })
  }, [loadFavoriteRows])

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current != null) {
        window.clearTimeout(copyResetTimerRef.current)
        copyResetTimerRef.current = null
      }
    }
  }, [])

  const listBody =
    loading ? (
      <p className="py-6 text-center text-sm text-slate-500">加载中…</p>
    ) : rows.length === 0 ? (
      <p className="py-8 text-center text-sm text-slate-500">暂无收藏</p>
    ) : (
      <ul className="flex flex-col gap-2">
        {rows.map((t) => (
          <li
            key={t.id}
            className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-[13px] leading-relaxed text-slate-700"
          >
            <p className="whitespace-pre-wrap break-words">{t.content}</p>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-400">
                {new Date(t.createdAt).toLocaleString()}
              </span>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className="rounded-md px-2 py-0.5 text-[11px] font-medium text-violet-700 hover:bg-violet-50"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(t.content)
                      .then(() => {
                        setCopiedRowId(t.id)
                        if (copyResetTimerRef.current != null) {
                          window.clearTimeout(copyResetTimerRef.current)
                        }
                        copyResetTimerRef.current = window.setTimeout(() => {
                          setCopiedRowId((cur) =>
                            cur === t.id ? null : cur,
                          )
                          copyResetTimerRef.current = null
                        }, 2000)
                      })
                      .catch(() => {
                        /* 剪贴板拒绝等：保持「复制」 */
                      })
                  }}
                >
                  {copiedRowId === t.id ? '已复制' : '复制'}
                </button>
                <button
                  type="button"
                  className="rounded-md px-2 py-0.5 text-[11px] font-medium text-rose-600 hover:bg-rose-50"
                  onClick={() => {
                    if (
                      !window.confirm(
                        '确定从本地记录中删除这条收藏？删除后无法恢复。',
                      )
                    ) {
                      return
                    }
                    void removeTextFromHistory(t.id)
                  }}
                >
                  删除
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    )

  if (fillAvailable) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <p className="shrink-0 text-xs text-slate-500">仅本地保存的陪伴句收藏</p>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">{listBody}</div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">仅本地保存的陪伴句收藏</p>
      <div className="max-h-[min(60vh,520px)] overflow-y-auto pr-1">{listBody}</div>
    </div>
  )
}
