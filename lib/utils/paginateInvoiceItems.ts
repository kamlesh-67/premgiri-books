/**
 * lib/utils/paginateInvoiceItems.ts
 *
 * Splits invoice line items into fixed-size page chunks for the print/PDF
 * template. A fixed row count per page (rather than measuring live DOM
 * height) keeps pagination deterministic — every page renders identically
 * regardless of font-loading timing or browser zoom, which matters since
 * html2canvas captures each page as a separate raster image.
 */

// Conservative row counts tuned for A4 portrait at the print template's font
// sizes: page 1 has more room (no terms/signature block), later pages assume
// the same GST-summary footer repeats, and the last page also carries
// amount-in-words + terms + signature, so it fits fewer rows than the others.
const FIRST_PAGE_ROWS = 14
const MIDDLE_PAGE_ROWS = 18
const LAST_PAGE_ROWS = 10

export interface InvoicePage<T> {
  items: T[];
  pageNumber: number;
  totalPages: number;
  isLastPage: boolean;
}

/**
 * Splits `items` into pages. If everything fits on one page (<= FIRST_PAGE_ROWS
 * when there's only one page), that single page is treated as both first and
 * last — it gets the full footer (GST summary + terms + signature + amount in words).
 */
export function paginateInvoiceItems<T>(items: T[]): InvoicePage<T>[] {
  if (items.length <= FIRST_PAGE_ROWS) {
    return [{ items, pageNumber: 1, totalPages: 1, isLastPage: true }]
  }

  // Multi-page: page 1 gets FIRST_PAGE_ROWS, then repeatedly consume
  // MIDDLE_PAGE_ROWS until what's left fits within LAST_PAGE_ROWS.
  const chunks: T[][] = []
  let remaining = items.slice()

  chunks.push(remaining.slice(0, FIRST_PAGE_ROWS))
  remaining = remaining.slice(FIRST_PAGE_ROWS)

  while (remaining.length > LAST_PAGE_ROWS) {
    chunks.push(remaining.slice(0, MIDDLE_PAGE_ROWS))
    remaining = remaining.slice(MIDDLE_PAGE_ROWS)
  }
  chunks.push(remaining)

  const totalPages = chunks.length
  return chunks.map((pageItems, idx) => ({
    items: pageItems,
    pageNumber: idx + 1,
    totalPages,
    isLastPage: idx === totalPages - 1,
  }))
}

/**
 * Returns the page element ids (`${idPrefix}-page-{n}`) that InvoicePrintTemplate
 * will render for `itemCount` line items — without importing the template itself
 * (which pulls in the much larger `to-words` dependency). Callers use this to
 * drive exportPagesToPDF/printElements before the template has necessarily loaded.
 */
export function getInvoicePrintPageIds(idPrefix: string, itemCount: number): string[] {
  const pages = paginateInvoiceItems(new Array(itemCount).fill(null))
  return pages.map((p) => `${idPrefix}-page-${p.pageNumber}`)
}
