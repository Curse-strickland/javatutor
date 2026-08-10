const TYPE_KEYWORDS = new Set([
  'class', 'interface', 'enum', 'public', 'private', 'protected', 'static',
  'final', 'abstract', 'void', 'int', 'long', 'double', 'float', 'boolean',
  'char', 'byte', 'short', 'String', 'new', 'return', 'if', 'else', 'for',
  'while', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'throw',
  'extends', 'implements', 'import', 'package', 'this', 'super', 'null',
  'true', 'false', 'var',
])

const CLASS_DECL_RE = /\b(class|interface|enum)\s+(\w+)/g
const FIELD_RE = /\b(?:public|private|protected)\s+(?:static\s+)?(?:final\s+)?([\w<>,\[\].?]+)\s+(\w+)\s*(?:=|;)/
const METHOD_RE = /\b(?:public|private|protected)\s+(?:static\s+)?(?:[\w<>,\[\].?]+\s+)+(\w+)\s*\([^)]*\)\s*(?:\{|;)/

function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
}

/**
 * Split source into class blocks keyed by type name.
 * @param {string} code
 */
function splitClassBlocks(code) {
  const cleaned = stripComments(code)
  const blocks = []
  let match

  while ((match = CLASS_DECL_RE.exec(cleaned)) !== null) {
    const kind = match[1]
    const name = match[2]
    if (TYPE_KEYWORDS.has(name)) continue

    const bodyStart = cleaned.indexOf('{', match.index)
    if (bodyStart < 0) continue

    let depth = 0
    let bodyEnd = -1
    for (let i = bodyStart; i < cleaned.length; i++) {
      if (cleaned[i] === '{') depth++
      else if (cleaned[i] === '}') {
        depth--
        if (depth === 0) {
          bodyEnd = i
          break
        }
      }
    }
    if (bodyEnd < 0) continue

    blocks.push({
      kind,
      name,
      body: cleaned.slice(bodyStart + 1, bodyEnd),
    })
  }

  return blocks
}

function extractMembers(body) {
  const fields = []
  const methods = []
  const lines = body.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('@')) continue

    const fieldMatch = trimmed.match(FIELD_RE)
    if (fieldMatch && !trimmed.includes('(')) {
      const typeName = fieldMatch[1]
      const fieldName = fieldMatch[2]
      if (!TYPE_KEYWORDS.has(fieldName) && fields.length < 8) {
        fields.push(`${fieldName}: ${typeName}`)
      }
      continue
    }

    const methodMatch = trimmed.match(METHOD_RE)
    if (methodMatch) {
      const methodName = methodMatch[1]
      if (!TYPE_KEYWORDS.has(methodName) && methods.length < 8) {
        if (!methods.includes(`${methodName}()`)) methods.push(`${methodName}()`)
      }
    }
  }

  return { fields, methods }
}

/**
 * Naive Java type extractor from source text.
 * @param {string} code
 * @param {string} [fileName]
 */
export function parseJavaClasses(code, fileName = 'Unknown.java') {
  if (!code || typeof code !== 'string') return []

  const blocks = splitClassBlocks(code)
  return blocks.map(({ kind, name, body }) => {
    const { fields, methods } = extractMembers(body)
    return { kind, name, fileName, fields, methods }
  })
}

/**
 * @param {Array<{ name: string, code: string }>} files
 * @returns {string} SVG string
 */
export function generateClassDiagramSvg(files) {
  const allClasses = []
  for (const file of files || []) {
    allClasses.push(...parseJavaClasses(file.code, file.name))
  }

  if (!allClasses.length) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 120" font-family="ui-monospace, monospace">
      <rect width="320" height="120" fill="#f8fafb" stroke="#0d9ec4"/>
      <text x="160" y="60" text-anchor="middle" fill="#64748b" font-size="12">未识别到类 / 接口</text>
    </svg>`
  }

  const boxW = 160
  const headerH = 28
  const lineH = 16
  const pad = 8
  const gapX = 24
  const gapY = 20
  const cols = Math.min(3, allClasses.length)
  const rows = Math.ceil(allClasses.length / cols)

  const boxHeights = allClasses.map((cls) => {
    const bodyLines = Math.min(cls.fields.length, 4) + Math.min(cls.methods.length, 4)
    return headerH + pad * 2 + Math.max(bodyLines, 1) * lineH + 8
  })

  const rowHeights = []
  for (let r = 0; r < rows; r++) {
    let maxH = 0
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c
      if (idx < allClasses.length) maxH = Math.max(maxH, boxHeights[idx])
    }
    rowHeights.push(maxH)
  }

  const width = cols * boxW + (cols + 1) * gapX
  let height = gapY
  for (const h of rowHeights) height += h + gapY
  height = Math.max(height, 120)

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" font-family="ui-monospace, monospace">`,
    `<rect width="${width}" height="${height}" fill="#f8fafb" stroke="#0d9ec4" stroke-width="1"/>`,
    `<text x="${width / 2}" y="18" text-anchor="middle" fill="#12161d" font-size="12" font-weight="700">类图 · 静态解析</text>`,
  ]

  let yOffset = gapY + 10
  allClasses.forEach((cls, idx) => {
    const col = idx % cols
    const row = Math.floor(idx / cols)
    const x = gapX + col * (boxW + gapX)
    let y = yOffset
    for (let r = 0; r < row; r++) y += rowHeights[r] + gapY
    const boxH = boxHeights[idx]

    const stereotype = cls.kind === 'interface' ? '«interface»' : cls.kind === 'enum' ? '«enum»' : '«class»'
    parts.push(`<rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" fill="#fff" stroke="#2778c1"/>`)
    parts.push(`<text x="${x + boxW / 2}" y="${y + 18}" text-anchor="middle" fill="#12161d" font-size="11" font-weight="700">${stereotype} ${escapeXml(cls.name)}</text>`)
    parts.push(`<line x1="${x}" y1="${y + headerH}" x2="${x + boxW}" y2="${y + headerH}" stroke="#2778c1"/>`)

    let ly = y + headerH + pad + 12
    for (const field of cls.fields.slice(0, 4)) {
      parts.push(`<text x="${x + pad}" y="${ly}" fill="#64748b" font-size="10">- ${escapeXml(field)}</text>`)
      ly += lineH
    }
    if (cls.fields.length || cls.methods.length) {
      parts.push(`<line x1="${x}" y1="${ly - 4}" x2="${x + boxW}" y2="${ly - 4}" stroke="#2778c1" opacity="0.5"/>`)
    }
    for (const method of cls.methods.slice(0, 4)) {
      parts.push(`<text x="${x + pad}" y="${ly + 4}" fill="#64748b" font-size="10">+ ${escapeXml(method)}</text>`)
      ly += lineH
    }
  })

  parts.push('</svg>')
  return parts.join('\n')
}

function escapeXml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
