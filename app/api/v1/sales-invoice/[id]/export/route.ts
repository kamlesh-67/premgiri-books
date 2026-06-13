import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { Decimal } from "decimal.js";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const companyId = session.companyId;
    const { id } = await params;

    const voucher = await prisma.voucher.findFirst({
      where: { id, companyId, voucherType: "SALES" },
      include: {
        partyLedger: { select: { name: true, gstin: true } },
        voucherItems: {
          include: {
            item: { select: { name: true } },
          },
        },
      },
    });

    if (!voucher) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const workbook = new ExcelJS.Workbook();
    const sheetName = `Invoice ${voucher.voucherNo}`.replace(/[*?:\/\\\[\]]/g, "-");
    const worksheet = workbook.addWorksheet(sheetName);

    // Header info
    worksheet.mergeCells("A1:F1");
    worksheet.getCell("A1").value = `Sales Invoice: ${voucher.voucherNo}`;
    worksheet.getCell("A1").font = { bold: true, size: 14 };

    worksheet.addRow(["Date", voucher.date.toISOString().split("T")[0]]);
    worksheet.addRow(["Customer", voucher.partyLedger?.name || "—"]);
    worksheet.addRow(["GSTIN", voucher.partyLedger?.gstin || "—"]);
    worksheet.addRow([]);

    // Table Header
    const headerRow = worksheet.addRow([
      "Sr No",
      "Item Description",
      "HSN",
      "Qty",
      "Rate",
      "Taxable",
      "CGST",
      "SGST",
      "IGST",
      "Total",
    ]);
    headerRow.font = { bold: true };

    // Line Items
    voucher.voucherItems.forEach((item, index) => {
      const taxable = new Decimal(item.amount.toString()).toNumber();
      const cgst = new Decimal((item.cgstAmt ?? 0).toString()).toNumber();
      const sgst = new Decimal((item.sgstAmt ?? 0).toString()).toNumber();
      const igst = new Decimal((item.igstAmt ?? 0).toString()).toNumber();
      const total = taxable + cgst + sgst + igst;

      worksheet.addRow([
        index + 1,
        item.item.name,
        item.hsnCode || "—",
        new Decimal(item.qty.toString()).toNumber(),
        new Decimal(item.rate.toString()).toNumber(),
        taxable,
        cgst,
        sgst,
        igst,
        total,
      ]);
    });

    worksheet.addRow([]);
    
    // Totals
    const cgstTotal = new Decimal(voucher.cgstAmount.toString()).toNumber();
    const sgstTotal = new Decimal(voucher.sgstAmount.toString()).toNumber();
    const igstTotal = new Decimal(voucher.igstAmount.toString()).toNumber();
    const totalAmount = new Decimal(voucher.totalAmount.toString()).toNumber();
    const roundOff = new Decimal((voucher.roundOff ?? 0).toString()).toNumber();

    worksheet.addRow(["", "", "", "", "", "CGST Total", cgstTotal]);
    worksheet.addRow(["", "", "", "", "", "SGST Total", sgstTotal]);
    worksheet.addRow(["", "", "", "", "", "IGST Total", igstTotal]);
    worksheet.addRow(["", "", "", "", "", "Round Off", roundOff]);
    const grandTotalRow = worksheet.addRow(["", "", "", "", "", "Grand Total", totalAmount]);
    grandTotalRow.font = { bold: true };

    // Styling
    worksheet.getColumn(2).width = 30;
    worksheet.getColumn(6).width = 15;
    worksheet.getColumn(10).width = 15;

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Invoice_${voucher.voucherNo}.xlsx"`,
      },
    });
  } catch (error: unknown) {
    console.error("Export error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
