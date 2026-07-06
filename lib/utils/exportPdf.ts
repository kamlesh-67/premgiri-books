/**
 * lib/utils/exportPdf.ts — Client-side PDF export via html2canvas + jsPDF.
 *
 * Rasterizes already-rendered DOM elements into a multi-page A4 PDF. No
 * server round-trip — sidesteps @react-pdf/renderer's reconciler entirely
 * (avoids the "React error #31" incompatibility in this app's React version).
 *
 * Two capture modes:
 *  - exportElementToPDF: single element, sliced into as many A4 pages as its
 *    rendered height requires (used for simple, non-paginated content).
 *  - exportPagesToPDF: one element PER page (used by the invoice print
 *    template, which pre-splits line items into page-sized chunks so each
 *    page can repeat its own footer/GST-summary correctly).
 */

async function loadPdfLibs() {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])
  return { html2canvas, jsPDF }
}

/**
 * Renders the DOM element with the given id to a downloadable PDF file,
 * slicing its captured image across as many A4 pages as needed.
 */
export async function exportElementToPDF(elementId: string, filename: string): Promise<void> {
  const element = document.getElementById(elementId)
  if (!element) throw new Error(`Element #${elementId} not found`)

  const { html2canvas, jsPDF } = await loadPdfLibs()

  const canvas = await html2canvas(element, {
    scale: 2.5,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  })

  const imgData = canvas.toDataURL('image/png')

  // A4 portrait: 210mm x 297mm
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const imgWidth = 210
  const pageHeight = 297
  const imgHeight = (canvas.height * imgWidth) / canvas.width
  let heightLeft = imgHeight
  let position = 0

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST')
  heightLeft -= pageHeight

  while (heightLeft >= 0) {
    position = heightLeft - imgHeight
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST')
    heightLeft -= pageHeight
  }

  pdf.save(filename)
}

/**
 * Renders a list of DOM elements (one per PDF page) into a single multi-page
 * PDF — each element becomes exactly one A4 page, scaled to fit.
 */
export async function exportPagesToPDF(elementIds: string[], filename: string): Promise<void> {
  if (elementIds.length === 0) throw new Error('No pages to export')

  const { html2canvas, jsPDF } = await loadPdfLibs()
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidthMm = 210
  const pageHeightMm = 297

  for (let i = 0; i < elementIds.length; i++) {
    const element = document.getElementById(elementIds[i])
    if (!element) throw new Error(`Element #${elementIds[i]} not found`)

    const canvas = await html2canvas(element, {
      scale: 2.5,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    })
    const imgData = canvas.toDataURL('image/png')
    const imgHeightMm = (canvas.height * pageWidthMm) / canvas.width

    if (i > 0) pdf.addPage()
    pdf.addImage(imgData, 'PNG', 0, 0, pageWidthMm, Math.min(imgHeightMm, pageHeightMm), undefined, 'FAST')
  }

  pdf.save(filename)
}

/**
 * Opens the browser's native print dialog for the given element by
 * temporarily rendering it into a hidden iframe with a minimal print stylesheet.
 */
export function printElement(elementId: string): void {
  printElements([elementId])
}

/**
 * Opens the browser's native print dialog for a list of elements, each
 * rendered as its own page (CSS page-break-after between them).
 */
export function printElements(elementIds: string[]): void {
  const elements = elementIds.map((id) => {
    const el = document.getElementById(id)
    if (!el) throw new Error(`Element #${id} not found`)
    return el
  })

  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument
  if (!doc) {
    document.body.removeChild(iframe)
    throw new Error('Could not access print iframe document')
  }

  // Clone the app's stylesheets (Tailwind + globals) into the iframe so utility
  // classes in the printed element actually render — outerHTML alone carries no CSS.
  const styleTags = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((node) => node.outerHTML)
    .join('\n')

  const pagesHtml = elements
    .map((el, idx) => `<div style="${idx < elements.length - 1 ? 'page-break-after: always;' : ''}">${el.outerHTML}</div>`)
    .join('\n')

  doc.open()
  doc.write(`<!DOCTYPE html><html><head><title>Print</title>
    ${styleTags}
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; font-family: system-ui, -apple-system, sans-serif; }
      @page { size: A4; margin: 12mm; }
    </style>
    </head><body>${pagesHtml}</body></html>`)
  doc.close()

  iframe.onload = () => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    setTimeout(() => document.body.removeChild(iframe), 1000)
  }
}
