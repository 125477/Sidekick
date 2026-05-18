import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

/** 与 core `isAllowedDashScopeResultAudioUrl` 保持一致；勿从 @sidekick/core 导入（Vite 配置走 Node ESM）。 */
function isAllowedDashScopeResultAudioUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return false
    const host = u.hostname.toLowerCase()
    return host.endsWith('.aliyuncs.com') || host.includes('dashscope')
  } catch {
    return false
  }
}

/**
 * Dev：代理拉取 DashScope TTS 返回的 OSS 音频 URL，避免渲染进程跨域。
 * 与 `dashscopeTtsClient.resolveDashScopeAudioPlaybackUrl` 的 `/dashscope-audio?target=` 配套。
 */
export function dashscopeAudioProxyPlugin(): Plugin {
  return {
    name: 'sidekick-dashscope-audio-proxy',
    configureServer(server) {
      server.middlewares.use(
        async (
          req: IncomingMessage,
          res: ServerResponse,
          next: (err?: unknown) => void,
        ) => {
          const rawUrl = req.url ?? ''
          if (!rawUrl.startsWith('/dashscope-audio')) {
            next()
            return
          }

          let target: string | null = null
          try {
            const parsed = new URL(rawUrl, 'http://127.0.0.1')
            target = parsed.searchParams.get('target')
          } catch {
            res.statusCode = 400
            res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            res.end('invalid request')
            return
          }

          if (!target || !isAllowedDashScopeResultAudioUrl(target)) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'text/plain; charset=utf-8')
            res.end('invalid or disallowed target')
            return
          }

          try {
            const range = req.headers.range
            const upstream = await fetch(target, {
              ...(typeof range === 'string' ? { headers: { Range: range } } : {}),
            })
            res.statusCode = upstream.status
            for (const h of [
              'content-type',
              'content-length',
              'accept-ranges',
              'content-range',
            ]) {
              const v = upstream.headers.get(h)
              if (v) res.setHeader(h, v)
            }
            const body = Buffer.from(await upstream.arrayBuffer())
            res.end(body)
          } catch (err) {
            next(err)
          }
        },
      )
    },
  }
}
