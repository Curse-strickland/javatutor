// 守卫 http() 的「非 2xx 抛可读错误」——这是 2026-09-11 线上 502 事故的直接教训：
// 后端不可用时 nginx 回 HTML 错误页，调用方 res.json() 抛 `Unexpected token '<'`，
// 把「后端没起来」盖成了「前端解析出错」。见 docs/plan/2026-09-11-log-dir-permission-502-...。

import { describe, it, expect, vi, afterEach } from 'vitest'
import { http } from './http.js'

function stubFetch(response) {
  const fn = vi.fn(async () => response)
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('http', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('2xx 原样返回 Response（调用方仍可 res.json / 读 SSE body）', async () => {
    const res = { ok: true, status: 200, json: async () => ({ a: 1 }) }
    const fetchFn = stubFetch(res)

    await expect(http('/api/run', { method: 'POST' })).resolves.toBe(res)
    expect(fetchFn).toHaveBeenCalledTimes(1)
  })

  it('非 2xx 且 body 是 HTML（nginx 502 页）→ 抛带提示的可读错误', async () => {
    stubFetch({
      ok: false,
      status: 502,
      text: async () => '<html>\n<head><title>502 Bad Gateway</title></head>',
    })

    await expect(http('/api/run')).rejects.toThrow('HTTP 502（后端未启动或不可用）')
  })

  it('非 2xx 且 body 不是 HTML → 只报状态码，不硬塞提示', async () => {
    stubFetch({ ok: false, status: 403, text: async () => '{"error":"forbidden"}' })

    await expect(http('/api/run')).rejects.toThrow('HTTP 403')
    await expect(http('/api/run')).rejects.not.toThrow('后端未启动')
  })

  it('读 body 失败也不影响抛错（错误信息退化为纯状态码）', async () => {
    stubFetch({
      ok: false,
      status: 500,
      text: async () => {
        throw new Error('body already consumed')
      },
    })

    await expect(http('/api/run')).rejects.toThrow('HTTP 500')
  })

  it('带上 X-Request-ID 头，便于和后端日志串起来', async () => {
    const fetchFn = stubFetch({ ok: true, status: 200 })
    await http('/api/run')

    const [, options] = fetchFn.mock.calls[0]
    expect(options.headers.get('X-Request-ID')).toBeTruthy()
  })
})
