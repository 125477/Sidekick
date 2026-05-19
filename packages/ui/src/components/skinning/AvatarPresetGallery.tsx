import type { AvatarPreset } from '@sidekick/core'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import { customAvatarSlotDisplayName } from '../../utils/avatarSlotDisplayName'
import { isDotLottieSrc, isVideoAvatarSrc } from '../../utils/isDotLottieSrc'

function isCustomPreset(p: AvatarPreset): boolean {
  return p.source === 'upload' || p.source === 'generated'
}

type AvatarPresetGalleryProps = {
  presets: AvatarPreset[]
  selectedAvatarId: string
  onSelect: (avatarId: string) => void
  /** 区块标题，默认「默认形象」。 */
  sectionTitle?: string
  /** 无条目时在标题下展示（例如自定义区引导）。 */
  emptyHint?: string
  /** 仅应对 `upload` / `generated`；提供后悬停卡片时显示删除。 */
  onRemovePreset?: (avatarId: string) => void
  /** 为 true 时卡片底部按序显示「形象一」「形象二」…，与内置区风格一致，不读 `preset.name`。 */
  orderedSlotDisplayNames?: boolean
}

export function AvatarPresetGallery({
  presets,
  selectedAvatarId,
  onSelect,
  sectionTitle = '默认形象',
  emptyHint,
  onRemovePreset,
  orderedSlotDisplayNames = false,
}: AvatarPresetGalleryProps) {
  return (
    <section className="mb-4">
      <p className="mb-2 text-sm font-medium text-[color:var(--sk-text-body)]">{sectionTitle}</p>
      {presets.length === 0 ? (
        emptyHint ? (
          <p className="sk-muted text-xs leading-relaxed">{emptyHint}</p>
        ) : null
      ) : (
        <div className="grid grid-cols-6 gap-1 sm:gap-1.5">
          {presets.map((avatar, slotIndex) => {
            const showDelete = Boolean(onRemovePreset) && isCustomPreset(avatar)
            const displayName = orderedSlotDisplayNames
              ? customAvatarSlotDisplayName(slotIndex)
              : avatar.name
            return (
              <div key={avatar.id} className="group/preset relative min-w-0">
                <button
                  type="button"
                  onClick={() => onSelect(avatar.id)}
                  className={`min-w-0 w-full overflow-hidden rounded-xl border p-0.5 text-left sm:p-1 ${selectedAvatarId === avatar.id ? 'border-[color:var(--sk-accent-border-strong)] ring-2 ring-[color:var(--sk-accent-border)]' : 'border-[color:var(--sk-card-border)]'}`}
                >
                  <div className="relative flex aspect-square w-full min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-lg bg-[color:var(--sk-card-bg)]">
                    {isVideoAvatarSrc(avatar.src) ? (
                      <video
                        key={avatar.src}
                        src={avatar.src}
                        className="max-h-full max-w-full rounded-lg object-contain"
                        muted
                        playsInline
                        loop
                        autoPlay
                        aria-label={displayName}
                      />
                    ) : isDotLottieSrc(avatar.src) ? (
                      <div className="relative h-full w-full min-h-0 min-w-0">
                        <DotLottieReact
                          key={avatar.src}
                          src={avatar.src}
                          loop
                          autoplay
                          layout={{ fit: 'contain' }}
                          className="h-full w-full min-h-0 min-w-0"
                        />
                      </div>
                    ) : (
                      <img
                        src={avatar.src}
                        alt={displayName}
                        className="max-h-full max-w-full rounded-lg object-contain"
                      />
                    )}
                  </div>
                  <span className="mt-0.5 block truncate text-[10px] leading-tight text-[color:var(--sk-text-secondary)] sm:text-xs">
                    {displayName}
                  </span>
                </button>
                {showDelete ? (
                  <button
                    type="button"
                    aria-label={`删除${displayName}`}
                    title="删除"
                    className="absolute right-0.5 top-0.5 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--sk-card-border)] bg-[color:var(--sk-content-surface)] text-rose-500 shadow-md opacity-0 pointer-events-none transition-opacity duration-150 motion-reduce:transition-none group-hover/preset:pointer-events-auto group-hover/preset:opacity-100 group-focus-within/preset:pointer-events-auto group-focus-within/preset:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-rose-500 hover:bg-rose-500/10 [-webkit-app-region:no-drag]"
                    onClick={(event) => {
                      event.stopPropagation()
                      onRemovePreset?.(avatar.id)
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-3.5 w-3.5"
                      aria-hidden
                    >
                      <path
                        fillRule="evenodd"
                        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
