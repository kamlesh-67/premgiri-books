"use client";
import { MoneyMoveList } from "@/components/voucher/MoneyMoveList";

export default function ReceiptPage() {
  return (
    <MoneyMoveList
      kind="receipts"
      title="Receipts"
      subtitle="Money received from customers."
      partyLabel="Customer"
    />
  );
}
