/**
 * Minimal markdown → HTML for algo-knowledge docs.
 * Supports: h1–h3, paragraphs, ul, blockquote, hr, tables, **bold**, ```code```.
 */

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function slugifyHeading(raw) {
  return raw
    .replace(/\*\*/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fff-]/g, '')
}

function inlineFormat(text) {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

function isTableRow(line) {
  const t = line.trim()
  return t.startsWith('|') && t.endsWith('|')
}

function isTableSeparator(line) {
  return /^\|[\s\-:|]+\|$/.test(line.trim())
}

function parseTableRow(line) {
  return line
    .trim()
    .slice(1, -1)
    .split('|')
    .map(cell => cell.trim())
}

function renderTable(lines, startIndex) {
  const headerCells = parseTableRow(lines[startIndex])
  let i = startIndex + 2
  const bodyRows = []
  while (i < lines.length && isTableRow(lines[i])) {
    bodyRows.push(parseTableRow(lines[i]))
    i += 1
  }
  const head = `<thead><tr>${headerCells.map(c => `<th>${inlineFormat(c)}</th>`).join('')}</tr></thead>`
  const body = bodyRows.length
    ? `<tbody>${bodyRows.map(row => `<tr>${row.map(c => `<td>${inlineFormat(c)}</td>`).join('')}</tr>`).join('')}</tbody>`
    : ''
  return { html: `<table class="sm-table">${head}${body}</table>`, nextIndex: i }
}

function renderTextBlock(text) {
  const lines = text.split('\n')
  const html = []
  let inList = false
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      i += 1
      continue
    }

    if (isTableRow(trimmed) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      const table = renderTable(lines, i)
      html.push(table.html)
      i = table.nextIndex
      continue
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      html.push('<hr class="sm-hr" />')
      i += 1
      continue
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      const level = headingMatch[1].length
      const title = headingMatch[2]
      const id = slugifyHeading(title)
      html.push(`<h${level} id="${id}">${inlineFormat(title)}</h${level}>`)
      i += 1
      continue
    }

    if (trimmed.startsWith('> ')) {
      if (inList) {
        html.push('</ul>')
        inList = false
      }
      html.push(`<blockquote class="sm-quote">${inlineFormat(trimmed.slice(2))}</blockquote>`)
      i += 1
      continue
    }

    const listMatch = trimmed.match(/^[-*]\s+(.+)$/)
    if (listMatch) {
      if (!inList) {
        html.push('<ul>')
        inList = true
      }
      html.push(`<li>${inlineFormat(listMatch[1])}</li>`)
      i += 1
      continue
    }

    if (inList) {
      html.push('</ul>')
      inList = false
    }
    html.push(`<p>${inlineFormat(trimmed)}</p>`)
    i += 1
  }

  if (inList) html.push('</ul>')
  return html.join('\n')
}

export function renderSimpleMarkdown(md) {
  if (!md) return ''

  // Normalize CRLF so fence regex works on Windows-checked-out docs
  const source = String(md).replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  const parts = []
  // Allow ```java / ``` / ``` java — language optional; body until closing fence
  const codeBlockRe = /```([^\n`]*)\n([\s\S]*?)```/g
  let lastIndex = 0
  let match

  while ((match = codeBlockRe.exec(source)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: source.slice(lastIndex, match.index) })
    }
    const lang = (match[1] || '').trim()
    parts.push({ type: 'code', lang, content: match[2] })
    lastIndex = codeBlockRe.lastIndex
  }

  if (lastIndex < source.length) {
    parts.push({ type: 'text', content: source.slice(lastIndex) })
  }

  if (!parts.length) {
    parts.push({ type: 'text', content: source })
  }

  return parts
    .map(part => {
      if (part.type === 'code') {
        const langAttr = part.lang ? ` data-lang="${escapeHtml(part.lang)}"` : ''
        return `<pre class="sm-code"${langAttr}><code>${escapeHtml(part.content.replace(/\n$/, ''))}</code></pre>`
      }
      return renderTextBlock(part.content)
    })
    .join('\n')
}
