import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";
import { Decimal } from "decimal.js";

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "All";
    const q = searchParams.get("q") || "";

    const companyId = session.companyId;
    if (!companyId) throw new Error("Company ID is required");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { companyId, voucherType: "SALES" };
    if (status !== "All") where.status = status.toUpperCase();
    if (q) {
      where.OR = [
        { voucherNo: { contains: q } },
        { partyLedger: { name: { contains: q } } },
      ];
    }

    const vouchers = await prisma.voucher.findMany({
      where,
      include: {
        partyLedger: { select: { name: true } },
        billRefs: { select: { outstandingAmount: true } },
      },
      orderBy: { date: "desc" },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sales Invoices");

    worksheet.columns = [
      { header: "Invoice No", key: "voucherNo", width: 20 },
      { header: "Date", key: "date", width: 15 },
      { header: "Customer", key: "customer", width: 30 },
      { header: "Taxable", key: "taxable", width: 15 },
      { header: "GST", key: "gst", width: 15 },
      { header: "Total", key: "total", width: 15 },
      { header: "Outstanding", key: "outstanding", width: 15 },
      { header: "Status", key: "status", width: 15 },
    ];

    vouchers.forEach((v) => {
      const total = new Decimal(v.totalAmount.toString()).toNumber();
      const cgst = new Decimal(v.cgstAmount.toString()).toNumber();
      const sgst = new Decimal(v.sgstAmount.toString()).toNumber();
      const igst = new Decimal(v.igstAmount.toString()).toNumber();
      const taxable = total - cgst - sgst - igst;
      const gst = cgst + sgst + igst;
      const outstanding = v.billRefs.reduce((s, br) => s + new Decimal(br.outstandingAmount.toString()).toNumber(), 0);

      worksheet.addRow({
        voucherNo: v.voucherNo,
        date: v.date.toISOString().split("T")[0],
        customer: v.partyLedger?.name || "—",
        taxable,
        gst,
        total,
        outstanding,
        status: v.status,
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Sales_Invoices.xlsx"`,
      },
    });
  } catch (error: unknown) {
    console.error("Export error:", error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
