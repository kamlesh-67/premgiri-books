"use client";

/**
 * InvoicePrintTemplate.tsx
 *
 * Formal print/PDF layout for sales invoices, styled after a commercial
 * invoice template (dark header band, two-column party info, bordered
 * items table, bank/terms footer) — adapted to Indian GST fields
 * (GSTIN, HSN, CGST/SGST/IGST) instead of export-shipment fields.
 *
 * Paginated: renders one fixed-height A4 page div per chunk from
 * paginateInvoiceItems(). GST summary + totals repeat on every page;
 * amount-in-words, terms, and signature appear only on the last page,
 * bottom-aligned. Each page div gets a unique id (`${idPrefix}-page-{n}`)
 * so lib/utils/exportPdf.ts can capture them individually.
 */
import { Decimal } from "decimal.js";
import { ToWords } from "to-words";
import { formatINR } from "@/lib/utils/format";
import { paginateInvoiceItems } from "@/lib/utils/paginateInvoiceItems";

const toWords = new ToWords({
  localeCode: "en-IN",
  converterOptions: {
    currency: true,
    ignoreDecimal: false,
    currencyOptions: {
      name: "Rupee",
      plural: "Rupees",
      symbol: "₹",
      fractionalUnit: { name: "Paise", plural: "Paise", symbol: "p" },
    },
  },
});

export type InvoiceCopyLabel = "Original Copy" | "Transport Copy";

interface PrintVoucherItem {
  id: string;
  item: { name: string };
  hsnCode?: string | null;
  qty: string;
  rate: string;
  amount: string;
  unit?: string | null;
  discountPct?: string | null;
  discountAmt?: string | null;
  cgstRate?: string | null;
  sgstRate?: string | null;
  igstRate?: string | null;
  cgstAmt?: string | null;
  sgstAmt?: string | null;
  igstAmt?: string | null;
}

interface PrintVoucher {
  voucherNo: string;
  voucherType: string;
  date: string;
  status: string;
  totalAmount: string;
  cgstAmount: string;
  sgstAmount: string;
  igstAmount: string;
  roundOff: string;
  narration?: string | null;
  placeOfSupply?: string | null;
  billingAddress?: string | null;
  shippingAddress?: string | null;
  partyLedger?: { name: string; gstin?: string | null; address?: string | null } | null;
  voucherItems: PrintVoucherItem[];
}

interface PrintBankAccount {
  bankName: string | null;
  bankAccount: string | null;
  ifsc: string | null;
}

interface PrintCompany {
  name: string;
  gstin?: string | null;
  address?: string | null;
  defaultBankAccount?: PrintBankAccount | null;
}

interface InvoicePrintTemplateProps {
  idPrefix: string;
  voucher: PrintVoucher;
  company?: PrintCompany | null;
  copyLabel: InvoiceCopyLabel;
}

const DEFAULT_PLACE_OF_SUPPLY = "Sardarshahar";

/**
 * Walk-in sales record customer name/mobile in the narration as
 * "Walk-in (Name: X, Mobile: Y). ..." (see InvoiceForm.tsx / sales-invoice
 * wizard) since there's no dedicated ledger per walk-in customer. Parsed
 * back out here so the PDF can show it under Billed To.
 */
function parseWalkInDetails(narration?: string | null): { name?: string; mobile?: string } {
  if (!narration) return {};
  const match = narration.match(/^Walk-in \(([^)]*)\)/);
  if (!match) return {};
  const details: { name?: string; mobile?: string } = {};
  for (const part of match[1].split(",")) {
    const [key, ...rest] = part.split(":");
    const value = rest.join(":").trim();
    if (!value) continue;
    if (key.trim() === "Name") details.name = value;
    if (key.trim() === "Mobile") details.mobile = value;
  }
  return details;
}

function formatDate(dateStr: string): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function InvoicePrintTemplate({ idPrefix, voucher, company, copyLabel }: InvoicePrintTemplateProps) {
  const cgst = new Decimal(voucher.cgstAmount || "0");
  const sgst = new Decimal(voucher.sgstAmount || "0");
  const igst = new Decimal(voucher.igstAmount || "0");
  const roundOff = new Decimal(voucher.roundOff || "0");
  const total = new Decimal(voucher.totalAmount || "0");
  const taxable = total.minus(cgst).minus(sgst).minus(igst).minus(roundOff);
  const isIntraState = cgst.gt(0);
  const amountInWords = toWords.convert(total.toNumber());
  const placeOfSupply = voucher.placeOfSupply || DEFAULT_PLACE_OF_SUPPLY;
  const bank = company?.defaultBankAccount;
  const totalQty = voucher.voucherItems.reduce(
    (sum, item) => sum.plus(new Decimal(item.qty || "0")),
    new Decimal(0)
  );
  const commonUnit = voucher.voucherItems[0]?.unit || "PCS";
  const walkIn = parseWalkInDetails(voucher.narration);

  const pages = paginateInvoiceItems(voucher.voucherItems);

  return (
    <>
      {pages.map((page) => (
        <div
          key={page.pageNumber}
          id={`${idPrefix}-page-${page.pageNumber}`}
          className="bg-white text-[#222222] flex flex-col p-3"
          style={{
            width: "794px",
            height: "1123px", // A4 at 96dpi — fixed so footers bottom-align reliably
            fontFamily: "Arial, Helvetica, sans-serif",
          }}
        >
          {/* ── Outer bordered box (reference layout) ── */}
          <div className="border-2 border-black flex flex-col flex-1 min-h-0">
            {/* ── Top corners: GSTIN left, copy label right ── */}
            <div className="flex items-start justify-between px-4 pt-2">
              <p className="text-[10px]">
                {company?.gstin ? <>GSTIN : {company.gstin}</> : <>&nbsp;</>}
              </p>
              <p className="text-[9px] font-medium">{copyLabel}</p>
            </div>

            {/* ── TAX INVOICE centered, company name centered below ── */}
            <div className="text-center px-4 pb-2 border-b border-black">
              <p className="text-xs font-semibold underline">
                {voucher.voucherType === "SALES" ? "TAX INVOICE" : voucher.voucherType.replace("_", " ")}
              </p>
              <p className="text-xl font-bold tracking-wide mt-0.5">{company?.name ?? "Your Company"}</p>
              {company?.address && <p className="text-[10px] mt-0.5">{company.address}</p>}
              {page.totalPages > 1 && (
                <p className="text-[9px] mt-0.5 text-gray-600">
                  Page {page.pageNumber} of {page.totalPages}
                </p>
              )}
            </div>

            <div className="px-4 pt-2 flex flex-col flex-1 min-h-0">
              {/* ── Invoice meta row ── */}
              <div className="grid grid-cols-2 gap-x-4 pb-2 mb-2 border-b border-black text-xs">
                <div className="space-y-0.5">
                  <p><span className="text-gray-600">Invoice No.</span> : <span className="font-medium">{voucher.voucherNo}</span></p>
                  <p><span className="text-gray-600">Dated</span> : <span className="font-medium">{formatDate(voucher.date)}</span></p>
                  <p><span className="text-gray-600">Place of Supply</span> : <span className="font-medium">{placeOfSupply}</span></p>
                </div>
                <div className="space-y-0.5">
                  <p><span className="text-gray-600">Transport</span> : <span className="font-medium">&nbsp;</span></p>
                  <p><span className="text-gray-600">Vehicle No.</span> : <span className="font-medium">&nbsp;</span></p>
                  <p><span className="text-gray-600">Terms of Payment</span> : <span className="font-medium">&nbsp;</span></p>
                </div>
              </div>

              {/* ── Billed To / Shipped To — left empty if no value present ── */}
              <div className="grid grid-cols-2 gap-x-4 pb-2 mb-2 border-b border-black text-xs">
                <div>
                  <p className="font-semibold">Billed to :</p>
                  <p className="mt-0.5">{walkIn.name || voucher.partyLedger?.name || ""}</p>
                  {(voucher.billingAddress || voucher.partyLedger?.address) && (
                    <p className="mt-0.5">{voucher.billingAddress || voucher.partyLedger?.address}</p>
                  )}
                  {walkIn.mobile && <p className="mt-0.5">Mobile : {walkIn.mobile}</p>}
                  <p className="mt-0.5">
                    {voucher.partyLedger?.gstin ? <>GSTIN/UIN : {voucher.partyLedger.gstin}</> : <>GSTIN/UIN : </>}
                  </p>
                </div>
                <div>
                  <p className="font-semibold">Shipped to :</p>
                  <p className="mt-0.5">{walkIn.name || voucher.partyLedger?.name || ""}</p>
                  {(voucher.shippingAddress || voucher.billingAddress || voucher.partyLedger?.address) && (
                    <p className="mt-0.5">
                      {voucher.shippingAddress || voucher.billingAddress || voucher.partyLedger?.address}
                    </p>
                  )}
                  {walkIn.mobile && <p className="mt-0.5">Mobile : {walkIn.mobile}</p>}
                </div>
              </div>

              {/* ── Line items table for this page ── */}
              <table className="w-full text-[11px] border-collapse mb-2">
                <thead>
                  <tr className="border-y border-black">
                    <th className="text-left font-semibold py-1 px-1.5 border-r border-black">S.N.</th>
                    <th className="text-left font-semibold py-1 px-1.5 border-r border-black">Description of Goods</th>
                    <th className="text-left font-semibold py-1 px-1.5 border-r border-black">HSN/SAC<br/>Code</th>
                    <th className="text-right font-semibold py-1 px-1.5 border-r border-black">Qty.</th>
                    <th className="text-left font-semibold py-1 px-1.5 border-r border-black">Unit</th>
                    <th className="text-right font-semibold py-1 px-1.5 border-r border-black">List Price</th>
                    <th className="text-right font-semibold py-1 px-1.5 border-r border-black">Discount</th>
                    <th className="text-right font-semibold py-1 px-1.5 border-r border-black">Price</th>
                    <th className="text-right font-semibold py-1 px-1.5">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {page.items.map((item, idxOnPage) => {
                    const serialNo =
                      pages.slice(0, page.pageNumber - 1).reduce((s, p) => s + p.items.length, 0) + idxOnPage + 1;
                    const listPrice = new Decimal(item.rate || "0");
                    const qty = new Decimal(item.qty || "0");
                    const discountAmt = new Decimal(item.discountAmt || "0");
                    const perUnitDiscount = qty.gt(0) ? discountAmt.div(qty) : new Decimal(0);
                    const price = listPrice.minus(perUnitDiscount);
                    return (
                      <tr key={item.id}>
                        <td className="py-1 px-1.5 border-r border-black">{serialNo}.</td>
                        <td className="py-1 px-1.5 border-r border-black">{item.item.name}</td>
                        <td className="py-1 px-1.5 border-r border-black">{item.hsnCode || ""}</td>
                        <td className="py-1 px-1.5 border-r border-black text-right">{item.qty}</td>
                        <td className="py-1 px-1.5 border-r border-black">{item.unit || "PCS"}</td>
                        <td className="py-1 px-1.5 border-r border-black text-right">{listPrice.toFixed(2)}</td>
                        <td className="py-1 px-1.5 border-r border-black text-right">
                          {discountAmt.gt(0) ? discountAmt.toFixed(2) : "0.00"} %
                        </td>
                        <td className="py-1 px-1.5 border-r border-black text-right">{price.toFixed(2)}</td>
                        <td className="py-1 px-1.5 text-right font-medium">{formatINR(item.amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                {page.isLastPage && (
                  <tfoot>
                    <tr className="border-t border-black">
                      <td className="py-1 px-1.5 border-r border-black font-semibold" colSpan={3}>
                        Total
                      </td>
                      <td className="py-1 px-1.5 border-r border-black text-right font-semibold">
                        {totalQty.toString()}
                      </td>
                      <td className="py-1 px-1.5 border-r border-black font-semibold">{commonUnit}</td>
                      <td className="py-1 px-1.5 border-r border-black" colSpan={3} />
                      <td className="py-1 px-1.5 text-right font-semibold">{formatINR(total.toFixed(2))}</td>
                    </tr>
                  </tfoot>
                )}
              </table>

              {/* ── Spacer pushes the footer to the bottom of the fixed-height page ── */}
              <div className="flex-1 min-h-0" />

              {/* ── GST summary + totals — repeats on every page ── */}
              <div className="flex justify-end mb-2 border-t border-black pt-1">
                <div className="w-64 shrink-0 text-xs">
                  <div className="flex justify-between py-0.5">
                    <span>Subtotal (Taxable Value)</span>
                    <span className="font-medium">{formatINR(taxable.toFixed(2))}</span>
                  </div>
                  {isIntraState ? (
                    <>
                      <div className="flex justify-between py-0.5">
                        <span>Add : CGST</span>
                        <span className="font-medium">{formatINR(cgst.toFixed(2))}</span>
                      </div>
                      <div className="flex justify-between py-0.5">
                        <span>Add : SGST</span>
                        <span className="font-medium">{formatINR(sgst.toFixed(2))}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between py-0.5">
                      <span>Add : IGST</span>
                      <span className="font-medium">{formatINR(igst.toFixed(2))}</span>
                    </div>
                  )}
                  {!roundOff.isZero() && (
                    <div className="flex justify-between py-0.5">
                      <span>{roundOff.isNegative() ? "Less" : "Add"} : Rounded Off ({roundOff.isNegative() ? "-" : "+"})</span>
                      <span className="font-medium">{formatINR(roundOff.abs().toFixed(2))}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold pt-1 mt-1 border-t border-black">
                    <span>Grand Total</span>
                    <span>{formatINR(total.toFixed(2))}</span>
                  </div>
                </div>
              </div>

              {/* ── Last page only: amount in words, bank details, terms, signature ── */}
              {page.isLastPage && (
                <>
                  <div className="pt-1.5 mb-2 border-t border-black text-xs">
                    <p className="font-semibold">Rupees {amountInWords}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 pt-1.5 mb-2 border-t border-black text-xs">
                    <div>
                      <p className="font-semibold mb-0.5">Bank Details :</p>
                      {bank?.bankName ? (
                        <div className="text-[11px] space-y-0.5">
                          <p>{bank.bankName} - IFSC Code-{bank.ifsc}</p>
                          <p>Account Number - {bank.bankAccount}</p>
                        </div>
                      ) : (
                        <p className="text-[11px] text-gray-400">—</p>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold mb-0.5">Terms & Conditions</p>
                      <ul className="text-[10px] list-none space-y-0.5">
                        <li>E. &amp; O.E.</li>
                        <li>1. Goods once sold will not be taken back.</li>
                        <li>2. Interest @ 18% p.a. will be charged if the payment is not made with in the stipulated time.</li>
                        <li>3. Subject to &apos;{placeOfSupply}&apos; Jurisdiction only.</li>
                      </ul>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 pt-1.5 border-t border-black text-xs pb-2">
                    <div>
                      <p className="font-medium">Receiver&apos;s Signature :</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">for {company?.name ?? "Your Company"}</p>
                      <p className="mt-8">Authorised Signatory</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
