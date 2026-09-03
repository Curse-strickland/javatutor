// 统一的 fetch 封装：给每个请求生成 requestId，带上 X-Request-ID 头，
// 并在浏览器控制台打印请求 / 错误日志，方便和后端日志串起来。
//
// 本项目用原生 fetch 而非 axios，所以这里做的是 fetch 封装（等价于 axios 拦截器）。
// 用法与 fetch 完全一致：http(url, options) 返回 Promise<Response>，
// 因此把项目里的 fetch(...) 直接替换成 http(...) 即可，SSE 流式读取 body 也能用。

const REQUEST_ID_HEADER = 'X-Request-ID'

function newRequestId() {
  // 现代浏览器 / 安全上下文（https 或 localhost）都支持
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // 兜底：老浏览器 / 非安全上下文
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function http(url, options = {}) {
  const requestId = newRequestId()
  const startTime = Date.now()
  const method = (options.method || 'GET').toUpperCase()

  const headers = new Headers(options.headers || {})
  if (!headers.has(REQUEST_ID_HEADER)) {
    headers.set(REQUEST_ID_HEADER, requestId)
  }

  return fetch(url, { ...options, headers })
    .then((response) => {
      const elapsed = Date.now() - startTime
      console.log(`[${requestId}] ${method} ${url} ${response.status} ${elapsed}ms`)
      return response
    })
    .catch((error) => {
      const elapsed = Date.now() - startTime
      console.error(`[${requestId}] ${method} ${url} failed after ${elapsed}ms`, error)
      throw error
    })
}

export default http
