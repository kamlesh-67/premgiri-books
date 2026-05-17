import { MoneyMoveList } from "./MoneyMoveList";
export default function Receipt() {
  return <MoneyMoveList title="Receipts" subtitle="Money received from customers." partyLabel="Customer" kind="receipts" />;
}
