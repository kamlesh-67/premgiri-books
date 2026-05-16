"use client";
import { MoneyMoveList } from "@/components/voucher/MoneyMoveList";

export default function PaymentPage() {
  return (
    <MoneyMoveList
      kind="payments"
      title="Payments"
      subtitle="Money paid to suppliers and others."
      partyLabel="Payee"
    />
  );
}
