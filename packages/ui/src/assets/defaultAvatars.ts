import {
  buildDefaultAvatarsFromParts,
  HTTPS_BUILTIN_AVATARS,
  moveDefaultAvatarToFront,
} from '@sidekick/core'
import { GIF_FOLDER_BUILTIN_PRESETS } from './generated/gifBuiltinPresets.generated'
import { LOTTIE_FOLDER_BUILTIN_PRESETS } from './generated/lottieBuiltinPresets.generated'
// import { VIDEO_FOLDER_BUILTIN_PRESETS } from './generated/videoBuiltinPresets.generated'

/** Cute AI Star Lottie（原默认列表第四位）挪至首位，作为默认选中与「形象一」。 */
const DEFAULT_AT_FIRST_ID = 'lottie-json-cute-ai-star'

/** 内置形象列表；应用图标仍使用 `src/static/app-icon.png`（见 `index.html` / electron `resources/icon.png`）。 */
export const DEFAULT_AVATARS = moveDefaultAvatarToFront(
  buildDefaultAvatarsFromParts(HTTPS_BUILTIN_AVATARS, [
    ...LOTTIE_FOLDER_BUILTIN_PRESETS,
    ...GIF_FOLDER_BUILTIN_PRESETS,
  ]),
  DEFAULT_AT_FIRST_ID,
)
