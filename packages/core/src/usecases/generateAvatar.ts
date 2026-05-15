export type GenerateAvatarInput = {
  imageGenRemaining: number
}

export type GenerateAvatarResult = {
  success: boolean
  nextRemaining: number
  reason?: 'quota-exhausted' | 'provider-error'
}

export async function generateAvatar(
  input: GenerateAvatarInput,
  providerGenerate: () => Promise<boolean>,
): Promise<GenerateAvatarResult> {
  if (input.imageGenRemaining <= 0) {
    return {
      success: false,
      nextRemaining: 0,
      reason: 'quota-exhausted',
    }
  }

  const success = await providerGenerate().catch(() => false)
  if (!success) {
    return {
      success: false,
      nextRemaining: input.imageGenRemaining,
      reason: 'provider-error',
    }
  }

  return {
    success: true,
    nextRemaining: Math.max(0, input.imageGenRemaining - 1),
  }
}
