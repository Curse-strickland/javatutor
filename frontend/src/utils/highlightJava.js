/**
 * Minimal Java syntax highlighter for the algo-knowledge code blocks.
 * Token colors mirror the Monaco "cursor-light" theme in Editor.vue so the
 * rendered ```java``` blocks match the editor's palette.
 *
 *   comment    #14141499 (italic)   annotation #007041
 *   string     #7565CC               type       #005293
 *   keyword    #A30034               default    #141414
 *   number     #92156A
 */

const KEYWORDS = new Set([
  // control flow / declarations
  'abstract', 'assert', 'break', 'case', 'catch', 'class', 'const', 'continue',
  'default', 'do', 'else', 'enum', 'extends', 'final', 'finally', 'for', 'goto',
  'if', 'implements', 'import', 'instanceof', 'interface', 'native', 'new',
  'package', 'private', 'protected', 'public', 'return', 'static', 'strictfp',
  'super', 'switch', 'synchronized', 'this', 'throw', 'throws', 'transient',
  'try', 'volatile', 'while', 'var', 'record', 'sealed', 'yield',
  // primitive types + literals
  'boolean', 'byte', 'char', 'double', 'float', 'int', 'long', 'short', 'void',
  'true', 'false', 'null',
])

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Single pass over the source: each alternative matches one token; gaps between
// matches (operators, punctuation, whitespace) are emitted as plain escaped text.
const TOKEN_RE = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(@[A-Za-z_][A-Za-z0-9_]*)|(\b0[xX][0-9a-fA-F]+\b|\b\d+(?:\.\d+)?[fFlLdD]?\b)|([A-Za-z_][A-Za-z0-9_]*)/g

export function highlightJava(code) {
  let html = ''
  let last = 0
  let m

  TOKEN_RE.lastIndex = 0
  while ((m = TOKEN_RE.exec(code)) !== null) {
    if (m.index > last) html += escapeHtml(code.slice(last, m.index))
    const full = m[0]

    if (m[1]) html += `<span class="tok-comment">${escapeHtml(full)}</span>`
    else if (m[2]) html += `<span class="tok-string">${escapeHtml(full)}</span>`
    else if (m[3]) html += `<span class="tok-annotation">${escapeHtml(full)}</span>`
    else if (m[4]) html += `<span class="tok-number">${escapeHtml(full)}</span>`
    else if (m[5]) {
      const word = m[5]
      if (KEYWORDS.has(word)) html += `<span class="tok-keyword">${escapeHtml(word)}</span>`
      else if (/^[A-Z]/.test(word)) html += `<span class="tok-type">${escapeHtml(word)}</span>`
      else html += escapeHtml(word)
    }

    last = m.index + full.length
  }

  if (last < code.length) html += escapeHtml(code.slice(last))
  return html
}
