import flowSvg from '../assets/uml-fallback/flow.svg?raw'
import dataflowSvg from '../assets/uml-fallback/dataflow.svg?raw'
import structureSvg from '../assets/uml-fallback/structure.svg?raw'
import classSvg from '../assets/uml-fallback/class.svg?raw'
import usecaseSvg from '../assets/uml-fallback/usecase.svg?raw'

/** @type {Record<string, string>} */
export const UML_FALLBACKS = {
  flow: flowSvg,
  dataflow: dataflowSvg,
  structure: structureSvg,
  class: classSvg,
  usecase: usecaseSvg,
}

/** Strip script tags and inline event handlers from trusted/static SVG. */
export function sanitizeSvg(svg) {
  if (!svg || typeof svg !== 'string') return ''
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\s+on\w+="[^"]*"/gi, '')
    .replace(/\s+on\w+='[^']*'/gi, '')
}

export function getStaticFallback(kind) {
  return sanitizeSvg(UML_FALLBACKS[kind] || UML_FALLBACKS.flow)
}
