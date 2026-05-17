import { useRef } from 'react'
import type { MoodMediaAttachment } from '../../state/moodJournalStorage'
import {
  MOOD_MEDIA_ACCEPT,
  canAddMoodAttachments,
  fileToMoodAttachment,
} from '../../state/moodJournalMedia'

type MoodSummaryMediaPickerProps = {
  attachments: MoodMediaAttachment[]
  onChange: (next: MoodMediaAttachment[]) => void
  disabled?: boolean
  onError?: (message: string) => void
}

/** 预览与「+」统一宽度（约为早期尺寸的 2 倍）。 */
const MOOD_MEDIA_TILE =
  'relative min-w-0 w-[9.5rem] shrink-0 sm:w-[10.5rem]'

function truncateMediaName(name: string): string {
  return name.length > 18 ? `${name.slice(0, 17)}\u2026` : name
}

function MoodMediaDeleteButton({
  label,
  disabled,
  onClick,
}: {
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`删除${label}`}
      title="删除"
      className="absolute right-1 top-1 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/90 bg-white/95 text-rose-600 shadow-md opacity-0 pointer-events-none transition-opacity duration-150 motion-reduce:transition-none group-hover/moodmedia:pointer-events-auto group-hover/moodmedia:opacity-100 group-focus-within/moodmedia:pointer-events-auto group-focus-within/moodmedia:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-rose-500 hover:bg-rose-50 disabled:opacity-50 [-webkit-app-region:no-drag]"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-5 w-5"
        aria-hidden
      >
        <path
          fillRule="evenodd"
          d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  )
}

function MoodMediaPreviewTile({
  att,
  disabled,
  onRemove,
}: {
  att: MoodMediaAttachment
  disabled: boolean
  onRemove: () => void
}) {
  const displayName = truncateMediaName(att.name)
  return (
    <li className={`group/moodmedia ${MOOD_MEDIA_TILE}`}>
      <div className="overflow-hidden rounded-xl border border-slate-200 p-1 sm:p-1.5">
        <div className="relative flex aspect-square w-full min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-lg bg-slate-50">
          {att.type === 'video' ? (
            <video
              src={att.dataUrl}
              className="max-h-full max-w-full rounded-lg object-contain"
              muted
              playsInline
              loop
              preload="metadata"
              aria-label={displayName}
            />
          ) : (
            <img
              src={att.dataUrl}
              alt={displayName}
              className="max-h-full max-w-full rounded-lg object-contain"
            />
          )}
        </div>
        <span className="mt-1 block truncate text-xs leading-tight text-slate-600 sm:text-sm">
          {displayName}
        </span>
      </div>
      <MoodMediaDeleteButton
        label={displayName}
        disabled={disabled}
        onClick={onRemove}
      />
    </li>
  )
}

export function MoodSummaryMediaPicker({
  attachments,
  onChange,
  disabled = false,
  onError,
}: MoodSummaryMediaPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canAdd = canAddMoodAttachments(attachments, 1)

  async function addFiles(files: FileList | null) {
    if (!files?.length || disabled) return
    const list = [...files]
    if (!canAddMoodAttachments(attachments, list.length)) {
      onError?.('最多添加 8 个图片或视频')
      return
    }
    const next = [...attachments]
    for (const file of list) {
      if (!canAddMoodAttachments(next, 1)) break
      const ok =
        file.type.startsWith('video/') || file.type.startsWith('image/')
      if (!ok) continue
      try {
        next.push(await fileToMoodAttachment(file))
      } catch (e) {
        if (e instanceof Error && e.message === 'FILE_TOO_LARGE') {
          onError?.('单个文件不能超过 12MB')
        } else {
          onError?.('无法添加该文件，请换一张图或短视频')
        }
      }
    }
    onChange(next)
  }

  return (
    <div className="grid gap-2">
      <span className="sk-label">图片与视频</span>
      <input
        ref={fileInputRef}
        type="file"
        accept={MOOD_MEDIA_ACCEPT}
        multiple
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          void addFiles(e.target.files)
          e.target.value = ''
        }}
      />
      <ul className="flex flex-wrap items-start gap-3">
        {attachments.map((att) => (
          <MoodMediaPreviewTile
            key={att.id}
            att={att}
            disabled={disabled}
            onRemove={() => onChange(attachments.filter((a) => a.id !== att.id))}
          />
        ))}
        {canAdd ? (
          <li className={MOOD_MEDIA_TILE}>
            <button
              type="button"
              disabled={disabled}
              aria-label="添加图片或视频"
              title="添加图片或视频"
              onClick={() => fileInputRef.current?.click()}
              className="block w-full overflow-hidden rounded-xl border border-violet-200 p-1 transition-[border-color,box-shadow] hover:border-violet-300 hover:shadow-sm disabled:opacity-50 sm:p-1.5 [-webkit-app-region:no-drag]"
            >
              <span className="flex aspect-square w-full items-center justify-center rounded-lg bg-white text-4xl font-medium leading-none text-violet-700 transition-colors hover:bg-violet-50">
                +
              </span>
            </button>
          </li>
        ) : null}
      </ul>
    </div>
  )
}
